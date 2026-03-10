import { prisma } from "./db";
import { formatCurrency } from "./utils";

export interface DateRange {
  start: Date;
  end: Date;
}

export function getDefaultDateRange(): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export function parseDateRange(searchParams: {
  start?: string;
  end?: string;
}): DateRange {
  const defaultRange = getDefaultDateRange();
  const start = searchParams.start
    ? new Date(searchParams.start)
    : defaultRange.start;
  const end = searchParams.end
    ? new Date(searchParams.end)
    : defaultRange.end;
  if (isNaN(start.getTime())) return defaultRange;
  if (isNaN(end.getTime())) return defaultRange;
  return { start, end };
}

async function getEntityIdsForRollup(
  workspaceId: string,
  entityId: string
): Promise<string[]> {
  const entities = await prisma.metaEntity.findMany({
    where: { workspaceId },
    select: { id: true, parentId: true },
  });
  const idSet = new Set<string>([entityId]);
  let frontier = [entityId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const pid of frontier) {
      for (const e of entities) {
        if (e.parentId === pid) {
          idSet.add(e.id);
          next.push(e.id);
        }
      }
    }
    frontier = next;
  }
  return Array.from(idSet);
}

async function getOfflineSalesInRange(workspaceId: string, range: DateRange) {
  return prisma.offlineSale.findMany({
    where: {
      workspaceId,
      date: { gte: range.start, lte: range.end },
    },
  });
}

export async function getAggregatedMetrics(
  workspaceId: string,
  range: DateRange
) {
  const insights = await prisma.metaInsightDaily.findMany({
    where: {
      entity: { workspaceId },
      date: { gte: range.start, lte: range.end },
    },
    include: {
      actions: true,
      entity: true,
    },
  });

  const totals = insights.reduce(
    (acc, i) => ({
      spend: acc.spend + Number(i.spend),
      impressions: acc.impressions + i.impressions,
      reach: acc.reach + i.reach,
      clicks: acc.clicks + i.clicks,
      conversions: acc.conversions,
      conversionValue: acc.conversionValue,
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0 }
  );

  const conversionActions = ["purchase", "lead", "omni_purchase", "omni_complete_registration"];
  for (const i of insights) {
    for (const a of i.actions) {
      if (conversionActions.some((t) => a.actionType.toLowerCase().includes(t))) {
        totals.conversions += a.value;
        totals.conversionValue += Number(a.actionValue);
      }
    }
  }

  const offlineSales = await getOfflineSalesInRange(workspaceId, range);
  for (const s of offlineSales) {
    totals.conversions += 1;
    totals.conversionValue += Number(s.amount);
  }

  const frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  const roas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;

  return {
    spend: totals.spend,
    impressions: totals.impressions,
    reach: totals.reach,
    frequency,
    clicks: totals.clicks,
    ctr,
    cpc,
    cpm,
    conversions: totals.conversions,
    conversionValue: totals.conversionValue,
    cpa,
    roas,
  };
}

export async function getTimeSeriesData(
  workspaceId: string,
  range: DateRange
) {
  const insights = await prisma.metaInsightDaily.findMany({
    where: {
      entity: { workspaceId },
      date: { gte: range.start, lte: range.end },
    },
    include: { actions: true },
    orderBy: { date: "asc" },
  });

  const byDate = new Map<
    string,
    {
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
  >();

  const conversionTypes = ["purchase", "lead", "omni_purchase", "omni_complete_registration"];
  for (const i of insights) {
    const d = i.date.toISOString().slice(0, 10);
    if (!byDate.has(d)) {
      byDate.set(d, {
        date: d,
        spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        conversionValue: 0,
        cpa: 0,
        roas: 0,
      });
    }
    const row = byDate.get(d)!;
    row.spend += Number(i.spend);
    row.impressions += i.impressions;
    row.clicks += i.clicks;
    for (const a of i.actions) {
      if (conversionTypes.some((t) => a.actionType.toLowerCase().includes(t))) {
        row.conversions += a.value;
        row.conversionValue += Number(a.actionValue);
      }
    }
  }

  const offlineSales = await getOfflineSalesInRange(workspaceId, range);
  for (const s of offlineSales) {
    const d = s.date.toISOString().slice(0, 10);
    if (!byDate.has(d)) {
      byDate.set(d, {
        date: d,
        spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        conversionValue: 0,
        cpa: 0,
        roas: 0,
      });
    }
    const row = byDate.get(d)!;
    row.conversions += 1;
    row.conversionValue += Number(s.amount);
  }

  for (const row of Array.from(byDate.values())) {
    row.ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    row.cpa = row.conversions > 0 ? row.spend / row.conversions : 0;
    row.roas = row.spend > 0 ? row.conversionValue / row.spend : 0;
  }

  return Array.from(byDate.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}

export async function getCampaignsWithMetrics(
  workspaceId: string,
  range: DateRange
) {
  const campaigns = await prisma.metaEntity.findMany({
    where: { workspaceId, entityType: "campaign" },
    include: {
      insights: {
        where: { date: { gte: range.start, lte: range.end } },
        include: { actions: true },
      },
    },
  });

  const offlineSales = await getOfflineSalesInRange(workspaceId, range);
  const salesByEntity = new Map<string, { count: number; value: number }>();
  for (const s of offlineSales) {
    const cur = salesByEntity.get(s.entityId) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(s.amount);
    salesByEntity.set(s.entityId, cur);
  }

  return Promise.all(
    campaigns.map(async (c) => {
      const insights = c.insights;
      const spend = insights.reduce((s, i) => s + Number(i.spend), 0);
      const impressions = insights.reduce((s, i) => s + i.impressions, 0);
      const clicks = insights.reduce((s, i) => s + i.clicks, 0);
      let conversions = 0;
      const convTypes = ["purchase", "lead", "omni_purchase"];
      for (const i of insights) {
        for (const a of i.actions) {
          if (convTypes.some((t) => a.actionType.toLowerCase().includes(t))) {
            conversions += a.value;
          }
        }
      }
      const rollupIds = await getEntityIdsForRollup(workspaceId, c.id);
      for (const eid of rollupIds) {
        const s = salesByEntity.get(eid) ?? { count: 0, value: 0 };
        conversions += s.count;
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
    })
  );
}

export async function getAdsetsWithMetrics(
  workspaceId: string,
  range: DateRange
) {
  const adsets = await prisma.metaEntity.findMany({
    where: { workspaceId, entityType: "adset" },
    include: {
      insights: {
        where: { date: { gte: range.start, lte: range.end } },
        include: { actions: true },
      },
      parent: true,
    },
  });

  const offlineSales = await getOfflineSalesInRange(workspaceId, range);
  const salesByEntity = new Map<string, { count: number; value: number }>();
  for (const s of offlineSales) {
    const cur = salesByEntity.get(s.entityId) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(s.amount);
    salesByEntity.set(s.entityId, cur);
  }

  return Promise.all(
    adsets.map(async (a) => {
      const insights = a.insights;
      const spend = insights.reduce((s, i) => s + Number(i.spend), 0);
      const impressions = insights.reduce((s, i) => s + i.impressions, 0);
      const clicks = insights.reduce((s, i) => s + i.clicks, 0);
      let conversions = 0;
      const convTypes = ["purchase", "lead", "omni_purchase"];
      for (const i of insights) {
        for (const act of i.actions) {
          if (convTypes.some((t) => act.actionType.toLowerCase().includes(t))) {
            conversions += act.value;
          }
        }
      }
      const rollupIds = await getEntityIdsForRollup(workspaceId, a.id);
      for (const eid of rollupIds) {
        const s = salesByEntity.get(eid) ?? { count: 0, value: 0 };
        conversions += s.count;
      }
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;
      return {
        id: a.id,
        name: a.name ?? a.externalId,
        campaign: a.parent?.name ?? a.parent?.externalId ?? "—",
        status: a.status,
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        conversions,
        cpa,
      };
    })
  );
}

export async function getAdsWithMetrics(
  workspaceId: string,
  range: DateRange
) {
  const entities = await prisma.metaEntity.findMany({
    where: {
      workspaceId,
      entityType: "ad",
    },
    include: {
      insights: {
        where: { date: { gte: range.start, lte: range.end } },
        include: { actions: true },
      },
      creatives: true,
    },
  });

  const offlineSales = await getOfflineSalesInRange(workspaceId, range);
  const salesByEntity = new Map<string, { count: number; value: number }>();
  for (const s of offlineSales) {
    const cur = salesByEntity.get(s.entityId) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(s.amount);
    salesByEntity.set(s.entityId, cur);
  }

  return entities.map((e) => {
    const insights = e.insights;
    const spend = insights.reduce((s, i) => s + Number(i.spend), 0);
    const impressions = insights.reduce((s, i) => s + i.impressions, 0);
    const clicks = insights.reduce((s, i) => s + i.clicks, 0);
    let conversions = 0;
    const convTypes = ["purchase", "lead", "omni_purchase"];
    for (const i of insights) {
      for (const a of i.actions) {
        if (convTypes.some((t) => a.actionType.toLowerCase().includes(t))) {
          conversions += a.value;
        }
      }
    }
    const adSales = salesByEntity.get(e.id) ?? { count: 0, value: 0 };
    conversions += adSales.count;
    const conversionValue = adSales.value;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    return {
      id: e.id,
      externalId: e.externalId,
      name: e.name,
      status: e.status,
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      conversions,
      cpa,
      creative: e.creatives[0],
      conversionValue,
    };
  });
}

export async function getCreativesWithPerformance(
  workspaceId: string,
  range: DateRange
) {
  const creatives = await prisma.metaCreative.findMany({
    where: {
      adEntity: { workspaceId },
    },
    include: {
      adEntity: {
        include: {
          insights: {
            where: { date: { gte: range.start, lte: range.end } },
            include: { actions: true },
          },
        },
      },
    },
  });

  const offlineSales = await getOfflineSalesInRange(workspaceId, range);
  const salesByEntity = new Map<string, { count: number; value: number }>();
  for (const s of offlineSales) {
    const cur = salesByEntity.get(s.entityId) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(s.amount);
    salesByEntity.set(s.entityId, cur);
  }

  return creatives.map((c) => {
    const insights = c.adEntity.insights;
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
    const adSales = salesByEntity.get(c.adEntityId) ?? { count: 0, value: 0 };
    conversions += adSales.count;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    const videoP95 = insights.reduce((s, i) => s + i.videoP95Watched, 0);
    const videoPlays = insights.reduce((s, i) => s + i.videoPlayActions, 0);
    const completionRate =
      videoPlays > 0 ? (videoP95 / videoPlays) * 100 : 0;

    return {
      ...c,
      spend,
      impressions,
      clicks,
      ctr,
      conversions,
      cpa,
      videoCompletionRate: completionRate,
    };
  });
}

export async function getRecommendations(
  workspaceId: string,
  range: DateRange
) {
  const insights = await prisma.metaInsightDaily.findMany({
    where: {
      entity: { workspaceId },
      date: { gte: range.start, lte: range.end },
    },
    include: {
      entity: true,
      actions: true,
    },
    orderBy: { date: "asc" },
  });

  const recommendations: {
    type: string;
    severity: "info" | "warning" | "critical";
    title: string;
    description: string;
    entityName?: string;
    metric?: string;
  }[] = [];

  const offlineSales = await getOfflineSalesInRange(workspaceId, range);
  const salesByEntity = new Map<string, number>();
  for (const s of offlineSales) {
    salesByEntity.set(s.entityId, (salesByEntity.get(s.entityId) ?? 0) + 1);
  }

  const byEntity = new Map<
    string,
    { entity: (typeof insights)[0]["entity"]; rows: (typeof insights) }
  >();
  for (const i of insights) {
    const key = i.entityId;
    if (!byEntity.has(key)) {
      byEntity.set(key, { entity: i.entity, rows: [] });
    }
    byEntity.get(key)!.rows.push(i);
  }

  for (const [, { entity, rows }] of byEntity) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

    const freq1 =
      firstHalf.reduce((s, r) => s + r.reach, 0) > 0
        ? firstHalf.reduce((s, r) => s + r.impressions, 0) /
          firstHalf.reduce((s, r) => s + r.reach, 0)
        : 0;
    const freq2 =
      secondHalf.reduce((s, r) => s + r.reach, 0) > 0
        ? secondHalf.reduce((s, r) => s + r.impressions, 0) /
          secondHalf.reduce((s, r) => s + r.reach, 0)
        : 0;
    const ctr1 =
      firstHalf.reduce((s, r) => s + r.impressions, 0) > 0
        ? (firstHalf.reduce((s, r) => s + r.clicks, 0) /
            firstHalf.reduce((s, r) => s + r.impressions, 0)) *
          100
        : 0;
    const ctr2 =
      secondHalf.reduce((s, r) => s + r.impressions, 0) > 0
        ? (secondHalf.reduce((s, r) => s + r.clicks, 0) /
            secondHalf.reduce((s, r) => s + r.impressions, 0)) *
          100
        : 0;

    if (freq2 > freq1 * 1.2 && ctr2 < ctr1 * 0.8) {
      recommendations.push({
        type: "fatigue",
        severity: "warning",
        title: "Creative fatigue detected",
        description:
          "Frequency is rising while CTR is declining. Consider refreshing creatives.",
        entityName: entity.name ?? entity.externalId,
        metric: `Frequency: ${freq1.toFixed(1)} → ${freq2.toFixed(1)}, CTR: ${ctr1.toFixed(2)}% → ${ctr2.toFixed(2)}%`,
      });
    }

    const totalSpend = rows.reduce((s, r) => s + Number(r.spend), 0);
    let totalConversions = 0;
    for (const r of rows) {
      for (const a of r.actions) {
        if (
          ["purchase", "lead", "omni_purchase"].some((t) =>
            a.actionType.toLowerCase().includes(t)
          )
        ) {
          totalConversions += a.value;
        }
      }
    }
    const rollupIds = await getEntityIdsForRollup(workspaceId, entity.id);
    const entityOfflineCount = rollupIds.reduce(
      (sum, id) => sum + (salesByEntity.get(id) ?? 0),
      0
    );
    totalConversions += entityOfflineCount;
    if (totalSpend > 100 && totalConversions === 0) {
      recommendations.push({
        type: "overspend",
        severity: "critical",
        title: "High spend, no conversions",
        description:
          "This entity has significant spend with zero conversions. Review targeting and creative.",
        entityName: entity.name ?? entity.externalId,
        metric: `Spend: ${formatCurrency(totalSpend)}`,
      });
    }
  }

  const allClicks = insights.reduce((s, r) => s + r.clicks, 0);
  let allConversions = 0;
  for (const r of insights) {
    for (const a of r.actions) {
      if (
        ["purchase", "lead", "omni_purchase"].some((t) =>
          a.actionType.toLowerCase().includes(t)
        )
      ) {
        allConversions += a.value;
      }
    }
  }
  const totalOfflineCount = offlineSales.length;
  allConversions += totalOfflineCount;
  if (allClicks > 500 && allConversions < allClicks * 0.01) {
    recommendations.push({
      type: "landing_page",
      severity: "warning",
      title: "Low conversion rate on clicks",
      description:
        "High click volume but very low conversions. Check landing page experience and relevance.",
      metric: `${allClicks} clicks, ${allConversions} conversions`,
    });
  }

  return recommendations;
}
