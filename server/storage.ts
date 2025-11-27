import {
  projects,
  deductions,
  currencySettings,
  timeEntries,
  users,
  type Project,
  type InsertProject,
  type Deduction,
  type InsertDeduction,
  type CurrencySetting,
  type InsertCurrencySetting,
  type TimeEntry,
  type InsertTimeEntry,
  type User,
  type InsertUser
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;

  // Deductions
  getDeductions(): Promise<Deduction | undefined>;
  updateDeductions(deductions: Partial<InsertDeduction>): Promise<Deduction>;

  // Currency Settings
  getCurrencySettings(): Promise<CurrencySetting | undefined>;
  updateCurrencySettings(settings: Partial<InsertCurrencySetting>): Promise<CurrencySetting>;

  // Time Entries
  getTimeEntries(): Promise<TimeEntry[]>;
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry & {
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
  deleteTimeEntry(id: string): Promise<void>;

  // Users
  getUser(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Projects
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db.update(projects).set(updateData).where(eq(projects.id, id)).returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Deductions
  async getDeductions(): Promise<Deduction | undefined> {
    const [deduction] = await db.select().from(deductions).limit(1);
    return deduction || undefined;
  }

  async updateDeductions(updateData: Partial<InsertDeduction>): Promise<Deduction> {
    const existing = await this.getDeductions();
    if (existing) {
      const [updated] = await db.update(deductions)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(deductions.id, existing.id))
        .returning();
      return updated;
    } else {
      const [newDeduction] = await db.insert(deductions).values(updateData as InsertDeduction).returning();
      return newDeduction;
    }
  }

  // Currency Settings
  async getCurrencySettings(): Promise<CurrencySetting | undefined> {
    const [settings] = await db.select().from(currencySettings).limit(1);
    return settings || undefined;
  }

  async updateCurrencySettings(updateData: Partial<InsertCurrencySetting>): Promise<CurrencySetting> {
    const existing = await this.getCurrencySettings();
    if (existing) {
      const [updated] = await db.update(currencySettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(currencySettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [newSettings] = await db.insert(currencySettings).values(updateData as InsertCurrencySetting).returning();
      return newSettings;
    }
  }

  // Time Entries
  async getTimeEntries(): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries).orderBy(desc(timeEntries.date));
  }

  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry || undefined;
  }

  async createTimeEntry(entry: InsertTimeEntry & {
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

  async deleteTimeEntry(id: string): Promise<void> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  // Users
  async getUser(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updatedUser || undefined;
  }
}

export const storage = new DatabaseStorage();
