import { prisma } from "./db";

export interface SaleEntityOption {
  id: string;
  name: string;
  entityType: "campaign" | "adset" | "ad";
  externalId: string;
}

export async function getEntitiesForSalePicker(
  workspaceId: string
): Promise<SaleEntityOption[]> {
  const entities = await prisma.metaEntity.findMany({
    where: {
      workspaceId,
      entityType: { in: ["campaign", "adset", "ad"] },
    },
    orderBy: [{ entityType: "asc" }, { name: "asc" }],
  });

  return entities.map((e) => ({
    id: e.id,
    name: e.name ?? e.externalId,
    entityType: e.entityType as "campaign" | "adset" | "ad",
    externalId: e.externalId,
  }));
}
