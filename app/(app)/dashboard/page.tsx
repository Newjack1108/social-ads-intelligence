import { Suspense } from "react";
import { DateRangePicker } from "@/components/date-range-picker";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAggregatedMetrics,
  getTimeSeriesData,
  parseDateRange,
} from "@/lib/dashboard";
import { getCurrentUser, getWorkspacesForUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { PerformanceChart } from "@/components/performance-chart";
import { Skeleton } from "@/components/ui/skeleton";

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/signin");

  const memberships = await getWorkspacesForUser(user.id);
  const workspaceId = memberships[0]?.workspaceId;
  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No workspace found. Join the default workspace (after running{" "}
              <code className="text-sm bg-muted px-1">npm run db:seed</code>) to
              view sample data.
            </p>
            <form action="/api/workspace/join-default" method="POST">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-10 px-4 py-2 hover:bg-primary/90"
              >
                Join default workspace
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const range = parseDateRange(params);
  const [metrics, timeSeries] = await Promise.all([
    getAggregatedMetrics(workspaceId, range),
    getTimeSeriesData(workspaceId, range),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <DateRangePicker />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KpiCard title="Spend" value={formatCurrency(metrics.spend)} />
        <KpiCard title="Impressions" value={formatNumber(metrics.impressions)} />
        <KpiCard title="Reach" value={formatNumber(metrics.reach)} />
        <KpiCard
          title="Frequency"
          value={metrics.frequency.toFixed(2)}
          description="Impressions per user"
        />
        <KpiCard title="Clicks" value={formatNumber(metrics.clicks)} />
        <KpiCard title="CTR" value={formatPercent(metrics.ctr)} />
        <KpiCard title="CPC" value={formatCurrency(metrics.cpc)} />
        <KpiCard title="CPM" value={formatCurrency(metrics.cpm)} />
        <KpiCard title="Conversions" value={formatNumber(metrics.conversions)} />
        <KpiCard title="CPA" value={formatCurrency(metrics.cpa)} />
        <KpiCard
          title="ROAS"
          value={metrics.roas > 0 ? `${metrics.roas.toFixed(2)}x` : "—"}
          description="Return on ad spend"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance over time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Spend, CTR, conversions, and ROAS
          </p>
        </CardHeader>
        <CardContent>
          <PerformanceChart data={timeSeries} />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      }
    >
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
