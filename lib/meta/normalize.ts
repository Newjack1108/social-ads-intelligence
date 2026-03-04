import { prisma } from "@/lib/db";
import type { MetaWebhookPayload, InsightRow } from "./schema";
import { Decimal } from "@prisma/client/runtime/library";

async function getOrCreateEntity(
  workspaceId: string,
  entityType: "account" | "campaign" | "adset" | "ad",
  externalId: string,
  data: {
    name?: string;
    status?: string;
    effectiveStatus?: string;
    parentId?: string;
    accountId?: string;
  }
) {
  const existing = await prisma.metaEntity.findUnique({
    where: {
      workspaceId_entityType_externalId: {
        workspaceId,
        entityType,
        externalId,
      },
    },
  });
  if (existing) {
    await prisma.metaEntity.update({
      where: { id: existing.id },
      data: {
        name: data.name ?? existing.name,
        status: data.status ?? existing.status,
        effectiveStatus: data.effectiveStatus ?? existing.effectiveStatus,
      },
    });
    return existing.id;
  }
  const created = await prisma.metaEntity.create({
    data: {
      workspaceId,
      entityType,
      externalId,
      name: data.name,
      status: data.status,
      effectiveStatus: data.effectiveStatus,
      parentId: data.parentId,
      accountId: data.accountId,
    },
  });
  return created.id;
}

function parseDecimal(val: unknown): Decimal {
  if (val === null || val === undefined) return new Decimal(0);
  if (typeof val === "number") return new Decimal(val);
  if (typeof val === "string") return new Decimal(parseFloat(val) || 0);
  return new Decimal(0);
}

function parseNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return 0;
}

export async function normalizeMetaPayload(
  workspaceId: string,
  payload: MetaWebhookPayload
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  const accountId = payload.account_id.replace("act_", "");

  const entityCache = new Map<string, string>();

  const getEntityId = async (
    entityType: "account" | "campaign" | "adset" | "ad",
    externalId: string,
    row: InsightRow
  ): Promise<string> => {
    const key = `${entityType}:${externalId}`;
    if (entityCache.has(key)) return entityCache.get(key)!;

    let parentId: string | undefined;
    let accountExternalId = accountId;

    if (entityType === "campaign" && row.campaign_id) {
      const accId = await getOrCreateEntity(
        workspaceId,
        "account",
        `act_${accountId}`,
        {}
      );
      parentId = accId;
    } else if (entityType === "adset" && row.adset_id && row.campaign_id) {
      const campId = await getOrCreateEntity(
        workspaceId,
        "campaign",
        row.campaign_id,
        {
          name: row.campaign_name,
          accountId: `act_${accountId}`,
        }
      );
      parentId = campId;
    } else if (entityType === "ad" && row.ad_id && row.adset_id) {
      const adsetId = await getOrCreateEntity(
        workspaceId,
        "adset",
        row.adset_id,
        {
          name: row.adset_name,
          accountId: `act_${accountId}`,
        }
      );
      parentId = adsetId;
    }

    const id = await getOrCreateEntity(workspaceId, entityType, externalId, {
      name:
        entityType === "campaign"
          ? row.campaign_name
          : entityType === "adset"
            ? row.adset_name
            : entityType === "ad"
              ? row.ad_name
              : undefined,
      parentId,
      accountId: `act_${accountExternalId}`,
    });
    entityCache.set(key, id);
    return id;
  };

  let processed = 0;

  for (const row of payload.rows) {
    try {
      const entityExternalId =
        row.ad_id ?? row.adset_id ?? row.campaign_id ?? `act_${accountId}`;
      const entityType: "account" | "campaign" | "adset" | "ad" = row.ad_id
        ? "ad"
        : row.adset_id
          ? "adset"
          : row.campaign_id
            ? "campaign"
            : "account";

      const entityId = await getEntityId(entityType, entityExternalId, row);
      const date = new Date(row.date_start);

      const insightData = {
        entityId,
        date,
        spend: parseDecimal(row.spend),
        impressions: parseNumber(row.impressions),
        reach: parseNumber(row.reach),
        frequency: parseDecimal(row.frequency),
        clicks: parseNumber(row.clicks),
        uniqueClicks: parseNumber(row.unique_clicks),
        linkClicks: parseNumber(row.link_clicks),
        inlineLinkClicks: parseNumber(row.inline_link_clicks),
        outboundClicks: parseNumber(row.outbound_clicks),
        cpc: parseDecimal(row.cpc),
        cpm: parseDecimal(row.cpm),
        ctr: parseDecimal(row.ctr),
        uniqueCtr: parseDecimal(row.unique_ctr),
        cpp: parseDecimal(row.cpp),
        videoPlayActions: parseNumber(row.video_play_actions),
        videoThruplays: parseNumber(row.video_thruplays),
        videoP25Watched: parseNumber(row.video_p25_watched_actions),
        videoP50Watched: parseNumber(row.video_p50_watched_actions),
        videoP75Watched: parseNumber(row.video_p75_watched_actions),
        videoP95Watched: parseNumber(row.video_p95_watched_actions),
      };

      const insight = await prisma.metaInsightDaily.upsert({
        where: {
          entityId_date: { entityId, date },
        },
        create: insightData,
        update: insightData,
      });

      const allActions = [
        ...(row.actions ?? []),
        ...(row.action_values ?? []),
      ];
      for (const act of allActions) {
        await prisma.metaActionDaily.upsert({
          where: {
            insightDailyId_actionType: {
              insightDailyId: insight.id,
              actionType: act.action_type,
            },
          },
          create: {
            insightDailyId: insight.id,
            actionType: act.action_type,
            value: act.value ?? 0,
            actionValue: new Decimal(act.action_value ?? 0),
            attributionSetting: act.attribution_setting,
          },
          update: {
            value: act.value ?? 0,
            actionValue: new Decimal(act.action_value ?? 0),
          },
        });
      }

      const breakdownKeys = [
        "age",
        "gender",
        "country",
        "region",
        "placement",
        "device_platform",
        "publisher_platform",
        "platform_position",
      ];
      for (const key of breakdownKeys) {
        const val = (row as Record<string, unknown>)[key];
        if (val && typeof val === "string") {
          const metrics = [
            "spend",
            "impressions",
            "reach",
            "frequency",
            "clicks",
            "ctr",
            "cpc",
            "cpm",
          ];
          for (const m of metrics) {
            const mVal = (row as Record<string, unknown>)[m];
            if (typeof mVal === "number" || typeof mVal === "string") {
              await prisma.metaBreakdownDaily.upsert({
                where: {
                  insightDailyId_breakdownType_breakdownValue_metricName: {
                    insightDailyId: insight.id,
                    breakdownType: key,
                    breakdownValue: val,
                    metricName: m,
                  },
                },
                create: {
                  insightDailyId: insight.id,
                  breakdownType: key,
                  breakdownValue: val,
                  metricName: m,
                  metricValue: new Decimal(Number(mVal) || 0),
                },
                update: {
                  metricValue: new Decimal(Number(mVal) || 0),
                },
              });
            }
          }
        }
      }

      processed++;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      errors.push(`Row ${row.date_start} ${row.ad_id ?? row.campaign_id}: ${err}`);
    }
  }

  for (const creative of payload.creatives ?? []) {
    try {
      const adEntity = await prisma.metaEntity.findFirst({
        where: {
          workspaceId,
          entityType: "ad",
          externalId: creative.ad_id,
        },
      });
      if (adEntity) {
        await prisma.metaCreative.upsert({
          where: { adEntityId: adEntity.id },
          create: {
            adEntityId: adEntity.id,
            creativeId: creative.creative_id,
            primaryText: creative.primary_text,
            headline: creative.headline,
            description: creative.description,
            cta: creative.cta,
            destinationUrl: creative.destination_url,
            imageUrl: creative.image_url,
            videoUrl: creative.video_url,
            thumbnailUrl: creative.thumbnail_url,
          },
          update: {
            creativeId: creative.creative_id,
            primaryText: creative.primary_text,
            headline: creative.headline,
            description: creative.description,
            cta: creative.cta,
            destinationUrl: creative.destination_url,
            imageUrl: creative.image_url,
            videoUrl: creative.video_url,
            thumbnailUrl: creative.thumbnail_url,
            lastSeenAt: new Date(),
          },
        });
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      errors.push(`Creative ${creative.ad_id}: ${err}`);
    }
  }

  return { processed, errors };
}
