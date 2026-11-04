import { storage } from "./storage.js";
import { applyUpworkMargin } from "../shared/currency.js";

// Live USD → INR rate, shared by every request on a warm instance.
// The upstream sources publish daily rates, so a 10-minute cache loses nothing.
const CACHE_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

let cached: { rate: number; at: number } | null = null;

async function fetchRate(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!r.ok) return null;
    const data = (await r.json()) as { rates?: { INR?: unknown } };
    const rate = data.rates?.INR;
    return typeof rate === "number" && isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/** Current USD → INR rate, or null when every source is unavailable. */
export async function getLiveUsdInr(): Promise<number | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rate;
  const rate =
    (await fetchRate("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR")) ??
    (await fetchRate("https://open.er-api.com/v6/latest/USD"));
  if (rate !== null) cached = { rate, at: Date.now() };
  return rate;
}

/**
 * Saves the rate Upwork would pay today (live market rate minus the user's
 * Upwork margin) and returns the settings. Keeps the stored rate when the live
 * rate can't be fetched.
 */
export async function refreshUserCurrency(userId: string) {
  const current = await storage.getCurrencySettings(userId);
  const live = await getLiveUsdInr();
  if (live === null) return current;
  const rate = applyUpworkMargin(live, Number(current.upworkMarginPercent) || 0);
  if (Math.abs(Number(current.usdToInr) - rate) < 0.00005) return current;
  return storage.updateCurrencySettings(userId, { usdToInr: rate });
}
