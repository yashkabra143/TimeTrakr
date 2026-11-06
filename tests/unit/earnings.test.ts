import { describe, it, expect } from "vitest";
import { calcEarnings, sumEarnings, scaleEarnings, WEEKS_PER_MONTH } from "../../shared/earnings";
import { parseTimeInput } from "../../shared/time";

const UPWORK = { serviceFee: 10, tds: 0.1, gst: 18 };

describe("calcEarnings", () => {
  it("matches a real Upwork week: 12:20 hrs @ $8 → $98.67 gross, $9.87 fee, $1.78 GST, $0.10 WHT", () => {
    const e = calcEarnings(12 * 60 + 20, 8, UPWORK);
    expect(e.grossUsd).toBeCloseTo(98.67, 2);
    expect(e.serviceFee).toBeCloseTo(9.87, 2);
    expect(e.gst).toBeCloseTo(1.78, 2);
    expect(e.tds).toBeCloseTo(0.1, 2);
    expect(e.netUsd).toBeCloseTo(98.67 - 9.87 - 1.78 - 0.1, 1);
  });

  it("treats H.MM input as hours and minutes (1.30 = 1h 30m, not 1.3h)", () => {
    const { minutes } = parseTimeInput("1.30", { format: "hm" });
    expect(minutes).toBe(90);
    expect(calcEarnings(minutes, 8, UPWORK).grossUsd).toBeCloseTo(12, 6);
  });

  it("returns zero for no time or a negative rate", () => {
    expect(calcEarnings(0, 8, UPWORK).netUsd).toBe(0);
    expect(calcEarnings(60, -5, UPWORK).grossUsd).toBe(0);
  });
});

describe("weekly plan totals", () => {
  it("sums projects and scales a week to a month", () => {
    const week = sumEarnings([calcEarnings(10 * 60, 7, UPWORK), calcEarnings(40 * 60, 8, UPWORK)]);
    expect(week.minutes).toBe(50 * 60);
    expect(week.grossUsd).toBeCloseTo(70 + 320, 6);
    const month = scaleEarnings(week, WEEKS_PER_MONTH);
    expect(month.grossUsd).toBeCloseTo(390 * (52 / 12), 6);
    expect(month.minutes / 60).toBeCloseTo(50 * (52 / 12), 6);
  });
});
