/**
 * API Integration tests — Currency & Exchange Rate
 */
import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";

let request: ReturnType<typeof supertest>;
let cookie: string;

beforeAll(async () => {
  const { createApp } = await import("../../server/app.js");
  const app = await createApp();
  request = supertest(app);

  const suffix = Date.now();
  await request.post("/api/register").send({ username: `qa_currency_${suffix}`, password: "test1234" });
  const login = await request.post("/api/login").send({ username: `qa_currency_${suffix}`, password: "test1234" });
  cookie = login.headers["set-cookie"]?.[0] ?? "";
});

describe("GET /api/currency", () => {
  it("200 — returns currency settings (auto-created with default 84.0)", async () => {
    const res = await request.get("/api/currency").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.usdToInr).toBeGreaterThan(0);
  });

  it("401 — unauthenticated", async () => {
    const res = await request.get("/api/currency");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/currency", () => {
  it("200 — updates exchange rate", async () => {
    const res = await request.patch("/api/currency")
      .set("Cookie", cookie)
      .send({ usdToInr: 87.5 });
    expect(res.status).toBe(200);
    expect(res.body.usdToInr).toBeCloseTo(87.5);
  });

  it("rate persists — GET returns updated value", async () => {
    await request.patch("/api/currency").set("Cookie", cookie).send({ usdToInr: 91.0 });
    const res = await request.get("/api/currency").set("Cookie", cookie);
    expect(res.body.usdToInr).toBeCloseTo(91.0);
  });

  it("400 or 422 — negative rate rejected", async () => {
    const res = await request.patch("/api/currency")
      .set("Cookie", cookie)
      .send({ usdToInr: -10 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("401 — unauthenticated", async () => {
    const res = await request.patch("/api/currency").send({ usdToInr: 90 });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/exchange-rate/live", () => {
  it("200 — returns a numeric rate > 50 (sanity check for INR)", async () => {
    const res = await request.get("/api/exchange-rate/live").set("Cookie", cookie);
    // Allow 502 if external API is unavailable in test environment
    if (res.status === 200) {
      expect(typeof res.body.rate).toBe("number");
      expect(res.body.rate).toBeGreaterThan(50);
      expect(res.body.rate).toBeLessThan(200); // sanity upper bound
    } else {
      expect(res.status).toBe(502);
    }
  });

  it("401 — unauthenticated", async () => {
    const res = await request.get("/api/exchange-rate/live");
    expect(res.status).toBe(401);
  });
});
