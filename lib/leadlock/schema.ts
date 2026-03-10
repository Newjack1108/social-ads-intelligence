import { z } from "zod";

export const leadlockWebhookPayloadSchema = z
  .object({
    sale_amount: z.number().positive("sale_amount must be a positive number"),
    sale_date: z
      .string()
      .optional()
      .transform((s) => (s ? new Date(s) : new Date())),
    ad_id: z.string().optional(),
    adset_id: z.string().optional(),
    campaign_id: z.string().optional(),
    leadlock_id: z.string().optional(),
    event_id: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => data.ad_id || data.adset_id || data.campaign_id,
    {
      message:
        "At least one of ad_id, adset_id, or campaign_id is required for attribution",
    }
  );

export type LeadlockWebhookPayload = z.infer<
  typeof leadlockWebhookPayloadSchema
>;
