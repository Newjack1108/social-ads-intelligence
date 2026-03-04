import { Suspense } from "react";
import { DateRangePicker } from "@/components/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseDateRange } from "@/lib/dashboard";
import { getCurrentUser, getWorkspacesForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

async function CampaignsContent({
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
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No workspace found.
        </CardContent>
      </Card>
    );
  }

  const params = await searchParams;
  const range = parseDateRange(params);

  const campaigns = await prisma.metaEntity.findMany({
    where: { workspaceId, entityType: "campaign" },
    include: {
      insights: {
        where: { date: { gte: range.start, lte: range.end } },
        include: { actions: true },
      },
    },
  });

  const rows = campaigns.map((c) => {
    const insights = c.insights;
    const spend = insights.reduce((s, i) => s + Number(i.spend), 0);
    const impressions = insights.reduce((s, i) => s + i.impressions, 0);
    const clicks = insights.reduce((s, i) => s + i.clicks, 0);
    let conversions = 0;
    for (const i of insights) {
      for (const a of i.actions) {
        if (
          ["purchase", "lead", "omni_purchase"].some((t) =>
            a.actionType.toLowerCase().includes(t)
          )
        ) {
          conversions += a.value;
        }
      }
    }
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    return {
      id: c.id,
      name: c.name ?? c.externalId,
      status: c.status,
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      conversions,
      cpa,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <DateRangePicker />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Campaign performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Aggregated metrics for the selected date range
          </p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">
              No campaign data. Ingest data from Make.com webhook.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.status ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(r.spend)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(r.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(r.clicks)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(r.ctr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(r.cpc)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(r.conversions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(r.cpa)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96" />
        </div>
      }
    >
      <CampaignsContent searchParams={searchParams} />
    </Suspense>
  );
}
