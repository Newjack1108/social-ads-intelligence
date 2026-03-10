import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { leadlockWebhookPayloadSchema } from "@/lib/leadlock/schema";
import { createRequestId, getLogger } from "@/lib/logger";
import { validateWorkspaceApiKey } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function resolveEntityId(
  workspaceId: string,
  adId?: string,
  adsetId?: string,
  campaignId?: string
): Promise<string | null> {
  // Prefer most granular: ad > adset > campaign
  const candidates: { entityType: "ad" | "adset" | "campaign"; externalId: string }[] = [];
  if (adId) candidates.push({ entityType: "ad", externalId: adId });
  if (adsetId) candidates.push({ entityType: "adset", externalId: adsetId });
  if (campaignId) candidates.push({ entityType: "campaign", externalId: campaignId });

  for (const { entityType, externalId } of candidates) {
    const entity = await prisma.metaEntity.findUnique({
      where: {
        workspaceId_entityType_externalId: {
          workspaceId,
          entityType,
          externalId,
        },
      },
    });
    if (entity) return entity.id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const logger = getLogger(requestId);

  try {
    const rawBody = await request.text();
    const workspaceKey = request.headers.get("x-workspace-key");
    const signature = request.headers.get("x-make-signature");
    const secretHeader = request.headers.get("x-webhook-secret");
    const webhookSecret = process.env.WEBHOOK_SECRET ?? "";

    const workspace = await validateWorkspaceApiKey(workspaceKey);
    if (!workspace) {
      logger.warn("LeadLock webhook rejected: invalid or missing x-workspace-key", {
        requestId,
        hasKey: !!workspaceKey,
      });
      return NextResponse.json(
        { error: "Invalid or missing x-workspace-key" },
        { status: 401 }
      );
    }

    const authValid =
      (signature && verifySignature(rawBody, signature, webhookSecret)) ||
      (secretHeader &&
        webhookSecret &&
        secretHeader.length === webhookSecret.length &&
        timingSafeEqual(
          Buffer.from(secretHeader, "utf8"),
          Buffer.from(webhookSecret, "utf8")
        ));

    if (!authValid) {
      logger.warn("LeadLock webhook rejected: invalid authentication", {
        requestId,
        workspaceId: workspace.workspaceId,
      });
      return NextResponse.json(
        {
          error:
            "Invalid or missing x-make-signature or x-webhook-secret. Provide HMAC signature or matching x-webhook-secret header.",
        },
        { status: 401 }
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const parsed = leadlockWebhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn("LeadLock webhook validation failed", {
        requestId,
        workspaceId: workspace.workspaceId,
        errors: parsed.error.flatten(),
      });
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const saleDate = data.sale_date instanceof Date ? data.sale_date : new Date(data.sale_date);
    saleDate.setHours(0, 0, 0, 0);

    const entityId = await resolveEntityId(
      workspace.workspaceId,
      data.ad_id,
      data.adset_id,
      data.campaign_id
    );

    if (!entityId) {
      return NextResponse.json(
        {
          error:
            "Could not find matching Meta entity for ad_id, adset_id, or campaign_id. Ensure Meta data has been synced first.",
        },
        { status: 400 }
      );
    }

    const leadlockId = data.leadlock_id ?? data.event_id ?? null;

    if (leadlockId) {
      // Upsert for dedup when leadlockId provided
      const existing = await prisma.offlineSale.findUnique({
        where: {
          workspaceId_leadlockId: {
            workspaceId: workspace.workspaceId,
            leadlockId,
          },
        },
      });

      if (existing) {
        await prisma.offlineSale.update({
          where: { id: existing.id },
          data: {
            amount: new Decimal(data.sale_amount),
            date: saleDate,
            entityId,
            notes: data.notes ?? undefined,
          },
        });
        logger.info("LeadLock webhook: updated existing sale", {
          requestId,
          workspaceId: workspace.workspaceId,
          id: existing.id,
        });
        return NextResponse.json({
          ok: true,
          requestId,
          id: existing.id,
          updated: true,
        });
      }
    }

    const sale = await prisma.offlineSale.create({
      data: {
        workspaceId: workspace.workspaceId,
        entityId,
        date: saleDate,
        amount: new Decimal(data.sale_amount),
        source: "leadlock",
        leadlockId,
        notes: data.notes ?? undefined,
      },
    });

    logger.info("LeadLock webhook: created sale", {
      requestId,
      workspaceId: workspace.workspaceId,
      id: sale.id,
    });

    return NextResponse.json({
      ok: true,
      requestId,
      id: sale.id,
    });
  } catch (e) {
    logger.error("LeadLock webhook failed", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
