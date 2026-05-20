import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const budgetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const existing = await prisma.aIBudgetConfig.findFirst();
  if (existing) {
    return;
  }

  await prisma.aIBudgetConfig.create({
    data: {
      monthly_budget_usd: 0,
      current_month_spend: 0,
      budget_month: budgetMonth,
      is_locked: false,
      alert_threshold_pct: 80,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
