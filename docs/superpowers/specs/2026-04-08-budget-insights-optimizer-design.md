# Budget Insights & Optimizer — Design Spec

**Date:** 2026-04-08
**Status:** Draft

## Overview

Enhance the existing budget plan page with a health scorecard and money flow visualization, and add a new Budget Optimizer page with actionable cut suggestions and an interactive what-if simulator. The goal is to make the budget plan **actionable** — not just showing how money is allocated, but helping users understand what to cut and what needs improvement.

## Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| What to show | Scorecard + money flow + cut suggestions + simulator | User wants the full package |
| How to judge "cuttable" | Trend vs. history + custom user targets | Combines personal trends with explicit goals |
| Money flow detail | Two levels, expandable to three (counterparties) | Progressive disclosure — clean by default |
| Scorecard format | Overall score (0-100) + per-tier scores | Big picture + detail |
| Cut suggestions format | Prioritized list + what-if simulator | All three options combined for maximum actionability |
| Page structure | Scorecard + money flow on budget plan page; optimizer on separate sub-page | Each page has a clear narrative |
| Architecture | Page-native sections (Approach B) | Simpler, avoids premature abstraction |

---

## Part 1: Budget Plan Page Enhancements

### 1.1 Budget Health Scorecard

**Position:** Top of the `/budget-plan` page, above existing content.

**Layout:**
- Overall score (0–100) displayed prominently with a color gradient (red/yellow/green)
- Below it, 3 per-tier scores for Needs, Wants, Savings
- Clicking a tier score scrolls to the relevant detail section

**Score color mapping:**
- 80–100: Green — on track
- 50–79: Yellow/amber — needs attention
- 0–49: Red — over budget

### 1.2 Money Flow Breakdown

**Position:** Below scorecard, above existing 50/30/20 bar.

**Visualization:**
- Sankey-style or stacked waterfall chart: Income -> Tiers -> Categories
- Two levels visible by default (Income -> Tier split)
- Click a tier to expand and see categories within it
- Click a category to expand and see top counterparties
- Each node shows amount + percentage of income

**Mobile:** On small screens, switch from Sankey to a nested list with expand/collapse.

### 1.3 Existing Content

The current KPI cards, 50/30/20 comparison bar, daily budget card, tier donut, and category table remain below the new sections unchanged.

---

## Part 2: Budget Optimizer Page

**Route:** `/budget-plan/optimizer`
**Access:** CTA button on the budget plan page below the scorecard ("Optimize your budget ->"). If any tier scores below 50, the button shows an attention indicator (yellow dot).

### 2.1 Cut Suggestions List

**Position:** Top half of the optimizer page.

Each suggestion card shows:
- Category name + icon
- Current month spending vs. previous month (or 3-month average)
- Trend arrow + percentage change (e.g. "up 40%")
- Number of consecutive months spending has been rising
- Potential savings if user returns to previous level
- Custom target violation flag (if applicable)

**Behavior:**
- Ranked by potential savings (highest first)
- Filterable by tier (Needs/Wants/Savings)
- Empty state: "Looking good — no major areas to cut right now"

### 2.2 What-If Simulator

**Position:** Bottom half of the optimizer page.

**Layout:**
- Left side: All spending categories as adjustable rows
  - Each row: category name, current spending, editable input/slider for hypothetical amount
  - Pre-populated with actual spending
- Right side panel (real-time updates):
  - New overall budget score vs. current
  - New per-tier scores vs. current
  - Total monthly savings from adjustments
  - Projected yearly savings
- "Reset" button to return to actuals
- "Apply as targets" button to save hypothetical amounts as custom category targets

**Mobile:** Slider becomes number input. Real-time panel moves below the category list.

### 2.3 Custom Category Targets

Integrated into the simulator via "Apply as targets." Saved targets:
- Appear on the cut suggestions list when exceeded
- Factor into the budget health score (custom target compliance component)

---

## Part 3: Scoring Algorithm

### Overall Score
Weighted average of tier scores:
- Needs: 40%
- Wants: 35%
- Savings: 25%

### Per-Tier Score (0–100)

Three components:

| Component | Weight | Logic |
|---|---|---|
| Target adherence | 60% | How close tier spending is to the 50/30/20 target. At target = 100, over by 2x = 0, linear interpolation. |
| Trend | 25% | Compares current month to 3-month average. Flat or decreasing = 100, increasing = penalized proportionally. |
| Custom target compliance | 15% | % of categories in the tier within user-set targets. No targets set = defaults to 100. |

---

## Part 4: Data & Backend

### New Server Actions

| Action | Purpose |
|---|---|
| `getBudgetScore(userId, month)` | Computes overall + per-tier scores |
| `getCutSuggestions(userId, month)` | Returns ranked suggestions comparing current month to 3-month average, flags custom target violations |
| `simulateBudget(userId, month, adjustments)` | Takes hypothetical category amounts, recomputes scores without persisting |
| `saveCategoryTargets(userId, targets[])` | Persists custom category targets |

### Database Changes

**New `categoryTargets` table:**

| Column | Type | Description |
|---|---|---|
| id | TEXT (PK) | Unique identifier |
| userId | TEXT (FK) | References users table |
| categoryId | TEXT (FK) | References categories table |
| amountCents | INTEGER | Target spending amount in cents |
| period | TEXT | Budget period (default: "monthly") |
| createdAt | TEXT | Creation timestamp |
| updatedAt | TEXT | Last update timestamp |

Separate from the categories table for clean separation and per-user targets on system categories.

### Data Reuse

- Leverages existing `computeNetSpending()` for all spending calculations
- Leverages existing `getCategoryTier()` for tier assignments
- Previous months data queryable from transactions table with date filters

---

## Part 5: Navigation & UX

### Month Context
- Both pages share the same `?month=yyyy-MM` query param
- Navigating from budget plan to optimizer carries the current month forward
- Optimizer uses the same month picker component

### Navigation
- No new top-level sidebar entry — optimizer is a sub-page of budget plan
- Accessed via CTA button on the budget plan page

### Responsive Behavior

| Element | Desktop | Mobile |
|---|---|---|
| Scorecard | Horizontal row of scores | Vertical stack (overall on top) |
| Money flow chart | Sankey diagram | Nested expand/collapse list |
| Simulator inputs | Sliders | Number inputs |
| Simulator panel | Side-by-side | Stacked (panel below list) |

### Empty States

| Scenario | Message |
|---|---|
| No income recorded | "Add income transactions to see your budget analysis" |
| No previous months for trend | Scores skip trend component, show "Not enough history" note |
| No custom targets | Simulator "Apply as targets" prompt encourages first use |
| No suggestions to cut | "Looking good — no major areas to cut right now" |
