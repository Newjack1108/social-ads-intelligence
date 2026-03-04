"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getDefaultDates() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 14);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaults = useMemo(() => getDefaultDates(), []);

  const start = searchParams.get("start") ?? defaults.start;
  const end = searchParams.get("end") ?? defaults.end;

  const setRange = useCallback(
    (newStart: string, newEnd: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newStart) params.set("start", newStart);
      else params.delete("start");
      if (newEnd) params.set("end", newEnd);
      else params.delete("end");
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex items-end gap-4 flex-wrap">
      <div className="space-y-2">
        <Label htmlFor="start">Start date</Label>
        <Input
          id="start"
          type="date"
          value={start}
          onChange={(e) => setRange(e.target.value, end)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="end">End date</Label>
        <Input
          id="end"
          type="date"
          value={end}
          onChange={(e) => setRange(start, e.target.value)}
        />
      </div>
    </div>
  );
}
