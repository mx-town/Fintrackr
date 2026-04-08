"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CutSuggestionCard } from "./cut-suggestion-card";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";
import type { CutSuggestion } from "@/lib/budget-plan/suggestions";

interface CutSuggestionsListProps {
  suggestions: CutSuggestion[];
}

const TIER_FILTERS = ["all", "needs", "wants", "savings"] as const;

export function CutSuggestionsList({ suggestions }: CutSuggestionsListProps) {
  const [filter, setFilter] = useState<(typeof TIER_FILTERS)[number]>("all");

  const filtered =
    filter === "all"
      ? suggestions
      : suggestions.filter((s) => s.tier === filter);

  const totalSavings = filtered.reduce((sum, s) => sum + s.savingsCents, 0);

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Cut Suggestions</h2>
        <div className="flex gap-1">
          {TIER_FILTERS.map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t)}
              className="text-xs"
            >
              {t === "all" ? "All" : TIER_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      {/* Total savings summary */}
      {filtered.length > 0 && totalSavings > 0 && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          Total potential savings:{" "}
          <span className="font-bold">
            {new Intl.NumberFormat("de-AT", {
              style: "currency",
              currency: "EUR",
            }).format(totalSavings / 100)}
            /mo
          </span>
        </div>
      )}

      {/* Suggestion cards or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8" />
          <p className="font-medium">Looking good!</p>
          <p className="text-sm">No major areas to cut right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((suggestion) => (
            <CutSuggestionCard
              key={suggestion.categoryId}
              suggestion={suggestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
