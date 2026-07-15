import { describe, it, expect } from "vitest";
import {
  categoryMovers,
  unusualExpenses,
  newCounterparties,
  selectInsights,
  MIN_DELTA_CENTS,
} from "./rules";

describe("categoryMovers", () => {
  it("reports a rise only above both thresholds (20% AND 25 €)", () => {
    const out = categoryMovers([
      { key: "c1", name: "Restaurants", currentCents: 35640, previousCents: 27000 },
      { key: "c2", name: "Coffee", currentCents: 1300, previousCents: 1000 },   // +30% but tiny
      { key: "c3", name: "Rent", currentCents: 96000, previousCents: 93000 },   // big € but +3%
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("increase");
    expect(out[0].headline).toContain("Restaurants");
  });

  it("reports decreases too", () => {
    const out = categoryMovers([
      // −24.4 % and −84,00 € — above both thresholds
      { key: "c1", name: "Groceries", currentCents: 26000, previousCents: 34400 },
    ]);
    expect(out[0].kind).toBe("decrease");
  });

  it("phrases a zero baseline as new, never a percent", () => {
    const out = categoryMovers([
      { key: "c1", name: "Fitness", currentCents: 8970, previousCents: 0 },
    ]);
    expect(out[0].kind).toBe("new-category");
    expect(out[0].headline).not.toContain("%");
    expect(out[0].detail).not.toContain("%");
  });
});

describe("unusualExpenses", () => {
  it("flags a transaction above 3x the category median (and above the floor)", () => {
    const medians = new Map([["shopping", 4500]]);
    const out = unusualExpenses(
      [
        { description: "MediaMarkt", counterpartyName: "MediaMarkt", amountCents: 28999, categoryKey: "shopping" },
        { description: "Socks", counterpartyName: null, amountCents: 900, categoryKey: "shopping" },
      ],
      medians
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("unusual-expense");
    expect(out[0].headline).toContain("MediaMarkt");
  });

  it("ignores small categories where 3x median is under the floor", () => {
    const medians = new Map([["coffee", 300]]);
    const out = unusualExpenses(
      [{ description: "Fancy beans", counterpartyName: null, amountCents: 1000, categoryKey: "coffee" }],
      medians
    );
    expect(out).toHaveLength(0); // 1000 < MIN_DELTA_CENTS
    expect(MIN_DELTA_CENTS).toBe(2500);
  });
});

describe("newCounterparties", () => {
  it("flags counterparties unseen in the previous period with >= 25 € total", () => {
    const out = newCounterparties(
      [
        { description: "x", counterpartyName: "Urban Sports Club", amountCents: 2990, categoryKey: "c" },
        { description: "x", counterpartyName: "Urban Sports Club", amountCents: 2990, categoryKey: "c" },
        { description: "x", counterpartyName: "Billa", amountCents: 5000, categoryKey: "c" },
        { description: "x", counterpartyName: "Tiny GmbH", amountCents: 300, categoryKey: "c" },
      ],
      new Set(["Billa"])
    );
    expect(out).toHaveLength(1);
    expect(out[0].headline).toContain("Urban Sports Club");
  });
});

describe("selectInsights", () => {
  it("returns at most 5, highest score first", () => {
    const mk = (score: number) => ({
      kind: "increase" as const,
      headline: `h${score}`,
      detail: "",
      score,
    });
    const out = selectInsights([mk(1), mk(9), mk(5), mk(7), mk(3), mk(8)]);
    expect(out.map((i) => i.score)).toEqual([9, 8, 7, 5, 3]);
  });
});
