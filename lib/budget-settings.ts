import { Prisma } from "@prisma/client";

type BudgetSettingsPrisma = {
  aIBudgetConfig: {
    findFirst(): Promise<any | null>;
    upsert(args: unknown): Promise<any>;
    update(args: unknown): Promise<any>;
  };
};

function currentBudgetMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function serializeConfig(config: any) {
  return {
    id: config.id,
    monthly_budget_usd: config.monthly_budget_usd?.toString?.() ?? String(config.monthly_budget_usd ?? "0"),
    current_month_spend: config.current_month_spend?.toString?.() ?? String(config.current_month_spend ?? "0"),
    budget_month: config.budget_month,
    is_locked: Boolean(config.is_locked),
    alert_threshold_pct: config.alert_threshold_pct ?? 80,
  };
}

export async function getBudgetSettings(prisma: BudgetSettingsPrisma, now = new Date()) {
  const budgetMonth = currentBudgetMonth(now);
  const existing = await prisma.aIBudgetConfig.findFirst();
  const config =
    existing ??
    (await prisma.aIBudgetConfig.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        monthly_budget_usd: 0,
        current_month_spend: 0,
        budget_month: budgetMonth,
        is_locked: false,
        alert_threshold_pct: 80,
      },
    }));

  return serializeConfig(config);
}

export async function updateBudgetSettings(
  prisma: BudgetSettingsPrisma,
  input: { monthly_budget_usd: number; alert_threshold_pct?: number },
  now = new Date(),
) {
  if (!Number.isFinite(input.monthly_budget_usd) || input.monthly_budget_usd < 0) {
    throw new Error("monthly_budget_usd must be non-negative");
  }
  const alertThreshold = input.alert_threshold_pct ?? 80;
  if (!Number.isInteger(alertThreshold) || alertThreshold < 0 || alertThreshold > 100) {
    throw new Error("alert_threshold_pct must be an integer between 0 and 100");
  }

  const existing = await prisma.aIBudgetConfig.findFirst();
  const data = {
    monthly_budget_usd: new Prisma.Decimal(input.monthly_budget_usd),
    alert_threshold_pct: alertThreshold,
  };

  const config = existing
    ? await prisma.aIBudgetConfig.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.aIBudgetConfig.upsert({
        where: { id: "default" },
        update: data,
        create: {
          id: "default",
          monthly_budget_usd: data.monthly_budget_usd,
          current_month_spend: 0,
          budget_month: currentBudgetMonth(now),
          is_locked: false,
          alert_threshold_pct: alertThreshold,
        },
      });

  return serializeConfig(config);
}
