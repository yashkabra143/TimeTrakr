import { describe, it, expect } from "vitest";
import { parseCsvDate, detectDayFirst, isFutureDate } from "../../server/csv-date";

const ymd = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;

describe("detectDayFirst", () => {
  it("is day-first when a first part is over 12", () => {
    expect(detectDayFirst(["12/10/2026", "25/10/2026"])).toBe(true);
  });
  it("is month-first when a second part is over 12", () => {
    expect(detectDayFirst(["1/15/2026", "2/1/2026"])).toBe(false);
  });
  it("defaults to day-first when every date is ambiguous", () => {
    expect(detectDayFirst(["12/10/2026", "9/10/2026"])).toBe(true);
  });
  it("ignores non-numeric dates", () => {
    expect(detectDayFirst(["2026-10-12", "Oct 12, 2026"])).toBe(true);
  });
});

describe("parseCsvDate", () => {
  it("reads 12/10/2026 as 12 Oct in a day-first file (was 10 Dec)", () => {
    expect(ymd(parseCsvDate("12/10/2026", true))).toBe("2026-10-12");
  });
  it("reads 12/10/2026 as 10 Dec in a month-first file", () => {
    expect(ymd(parseCsvDate("12/10/2026", false))).toBe("2026-12-10");
  });
  it("uses the unambiguous part whatever the file order", () => {
    expect(ymd(parseCsvDate("25/10/2026", false))).toBe("2026-10-25");
    expect(ymd(parseCsvDate("10/25/2026", true))).toBe("2026-10-25");
  });
  it("handles ISO, dashes, 2-digit years and Upwork's text dates", () => {
    expect(ymd(parseCsvDate("2026-10-12"))).toBe("2026-10-12");
    expect(ymd(parseCsvDate("12-10-26", true))).toBe("2026-10-12");
    expect(ymd(parseCsvDate("Oct 12, 2026"))).toBe("2026-10-12");
  });
  it("rejects impossible dates and blanks", () => {
    expect(parseCsvDate("31/02/2026", true)).toBeNull();
    expect(parseCsvDate("")).toBeNull();
    expect(parseCsvDate("not a date")).toBeNull();
  });
});

describe("isFutureDate", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  it("flags dates after tomorrow", () => {
    expect(isFutureDate(new Date("2026-12-10T00:00:00Z"), now)).toBe(true);
  });
  it("allows today and the past", () => {
    expect(isFutureDate(new Date("2026-11-06T00:00:00Z"), now)).toBe(false);
    expect(isFutureDate(new Date("2026-10-12T00:00:00Z"), now)).toBe(false);
  });
});
