import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, getWorkspacesForUser, requireWorkspaceAccess } from "@/lib/auth";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";

const createSaleSchema = z.object({
  entityId: z.string().min(1),
  date: z.string().transform((s) => new Date(s)),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await getWorkspacesForUser(user.id);
  const workspaceId = memberships[0]?.workspaceId;
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No workspace access" },
      { status: 403 }
    );
  }

  try {
    await requireWorkspaceAccess(workspaceId, user.id);
  } catch {
    return NextResponse.json(
      { error: "Forbidden: You do not have access to this workspace" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { entityId, date, amount, notes } = parsed.data;
  const saleDate = new Date(date);
  saleDate.setHours(0, 0, 0, 0);

  const entity = await prisma.metaEntity.findFirst({
    where: {
      id: entityId,
      workspaceId,
      entityType: { in: ["ad", "adset", "campaign"] },
    },
  });

  if (!entity) {
    return NextResponse.json(
      { error: "Entity not found or not accessible" },
      { status: 404 }
    );
  }

  const sale = await prisma.offlineSale.create({
    data: {
      workspaceId,
      entityId,
      date: saleDate,
      amount: new Decimal(amount),
      source: "manual",
      notes: notes ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, id: sale.id });
}
