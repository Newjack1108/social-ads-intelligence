import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SEED_API_KEY = "wk_seed_test_local_dev_12345";

async function main() {
  const workspace = await prisma.workspace.findUnique({
    where: { apiKey: SEED_API_KEY },
  });

  if (!workspace) {
    console.log("No seed workspace found. Nothing to clear.");
    return;
  }

  await prisma.metaRawEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.metaCreative.deleteMany({
    where: { adEntity: { workspaceId: workspace.id } },
  });
  await prisma.metaEntity.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });

  console.log("Sample data and seed workspace removed. Database is now fresh.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
