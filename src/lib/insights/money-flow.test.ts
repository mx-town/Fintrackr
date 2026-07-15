import { describe, it, expect } from "vitest";
import { buildMoneyFlow } from "./money-flow";

const inc = (name: string, totalCents: number) => ({ name, totalCents });

describe("buildMoneyFlow", () => {
  it("returns empty data when there is nothing to show", () => {
    expect(buildMoneyFlow([], [])).toEqual({ nodes: [], links: [] });
  });

  it("links incomes into Budget and Budget into expenses, in euros", () => {
    const flow = buildMoneyFlow(
      [inc("Salary", 280000)],
      [inc("Housing", 95000), inc("Groceries", 38000)]
    );
    expect(flow.links).toContainEqual({ source: "Salary", target: "Budget", value: 2800 });
    expect(flow.links).toContainEqual({ source: "Budget", target: "Housing", value: 950 });
    expect(flow.nodes.map((n) => n.id)).toContain("Budget");
  });

  it("adds a Savings node only when income exceeds expenses", () => {
    const surplus = buildMoneyFlow([inc("Salary", 100000)], [inc("Rent", 60000)]);
    expect(surplus.links).toContainEqual({ source: "Budget", target: "Savings", value: 400 });

    const deficit = buildMoneyFlow([inc("Salary", 50000)], [inc("Rent", 60000)]);
    expect(deficit.nodes.find((n) => n.id === "Savings")).toBeUndefined();
  });

  it("folds categories beyond the top 8 into Other", () => {
    const expenses = Array.from({ length: 11 }, (_, i) =>
      inc(`Cat${i}`, (11 - i) * 1000)
    );
    const flow = buildMoneyFlow([inc("Salary", 100000)], expenses);
    const targets = flow.links
      .filter((l) => l.source === "Budget" && l.target !== "Savings")
      .map((l) => l.target);
    expect(targets).toHaveLength(9); // top 8 + "Other"
    expect(targets).toContain("Other");
    // Other = Cat8(3000) + Cat9(2000) + Cat10(1000) = 60 €
    expect(flow.links.find((l) => l.target === "Other")!.value).toBe(60);
  });

  it("merges the fold into an existing Other category instead of duplicating", () => {
    const expenses = [
      inc("Other", 90000),
      ...Array.from({ length: 9 }, (_, i) => inc(`Cat${i}`, (9 - i) * 1000)),
    ];
    const flow = buildMoneyFlow([inc("Salary", 200000)], expenses);
    const otherLinks = flow.links.filter((l) => l.target === "Other");
    expect(otherLinks).toHaveLength(1);
  });

  it("renames a category that collides with the Budget node id", () => {
    const flow = buildMoneyFlow([inc("Salary", 10000)], [inc("Budget", 5000)]);
    expect(flow.links).toContainEqual({
      source: "Budget",
      target: "Budget (category)",
      value: 50,
    });
  });

  it("nets categories on both sides (refunds) so the graph never cycles", () => {
    const flow = buildMoneyFlow(
      [inc("Salary", 100000), inc("Groceries", 2000)], // 20 € refund
      [inc("Groceries", 30000)]
    );
    expect(flow.links.find((l) => l.source === "Groceries")).toBeUndefined();
    expect(flow.links).toContainEqual({ source: "Budget", target: "Groceries", value: 280 });
    // savings = 1000 − 280
    expect(flow.links).toContainEqual({ source: "Budget", target: "Savings", value: 720 });
  });

  it("keeps the income remainder when inflows exceed the category's expenses", () => {
    const flow = buildMoneyFlow(
      [inc("Transfers", 50000)],
      [inc("Transfers", 30000), inc("Rent", 10000)]
    );
    expect(flow.links).toContainEqual({ source: "Transfers", target: "Budget", value: 200 });
    expect(
      flow.links.find((l) => l.source === "Budget" && l.target === "Transfers")
    ).toBeUndefined();
  });
});
