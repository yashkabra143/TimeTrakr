/** Market rate minus Upwork's conversion spread, rounded to 4 places like Upwork's. */
export function applyUpworkMargin(marketRate: number, marginPercent: number): number {
  return Math.round(marketRate * (1 - marginPercent / 100) * 10000) / 10000;
}
