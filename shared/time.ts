export type TimeFormat = "hm" | "fractional";

export interface ParsedTime {
  minutes: number;
  format: TimeFormat;
  usedLegacyFractional: boolean;
  hadOverflow: boolean;
  source: number | string;
}

const normalizeMinutes = (value: number) => Math.max(0, Math.round(value));

export const minutesToHoursDecimal = (minutes: number) => normalizeMinutes(minutes) / 60;

export const splitMinutes = (minutes: number) => {
  const safeMinutes = normalizeMinutes(minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return { hours, minutes: mins };
};

export const formatMinutesReadable = (minutes: number) => {
  const { hours, minutes: mins } = splitMinutes(minutes);
  if (hours === 0) return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  if (mins === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const hourText = hours === 1 ? 'hour' : 'hours';
  const minuteText = mins === 1 ? 'minute' : 'minutes';
  return `${hours} ${hourText} ${mins} ${minuteText}`;
};

const parseHm = (value: number | string) => {
  const asString = String(value).trim();
  const numeric = typeof value === "number" ? value : parseFloat(asString);

  if (Number.isNaN(numeric) || numeric < 0) {
    throw new Error("Invalid time input");
  }
  const [hoursPart, minutesPartRaw = ""] = asString.split(".");
  const hours = Number.parseInt(hoursPart || "0", 10) || 0;

  // Use the first two digits as minutes; pad single digit to represent tens
  const minuteDigits = minutesPartRaw ? Number.parseInt(minutesPartRaw.slice(0, 2).padEnd(2, "0"), 10) : 0;
  const totalMinutes = normalizeMinutes(hours * 60 + minuteDigits);

  return {
    minutes: totalMinutes,
    hadOverflow: minuteDigits >= 60,
  };
};

const parseFractional = (value: number | string) => {
  const asString = String(value).trim();
  const numeric = typeof value === "number" ? value : parseFloat(asString);
  if (Number.isNaN(numeric) || numeric < 0) throw new Error("Invalid time input");
  return {
    minutes: normalizeMinutes(numeric * 60),
    hadOverflow: false,
  };
};

const shouldInferLegacy = (value: number | string) => {
  const asString = String(value);
  const [hoursPart, decimal = ""] = asString.split(".");
  
  // If no decimal part, treat as H.MM format (e.g., "8" = 8h 0m)
  if (!decimal) return false;
  
  const decimalLength = decimal.length;
  
  // More than 2 decimal digits: definitely fractional (e.g., 1.333, 1.75)
  // Old clients commonly send values like 1.5, 1.75, 2.25 as fractional hours
  if (decimalLength > 2) return true;
  
  // Exactly 2 decimal digits: check if it's clearly H.MM format
  // In fractional hours, the decimal part represents a fraction of an hour (< 1.0)
  // So values where the second digit > 5 are impossible in fractional format
  // Examples: 1.60, 1.75, 1.99 must be H.MM (1h 60m, 1h 75m, 1h 99m)
  if (decimalLength === 2) {
    const firstDigit = parseInt(decimal[0], 10);
    const secondDigit = parseInt(decimal[1], 10);
    
    // If second digit > 5, it's definitely H.MM format
    // (e.g., 1.60 = 1h 60m = 2h, 1.75 = 1h 75m = 2h 15m)
    if (secondDigit > 5) return false;
    
    // If first digit is 5 and second is 0-5, it could be 0.50-0.55 hours (fractional)
    // or 0h 50m-0h 55m (H.MM). During migration, default to legacy to avoid corruption.
    // For values like 1.50, 1.25, etc., default to legacy (safer during migration)
    return true;
  }
  
  // Exactly 1 decimal digit (e.g., 1.5, 2.3, 0.5)
  // During migration, default to legacy fractional format to avoid data corruption
  // Old clients send 1.5 meaning 1.5 hours (90 min), not 1h 50m (110 min)
  // New clients should explicitly specify inputFormat: "hm" if they want H.MM format
  return true;
};

export const parseTimeInput = (
  value: number | string,
  opts?: { format?: TimeFormat; allowLegacyInference?: boolean }
): ParsedTime => {
  const useLegacy =
    opts?.format === "fractional" ||
    (!opts?.format && opts?.allowLegacyInference !== false && shouldInferLegacy(value));

  if (useLegacy) {
    const parsed = parseFractional(value);
    return {
      ...parsed,
      format: "fractional",
      usedLegacyFractional: true,
      source: value,
    };
  }

  const parsed = parseHm(value);
  return {
    ...parsed,
    format: "hm",
    usedLegacyFractional: false,
    source: value,
  };
};
