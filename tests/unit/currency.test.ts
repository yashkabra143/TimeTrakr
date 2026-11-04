import { describe, it, expect } from "vitest";
import { applyUpworkMargin } from "../../shared/currency";

describe("applyUpworkMargin", () => {
  it("returns the market rate when margin is 0", () => {
    expect(applyUpworkMargin(94.75, 0)).toBe(94.75);
  });

  it("subtracts the margin and rounds to 4 decimals", () => {
    expect(applyUpworkMargin(94.75, 1.8)).toBe(93.0445);
  });

});
