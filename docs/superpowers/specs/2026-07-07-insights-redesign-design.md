# Insights Page Redesign — Design Spec

**Date:** 2026-07-07
**Status:** Approved by user (visual mockup reviewed and accepted)
**Mockup:** https://claude.ai/code/artifact/c4f17b9e-8413-450a-a291-4a69b443963a

## Goal

Upgrade the Insights page from a fixed current-year view with two "Coming soon"
placeholders into a polished, period-aware analysis page with a money-flow
Sankey, a weekday spending heatmap, and a rule-based "What stands out" insight
panel. Delivered in three independently shippable stages.

**Quality bar (explicit user requirement):** the result must look and feel
genuinely professional — consistent with the existing "Obsidian Vault" design
system (dark, emerald primary, Cascadia Code for numerals), with polished
empty/loading states, smooth chart animations, and hover tooltips matching the
existing `nivoTheme` styling. No placeholder-quality UI.

## Constraints & facts discovered

- Bank data contains **no time-of-day** — all transaction timestamps are
  midnight (verified against the live DB). An hour-based heatmap is therefore
  impossible; the "Spending by Time" placeholder becomes a
  **weekday × month** heatmap instead.
- `MoneyFlowSankey` ([sankey.tsx](../../../src/components/charts/sankey.tsx))
  and `SpendingHeatmap`
  ([spending-heatmap.tsx](../../../src/components/charts/spending-heatmap.tsx))
  already exist but are not wired up anywhere. Reuse them.
- The app palette pair `#60a5fa` (blue) / `#a78bfa` (purple) is nearly
  indistinguishable under deuteranopia (ΔE 0.3). Chart node/segment ordering
  must never place them adjacent, and Sankey nodes carry direct labels.
- Offline-first philosophy: insight generation is **rule-based, no LLM**.

## Stage 1 — Period control for Insights

- Insights page reads `from`/`to` query params (same ISO-date validation
  pattern as the dashboard, [page.tsx](<../../../src/app/(dashboard)/page.tsx>)).
  Default remains the current year.
- Reuse the existing `DateRangePicker` in the page header.
- Treemap and Sunburst use the exact selected range via the existing
  `getCategoryHierarchy(userId, start, end)`.
- The calendar heatmap always renders the full year containing the selected
  **end date** (calendars are inherently year-based); `getCalendarData` is
  unchanged.
- Page subtitle shows the active period.

## Stage 2 — Fill the two placeholders

### Money Flow (Sankey)

- New server query `getMoneyFlow(userId, start, end)` in
  [insights.ts](../../../src/actions/insights.ts).
- Flow shape: income categories (e.g. Salary, Other income) → single
  **Budget** node → top 8 expense categories by total, remaining ones folded
  into **Other**; surplus (income − expenses, if positive) flows to
  **Savings**.
- If expenses exceed income, no Savings node is shown (no negative links).
- Rendered with the existing `MoneyFlowSankey` component; empty state already
  built in.

### Weekday pattern heatmap (replaces "Spending by Time")

- New server query aggregating expenses by weekday × month for the selected
  range: average spend per weekday occurrence (not raw sum, so partial months
  don't skew).
- Rendered with the existing `SpendingHeatmap` component; rows Mon–Sun,
  columns = months in range; title changed to "Which days cost you money?".
- A one-line takeaway under the chart names the most expensive weekday vs. the
  cheapest (e.g. "Saturdays average €68 vs. €31 on Tuesdays").

## Stage 3 — "What stands out" insight panel

- Panel at the top of the Insights page, 3–5 cards comparing the selected
  period against the **previous period of equal length**.
- Rules live as **pure functions in `src/lib/insights/`** (no DB access,
  unit-testable); a server query supplies both periods' aggregates.
- Rule set (initial):
  1. **Category movers:** largest increases/decreases; report only if
     ≥ 20 % change **and** ≥ €25 absolute difference (noise floor).
  2. **Unusual single expense:** a transaction far above the category's
     typical size (e.g. > 3× the category median for the period pair).
  3. **New counterparty:** counterparty absent in previous period with
     meaningful total spend (≥ €25).
  4. **Previous period = 0** → phrase as "new this period", never a percent
     (no division by zero).
- Ranking: rules produce candidates with a significance score; top 3–5 shown.
- Panel is hidden entirely when the previous period has no data or fewer than
  a minimum number of transactions (no hollow statements).
- Visual language per mockup: icon chip (▲ increase / ▼ decrease / ★ new /
  ! unusual) with semantic colors (rose / emerald / blue / amber), monospace
  delta line.

## Error handling

- Invalid or missing query params fall back to defaults (existing dashboard
  pattern).
- Empty selected range keeps the existing EmptyState behavior.
- All new charts render their built-in empty states when queries return
  nothing.

## Testing

- Unit tests for the `src/lib/insights/` rule functions (movers threshold,
  zero-baseline phrasing, new-counterparty detection, ranking).
- Weekday averaging logic (partial months) covered by unit test.
- Manual verification of the page against the mockup in both dev and build.

## Out of scope

- LLM-generated insights, recurring-payment detection, dashboard changes,
  Sankey drill-down interactions.
