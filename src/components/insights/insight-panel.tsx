import { TrendingUp, TrendingDown, Sparkles, AlertTriangle } from "lucide-react";
import type { Insight, InsightKind } from "@/lib/insights/rules";

const KIND_STYLES: Record<
  InsightKind,
  { icon: React.ReactNode; chip: string; delta: string }
> = {
  increase: {
    icon: <TrendingUp className="h-4 w-4" />,
    chip: "bg-rose-500/15 text-rose-400",
    delta: "text-rose-400",
  },
  decrease: {
    icon: <TrendingDown className="h-4 w-4" />,
    chip: "bg-primary/15 text-primary",
    delta: "text-primary",
  },
  "new-category": {
    icon: <Sparkles className="h-4 w-4" />,
    chip: "bg-blue-500/15 text-blue-400",
    delta: "text-blue-400",
  },
  "new-counterparty": {
    icon: <Sparkles className="h-4 w-4" />,
    chip: "bg-blue-500/15 text-blue-400",
    delta: "text-blue-400",
  },
  "unusual-expense": {
    icon: <AlertTriangle className="h-4 w-4" />,
    chip: "bg-amber-500/15 text-amber-400",
    delta: "text-amber-400",
  },
};

export function InsightPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-semibold">What stands out</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Compared with the previous period of the same length
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight, i) => {
          const s = KIND_STYLES[insight.kind];
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
            >
              <span
                className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${s.chip}`}
              >
                {s.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug">{insight.headline}</p>
                <p className={`mt-1 font-mono text-xs ${s.delta}`}>
                  {insight.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
