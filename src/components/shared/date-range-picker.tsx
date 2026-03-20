"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PRESETS = [
  {
    label: "This Month",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Last Month",
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    label: "Last 3 Months",
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 2)),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Year to Date",
    getValue: () => ({
      from: startOfYear(new Date()),
      to: new Date(),
    }),
  },
];

export function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState<{ from: Date; to: Date }>({
    from: searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : startOfMonth(new Date()),
    to: searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : endOfMonth(new Date()),
  });

  const applyRange = (from: Date, to: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from.toISOString().slice(0, 10));
    params.set("to", to.toISOString().slice(0, 10));
    router.push(`?${params.toString()}`);
    setDate({ from, to });
  };

  return (
    <div className="flex items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.label}
          variant="ghost"
          size="sm"
          className="hidden lg:inline-flex text-xs"
          onClick={() => {
            const { from, to } = preset.getValue();
            applyRange(from, to);
          }}
        >
          {preset.label}
        </Button>
      ))}
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="gap-2" />}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="text-xs">
            {format(date.from, "dd.MM.yy")} - {format(date.to, "dd.MM.yy")}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={date.from}
            selected={{ from: date.from, to: date.to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                applyRange(range.from, range.to);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
