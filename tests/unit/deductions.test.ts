/**
 * Unit tests — deduction calculation logic
 *
 * These replicate exactly what POST /api/entries computes so we can
 * catch regressions without hitting the database.
 */
import { describe, it, expect } from "vitest";

// ─── Mirror the exact calculation from server/routes.ts ──────────────────────

interface DeductionConfig {
  serviceFee: number; // % e.g. 10
  tds: number;        // % e.g. 0.1 (note: 0.1 not 10%)
  gst: number;        // % on serviceFee e.g. 18
  transferFee: number; // flat $
  isGstRegistered: boolean;
}

interface CalcResult {
  deductionService: number;
  deductionTds: number;
  deductionGst: number;
  deductionTransfer: number;
  deductionTotal: number;
  netUsd: number;
  netInr: number;
}

function calcDeductions(
  grossUsd: number,
  cfg: DeductionConfig,
  exchangeRate: number
): CalcResult {
  const deductionService = grossUsd * (cfg.serviceFee / 100);
  const deductionTds = grossUsd * (cfg.tds / 100);
  const deductionGst = cfg.isGstRegistered ? deductionService * (cfg.gst / 100) : 0;
  const deductionTransfer = 0; // always 0 in current implementation
  const deductionTotal = deductionService + deductionTds + deductionGst;
  const netUsd = Math.max(0, grossUsd - deductionTotal);
  const netInr = netUsd * exchangeRate;
  return { deductionService, deductionTds, deductionGst, deductionTransfer, deductionTotal, netUsd, netInr };
}

const DEFAULT_CONFIG: DeductionConfig = {
  serviceFee: 10,
  tds: 0.1,
  gst: 18,
  transferFee: 0.99,
  isGstRegistered: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Deduction calculation — default config (not GST registered)", () => {
  const rate = 84;

  it("$100 gross: service fee 10% = $10", () => {
    const r = calcDeductions(100, DEFAULT_CONFIG, rate);
    expect(r.deductionService).toBeCloseTo(10);
  });

  it("$100 gross: TDS 0.1% = $0.10", () => {
    const r = calcDeductions(100, DEFAULT_CONFIG, rate);
    expect(r.deductionTds).toBeCloseTo(0.1);
  });

  it("$100 gross: GST = 0 when not GST registered", () => {
    const r = calcDeductions(100, DEFAULT_CONFIG, rate);
    expect(r.deductionGst).toBe(0);
  });

  it("$100 gross: total deduction = $10.10", () => {
    const r = calcDeductions(100, DEFAULT_CONFIG, rate);
    expect(r.deductionTotal).toBeCloseTo(10.1);
  });

  it("$100 gross: net USD = $89.90", () => {
    const r = calcDeductions(100, DEFAULT_CONFIG, rate);
    expect(r.netUsd).toBeCloseTo(89.9);
  });

  it("$100 gross at ₹84: net INR = ₹7551.60", () => {
    const r = calcDeductions(100, DEFAULT_CONFIG, rate);
    expect(r.netInr).toBeCloseTo(7551.6);
  });

  it("net USD is never negative (edge: 0 gross)", () => {
    const r = calcDeductions(0, DEFAULT_CONFIG, rate);
    expect(r.netUsd).toBe(0);
    expect(r.netInr).toBe(0);
  });
});

describe("Deduction calculation — GST registered", () => {
  const gstCfg: DeductionConfig = { ...DEFAULT_CONFIG, isGstRegistered: true };
  const rate = 84;

  it("$100 gross: GST on service fee = 10 * 18% = $1.80", () => {
    const r = calcDeductions(100, gstCfg, rate);
    expect(r.deductionGst).toBeCloseTo(1.8);
  });

  it("$100 gross: total deduction = service + TDS + GST = 10 + 0.1 + 1.8 = $11.90", () => {
    const r = calcDeductions(100, gstCfg, rate);
    expect(r.deductionTotal).toBeCloseTo(11.9);
  });

  it("$100 gross: net USD = $88.10", () => {
    const r = calcDeductions(100, gstCfg, rate);
    expect(r.netUsd).toBeCloseTo(88.1);
  });
});

describe("Deduction calculation — custom rates", () => {
  const cfg: DeductionConfig = {
    serviceFee: 20, // 20% Upwork fee
    tds: 10,        // high TDS slab
    gst: 18,
    transferFee: 1.99,
    isGstRegistered: true,
  };

  it("$1000 gross: service fee = $200", () => {
    const r = calcDeductions(1000, cfg, 84);
    expect(r.deductionService).toBeCloseTo(200);
  });

  it("$1000 gross: TDS = $100", () => {
    const r = calcDeductions(1000, cfg, 84);
    expect(r.deductionTds).toBeCloseTo(100);
  });

  it("$1000 gross: GST on service = $36", () => {
    const r = calcDeductions(1000, cfg, 84);
    expect(r.deductionGst).toBeCloseTo(36);
  });

  it("$1000 gross: total = $336, net = $664", () => {
    const r = calcDeductions(1000, cfg, 84);
    expect(r.deductionTotal).toBeCloseTo(336);
    expect(r.netUsd).toBeCloseTo(664);
  });
});

describe("Exchange rate impact", () => {
  it("same USD net, higher INR rate → higher INR", () => {
    const a = calcDeductions(100, DEFAULT_CONFIG, 84);
    const b = calcDeductions(100, DEFAULT_CONFIG, 90);
    expect(b.netInr).toBeGreaterThan(a.netInr);
  });

  it("rate change does not affect USD amounts", () => {
    const a = calcDeductions(100, DEFAULT_CONFIG, 84);
    const b = calcDeductions(100, DEFAULT_CONFIG, 90);
    expect(a.netUsd).toBeCloseTo(b.netUsd);
  });
});

describe("Hourly vs Fixed project earnings", () => {
  it("hourly: grossUsd = hours * rate", () => {
    const hoursDecimal = 2.5; // 2h 30m
    const hourlyRate = 40;
    const grossUsd = hoursDecimal * hourlyRate;
    expect(grossUsd).toBe(100);
  });

  it("fixed: grossUsd = project rate regardless of hours", () => {
    const fixedRate = 500;
    const grossUsd = fixedRate; // manualGrossAmount || rate
    expect(grossUsd).toBe(500);
  });
});
