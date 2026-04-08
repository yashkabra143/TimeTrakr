/**
 * API Integration tests — Authentication
 *
 * Requires: TEST_DATABASE_URL env var pointing to a test PostgreSQL DB.
 * Run:  npm run test:api
 *
 * Each test suite uses a unique username to avoid collisions.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";

// Dynamically import the Express app (avoids double-initialising in unit tests)
let app: any;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  const { createApp } = await import("../../server/app.js");
  app = await createApp();
  request = supertest(app);
});

afterAll(async () => {
  // Close DB / session store connections if exposed
  if (app?.closeConnections) await app.closeConnections();
});

// ─── Health ───────────────────────────────────────────────────────────────────

describe("GET /api/ping", () => {
  it("returns 200", async () => {
    const res = await request.get("/api/ping");
    expect(res.status).toBe(200);
  });
});

// ─── Registration ─────────────────────────────────────────────────────────────

describe("POST /api/register", () => {
  const user = { username: `qa_reg_${Date.now()}`, password: "test1234" };

  it("201 — creates account and returns safe user object", async () => {
    const res = await request.post("/api/register").send(user);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: user.username });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.salt).toBeUndefined();
  });

  it("400 — username too short (< 3 chars)", async () => {
    const res = await request.post("/api/register").send({ username: "ab", password: "test1234" });
    expect(res.status).toBe(400);
  });

  it("400 — password too short (< 6 chars)", async () => {
    const res = await request.post("/api/register").send({ username: `qa_short_${Date.now()}`, password: "abc" });
    expect(res.status).toBe(400);
  });

  it("400 — duplicate username", async () => {
    // Register again with same username
    const res = await request.post("/api/register").send(user);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already|exists|taken/i);
  });

  it("400 — missing username", async () => {
    const res = await request.post("/api/register").send({ password: "test1234" });
    expect(res.status).toBe(400);
  });

  it("400 — missing password", async () => {
    const res = await request.post("/api/register").send({ username: `qa_nopw_${Date.now()}` });
    expect(res.status).toBe(400);
  });

  it("ignores extra fields (no mass assignment)", async () => {
    const res = await request.post("/api/register").send({
      username: `qa_extra_${Date.now()}`,
      password: "test1234",
      planType: "pro_annual",  // should be ignored
      isAdmin: true,            // should be ignored
    });
    expect(res.status).toBe(201);
    expect(res.body.user.planType).toBe("free");
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe("POST /api/login", () => {
  const creds = { username: `qa_login_${Date.now()}`, password: "Secure123!" };

  beforeAll(async () => {
    await request.post("/api/register").send(creds);
  });

  it("200 — valid credentials return user, set session cookie", async () => {
    const res = await request.post("/api/login").send(creds);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(creds.username);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("401 — wrong password", async () => {
    const res = await request.post("/api/login").send({ username: creds.username, password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  it("401 — unknown username", async () => {
    const res = await request.post("/api/login").send({ username: "nonexistent_user_xyz", password: "test1234" });
    expect(res.status).toBe(401);
  });

  it("response never includes password or salt", async () => {
    const res = await request.post("/api/login").send(creds);
    expect(res.body.user?.password).toBeUndefined();
    expect(res.body.user?.salt).toBeUndefined();
  });

  it("session ID changes after login (session fixation prevention)", async () => {
    // Get a pre-login session cookie
    const pre = await request.get("/api/me");
    const preCookie = pre.headers["set-cookie"]?.[0];

    const login = await request.post("/api/login").send(creds);
    const postCookie = login.headers["set-cookie"]?.[0];

    // Session ID portion of the cookie should differ
    const extractSid = (c: string) => c?.split(";")[0];
    expect(extractSid(preCookie)).not.toBe(extractSid(postCookie));
  });
});

// ─── /api/me ─────────────────────────────────────────────────────────────────

describe("GET /api/me", () => {
  const creds = { username: `qa_me_${Date.now()}`, password: "test1234" };
  let cookie: string;

  beforeAll(async () => {
    await request.post("/api/register").send(creds);
    const res = await request.post("/api/login").send(creds);
    cookie = res.headers["set-cookie"]?.[0] ?? "";
  });

  it("200 — returns current user when authenticated", async () => {
    const res = await request.get("/api/me").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(creds.username);
  });

  it("200 — returns null when not authenticated (not 401)", async () => {
    const res = await request.get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe("POST /api/logout", () => {
  const creds = { username: `qa_logout_${Date.now()}`, password: "test1234" };
  let cookie: string;

  beforeAll(async () => {
    await request.post("/api/register").send(creds);
    const res = await request.post("/api/login").send(creds);
    cookie = res.headers["set-cookie"]?.[0] ?? "";
  });

  it("destroys session — subsequent /api/me returns null", async () => {
    await request.post("/api/logout").set("Cookie", cookie);
    const me = await request.get("/api/me").set("Cookie", cookie);
    expect(me.body).toBeNull();
  });
});

// ─── Protected route without auth ─────────────────────────────────────────────

describe("Protected routes — unauthenticated", () => {
  it("GET /api/projects returns 401", async () => {
    const res = await request.get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("GET /api/entries returns 401", async () => {
    const res = await request.get("/api/entries");
    expect(res.status).toBe(401);
  });

  it("PATCH /api/currency returns 401", async () => {
    const res = await request.patch("/api/currency").send({ usdToInr: 90 });
    expect(res.status).toBe(401);
  });
});

// ─── Change password ──────────────────────────────────────────────────────────

describe("POST /api/change-password", () => {
  const creds = { username: `qa_chpw_${Date.now()}`, password: "OldPass1!" };
  let cookie: string;

  beforeAll(async () => {
    await request.post("/api/register").send(creds);
    const res = await request.post("/api/login").send(creds);
    cookie = res.headers["set-cookie"]?.[0] ?? "";
  });

  it("400 — wrong current password", async () => {
    const res = await request.post("/api/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "WrongPass!", newPassword: "NewPass1!" });
    expect(res.status).toBe(400);
  });

  it("200 — correct current password, new password ≥ 6 chars", async () => {
    const res = await request.post("/api/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: creds.password, newPassword: "NewPass1!" });
    expect(res.status).toBe(200);
  });

  it("can log in with new password after change", async () => {
    const res = await request.post("/api/login").send({ username: creds.username, password: "NewPass1!" });
    expect(res.status).toBe(200);
  });
});
