import { z } from "zod";

const actionSchema = z.object({
  action_type: z.string(),
  value: z.number().default(0),
  action_value: z.number().default(0),
  attribution_setting: z.string().optional(),
});

const breakdownValueSchema = z.record(z.string(), z.union([z.number(), z.string()]));

const insightRowSchema = z.object({
  account_id: z.string().optional(),
  campaign_id: z.string().optional(),
  campaign_name: z.string().optional(),
  adset_id: z.string().optional(),
  adset_name: z.string().optional(),
  ad_id: z.string().optional(),
  ad_name: z.string().optional(),
  date_start: z.string(),
  date_stop: z.string().optional(),
  spend: z.number().default(0),
  impressions: z.number().default(0),
  reach: z.number().default(0),
  frequency: z.number().default(0),
  clicks: z.number().default(0),
  unique_clicks: z.number().default(0),
  link_clicks: z.number().default(0),
  inline_link_clicks: z.number().default(0),
  outbound_clicks: z.number().default(0),
  cpc: z.number().default(0),
  cpm: z.number().default(0),
  ctr: z.number().default(0),
  unique_ctr: z.number().default(0),
  cpp: z.number().default(0),
  video_play_actions: z.number().default(0),
  video_thruplays: z.number().default(0),
  video_p25_watched_actions: z.number().default(0),
  video_p50_watched_actions: z.number().default(0),
  video_p75_watched_actions: z.number().default(0),
  video_p95_watched_actions: z.number().default(0),
  actions: z.array(actionSchema).optional(),
  action_values: z.array(actionSchema).optional(),
}).passthrough();

const creativeSchema = z.object({
  ad_id: z.string(),
  creative_id: z.string().optional(),
  primary_text: z.string().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  cta: z.string().optional(),
  destination_url: z.string().optional(),
  image_url: z.string().optional(),
  video_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
}).passthrough();

export const metaWebhookPayloadSchema = z.object({
  source: z.literal("meta"),
  account_id: z.string(),
  sync_id: z.string().uuid().optional(),
  generated_at: z.string().optional(),
  grain: z.enum(["daily", "lifetime"]).default("daily"),
  rows: z.array(insightRowSchema),
  creatives: z.array(creativeSchema).optional().default([]),
});

export type MetaWebhookPayload = z.infer<typeof metaWebhookPayloadSchema>;
export type InsightRow = z.infer<typeof insightRowSchema>;
export type CreativeSnapshot = z.infer<typeof creativeSchema>;
