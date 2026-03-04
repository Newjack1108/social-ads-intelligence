import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_API_KEY = "wk_seed_test_local_dev_12345";

async function main() {
  console.log("Seeding database...");
  console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);

  let workspace = await prisma.workspace.findUnique({
    where: { apiKey: SEED_API_KEY },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Default Workspace",
        apiKey: SEED_API_KEY,
      },
    });
  }

  console.log("Workspace created:", workspace.name);
  console.log("API Key (use for x-workspace-key):", workspace.apiKey);

  const accountEntity = await prisma.metaEntity.upsert({
    where: {
      workspaceId_entityType_externalId: {
        workspaceId: workspace.id,
        entityType: "account",
        externalId: "act_123456789",
      },
    },
    create: {
      workspaceId: workspace.id,
      entityType: "account",
      externalId: "act_123456789",
      name: "Sample Account",
    },
    update: {},
  });

  const campaignEntity = await prisma.metaEntity.upsert({
    where: {
      workspaceId_entityType_externalId: {
        workspaceId: workspace.id,
        entityType: "campaign",
        externalId: "camp_001",
      },
    },
    create: {
      workspaceId: workspace.id,
      entityType: "campaign",
      externalId: "camp_001",
      name: "Brand Awareness Campaign",
      parentId: accountEntity.id,
      accountId: "act_123456789",
    },
    update: {},
  });

  const adsetEntity = await prisma.metaEntity.upsert({
    where: {
      workspaceId_entityType_externalId: {
        workspaceId: workspace.id,
        entityType: "adset",
        externalId: "adset_001",
      },
    },
    create: {
      workspaceId: workspace.id,
      entityType: "adset",
      externalId: "adset_001",
      name: "US 18-35",
      parentId: campaignEntity.id,
      accountId: "act_123456789",
    },
    update: {},
  });

  const adEntity = await prisma.metaEntity.upsert({
    where: {
      workspaceId_entityType_externalId: {
        workspaceId: workspace.id,
        entityType: "ad",
        externalId: "ad_001",
      },
    },
    create: {
      workspaceId: workspace.id,
      entityType: "ad",
      externalId: "ad_001",
      name: "Summer Sale Ad",
      parentId: adsetEntity.id,
      accountId: "act_123456789",
    },
    update: {},
  });

  const today = new Date();
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  for (const date of dates) {
    const insight = await prisma.metaInsightDaily.upsert({
      where: {
        entityId_date: { entityId: adEntity.id, date },
      },
      create: {
        entityId: adEntity.id,
        date,
        spend: 50 + Math.random() * 100,
        impressions: 10000 + Math.floor(Math.random() * 20000),
        reach: 5000 + Math.floor(Math.random() * 10000),
        frequency: 1.5 + Math.random() * 1.5,
        clicks: 100 + Math.floor(Math.random() * 300),
        cpc: 0.5 + Math.random() * 1,
        cpm: 5 + Math.random() * 10,
        ctr: 0.5 + Math.random() * 1.5,
        videoPlayActions: Math.floor(Math.random() * 500),
        videoP95Watched: Math.floor(Math.random() * 200),
      },
      update: {},
    });

    await prisma.metaActionDaily.upsert({
      where: {
        insightDailyId_actionType: {
          insightDailyId: insight.id,
          actionType: "link_click",
        },
      },
      create: {
        insightDailyId: insight.id,
        actionType: "link_click",
        value: 100 + Math.floor(Math.random() * 200),
      },
      update: {},
    });

    await prisma.metaActionDaily.upsert({
      where: {
        insightDailyId_actionType: {
          insightDailyId: insight.id,
          actionType: "omni_purchase",
        },
      },
      create: {
        insightDailyId: insight.id,
        actionType: "omni_purchase",
        value: Math.floor(Math.random() * 15),
        actionValue: 200 + Math.random() * 500,
      },
      update: {},
    });
  }

  await prisma.metaCreative.upsert({
    where: { adEntityId: adEntity.id },
    create: {
      adEntityId: adEntity.id,
      primaryText: "Summer sale - up to 40% off! Shop now and save on your favorite products.",
      headline: "Limited Time Offer",
      description: "Don't miss out on these amazing deals.",
      cta: "SHOP_NOW",
      destinationUrl: "https://example.com/sale",
    },
    update: {},
  });

  console.log("Seed complete. Sample data created for the last 14 days.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
