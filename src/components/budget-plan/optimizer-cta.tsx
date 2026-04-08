"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptimizerCtaProps {
  hasLowScore: boolean; // true if any tier score < 50
}

export function OptimizerCta({ hasLowScore }: OptimizerCtaProps) {
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");
  const href = monthParam
    ? `/budget-plan/optimizer?month=${monthParam}`
    : "/budget-plan/optimizer";

  return (
    <div className="flex justify-center">
      <Link
        href={href}
        className={cn(
          "group relative inline-flex items-center justify-center rounded-lg border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        )}
      >
        {hasLowScore && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
        )}
        Optimize your budget
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
