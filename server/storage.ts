import {
  projects,
  deductions,
  currencySettings,
  timeEntries,
  users,
  withdrawals,
  type Project,
  type InsertProject,
  type Deduction,
  type InsertDeduction,
  type CurrencySetting,
  type InsertCurrencySetting,
  type TimeEntry,
  type InsertTimeEntry,
  type User,
  type InsertUser,
  type Withdrawal,
  type InsertWithdrawal,
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc, and, isNull } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";

export interface IStorage {
  // Projects (all scoped to userId)
  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string, userId: string): Promise<Project | undefined>;
  createProject(project: InsertProject, userId: string): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>, userId: string): Promise<Project | undefined>;
  deleteProject(id: string, userId: string): Promise<void>;

  // Deductions (auto-created per user with defaults)
  getDeductions(userId: string): Promise<Deduction>;
  updateDeductions(userId: string, deductions: Partial<InsertDeduction>): Promise<Deduction>;

  // Currency Settings (auto-created per user with defaults)
  getCurrencySettings(userId: string): Promise<CurrencySetting>;
  updateCurrencySettings(userId: string, settings: Partial<InsertCurrencySetting>): Promise<CurrencySetting>;

  // Time Entries (all scoped to userId)
  getTimeEntries(userId: string): Promise<TimeEntry[]>;
  getTimeEntry(id: string, userId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry & {
    userId: string;
    grossUsd: number;
    deductionService: number;
    deductionGst: number;
    deductionTds: number;
    deductionTransfer: number;
    deductionTotal: number;
    netUsd: number;
    netInr: number;
    exchangeRate: number;
  }): Promise<TimeEntry>;
  deleteTimeEntry(id: string, userId: string): Promise<void>;

  // Users
  getUser(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Partial<InsertUser> & { username: string }): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  findOrCreateOAuthUser(profile: {
    provider: "google" | "github";
    id: string;
    email?: string | null;
    name?: string | null;
    picture?: string | null;
  }): Promise<User>;

  // Withdrawals (all scoped to userId)
  getWithdrawals(userId: string): Promise<Withdrawal[]>;
  getWithdrawal(id: string, userId: string): Promise<Withdrawal | undefined>;
  createWithdrawal(withdrawal: InsertWithdrawal, userId: string): Promise<Withdrawal>;
  updateWithdrawalStatus(id: string, status: string, userId: string): Promise<Withdrawal | undefined>;
  deleteWithdrawal(id: string, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {

  // ── Projects ──────────────────────────────────────────────────────────────

  async getProjects(userId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async getProject(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return project ?? undefined;
  }

  async createProject(insertProject: InsertProject, userId: string): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({ ...insertProject, userId })
      .returning();
    return project;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>, userId: string): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return project ?? undefined;
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
  }

  // ── Deductions (auto-create defaults per user) ────────────────────────────

  async getDeductions(userId: string): Promise<Deduction> {
    const [existing] = await db
      .select()
      .from(deductions)
      .where(eq(deductions.userId, userId))
      .limit(1);
    if (existing) return existing;
    // Auto-create defaults for new user
    const [created] = await db
      .insert(deductions)
      .values({ userId, serviceFee: 10, tds: 0.1, gst: 18, transferFee: 0.99 })
      .returning();
    return created;
  }

  async updateDeductions(userId: string, updateData: Partial<InsertDeduction>): Promise<Deduction> {
    const existing = await this.getDeductions(userId);
    const [updated] = await db
      .update(deductions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(deductions.id, existing.id))
      .returning();
    return updated;
  }

  // ── Currency Settings (auto-create defaults per user) ─────────────────────

  async getCurrencySettings(userId: string): Promise<CurrencySetting> {
    const [existing] = await db
      .select()
      .from(currencySettings)
      .where(eq(currencySettings.userId, userId))
      .limit(1);
    if (existing) return existing;
    // Auto-create defaults for new user
    const [created] = await db
      .insert(currencySettings)
      .values({ userId, usdToInr: 84.0 })
      .returning();
    return created;
  }

  async updateCurrencySettings(userId: string, updateData: Partial<InsertCurrencySetting>): Promise<CurrencySetting> {
    const existing = await this.getCurrencySettings(userId);
    const [updated] = await db
      .update(currencySettings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(currencySettings.id, existing.id))
      .returning();
    return updated;
  }

  // ── Time Entries ──────────────────────────────────────────────────────────

  async getTimeEntries(userId: string): Promise<TimeEntry[]> {
    try {
      return await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.userId, userId))
        .orderBy(desc(timeEntries.date));
    } catch (error: any) {
      // Handle old schema without minutes column
      if (error?.message?.includes('column "minutes" does not exist') || error?.code === "42703") {
        console.warn("[STORAGE] Detected old schema, using migration-compatible query");
        if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
        const rawSql = neon(process.env.DATABASE_URL);
        const result = await rawSql`
          SELECT
            id,
            user_id as "userId",
            project_id as "projectId",
            COALESCE(minutes, ROUND(COALESCE(hours, 0) * 60))::integer as minutes,
            COALESCE(input_format, 'fractional') as "inputFormat",
            COALESCE(raw_input, hours::text) as "rawInput",
            date, description,
            gross_usd as "grossUsd",
            deduction_service as "deductionService",
            deduction_gst as "deductionGst",
            deduction_tds as "deductionTds",
            deduction_transfer as "deductionTransfer",
            deduction_total as "deductionTotal",
            net_usd as "netUsd",
            net_inr as "netInr",
            exchange_rate as "exchangeRate",
            created_at as "createdAt"
          FROM time_entries
          WHERE user_id = ${userId}
          ORDER BY date DESC
        `;
        return result as TimeEntry[];
      }
      throw error;
    }
  }

  async getTimeEntry(id: string, userId: string): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)));
    return entry ?? undefined;
  }

  async createTimeEntry(entry: InsertTimeEntry & {
    userId: string;
    grossUsd: number;
    deductionService: number;
    deductionGst: number;
    deductionTds: number;
    deductionTransfer: number;
    deductionTotal: number;
    netUsd: number;
    netInr: number;
    exchangeRate: number;
  }): Promise<TimeEntry> {
    const [newEntry] = await db.insert(timeEntries).values(entry).returning();
    return newEntry;
  }

  async deleteTimeEntry(id: string, userId: string): Promise<void> {
    await db.delete(timeEntries).where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)));
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async getUser(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user ?? undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user ?? undefined;
  }

  async createUser(user: Partial<InsertUser> & { username: string }): Promise<User> {
    const [newUser] = await db.insert(users).values(user as any).returning();
    return newUser;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updatedUser ?? undefined;
  }

  async findOrCreateOAuthUser(profile: {
    provider: "google" | "github";
    id: string;
    email?: string | null;
    name?: string | null;
    picture?: string | null;
  }): Promise<User> {
    const { provider, id, email, name, picture } = profile;

    // 1. Find existing user by provider ID
    const providerField = provider === "google" ? users.googleId : users.githubId;
    const [existing] = await db.select().from(users).where(eq(providerField, id));
    if (existing) {
      // Refresh profile picture / name if changed
      const [updated] = await db
        .update(users)
        .set({ profilePicture: picture ?? existing.profilePicture, fullName: name ?? existing.fullName })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }

    // 2. Link to existing account if same email
    if (email) {
      const [emailUser] = await db.select().from(users).where(eq(users.email, email));
      if (emailUser) {
        const linkData = provider === "google" ? { googleId: id } : { githubId: id };
        const [linked] = await db
          .update(users)
          .set({ ...linkData, profilePicture: picture ?? emailUser.profilePicture })
          .where(eq(users.id, emailUser.id))
          .returning();
        return linked;
      }
    }

    // 3. Link to seed account (password-registered user with no email/OAuth yet)
    const [seedUser] = await db
      .select()
      .from(users)
      .where(and(isNull(users.email), isNull(users.googleId), isNull(users.githubId)))
      .limit(1);

    if (seedUser) {
      const linkData = provider === "google" ? { googleId: id } : { githubId: id };
      const [linked] = await db
        .update(users)
        .set({
          ...linkData,
          email: email ?? null,
          fullName: name ?? seedUser.fullName,
          profilePicture: picture ?? seedUser.profilePicture,
        })
        .where(eq(users.id, seedUser.id))
        .returning();
      return linked;
    }

    // 4. Create new user — derive a unique username
    let base = name
      ? name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 20)
      : (email?.split("@")[0] ?? provider);
    if (!base || base.length < 3) base = provider + "_user";

    let username = base;
    let attempt = 0;
    while (await this.getUser(username)) {
      attempt++;
      username = `${base}${attempt}`;
    }

    const createData: Record<string, unknown> = {
      username,
      email: email ?? null,
      fullName: name ?? null,
      profilePicture: picture ?? null,
    };
    if (provider === "google") createData.googleId = id;
    else createData.githubId = id;

    const [newUser] = await db.insert(users).values(createData as any).returning();
    return newUser;
  }

  // ── Withdrawals ───────────────────────────────────────────────────────────

  async getWithdrawals(userId: string): Promise<Withdrawal[]> {
    return await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.withdrawalDate));
  }

  async getWithdrawal(id: string, userId: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db
      .select()
      .from(withdrawals)
      .where(and(eq(withdrawals.id, id), eq(withdrawals.userId, userId)));
    return withdrawal ?? undefined;
  }

  async createWithdrawal(withdrawal: InsertWithdrawal, userId: string): Promise<Withdrawal> {
    const [newWithdrawal] = await db
      .insert(withdrawals)
      .values({ ...withdrawal, userId })
      .returning();
    return newWithdrawal;
  }

  async updateWithdrawalStatus(id: string, status: string, userId: string): Promise<Withdrawal | undefined> {
    const [updated] = await db
      .update(withdrawals)
      .set({ paymentStatus: status })
      .where(and(eq(withdrawals.id, id), eq(withdrawals.userId, userId)))
      .returning();
    return updated ?? undefined;
  }

  async deleteWithdrawal(id: string, userId: string): Promise<void> {
    await db.delete(withdrawals).where(and(eq(withdrawals.id, id), eq(withdrawals.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
