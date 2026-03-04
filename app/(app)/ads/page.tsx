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
import { getAdsWithMetrics } from "@/lib/dashboard";
import { parseDateRange } from "@/lib/dashboard";
import { getCurrentUser, getWorkspacesForUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

async function AdsContent({
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
  const ads = await getAdsWithMetrics(workspaceId, range);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Ads</h1>
        <DateRangePicker />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ad performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ad-level metrics with creative thumbnails
          </p>
        </CardHeader>
        <CardContent>
          {ads.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">
              No ad data. Ingest data from Make.com webhook.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Creative</TableHead>
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
                {ads.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p>{a.name ?? a.externalId}</p>
                        {a.creative?.headline && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {a.creative.headline}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.creative?.thumbnailUrl || a.creative?.imageUrl ? (
                        <div className="w-12 h-12 relative rounded overflow-hidden bg-muted">
                          <Image
                            src={
                              a.creative.thumbnailUrl ?? a.creative.imageUrl ?? ""
                            }
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>{a.status ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(a.spend)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(a.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(a.clicks)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(a.ctr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(a.cpc)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(a.conversions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(a.cpa)}
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

export default async function AdsPage({
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
      <AdsContent searchParams={searchParams} />
    </Suspense>
  );
}
