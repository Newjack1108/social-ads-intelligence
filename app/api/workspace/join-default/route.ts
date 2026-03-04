import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SEED_WORKSPACE_API_KEY = "wk_seed_test_local_dev_12345";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      message: "Already in a workspace",
      workspaceId: existing.workspaceId,
    });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { apiKey: SEED_WORKSPACE_API_KEY },
  });
  if (!workspace) {
    return NextResponse.json(
      { error: "Default workspace not found. Run db:seed first." },
      { status: 404 }
    );
  }

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Joined default workspace",
    workspaceId: workspace.id,
  });
}
