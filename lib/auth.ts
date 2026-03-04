import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/config";
import { prisma } from "./db";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user?.email) return null;
  return {
    id: session.user.id ?? "",
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

export async function getWorkspacesForUser(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized: Please sign in to continue");
  }
  return user;
}

export async function requireWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<{ workspaceId: string }> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!membership) {
    throw new Error("Forbidden: You do not have access to this workspace");
  }
  return { workspaceId };
}

export async function validateWorkspaceApiKey(
  apiKey: string | null
): Promise<{ workspaceId: string } | null> {
  if (!apiKey) return null;
  const workspace = await prisma.workspace.findUnique({
    where: { apiKey },
  });
  if (!workspace) return null;
  return { workspaceId: workspace.id };
}
