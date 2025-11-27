import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  rate: real("rate").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deductions = pgTable("deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceFee: real("service_fee").notNull().default(10),
  tds: real("tds").notNull().default(0.1),
  gst: real("gst").notNull().default(18),
  transferFee: real("transfer_fee").notNull().default(0.99),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const currencySettings = pgTable("currency_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  usdToInr: real("usd_to_inr").notNull().default(84.0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  hours: real("hours").notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),

  // Snapshotted calculations
  grossUsd: real("gross_usd").notNull(),
  deductionService: real("deduction_service").notNull(),
  deductionGst: real("deduction_gst").notNull(),
  deductionTds: real("deduction_tds").notNull(),
  deductionTransfer: real("deduction_transfer").notNull(),
  deductionTotal: real("deduction_total").notNull(),
  netUsd: real("net_usd").notNull(),
  netInr: real("net_inr").notNull(),
  exchangeRate: real("exchange_rate").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email"),
  fullName: text("full_name"),
  dateOfBirth: text("date_of_birth"),
  profilePicture: text("profile_picture"),
  password: text("password").notNull(), // Hashed password
  salt: text("salt").notNull(), // Salt for hashing
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertDeductionSchema = createInsertSchema(deductions).omit({
  id: true,
  updatedAt: true,
});

export const insertCurrencySettingsSchema = createInsertSchema(currencySettings).omit({
  id: true,
  updatedAt: true,
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  grossUsd: true,
  deductionService: true,
  deductionGst: true,
  deductionTds: true,
  deductionTransfer: true,
  deductionTotal: true,
  netUsd: true,
  netInr: true,
  exchangeRate: true,
  createdAt: true,
}).extend({
  date: z.coerce.date({
    required_error: "Date is required",
  }),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// Select schemas (TypeScript types)
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Deduction = typeof deductions.$inferSelect;
export type InsertDeduction = z.infer<typeof insertDeductionSchema>;

export type CurrencySetting = typeof currencySettings.$inferSelect;
export type InsertCurrencySetting = z.infer<typeof insertCurrencySettingsSchema>;

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
