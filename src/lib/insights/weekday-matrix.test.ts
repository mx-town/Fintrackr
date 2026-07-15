import { describe, it, expect } from "vitest";
import { buildWeekdayMatrix, weekdayTakeaway } from "./weekday-matrix";

// June 2026: Mon Jun 1 … Tue Jun 30 (4 Saturdays: 6, 13, 20, 27)
const tx = (iso: string, cents: number) => ({
  date: new Date(`${iso}T00:00:00`),
  amountCents: cents,
});

describe("buildWeekdayMatrix", () => {
  it("averages by weekday occurrence, not raw sum", () => {
    const rows = buildWeekdayMatrix(
      [tx("2026-06-06", 4000), tx("2026-06-13", 2000)], // two of four Saturdays
      new Date("2026-06-01T00:00:00"),
      new Date("2026-06-30T23:59:59")
    );
    const sat = rows.find((r) => r.id === "Sat")!;
    // (4000 + 2000) / 4 Saturdays = 1500 cents = 15 €
    expect(sat.data).toEqual([{ x: "Jun", y: 15 }]);
  });

  it("orders rows Mon..Sun and columns chronologically", () => {
    const rows = buildWeekdayMatrix(
      [tx("2026-05-04", 1000), tx("2026-06-01", 1000)],
      new Date("2026-05-01T00:00:00"),
      new Date("2026-06-30T23:59:59")
    );
    expect(rows.map((r) => r.id)).toEqual([
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    ]);
    expect(rows[0].data.map((d) => d.x)).toEqual(["May", "Jun"]);
  });

  it("only counts weekday occurrences inside the range (partial months)", () => {
    // Range covers only Jun 1–7: exactly one of each weekday.
    const rows = buildWeekdayMatrix(
      [tx("2026-06-06", 3000)],
      new Date("2026-06-01T00:00:00"),
      new Date("2026-06-07T23:59:59")
    );
    const sat = rows.find((r) => r.id === "Sat")!;
    expect(sat.data).toEqual([{ x: "Jun", y: 30 }]); // ÷1, not ÷4
  });

  it("labels columns with the year when the range spans years", () => {
    const rows = buildWeekdayMatrix(
      [tx("2025-12-01", 1000), tx("2026-01-05", 1000)],
      new Date("2025-12-01T00:00:00"),
      new Date("2026-01-31T23:59:59")
    );
    expect(rows[0].data.map((d) => d.x)).toEqual(["Dec 25", "Jan 26"]);
  });

  it("returns [] when there are no transactions", () => {
    expect(
      buildWeekdayMatrix([], new Date("2026-06-01"), new Date("2026-06-30"))
    ).toEqual([]);
  });
});

describe("weekdayTakeaway", () => {
  it("names the most and least expensive weekday", () => {
    const rows = buildWeekdayMatrix(
      [tx("2026-06-06", 8000), tx("2026-06-02", 1000)], // Sat vs Tue
      new Date("2026-06-01T00:00:00"),
      new Date("2026-06-30T23:59:59")
    );
    const t = weekdayTakeaway(rows)!;
    expect(t.most.day).toBe("Sat");
    expect(t.least.day).toBe("Tue");
    expect(t.most.avg).toBeGreaterThan(t.least.avg);
  });

  it("returns null for empty input", () => {
    expect(weekdayTakeaway([])).toBeNull();
  });
});
