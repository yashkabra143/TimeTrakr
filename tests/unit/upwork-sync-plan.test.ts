import { describe, it, expect } from "vitest";
import {
  planUpworkSync, upworkSyncSchema, istMidnight, istDay, cleanContractTitle, withdrawalStatus,
  type PlanEntry, type PlanProject, type PlanWithdrawal,
} from "../../server/upwork-sync-plan";

const PETER: PlanProject = { id: "p1", name: "Peter", rate: 7, upworkContractId: "37719547" };
const CHRIS: PlanProject = { id: "p2", name: "Chris", rate: 8, upworkContractId: "40864249" };

const input = (over: Partial<Parameters<typeof upworkSyncSchema.parse>[0]> = {}) =>
  upworkSyncSchema.parse({ from: "2026-10-26", to: "2026-11-08", timesheets: [], ...over });

const ts = (contractId: string, date: string, hours: number, rate: number, title = "QA Engineer") =>
  ({ contractId, contractTitle: title, date, hours, charges: hours * rate });

const entry = (over: Partial<PlanEntry>): PlanEntry =>
  ({ id: "e", projectId: "p1", minutes: 60, grossUsd: 7, date: istMidnight("2026-11-02"), externalId: null, ...over });

describe("dates", () => {
  it("stores days at IST midnight and reads them back as the same day", () => {
    expect(istMidnight("2026-10-31").toISOString()).toBe("2026-10-30T18:30:00.000Z");
    expect(istDay(istMidnight("2026-10-31"))).toBe("2026-10-31");
    expect(istDay(new Date("2026-10-31T00:00:00Z"))).toBe("2026-10-31");
  });
});

describe("planUpworkSync — time entries", () => {
  it("adds a new day: 2:40 hrs @ $7 → 160 min", () => {
    const plan = planUpworkSync(input({ timesheets: [ts("37719547", "2026-11-02", 2.6666666666666665, 7)] }),
      { projects: [PETER], entries: [], withdrawals: [] });
    expect(plan.entryInserts).toEqual([expect.objectContaining({ minutes: 160, rate: 7, externalId: "upwork:37719547:2026-11-02" })]);
  });

  it("adds up several Upwork lines for the same contract and day", () => {
    const plan = planUpworkSync(input({ timesheets: [ts("37719547", "2026-11-02", 1, 7), ts("37719547", "2026-11-02", 0.5, 7)] }),
      { projects: [PETER], entries: [], withdrawals: [] });
    expect(plan.entryInserts).toHaveLength(1);
    expect(plan.entryInserts[0].minutes).toBe(90);
  });

  it("leaves an already-synced day alone when nothing changed (safe to re-run)", () => {
    const plan = planUpworkSync(input({ timesheets: [ts("37719547", "2026-11-02", 1, 7)] }), {
      projects: [PETER], withdrawals: [],
      entries: [entry({ minutes: 60, grossUsd: 7, externalId: "upwork:37719547:2026-11-02" })],
    });
    expect(plan.entryInserts).toHaveLength(0);
    expect(plan.entryUpdates).toHaveLength(0);
    expect(plan.unchanged.entries).toBe(1);
  });

  it("updates a synced day when Upwork's hours changed (Upwork wins)", () => {
    const plan = planUpworkSync(input({ timesheets: [ts("37719547", "2026-11-02", 2, 7)] }), {
      projects: [PETER], withdrawals: [],
      entries: [entry({ id: "s1", minutes: 60, externalId: "upwork:37719547:2026-11-02" })],
    });
    expect(plan.entryUpdates).toEqual([expect.objectContaining({ id: "s1", minutes: 120, fromMinutes: 60 })]);
  });

  it("takes over a hand-typed entry with the same hours instead of duplicating it", () => {
    const plan = planUpworkSync(input({ timesheets: [ts("37719547", "2026-11-02", 1.5, 7)] }), {
      projects: [PETER], withdrawals: [], entries: [entry({ id: "m1", minutes: 90 })],
    });
    expect(plan.entryAdopts).toEqual([{ id: "m1", externalId: "upwork:37719547:2026-11-02", date: "2026-11-02" }]);
    expect(plan.entryInserts).toHaveLength(0);
  });

  it("reports a hand-typed entry with different hours and doesn't touch it", () => {
    const plan = planUpworkSync(input({ timesheets: [ts("37719547", "2026-11-02", 2, 7)] }), {
      projects: [PETER], withdrawals: [], entries: [entry({ id: "m1", minutes: 90 })],
    });
    expect(plan.conflicts).toEqual([expect.objectContaining({ project: "Peter", upworkMinutes: 120, timetrakrMinutes: 90 })]);
    expect(plan.entryInserts).toHaveLength(0);
    expect(plan.entryUpdates).toHaveLength(0);
  });

  it("deletes a synced day in the window that Upwork no longer reports", () => {
    const plan = planUpworkSync(input({ timesheets: [ts("37719547", "2026-11-03", 1, 7)] }), {
      projects: [PETER], withdrawals: [],
      entries: [
        entry({ id: "gone", externalId: "upwork:37719547:2026-11-02" }),
        entry({ id: "old", externalId: "upwork:37719547:2026-10-20", date: istMidnight("2026-10-20") }), // outside window
        entry({ id: "hand" }), // typed by hand
      ],
    });
    expect(plan.entryDeletes.map(d => d.id)).toEqual(["gone"]);
  });

  it("never deletes when no timesheets came back (failed fetch)", () => {
    const plan = planUpworkSync(input({ timesheets: [] }), {
      projects: [PETER], withdrawals: [], entries: [entry({ externalId: "upwork:37719547:2026-11-02" })],
    });
    expect(plan.entryDeletes).toHaveLength(0);
  });

  it("creates a project for a new contract with its rate and a clean name", () => {
    const title = "Title:\n🎮 Experienced QA Tester for Mobile Word Game";
    const plan = planUpworkSync(input({ timesheets: [ts("999", "2026-11-02", 1, 12, title), ts("999", "2026-11-03", 2, 12, title)] }),
      { projects: [PETER, CHRIS], entries: [], withdrawals: [] });
    expect(plan.newProjects).toEqual([{ contractId: "999", name: "Experienced QA Tester for Mobile Word Game", rate: 12 }]);
    expect(plan.entryInserts).toHaveLength(2);
  });
});

describe("planUpworkSync — withdrawals", () => {
  const w = (over: Partial<PlanWithdrawal>): PlanWithdrawal => ({
    id: "w1", withdrawalAmount: 647.13, netEarnings: 648.12, withdrawalDate: istMidnight("2026-10-30"),
    paymentStatus: "received", notes: null, externalId: null, ...over,
  });
  const upworkW = { recordId: "962791907", date: "2026-10-30", amount: 647.13, fee: 0.99, status: "SUCCESS" };

  it("adds a new withdrawal as received", () => {
    const plan = planUpworkSync(input({ withdrawals: [upworkW] }), { projects: [], entries: [], withdrawals: [] });
    expect(plan.withdrawalInserts).toEqual([expect.objectContaining({ externalId: "upwork:962791907", amount: 647.13, fee: 0.99, paymentStatus: "received" })]);
  });

  it("matches an earlier synced withdrawal by the txn id in its notes", () => {
    const plan = planUpworkSync(input({ withdrawals: [upworkW] }), {
      projects: [], entries: [], withdrawals: [w({ notes: "Upwork rate 93.0304 · Upwork txn 962791907", withdrawalDate: istMidnight("2026-10-29") })],
    });
    expect(plan.withdrawalInserts).toHaveLength(0);
    expect(plan.withdrawalUpdates).toEqual([expect.objectContaining({ id: "w1", externalId: "upwork:962791907" })]);
  });

  it("matches an imported withdrawal by day and amount", () => {
    const plan = planUpworkSync(input({ withdrawals: [upworkW] }), { projects: [], entries: [], withdrawals: [w({ notes: "Imported from Upwork" })] });
    expect(plan.withdrawalInserts).toHaveLength(0);
    expect(plan.withdrawalUpdates).toHaveLength(1);
  });

  it("is unchanged on a second run and moves pending to received", () => {
    const synced = w({ externalId: "upwork:962791907" });
    expect(planUpworkSync(input({ withdrawals: [upworkW] }), { projects: [], entries: [], withdrawals: [synced] }).unchanged.withdrawals).toBe(1);
    const pending = w({ externalId: "upwork:962791907", paymentStatus: "pending" });
    expect(planUpworkSync(input({ withdrawals: [upworkW] }), { projects: [], entries: [], withdrawals: [pending] }).withdrawalUpdates)
      .toEqual([expect.objectContaining({ paymentStatus: "received" })]);
  });
});

describe("input checks", () => {
  it("rejects timesheet days outside the window and windows over 62 days", () => {
    expect(upworkSyncSchema.safeParse({ from: "2026-11-01", to: "2026-11-08", timesheets: [ts("1", "2026-10-01", 1, 7)] }).success).toBe(false);
    expect(upworkSyncSchema.safeParse({ from: "2026-01-01", to: "2026-11-08", timesheets: [] }).success).toBe(false);
  });
  it("maps statuses and cleans titles", () => {
    expect(withdrawalStatus("SUCCESS")).toBe("received");
    expect(withdrawalStatus("PROCESSING")).toBe("pending");
    expect(cleanContractTitle("QA Engineer")).toBe("QA Engineer");
  });
});
