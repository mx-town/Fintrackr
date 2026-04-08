import { TIER_TARGETS, type BudgetTier } from "./tiers";

export interface TierScore {
  tier: "needs" | "wants" | "savings";
  score: number; // 0-100
  targetAdherence: number; // 0-100
  trend: number; // 0-100
  customTargetCompliance: number; // 0-100
}

export interface BudgetScore {
  overall: number; // 0-100
  tiers: TierScore[];
}

export interface TierSpending {
  tier: "needs" | "wants" | "savings";
  amountCents: number;
}

export interface CategorySpendingHistory {
  categoryId: string;
  tier: "needs" | "wants" | "savings";
  currentAmountCents: number;
  avg3MonthCents: number;
  targetCents: number | null; // null = no custom target
}

const TIER_WEIGHTS = { needs: 0.4, wants: 0.35, savings: 0.25 } as const;
const ADHERENCE_WEIGHT = 0.6;
const TREND_WEIGHT = 0.25;
const COMPLIANCE_WEIGHT = 0.15;

/**
 * Computes how close tier spending is to the 50/30/20 target.
 * At target = 100, at 2x target = 0, linear interpolation.
 * Under target = 100 (no bonus for underspending).
 */
export function computeTargetAdherence(
  tierAmountCents: number,
  incomeCents: number,
  tier: "needs" | "wants" | "savings"
): number {
  if (incomeCents <= 0) return 0;
  const targetPct = TIER_TARGETS[tier];
  const targetCents = (incomeCents * targetPct) / 100;
  if (tierAmountCents <= targetCents) return 100;
  const overRatio = (tierAmountCents - targetCents) / targetCents;
  return Math.max(0, Math.round(100 - overRatio * 100));
}

/**
 * Compares current spending to 3-month average.
 * Flat or decreasing = 100. Increasing = penalized proportionally.
 * Doubling vs average = 0.
 */
export function computeTrendScore(
  currentCents: number,
  avg3MonthCents: number
): number {
  if (avg3MonthCents <= 0) return 100;
  if (currentCents <= avg3MonthCents) return 100;
  const increaseRatio = (currentCents - avg3MonthCents) / avg3MonthCents;
  return Math.max(0, Math.round(100 - increaseRatio * 100));
}

/**
 * Percentage of categories within the tier that are under their custom targets.
 * Categories without targets are ignored. If no targets exist, returns 100.
 */
export function computeCustomTargetCompliance(
  categories: CategorySpendingHistory[]
): number {
  const withTargets = categories.filter((c) => c.targetCents !== null);
  if (withTargets.length === 0) return 100;
  const compliant = withTargets.filter(
    (c) => c.currentAmountCents <= c.targetCents!
  );
  return Math.round((compliant.length / withTargets.length) * 100);
}

/**
 * Computes the full budget health score: overall + per-tier.
 */
export function computeBudgetScore(
  incomeCents: number,
  tierSpending: TierSpending[],
  tierHistories: Record<"needs" | "wants" | "savings", CategorySpendingHistory[]>,
  tierAvg3MonthCents: Record<"needs" | "wants" | "savings", number>
): BudgetScore {
  const tiers: TierScore[] = (["needs", "wants", "savings"] as const).map((tier) => {
    const spending = tierSpending.find((t) => t.tier === tier);
    const amountCents = spending?.amountCents ?? 0;
    const categories = tierHistories[tier] ?? [];
    const avg3Month = tierAvg3MonthCents[tier] ?? 0;

    const targetAdherence = computeTargetAdherence(amountCents, incomeCents, tier);
    const trend = computeTrendScore(amountCents, avg3Month);
    const customTargetCompliance = computeCustomTargetCompliance(categories);

    const score = Math.round(
      targetAdherence * ADHERENCE_WEIGHT +
      trend * TREND_WEIGHT +
      customTargetCompliance * COMPLIANCE_WEIGHT
    );

    return { tier, score, targetAdherence, trend, customTargetCompliance };
  });

  const overall = Math.round(
    tiers.reduce((sum, t) => sum + t.score * TIER_WEIGHTS[t.tier], 0)
  );

  return { overall, tiers };
}

export function getScoreColor(score: number): "green" | "amber" | "red" {
  if (score >= 80) return "green";
  if (score >= 50) return "amber";
  return "red";
}
