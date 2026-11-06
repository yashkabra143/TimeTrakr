// Upwork auto-sync: sync keys and applying a sync plan to the database.
// A scheduled agent reads Upwork (timesheets, withdrawals, balance) and POSTs it
// to /api/sync/upwork with the user's sync key. See upwork-sync-plan.ts.
import { createHash, randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { storage } from "./storage.js";
import { refreshUserCurrency } from "./exchange-rate.js";
import { projects, timeEntries, users, withdrawals } from "../shared/schema.js";
import { calcEarnings } from "../shared/earnings.js";
import {
  planUpworkSync, istMidnight, cleanContractTitle,
  type UpworkSyncInput, type SyncPlan,
} from "./upwork-sync-plan.js";

const KEY_PREFIX = "tts_";

/** 90 → "1:30" */
const minutesToHM = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const PROJECT_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export const hashSyncKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** Creates a new sync key for the user, replacing any old one. Returns the key once. */
export async function createSyncKey(userId: string): Promise<string> {
  const key = KEY_PREFIX + randomBytes(32).toString("hex");
  await db.update(users)
    .set({ syncTokenHash: hashSyncKey(key), syncTokenCreatedAt: new Date() })
    .where(eq(users.id, userId));
  return key;
}

export async function revokeSyncKey(userId: string): Promise<void> {
  await db.update(users).set({ syncTokenHash: null, syncTokenCreatedAt: null }).where(eq(users.id, userId));
}

export async function getSyncStatus(userId: string) {
  const [row] = await db
    .select({ hash: users.syncTokenHash, createdAt: users.syncTokenCreatedAt, lastSyncAt: users.lastSyncAt })
    .from(users).where(eq(users.id, userId));
  return { hasKey: !!row?.hash, createdAt: row?.createdAt ?? null, lastSyncAt: row?.lastSyncAt ?? null };
}

/** The user id a sync key belongs to, or null. */
export async function userIdForSyncKey(key: string | undefined): Promise<string | null> {
  if (!key || !key.startsWith(KEY_PREFIX) || key.length !== KEY_PREFIX.length + 64) return null;
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.syncTokenHash, hashSyncKey(key)));
  return row?.id ?? null;
}

function summarize(plan: SyncPlan, input: UpworkSyncInput, projectsCreated: string[], availableFunds: number | null) {
  return {
    dryRun: input.dryRun,
    window: { from: input.from, to: input.to },
    projectsCreated,
    entries: {
      added: plan.entryInserts.length,
      updated: plan.entryUpdates.map(u => ({ date: u.date, from: minutesToHM(u.fromMinutes), to: minutesToHM(u.minutes) })),
      matchedExisting: plan.entryAdopts.length,
      deleted: plan.entryDeletes.map(d => ({ date: d.date, time: minutesToHM(d.minutes) })),
      unchanged: plan.unchanged.entries,
      conflicts: plan.conflicts,
    },
    withdrawals: {
      added: plan.withdrawalInserts.map(w => ({ date: w.date, amount: w.amount, status: w.paymentStatus })),
      updated: plan.withdrawalUpdates.length,
      unchanged: plan.unchanged.withdrawals,
    },
    availableFunds,
  };
}

export async function runUpworkSync(userId: string, input: UpworkSyncInput) {
  const [projectRows, entryRows, withdrawalRows, deductions] = await Promise.all([
    storage.getProjects(userId),
    storage.getTimeEntries(userId),
    storage.getWithdrawals(userId),
    storage.getDeductions(userId),
  ]);

  const plan = planUpworkSync(input, {
    projects: projectRows.map(p => ({ id: p.id, name: p.name, rate: Number(p.rate), upworkContractId: p.upworkContractId ?? null })),
    entries: entryRows.map(e => ({
      id: e.id, projectId: e.projectId, minutes: e.minutes, grossUsd: Number(e.grossUsd),
      date: new Date(e.date), externalId: e.externalId ?? null,
    })),
    withdrawals: withdrawalRows.map(w => ({
      id: w.id, withdrawalAmount: Number(w.withdrawalAmount), netEarnings: Number(w.netEarnings),
      withdrawalDate: new Date(w.withdrawalDate), paymentStatus: w.paymentStatus, notes: w.notes, externalId: w.externalId ?? null,
    })),
  });

  const projectsCreated = plan.newProjects.map(p => p.name);
  if (input.dryRun) return summarize(plan, input, projectsCreated, input.availableBalance ?? null);

  const rates = { serviceFee: Number(deductions.serviceFee) || 0, tds: Number(deductions.tds) || 0, gst: Number(deductions.gst) || 0 };
  const earnings = (minutes: number, rate: number, exchangeRate: number) => {
    const e = calcEarnings(minutes, rate, rates);
    return {
      grossUsd: e.grossUsd, deductionService: e.serviceFee, deductionTds: e.tds, deductionGst: e.gst,
      deductionTransfer: 0, deductionTotal: e.deductions, netUsd: e.netUsd, netInr: e.netUsd * exchangeRate, exchangeRate,
    };
  };
  const description = (title: string) => `Upwork · ${cleanContractTitle(title)}`;

  // New contracts become projects.
  const projectIdByContract = new Map(projectRows.filter(p => p.upworkContractId).map(p => [p.upworkContractId!, p.id]));
  for (let i = 0; i < plan.newProjects.length; i++) {
    const p = plan.newProjects[i];
    const [created] = await db.insert(projects).values({
      userId, name: p.name, rate: p.rate, type: "hourly", upworkContractId: p.contractId,
      color: PROJECT_COLORS[(projectRows.length + i) % PROJECT_COLORS.length],
    }).returning();
    projectIdByContract.set(p.contractId, created.id);
  }

  const needsRate = plan.entryInserts.length > 0;
  const exchangeRate = needsRate ? Number((await refreshUserCurrency(userId)).usdToInr) || 0 : 0;

  for (const e of plan.entryInserts) {
    await db.insert(timeEntries).values({
      userId, projectId: projectIdByContract.get(e.contractId)!, minutes: e.minutes,
      inputFormat: "hm", rawInput: minutesToHM(e.minutes).replace(":", "."), date: istMidnight(e.date),
      description: description(e.contractTitle), externalId: e.externalId,
      ...earnings(e.minutes, e.rate, exchangeRate),
    }).onConflictDoNothing();
  }

  const entryById = new Map(entryRows.map(e => [e.id, e]));
  for (const u of plan.entryUpdates) {
    const keepRate = Number(entryById.get(u.id)?.exchangeRate) || exchangeRate;
    await db.update(timeEntries).set({
      minutes: u.minutes, inputFormat: "hm", rawInput: minutesToHM(u.minutes).replace(":", "."),
      ...earnings(u.minutes, u.rate, keepRate),
    }).where(and(eq(timeEntries.id, u.id), eq(timeEntries.userId, userId)));
  }

  for (const a of plan.entryAdopts) {
    await db.update(timeEntries).set({ externalId: a.externalId })
      .where(and(eq(timeEntries.id, a.id), eq(timeEntries.userId, userId)));
  }

  for (const d of plan.entryDeletes) {
    await db.delete(timeEntries).where(and(eq(timeEntries.id, d.id), eq(timeEntries.userId, userId)));
  }

  for (const w of plan.withdrawalInserts) {
    await db.insert(withdrawals).values({
      userId, netEarnings: Math.round((w.amount + w.fee) * 100) / 100, transactionFee: w.fee,
      withdrawalAmount: w.amount, withdrawalDate: istMidnight(w.date), paymentStatus: w.paymentStatus,
      notes: `Upwork txn ${w.recordId}`, externalId: w.externalId,
    }).onConflictDoNothing();
  }

  for (const w of plan.withdrawalUpdates) {
    await db.update(withdrawals).set({ externalId: w.externalId, paymentStatus: w.paymentStatus })
      .where(and(eq(withdrawals.id, w.id), eq(withdrawals.userId, userId)));
  }

  const update: Partial<typeof users.$inferInsert> = { lastSyncAt: new Date() };
  if (input.availableBalance !== undefined) update.availableFunds = Math.round(input.availableBalance * 100) / 100;
  await db.update(users).set(update).where(eq(users.id, userId));

  return summarize(plan, input, projectsCreated, update.availableFunds ?? null);
}
