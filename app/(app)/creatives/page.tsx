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
import { getCreativesWithPerformance } from "@/lib/dashboard";
import { parseDateRange } from "@/lib/dashboard";
import { getCurrentUser, getWorkspacesForUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

async function CreativesContent({
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
  const creatives = await getCreativesWithPerformance(workspaceId, range);

  const sortedByCtr = [...creatives].sort((a, b) => b.ctr - a.ctr);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Creatives</h1>
        <DateRangePicker />
      </div>

      {sortedByCtr.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Best creatives by CTR</CardTitle>
            <p className="text-sm text-muted-foreground">
              Top-performing creatives by click-through rate
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedByCtr.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="border rounded-lg p-4 space-y-2 flex flex-col"
                >
                  {(c.thumbnailUrl || c.imageUrl) && (
                    <div className="w-full aspect-video relative rounded bg-muted overflow-hidden">
                      <Image
                        src={c.thumbnailUrl ?? c.imageUrl ?? ""}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div>
                    {c.primaryText && (
                      <p className="text-sm line-clamp-2">{c.primaryText}</p>
                    )}
                    {c.headline && (
                      <p className="text-xs font-medium mt-1">{c.headline}</p>
                    )}
                    {c.cta && (
                      <p className="text-xs text-muted-foreground">CTA: {c.cta}</p>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-auto pt-2">
                    <span>CTR: {formatPercent(c.ctr)}</span>
                    <span>CPA: {formatCurrency(c.cpa)}</span>
                    {c.videoCompletionRate > 0 && (
                      <span>Completion: {c.videoCompletionRate.toFixed(1)}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Creative performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Full table with primary text, headline, CTA combos
          </p>
        </CardHeader>
        <CardContent>
          {creatives.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">
              No creative data. Ingest creatives from Make.com webhook.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creative</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>CTA</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">Video 95%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creatives.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {(c.thumbnailUrl || c.imageUrl) && (
                          <div className="w-12 h-12 relative rounded overflow-hidden bg-muted shrink-0">
                            <Image
                              src={c.thumbnailUrl ?? c.imageUrl ?? ""}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                        <p className="text-sm line-clamp-2 max-w-[200px]">
                          {c.primaryText ?? "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {c.headline ?? "—"}
                    </TableCell>
                    <TableCell>{c.cta ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(c.spend)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(c.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(c.clicks)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(c.ctr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(c.conversions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(c.cpa)}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.videoCompletionRate > 0
                        ? `${c.videoCompletionRate.toFixed(1)}%`
                        : "—"}
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

export default async function CreativesPage({
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
      <CreativesContent searchParams={searchParams} />
    </Suspense>
  );
}
