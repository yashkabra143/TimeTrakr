import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users defined first — all other tables reference it
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email"),
  fullName: text("full_name"),
  dateOfBirth: text("date_of_birth"),
  profilePicture: text("profile_picture"),
  password: text("password"),         // nullable — OAuth users have no password
  salt: text("salt"),                 // nullable — OAuth users have no salt
  googleId: text("google_id").unique(),
  githubId: text("github_id").unique(),
  availableFunds: real("available_funds"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  planType: text("plan_type").notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at"),
  razorpaySubId: text("razorpay_sub_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),           // nullable for backward compat; migration fills it
  name: text("name").notNull(),
  rate: real("rate").notNull(),
  color: text("color").notNull(),
  type: text("type").notNull().default("hourly"), // "hourly" or "fixed"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deductions = pgTable("deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),           // nullable for backward compat
  serviceFee: real("service_fee").notNull().default(10),
  tds: real("tds").notNull().default(0.1),
  gst: real("gst").notNull().default(18),
  transferFee: real("transfer_fee").notNull().default(0.99),
  isGstRegistered: boolean("is_gst_registered").notNull().default(false),
  taxSlabRate: real("tax_slab_rate").notNull().default(30),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const currencySettings = pgTable("currency_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),           // nullable for backward compat
  usdToInr: real("usd_to_inr").notNull().default(84.0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),           // nullable for backward compat
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  minutes: integer("minutes").notNull(),
  inputFormat: text("input_format").notNull().default("hm"),
  rawInput: text("raw_input"),
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

export const withdrawals = pgTable("Withdrawl", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),           // nullable for backward compat
  netEarnings: real("net_earnings").notNull(),
  transactionFee: real("transaction_fee").notNull().default(0.99),
  withdrawalAmount: real("withdrawal_amount").notNull(),
  withdrawalDate: timestamp("withdrawal_date").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tdsEntries = pgTable("tds_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  deductorName: text("deductor_name").notNull(),
  panNumber: text("pan_number"),
  amount: real("amount").notNull(),         // TDS amount in INR
  grossAmount: real("gross_amount").notNull(), // Gross invoice in INR
  certificateNumber: text("certificate_number"),
  quarter: text("quarter").notNull(),       // e.g. "Q1 FY2025-26"
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Insert schemas (userId always omitted — set server-side from session) ──

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertDeductionSchema = createInsertSchema(deductions).omit({
  id: true,
  userId: true,
  updatedAt: true,
});

export const insertCurrencySettingsSchema = createInsertSchema(currencySettings).omit({
  id: true,
  userId: true,
  updatedAt: true,
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  userId: true,
  inputFormat: true,
  rawInput: true,
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
  minutes: z.number().int().min(0).optional(),
  hours: z.number().min(0).optional(),
  inputFormat: z.enum(["hm", "fractional"]).optional(),
  rawInput: z.union([z.string(), z.number()]).optional(),
  date: z.coerce.date({ required_error: "Date is required" }),
  manualGrossAmount: z.number().optional(),
}).superRefine((data, ctx) => {
  if (typeof data.minutes === "undefined" && typeof data.hours === "undefined") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide minutes or hours",
      path: ["minutes"],
    });
  }
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  withdrawalDate: z.coerce.date({ required_error: "Withdrawal date is required" }),
});

// ── TypeScript types ──────────────────────────────────────────────────────

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

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;

export const insertTdsEntrySchema = createInsertSchema(tdsEntries).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  date: z.coerce.date(),
});

export type TdsEntry = typeof tdsEntries.$inferSelect;
export type InsertTdsEntry = z.infer<typeof insertTdsEntrySchema>;

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({
  id: true,
  createdAt: true,
});
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
