import { EmptyState } from "@/components/shared/empty-state";
import { SpendingCalendar } from "@/components/charts/calendar-heatmap";
import { SpendingTreemap } from "@/components/charts/treemap";
import { CategorySunburst } from "@/components/charts/sunburst";
import { MoneyFlowSankey } from "@/components/charts/sankey";
import { SpendingHeatmap } from "@/components/charts/spending-heatmap";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Upload } from "lucide-react";
import { getCalendarData, getCategoryHierarchy, getMoneyFlow, getWeekdayMatrix, getInsightPanelData } from "@/actions/insights";
import { InsightPanel } from "@/components/insights/insight-panel";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { parseDateParam } from "@/lib/date-params";
import { startOfYear, endOfYear, format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await ensureDb();

  const params = await searchParams;
  const now = new Date();
  const startDate = parseDateParam(params.from) ?? startOfYear(now);
  const endDate = parseDateParam(params.to) ?? endOfYear(now);

  // The calendar is inherently year-based: show the year containing endDate.
  const calendarYear = endDate.getFullYear();
  const calendarFrom = startOfYear(endDate);
  const calendarTo = endOfYear(endDate);

  const [calendarData, hierarchy, moneyFlow, weekday, panel] = await Promise.all([
    getCalendarData(DEFAULT_USER_ID, calendarYear),
    getCategoryHierarchy(DEFAULT_USER_ID, startDate, endDate),
    getMoneyFlow(DEFAULT_USER_ID, startDate, endDate),
    getWeekdayMatrix(DEFAULT_USER_ID, startDate, endDate),
    getInsightPanelData(DEFAULT_USER_ID, startDate, endDate),
  ]);

  const hasData =
    calendarData.length > 0 ||
    (hierarchy.treemapData.children && hierarchy.treemapData.children.length > 0);

  const periodLabel = `${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`;

  if (!hasData) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Insights
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {periodLabel} · spending patterns and category analysis
            </p>
          </div>
          <DateRangePicker />
        </div>
        <EmptyState
          icon={<Upload className="h-8 w-8 text-muted-foreground" />}
          title="No data to analyze"
          description="Upload your bank statements to unlock spending insights, heatmaps, and category breakdowns."
          actionLabel="Upload Transactions"
          actionHref="/upload"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 chart-stagger">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Insights
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel} · spending patterns and category analysis
          </p>
        </div>
        <DateRangePicker />
      </div>

      {!panel.hidden && <InsightPanel insights={panel.insights} />}

      {/* Full-year calendar heatmap */}
      <SpendingCalendar
        data={calendarData}
        from={format(calendarFrom, "yyyy-MM-dd")}
        to={format(calendarTo, "yyyy-MM-dd")}
      />

      {/* Treemap + Sunburst side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpendingTreemap data={hierarchy.treemapData} />
        <CategorySunburst data={hierarchy.sunburstData} />
      </div>

      {/* Sankey + Time Heatmap */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MoneyFlowSankey data={moneyFlow} />
        <SpendingHeatmap
          data={weekday.matrix}
          title="Which days cost you money?"
          subtitle="Average spending by weekday and month"
          footer={
            weekday.takeaway && weekday.takeaway.most.avg > 0 ? (
              <span>
                <strong className="text-foreground">
                  {weekday.takeaway.most.day}
                </strong>{" "}
                is your most expensive day —{" "}
                {formatCurrency(Math.round(weekday.takeaway.most.avg * 100))} on
                average vs. {formatCurrency(Math.round(weekday.takeaway.least.avg * 100))}{" "}
                on {weekday.takeaway.least.day}.
              </span>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
