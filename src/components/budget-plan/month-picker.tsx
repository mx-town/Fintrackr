"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, subMonths, addMonths } from "date-fns";

export function MonthPicker({ currentMonth, basePath = "/budget-plan" }: { currentMonth: string; basePath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const date = new Date(currentMonth + "-01T00:00:00");

  const navigate = (newDate: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", format(newDate, "yyyy-MM"));
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(subMonths(date, 1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium text-foreground">
        {format(date, "MMMM yyyy")}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(addMonths(date, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
