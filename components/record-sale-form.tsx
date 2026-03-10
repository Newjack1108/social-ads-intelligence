"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SaleEntityOption } from "@/lib/sales";

const entityTypeLabel = {
  campaign: "Campaign",
  adset: "Ad Set",
  ad: "Ad",
};

export function RecordSaleForm({
  entities,
}: {
  entities: SaleEntityOption[];
}) {
  const router = useRouter();
  const [entityId, setEntityId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const date = formData.get("date") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const notes = (formData.get("notes") as string) || undefined;

    if (!entityId || !date || !amount || amount <= 0) {
      setError("Please fill in entity, date, and a valid amount.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: entityId,
          date,
          amount,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to record sale");
      }

      setEntityId("");
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record sale");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (entities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No campaigns, ad sets, or ads found. Ingest Meta data first via the
        webhook.
      </p>
    );
  }

  // Group by type for display
  const byType = {
    campaign: entities.filter((e) => e.entityType === "campaign"),
    adset: entities.filter((e) => e.entityType === "adset"),
    ad: entities.filter((e) => e.entityType === "ad"),
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="entityId">Attribution (Campaign, Ad Set, or Ad)</Label>
        <Select value={entityId || undefined} onValueChange={setEntityId}>
          <SelectTrigger id="entityId">
            <SelectValue placeholder="Select entity..." />
          </SelectTrigger>
          <SelectContent>
            {byType.campaign.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Campaigns
                </div>
                {byType.campaign.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({entityTypeLabel.campaign})
                  </SelectItem>
                ))}
              </>
            )}
            {byType.adset.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Ad Sets
                </div>
                {byType.adset.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({entityTypeLabel.adset})
                  </SelectItem>
                ))}
              </>
            )}
            {byType.ad.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Ads
                </div>
                {byType.ad.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({entityTypeLabel.ad})
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="date">Sale date</Label>
        <Input
          id="date"
          name="date"
          type="date"
          defaultValue={today}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Sale amount</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" name="notes" type="text" placeholder="e.g. Wedding package" />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Recording..." : "Record sale"}
      </Button>
    </form>
  );
}
