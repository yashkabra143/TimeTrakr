// Upwork sync planner. Pure: takes what the sync agent fetched from Upwork plus
// the user's current TimeTrakr rows and works out what to change. No DB access,
// so it can be unit-tested and used for dry runs.
import { z } from "zod";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const upworkSyncSchema = z.object({
  // Days covered by `timesheets`. Synced entries inside this window that Upwork
  // no longer reports are deleted (Upwork wins).
  from: ymd,
  to: ymd,
  // One row per Upwork timesheet line (contractTimeReport node).
  timesheets: z.array(z.object({
    contractId: z.string().min(1).max(40),
    contractTitle: z.string().max(500).default(""),
    date: ymd,                          // dateWorkedOn
    hours: z.number().min(0).max(24),   // totalHoursWorked
    charges: z.number().min(0),         // totalCharges (USD)
  })).max(2000),
  // Upwork transactions with accountingSubtype "Withdrawal".
  withdrawals: z.array(z.object({
    recordId: z.string().min(1).max(40),
    date: ymd,                          // transactionCreationDate (UTC day)
    amount: z.number().positive(),      // amount sent to the bank (USD)
    fee: z.number().min(0).max(50).default(0), // matching "Withdrawal Fee" row
    status: z.string().max(40).optional(),     // paymentStatus, e.g. SUCCESS
  })).max(500).default([]),
  availableBalance: z.number().min(0).optional(), // available_balance → available_now
  dryRun: z.boolean().default(false),
}).superRefine((d, ctx) => {
  if (d.from > d.to) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "from is after to", path: ["from"] });
  const span = (Date.parse(d.to) - Date.parse(d.from)) / 86_400_000;
  if (span > 62) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Window is longer than 62 days", path: ["to"] });
  d.timesheets.forEach((t, i) => {
    if (t.date < d.from || t.date > d.to) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Timesheet date ${t.date} is outside ${d.from}..${d.to}`, path: ["timesheets", i, "date"] });
    }
  });
});

export type UpworkSyncInput = z.infer<typeof upworkSyncSchema>;

export interface PlanProject { id: string; name: string; rate: number; upworkContractId: string | null }
export interface PlanEntry { id: string; projectId: string; minutes: number; grossUsd: number; date: Date; externalId: string | null }
export interface PlanWithdrawal {
  id: string; withdrawalAmount: number; netEarnings: number; withdrawalDate: Date;
  paymentStatus: string; notes: string | null; externalId: string | null;
}

export interface SyncPlan {
  newProjects: { contractId: string; name: string; rate: number }[];
  entryInserts: { contractId: string; contractTitle: string; date: string; minutes: number; rate: number; externalId: string }[];
  entryUpdates: { id: string; contractTitle: string; date: string; minutes: number; rate: number; externalId: string; fromMinutes: number }[];
  entryAdopts: { id: string; externalId: string; date: string }[];
  entryDeletes: { id: string; date: string; minutes: number }[];
  conflicts: { date: string; project: string; upworkMinutes: number; timetrakrMinutes: number; reason: string }[];
  withdrawalInserts: { externalId: string; recordId: string; date: string; amount: number; fee: number; paymentStatus: string }[];
  withdrawalUpdates: { id: string; externalId: string; paymentStatus: string; date: string; amount: number }[];
  unchanged: { entries: number; withdrawals: number };
}

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

/** Calendar day in India for a stored timestamp (entries are saved at 00:00 UTC or IST midnight). */
export function istDay(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** IST midnight of a YYYY-MM-DD day, as the client and earlier syncs store it. */
export function istMidnight(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);
}

// Emoji and joiners (surrogate pairs, symbols, variation selector, ZWJ).
const EMOJI = /[\uD800-\uDFFF☀-➿️‍]/g;

/** "Title:\n🎮 Experienced QA Tester for …" → "Experienced QA Tester for …" */
export function cleanContractTitle(title: string): string {
  const t = title.replace(/^\s*title:\s*/i, "").replace(EMOJI, "").replace(/\s+/g, " ").trim();
  return (t || "Upwork contract").slice(0, 80);
}

export function withdrawalStatus(status: string | undefined): "received" | "pending" {
  return /^(success|completed|paid|processed)$/i.test(status ?? "") ? "received" : "pending";
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const near = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;

export function planUpworkSync(
  input: UpworkSyncInput,
  state: { projects: PlanProject[]; entries: PlanEntry[]; withdrawals: PlanWithdrawal[] },
): SyncPlan {
  const plan: SyncPlan = {
    newProjects: [], entryInserts: [], entryUpdates: [], entryAdopts: [], entryDeletes: [],
    conflicts: [], withdrawalInserts: [], withdrawalUpdates: [], unchanged: { entries: 0, withdrawals: 0 },
  };

  // ── Time entries ──────────────────────────────────────────────────────────
  // Upwork can return several lines for one contract and day; add them up.
  const days = new Map<string, { contractId: string; contractTitle: string; date: string; hours: number; charges: number }>();
  for (const t of input.timesheets) {
    const key = `${t.contractId}|${t.date}`;
    const d = days.get(key) ?? { contractId: t.contractId, contractTitle: t.contractTitle, date: t.date, hours: 0, charges: 0 };
    d.hours += t.hours;
    d.charges += t.charges;
    days.set(key, d);
  }

  const projectByContract = new Map(state.projects.filter(p => p.upworkContractId).map(p => [p.upworkContractId!, p]));
  const byExternal = new Map(state.entries.filter(e => e.externalId).map(e => [e.externalId!, e]));
  const reported = new Set<string>();
  const adopted = new Set<string>();

  for (const d of Array.from(days.values())) {
    const minutes = Math.round(d.hours * 60);
    if (minutes <= 0) continue;
    const externalId = `upwork:${d.contractId}:${d.date}`;
    reported.add(externalId);
    const project = projectByContract.get(d.contractId);
    const rate = d.hours > 0 ? round2(d.charges / d.hours) : project?.rate ?? 0;

    const existing = byExternal.get(externalId);
    if (existing) {
      const gross = (minutes / 60) * rate;
      if (existing.minutes === minutes && near(existing.grossUsd, gross)) plan.unchanged.entries++;
      else plan.entryUpdates.push({ id: existing.id, contractTitle: d.contractTitle, date: d.date, minutes, rate, externalId, fromMinutes: existing.minutes });
      continue;
    }

    if (!project) {
      if (!plan.newProjects.some(p => p.contractId === d.contractId)) {
        plan.newProjects.push({ contractId: d.contractId, name: cleanContractTitle(d.contractTitle), rate });
      }
      plan.entryInserts.push({ contractId: d.contractId, contractTitle: d.contractTitle, date: d.date, minutes, rate, externalId });
      continue;
    }

    // Hours typed by hand for the same project and day: take over a matching
    // entry rather than adding a duplicate; leave a different one alone.
    const manual = state.entries.filter(e =>
      !e.externalId && !adopted.has(e.id) && e.projectId === project.id && istDay(e.date) === d.date);
    if (manual.length === 0) {
      plan.entryInserts.push({ contractId: d.contractId, contractTitle: d.contractTitle, date: d.date, minutes, rate, externalId });
    } else if (manual.length === 1 && manual[0].minutes === minutes) {
      adopted.add(manual[0].id);
      plan.entryAdopts.push({ id: manual[0].id, externalId, date: d.date });
    } else {
      plan.conflicts.push({
        date: d.date, project: project.name, upworkMinutes: minutes,
        timetrakrMinutes: manual.reduce((s, e) => s + e.minutes, 0),
        reason: "Entered by hand with different hours; not changed",
      });
    }
  }

  // Synced entries in the window that Upwork no longer reports. Skipped when
  // no timesheets came back at all, so a failed fetch can't wipe a window.
  if (input.timesheets.length > 0) {
    for (const e of state.entries) {
      if (!e.externalId?.startsWith("upwork:") || reported.has(e.externalId)) continue;
      const day = istDay(e.date);
      if (day >= input.from && day <= input.to) plan.entryDeletes.push({ id: e.id, date: day, minutes: e.minutes });
    }
  }

  // ── Withdrawals ───────────────────────────────────────────────────────────
  const claimed = new Set<string>();
  for (const w of input.withdrawals) {
    const externalId = `upwork:${w.recordId}`;
    const status = withdrawalStatus(w.status);
    const existing =
      state.withdrawals.find(x => x.externalId === externalId) ??
      state.withdrawals.find(x => !x.externalId && !claimed.has(x.id) && (x.notes ?? "").includes(`txn ${w.recordId}`)) ??
      state.withdrawals.find(x => !x.externalId && !claimed.has(x.id) &&
        istDay(x.withdrawalDate) === w.date &&
        (near(x.withdrawalAmount, w.amount) || near(x.netEarnings, w.amount + w.fee)));
    if (!existing) {
      plan.withdrawalInserts.push({ externalId, recordId: w.recordId, date: w.date, amount: round2(w.amount), fee: round2(w.fee), paymentStatus: status });
      continue;
    }
    claimed.add(existing.id);
    if (existing.externalId === externalId && existing.paymentStatus === status) {
      plan.unchanged.withdrawals++;
    } else {
      plan.withdrawalUpdates.push({ id: existing.id, externalId, paymentStatus: status, date: w.date, amount: w.amount });
    }
  }

  return plan;
}
