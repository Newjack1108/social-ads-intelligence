"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface DataPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionValue: number;
  cpa: number;
  roas: number;
}

interface PerformanceChartProps {
  data: DataPoint[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No data for this date range
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: string) =>
              new Date(v).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `$${v}`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            formatter={(value: number, name: string) => {
              if (name === "spend") return [formatCurrency(value), "Spend"];
              if (name === "ctr") return [formatPercent(value), "CTR"];
              if (name === "conversions") return [value, "Conversions"];
              if (name === "roas") return [`${value.toFixed(2)}x`, "ROAS"];
              return [value, name];
            }}
            labelFormatter={(v: string) =>
              new Date(v).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="spend"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
            name="Spend"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="ctr"
            stroke="hsl(173 58% 39%)"
            fill="hsl(173 58% 39%)"
            fillOpacity={0.2}
            name="CTR"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
