"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getTransactions } from "@/actions/transactions";
import { formatSignedCurrency, formatCurrency, normalizeMerchant } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

export interface DrilldownFilter {
  title: string;
  subtitle: string;
  type?: "income" | "expense";
  categoryId?: string;
  categoryIds?: string[];
  startDate: string; // ISO string
  endDate: string;   // ISO string
}

type TxRow = Awaited<ReturnType<typeof getTransactions>>[number];

// ---------------------------------------------------------------------------
// Counterparty grouping
// ---------------------------------------------------------------------------

interface CounterpartyGroup {
  key: string;
  label: string;
  rows: TxRow[];
  totalCents: number;
  /** net: expenses minus income within the group */
  netCents: number;
  dominantType: "income" | "expense" | "transfer";
  category: TxRow["category"];
}

function getGroupKey(tx: TxRow["transaction"]): string {
  // IBAN takes priority (exact match)
  if (tx.counterpartyIban) {
    const norm = tx.counterpartyIban.replace(/\s/g, "").toUpperCase();
    if (norm.length >= 15) return `iban:${norm}`;
  }
  // Normalize merchant name: strips numbers, special chars, reference IDs
  // e.g. "FPSKNS*165051762" and "FPSKNS*163232759" both → "fpskns"
  const raw = tx.counterpartyName || tx.description;
  const normalized = normalizeMerchant(raw);
  if (normalized.length > 0 && normalized !== "unknown") {
    return `merchant:${normalized}`;
  }
  // Ungroupable — keep standalone
  return `tx:${tx.id}`;
}

function groupByCounterparty(rows: TxRow[]): CounterpartyGroup[] {
  const map = new Map<string, CounterpartyGroup>();

  for (const row of rows) {
    const key = getGroupKey(row.transaction);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        label: row.transaction.counterpartyName || row.transaction.description,
        rows: [],
        totalCents: 0,
        netCents: 0,
        dominantType: row.transaction.type,
        category: row.category,
      };
      map.set(key, group);
    }
    group.rows.push(row);
    group.totalCents += row.transaction.amountCents;
    if (row.transaction.type === "expense") {
      group.netCents += row.transaction.amountCents;
    } else if (row.transaction.type === "income") {
      group.netCents -= row.transaction.amountCents;
    }
  }

  // Determine dominant type and sort rows by date desc within each group
  for (const group of map.values()) {
    const expenses = group.rows.filter((r) => r.transaction.type === "expense");
    group.dominantType = expenses.length >= group.rows.length / 2 ? "expense" : "income";
    group.rows.sort(
      (a, b) => new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime()
    );
  }

  // Sort groups: highest total first
  return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
}

// ---------------------------------------------------------------------------
// Single transaction row
// ---------------------------------------------------------------------------

function TxRowItem({ row, indent }: { row: TxRow; indent?: boolean }) {
  const { transaction: tx, category } = row;
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-muted/30 ${
        indent ? "ml-6" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {!indent && (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
            style={{
              backgroundColor: category?.color
                ? `${category.color}15`
                : "oklch(0.2 0.008 270)",
            }}
          >
            {category?.icon ?? "\u{1F4E6}"}
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${indent ? "max-w-[200px]" : "max-w-[180px]"}`}>
            {tx.counterpartyName || tx.description}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-muted-foreground font-mono-nums">
              {format(new Date(tx.date), "dd.MM.yyyy")}
            </span>
            {!indent && category && (
              <>
                <span className="text-muted-foreground/30">&middot;</span>
                <span className="text-[11px] text-muted-foreground">
                  {category.name ?? "Uncategorized"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <span
        className={`font-mono-nums text-sm font-semibold shrink-0 ${
          tx.type === "income"
            ? "text-[var(--color-income)]"
            : "text-[var(--color-expense)]"
        }`}
      >
        {formatSignedCurrency(tx.amountCents, tx.type, tx.currency)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped counterparty row (expandable)
// ---------------------------------------------------------------------------

function GroupRow({ group }: { group: CounterpartyGroup }) {
  const [expanded, setExpanded] = useState(false);

  // Single transaction — render directly, no grouping chrome
  if (group.rows.length === 1) {
    return <TxRowItem row={group.rows[0]} />;
  }

  const dateRange = (() => {
    const dates = group.rows.map((r) => new Date(r.transaction.date));
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    if (format(min, "MM.yyyy") === format(max, "MM.yyyy")) {
      return `${format(min, "dd.")}–${format(max, "dd.MM.yyyy")}`;
    }
    return `${format(min, "dd.MM.")}–${format(max, "dd.MM.yyyy")}`;
  })();

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30 cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base transition-transform group-hover:scale-110"
            style={{
              backgroundColor: group.category?.color
                ? `${group.category.color}15`
                : "oklch(0.2 0.008 270)",
            }}
          >
            {group.category?.icon ?? "\u{1F4E6}"}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium truncate max-w-[180px]">
              {group.label}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-muted-foreground font-mono-nums">
                {group.rows.length}x
              </span>
              <span className="text-muted-foreground/30">&middot;</span>
              <span className="text-[11px] text-muted-foreground font-mono-nums">
                {dateRange}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`font-mono-nums text-sm font-semibold ${
              group.dominantType === "income"
                ? "text-[var(--color-income)]"
                : "text-[var(--color-expense)]"
            }`}
          >
            {group.dominantType === "expense" ? "-" : ""}
            {formatCurrency(group.totalCents)}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-0.5 pb-1">
          {group.rows.map((row) => (
            <TxRowItem key={row.transaction.id} row={row} indent />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drilldown sheet
// ---------------------------------------------------------------------------

interface TransactionDrilldownProps {
  filter: DrilldownFilter | null;
  onClose: () => void;
  userId: string;
}

export function TransactionDrilldown({
  filter,
  onClose,
  userId,
}: TransactionDrilldownProps) {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!filter) {
      setRows([]);
      return;
    }

    startTransition(async () => {
      const results = await getTransactions(userId, {
        startDate: new Date(filter.startDate),
        endDate: new Date(filter.endDate),
        type: filter.type,
        categoryId: filter.categoryId,
        categoryIds: filter.categoryIds,
        limit: 50,
      });
      setRows(results);
    });
  }, [filter, userId]);

  const groups = groupByCounterparty(rows);

  // Build link to /transactions with filters
  const txLink = filter
    ? `/transactions?from=${filter.startDate.slice(0, 10)}&to=${filter.endDate.slice(0, 10)}${filter.type ? `&type=${filter.type}` : ""}${filter.categoryId ? `&category=${filter.categoryId}` : ""}`
    : "/transactions";

  return (
    <Sheet open={!!filter} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{filter?.title ?? "Transactions"}</SheetTitle>
          <SheetDescription>{filter?.subtitle ?? ""}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 -mx-0">
          {isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No transactions found for this filter.
            </p>
          ) : (
            <div className="space-y-0.5">
              {groups.map((group) => (
                <GroupRow key={group.key} group={group} />
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border/30">
          <Link
            href={txLink}
            className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            onClick={onClose}
          >
            View all in Transactions
            <ArrowRight className="h-4 w-4" />
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
