/**
 * API Integration tests — Time Entries
 *
 * Covers: create, read, delete, deduction math, IDOR protection.
 */
import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";

let request: ReturnType<typeof supertest>;
let cookie: string;
let projectId: string;
let otherCookie: string; // second user for IDOR tests

beforeAll(async () => {
  const { createApp } = await import("../../server/app.js");
  const app = await createApp();
  request = supertest(app);

  // Create and log in as test user
  const suffix = Date.now();
  await request.post("/api/register").send({ username: `qa_entries_${suffix}`, password: "test1234" });
  const login = await request.post("/api/login").send({ username: `qa_entries_${suffix}`, password: "test1234" });
  cookie = login.headers["set-cookie"]?.[0] ?? "";

  // Create a project to attach entries to
  const proj = await request.post("/api/projects")
    .set("Cookie", cookie)
    .send({ name: "QA Project", rate: 50, color: "#3b82f6", type: "hourly" });
  projectId = proj.body.id;

  // Second user for IDOR tests
  await request.post("/api/register").send({ username: `qa_other_${suffix}`, password: "test1234" });
  const other = await request.post("/api/login").send({ username: `qa_other_${suffix}`, password: "test1234" });
  otherCookie = other.headers["set-cookie"]?.[0] ?? "";
});

// ─── Create entry ─────────────────────────────────────────────────────────────

describe("POST /api/entries", () => {
  it("201 — creates entry with H.MM time format", async () => {
    const res = await request.post("/api/entries")
      .set("Cookie", cookie)
      .send({
        projectId,
        minutes: 500,           // 8h 20m
        inputFormat: "hm",
        rawInput: "8.20",
        date: new Date().toISOString(),
        description: "QA test entry",
      });
    expect(res.status).toBe(201);
    expect(res.body.minutes).toBe(500);
  });

  it("calculated earnings: $50/hr × (500/60) hours ≈ $416.67 gross", async () => {
    const res = await request.post("/api/entries")
      .set("Cookie", cookie)
      .send({ projectId, minutes: 500, inputFormat: "hm", rawInput: "8.20", date: new Date().toISOString() });
    expect(res.body.grossUsd).toBeCloseTo(416.67, 0);
  });

  it("netUsd is less than grossUsd (deductions applied)", async () => {
    const res = await request.post("/api/entries")
      .set("Cookie", cookie)
      .send({ projectId, minutes: 120, inputFormat: "hm", rawInput: "2.00", date: new Date().toISOString() });
    expect(res.body.netUsd).toBeLessThan(res.body.grossUsd);
  });

  it("response includes snapshots: exchangeRate, deductionTotal", async () => {
    const res = await request.post("/api/entries")
      .set("Cookie", cookie)
      .send({ projectId, minutes: 60, inputFormat: "hm", rawInput: "1.00", date: new Date().toISOString() });
    expect(res.body.exchangeRate).toBeGreaterThan(0);
    expect(res.body.deductionTotal).toBeGreaterThanOrEqual(0);
    expect(res.body.netInr).toBeGreaterThan(0);
  });

  it("400 — missing projectId", async () => {
    const res = await request.post("/api/entries")
      .set("Cookie", cookie)
      .send({ minutes: 60, inputFormat: "hm", date: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  it("404 — projectId not owned by user", async () => {
    const res = await request.post("/api/entries")
      .set("Cookie", otherCookie)
      .send({ projectId, minutes: 60, inputFormat: "hm", date: new Date().toISOString() });
    expect(res.status).toBe(404);
  });

  it("401 — unauthenticated request rejected", async () => {
    const res = await request.post("/api/entries")
      .send({ projectId, minutes: 60, inputFormat: "hm", date: new Date().toISOString() });
    expect(res.status).toBe(401);
  });
});

// ─── List entries ─────────────────────────────────────────────────────────────

describe("GET /api/entries", () => {
  it("200 — returns array of entries for user", async () => {
    const res = await request.get("/api/entries").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("other user cannot see first user's entries (IDOR)", async () => {
    // Add an entry for user1
    await request.post("/api/entries")
      .set("Cookie", cookie)
      .send({ projectId, minutes: 60, inputFormat: "hm", date: new Date().toISOString(), description: "secret entry" });

    // User2 gets their own empty list, not user1's entries
    const res = await request.get("/api/entries").set("Cookie", otherCookie);
    const descriptions = res.body.map((e: any) => e.description);
    expect(descriptions).not.toContain("secret entry");
  });
});

// ─── Delete entry ─────────────────────────────────────────────────────────────

describe("DELETE /api/entries/:id", () => {
  let entryId: string;

  beforeAll(async () => {
    const res = await request.post("/api/entries")
      .set("Cookie", cookie)
      .send({ projectId, minutes: 30, inputFormat: "hm", date: new Date().toISOString() });
    entryId = res.body.id;
  });

  it("200 — owner can delete their entry", async () => {
    const res = await request.delete(`/api/entries/${entryId}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("404 — deleted entry no longer retrievable", async () => {
    const entries = await request.get("/api/entries").set("Cookie", cookie);
    const found = entries.body.find((e: any) => e.id === entryId);
    expect(found).toBeUndefined();
  });

  it("IDOR — other user cannot delete first user's entry", async () => {
    // Create fresh entry
    const create = await request.post("/api/entries")
      .set("Cookie", cookie)
      .send({ projectId, minutes: 30, inputFormat: "hm", date: new Date().toISOString() });
    const newId = create.body.id;

    const res = await request.delete(`/api/entries/${newId}`).set("Cookie", otherCookie);
    expect(res.status).toBeGreaterThanOrEqual(400); // 403 or 404
  });
});
