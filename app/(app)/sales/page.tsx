import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordSaleForm } from "@/components/record-sale-form";
import { getCurrentUser, getWorkspacesForUser } from "@/lib/auth";
import { getEntitiesForSalePicker } from "@/lib/sales";
import { redirect } from "next/navigation";

export default async function SalesPage() {
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

  const entities = await getEntitiesForSalePicker(workspaceId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Record sale</h1>
      <Card>
        <CardHeader>
          <CardTitle>Manual sale entry</CardTitle>
          <p className="text-sm text-muted-foreground">
            Record an actual sale and attribute it to a campaign, ad set, or ad.
            This updates ROAS and conversion metrics across the dashboard.
          </p>
        </CardHeader>
        <CardContent>
          <RecordSaleForm entities={entities} />
        </CardContent>
      </Card>
    </div>
  );
}
