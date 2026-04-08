/**
 * Unit tests — shared/time.ts
 *
 * Critical: "8.20" = 8h 20m (H.MM format), NOT 8.2 hours.
 * This distinction drives all earnings calculations.
 */
import { describe, it, expect } from "vitest";
import {
  parseTimeInput,
  minutesToHoursDecimal,
  splitMinutes,
  formatMinutesReadable,
} from "../../shared/time.js";

// ─── parseTimeInput ───────────────────────────────────────────────────────────

describe("parseTimeInput — H.MM format (explicit)", () => {
  it("parses whole hours", () => {
    const r = parseTimeInput("8", { format: "hm" });
    expect(r.minutes).toBe(480);
    expect(r.format).toBe("hm");
  });

  it("parses H.MM: 8.20 = 8h 20m = 500 min", () => {
    const r = parseTimeInput("8.20", { format: "hm" });
    expect(r.minutes).toBe(500);
    expect(r.hadOverflow).toBe(false);
  });

  it("parses H.MM: 1.30 = 90 min", () => {
    expect(parseTimeInput("1.30", { format: "hm" }).minutes).toBe(90);
  });

  it("parses H.MM: 0.45 = 45 min", () => {
    expect(parseTimeInput("0.45", { format: "hm" }).minutes).toBe(45);
  });

  it("parses H.MM: 2.00 = 120 min", () => {
    expect(parseTimeInput("2.00", { format: "hm" }).minutes).toBe(120);
  });

  it("parses H.MM: 10.59 = 10h 59m = 659 min", () => {
    expect(parseTimeInput("10.59", { format: "hm" }).minutes).toBe(659);
  });

  it("single decimal digit treated as tens: 1.5 (hm) = 1h 50m = 110 min", () => {
    expect(parseTimeInput("1.5", { format: "hm" }).minutes).toBe(110);
  });

  it("sets hadOverflow=true when minutes part >= 60", () => {
    const r = parseTimeInput("1.60", { format: "hm" });
    expect(r.hadOverflow).toBe(true);
    expect(r.minutes).toBe(120); // 1h 60m rounds to 2h
  });

  it("rejects negative input", () => {
    expect(() => parseTimeInput("-1.00", { format: "hm" })).toThrow("Invalid time input");
  });

  it("rejects NaN", () => {
    expect(() => parseTimeInput("abc", { format: "hm" })).toThrow("Invalid time input");
  });

  it("returns 0 for '0'", () => {
    expect(parseTimeInput("0", { format: "hm" }).minutes).toBe(0);
  });
});

describe("parseTimeInput — fractional format (explicit)", () => {
  it("parses 1.5 = 90 min", () => {
    expect(parseTimeInput("1.5", { format: "fractional" }).minutes).toBe(90);
  });

  it("parses 0.5 = 30 min", () => {
    expect(parseTimeInput("0.5", { format: "fractional" }).minutes).toBe(30);
  });

  it("parses 2.25 = 135 min", () => {
    expect(parseTimeInput("2.25", { format: "fractional" }).minutes).toBe(135);
  });

  it("parses 8.0 = 480 min", () => {
    expect(parseTimeInput("8.0", { format: "fractional" }).minutes).toBe(480);
  });

  it("marks usedLegacyFractional=true", () => {
    expect(parseTimeInput("1.5", { format: "fractional" }).usedLegacyFractional).toBe(true);
  });
});

describe("parseTimeInput — legacy inference (no format specified)", () => {
  it("infers fractional for 1-decimal-digit input: 1.5 → 90 min (legacy)", () => {
    const r = parseTimeInput("1.5");
    expect(r.minutes).toBe(90);
    expect(r.usedLegacyFractional).toBe(true);
  });

  it("infers fractional for 2-decimal-digit with 2nd digit ≤ 5: 1.25 → 75 min", () => {
    const r = parseTimeInput("1.25");
    expect(r.minutes).toBe(75);
    expect(r.usedLegacyFractional).toBe(true);
  });

  // "1.60" → decimal="60", secondDigit=0 (≤5) → still infers fractional (legacy-safe)
  // 1.60 fractional hours = 96 min. To get H.MM (1h 60m=120min), pass format:"hm" explicitly.
  it("infers fractional for '1.60' (secondDigit=0, ≤5) → 96 min", () => {
    const r = parseTimeInput("1.60");
    expect(r.format).toBe("fractional");
    expect(r.minutes).toBe(96); // 1.60 * 60 = 96
  });

  // secondDigit > 5 triggers H.MM: "1.76" → decimal="76", secondDigit=6
  it("infers H.MM for '1.76' (secondDigit=6, >5) → 1h 76m = 136 min", () => {
    const r = parseTimeInput("1.76");
    expect(r.format).toBe("hm");
    expect(r.minutes).toBe(136); // 1h 76m, hadOverflow=true
  });

  it("infers fractional for > 2 decimal digits: 1.333 → 20 min", () => {
    const r = parseTimeInput("1.333");
    expect(r.usedLegacyFractional).toBe(true);
    expect(r.minutes).toBe(80); // 1.333 * 60 = 79.98 ≈ 80
  });
});

// ─── minutesToHoursDecimal ────────────────────────────────────────────────────

describe("minutesToHoursDecimal", () => {
  it("500 min → 8.333... hours", () => {
    expect(minutesToHoursDecimal(500)).toBeCloseTo(8.333, 2);
  });

  it("60 min → 1 hour", () => {
    expect(minutesToHoursDecimal(60)).toBe(1);
  });

  it("0 min → 0 hours", () => {
    expect(minutesToHoursDecimal(0)).toBe(0);
  });

  it("negative input clamped to 0", () => {
    expect(minutesToHoursDecimal(-60)).toBe(0);
  });
});

// ─── splitMinutes ─────────────────────────────────────────────────────────────

describe("splitMinutes", () => {
  it("500 → { hours: 8, minutes: 20 }", () => {
    expect(splitMinutes(500)).toEqual({ hours: 8, minutes: 20 });
  });

  it("90 → { hours: 1, minutes: 30 }", () => {
    expect(splitMinutes(90)).toEqual({ hours: 1, minutes: 30 });
  });

  it("60 → { hours: 1, minutes: 0 }", () => {
    expect(splitMinutes(60)).toEqual({ hours: 1, minutes: 0 });
  });

  it("45 → { hours: 0, minutes: 45 }", () => {
    expect(splitMinutes(45)).toEqual({ hours: 0, minutes: 45 });
  });

  it("0 → { hours: 0, minutes: 0 }", () => {
    expect(splitMinutes(0)).toEqual({ hours: 0, minutes: 0 });
  });
});

// ─── formatMinutesReadable ────────────────────────────────────────────────────

describe("formatMinutesReadable", () => {
  it("60 → '1 hour'", () => {
    expect(formatMinutesReadable(60)).toBe("1 hour");
  });

  it("120 → '2 hours'", () => {
    expect(formatMinutesReadable(120)).toBe("2 hours");
  });

  it("90 → '1 hour 30 minutes'", () => {
    expect(formatMinutesReadable(90)).toBe("1 hour 30 minutes");
  });

  it("1 → '1 minute'", () => {
    expect(formatMinutesReadable(1)).toBe("1 minute");
  });

  it("45 → '45 minutes'", () => {
    expect(formatMinutesReadable(45)).toBe("45 minutes");
  });

  it("0 → '0 minutes'", () => {
    expect(formatMinutesReadable(0)).toBe("0 minutes");
  });

  it("61 → '1 hour 1 minute'", () => {
    expect(formatMinutesReadable(61)).toBe("1 hour 1 minute");
  });
});
