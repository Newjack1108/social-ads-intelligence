import { Suspense } from "react";
import { DateRangePicker } from "@/components/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecommendations, parseDateRange } from "@/lib/dashboard";
import { getCurrentUser, getWorkspacesForUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

async function RecommendationsContent({
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
  const recommendations = await getRecommendations(workspaceId, range);

  const Icon = (severity: string) => {
    if (severity === "critical") return AlertCircle;
    if (severity === "warning") return AlertTriangle;
    return Info;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Recommendations</h1>
        <DateRangePicker />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Learning panel</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rules-based insights: fatigue, overspend, weak creatives, landing
            page issues
          </p>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-2">
                No recommendations for this date range.
              </p>
              <p className="text-sm text-muted-foreground">
                Recommendations are generated when we detect: creative fatigue
                (rising frequency + falling CTR), overspend with no conversions,
                or high clicks with low conversion rate.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((r, i) => {
                const IconComponent = Icon(r.severity);
                return (
                  <div
                    key={`${r.type}-${i}`}
                    className={`flex gap-4 p-4 rounded-lg border ${
                      r.severity === "critical"
                        ? "border-destructive/50 bg-destructive/5"
                        : r.severity === "warning"
                          ? "border-amber-500/50 bg-amber-500/5"
                          : "border-muted bg-muted/30"
                    }`}
                  >
                    <IconComponent
                      className={`h-5 w-5 shrink-0 mt-0.5 ${
                        r.severity === "critical"
                          ? "text-destructive"
                          : r.severity === "warning"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                      }`}
                    />
                    <div>
                      <h3 className="font-medium">{r.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {r.description}
                      </p>
                      {r.entityName && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Entity:</span>{" "}
                          {r.entityName}
                        </p>
                      )}
                      {r.metric && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {r.metric}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <RecommendationsContent searchParams={searchParams} />
    </Suspense>
  );
}
