// Earnings math shared by the calculators. Mirrors how entries are saved:
// service fee and TDS on gross, GST on the service fee.

export interface DeductionRates {
  serviceFee: number; // percent of gross
  tds: number;        // percent of gross
  gst: number;        // percent of the service fee
}

export interface Earnings {
  minutes: number;
  grossUsd: number;
  serviceFee: number;
  tds: number;
  gst: number;
  deductions: number;
  netUsd: number;
}

/** Average weeks in a month (52 weeks / 12 months). */
export const WEEKS_PER_MONTH = 52 / 12;

export function calcEarnings(minutes: number, hourlyRate: number, rates: DeductionRates): Earnings {
  const grossUsd = (Math.max(0, minutes) / 60) * Math.max(0, hourlyRate);
  const serviceFee = grossUsd * (rates.serviceFee / 100);
  const tds = grossUsd * (rates.tds / 100);
  const gst = serviceFee * (rates.gst / 100);
  const deductions = serviceFee + tds + gst;
  return { minutes, grossUsd, serviceFee, tds, gst, deductions, netUsd: Math.max(0, grossUsd - deductions) };
}

export function sumEarnings(items: Earnings[]): Earnings {
  return items.reduce(
    (a, e) => ({
      minutes: a.minutes + e.minutes,
      grossUsd: a.grossUsd + e.grossUsd,
      serviceFee: a.serviceFee + e.serviceFee,
      tds: a.tds + e.tds,
      gst: a.gst + e.gst,
      deductions: a.deductions + e.deductions,
      netUsd: a.netUsd + e.netUsd,
    }),
    { minutes: 0, grossUsd: 0, serviceFee: 0, tds: 0, gst: 0, deductions: 0, netUsd: 0 },
  );
}

export function scaleEarnings(e: Earnings, factor: number): Earnings {
  return {
    minutes: e.minutes * factor,
    grossUsd: e.grossUsd * factor,
    serviceFee: e.serviceFee * factor,
    tds: e.tds * factor,
    gst: e.gst * factor,
    deductions: e.deductions * factor,
    netUsd: e.netUsd * factor,
  };
}
