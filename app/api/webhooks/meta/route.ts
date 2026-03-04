import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { metaWebhookPayloadSchema } from "@/lib/meta/schema";
import { normalizeMetaPayload } from "@/lib/meta/normalize";
import { createRequestId, getLogger } from "@/lib/logger";
import { validateWorkspaceApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const logger = getLogger(requestId);

  try {
    const rawBody = await request.text();
    const workspaceKey = request.headers.get("x-workspace-key");
    const signature = request.headers.get("x-make-signature");
    const webhookSecret = process.env.WEBHOOK_SECRET ?? "";

    const workspace = await validateWorkspaceApiKey(workspaceKey);
    if (!workspace) {
      logger.warn("Webhook rejected: invalid or missing x-workspace-key", {
        requestId,
        hasKey: !!workspaceKey,
      });
      return NextResponse.json(
        { error: "Invalid or missing x-workspace-key" },
        { status: 401 }
      );
    }

    const signatureValid = verifySignature(rawBody, signature, webhookSecret);
    if (!signatureValid) {
      logger.warn("Webhook rejected: invalid x-make-signature", {
        requestId,
        workspaceId: workspace.workspaceId,
      });
      return NextResponse.json(
        { error: "Invalid or missing x-make-signature" },
        { status: 401 }
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      logger.error("Webhook payload JSON parse failed", {
        requestId,
        workspaceId: workspace.workspaceId,
        error: e instanceof Error ? e.message : String(e),
      });
      await prisma.metaRawEvent.create({
        data: {
          workspaceId: workspace.workspaceId,
          signatureValid: true,
          rawPayload: { parseError: "Invalid JSON" },
          processingError: "JSON parse failed",
        },
      });
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const parsed = metaWebhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn("Webhook payload validation failed", {
        requestId,
        workspaceId: workspace.workspaceId,
        errors: parsed.error.flatten(),
      });
      await prisma.metaRawEvent.create({
        data: {
          workspaceId: workspace.workspaceId,
          syncId: (payload as { sync_id?: string })?.sync_id,
          signatureValid: true,
          rawPayload: payload as object,
          processingError: parsed.error.message,
        },
      });
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rawEvent = await prisma.metaRawEvent.create({
      data: {
        workspaceId: workspace.workspaceId,
        syncId: parsed.data.sync_id,
        signatureValid: true,
        rawPayload: parsed.data as unknown as object,
      },
    });

    logger.info("Processing Meta webhook", {
      requestId,
      workspaceId: workspace.workspaceId,
      syncId: parsed.data.sync_id,
      rowsCount: parsed.data.rows.length,
      creativesCount: parsed.data.creatives?.length ?? 0,
    });

    const { processed, errors } = await normalizeMetaPayload(
      workspace.workspaceId,
      parsed.data
    );

    if (errors.length > 0) {
      await prisma.metaRawEvent.update({
        where: { id: rawEvent.id },
        data: {
          processingError: errors.slice(0, 5).join("; "),
        },
      });
      logger.warn("Webhook processed with errors", {
        requestId,
        workspaceId: workspace.workspaceId,
        processed,
        errorCount: errors.length,
      });
    }

    return NextResponse.json({
      ok: true,
      requestId,
      processed,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (e) {
    logger.error("Webhook processing failed", {
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
