import { describe, it, expect } from "vitest";
import { parseDateParam } from "./date-params";

describe("parseDateParam", () => {
  it("parses a valid ISO date", () => {
    const d = parseDateParam("2026-07-07");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6);
  });

  it("returns null for undefined", () => {
    expect(parseDateParam(undefined)).toBeNull();
  });

  it("rejects non-ISO formats", () => {
    expect(parseDateParam("07.07.2026")).toBeNull();
    expect(parseDateParam("2026-7-7")).toBeNull();
  });

  it("rejects impossible dates", () => {
    expect(parseDateParam("2026-13-40")).toBeNull();
  });
});
