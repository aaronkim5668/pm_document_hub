export type DecimalLike = {
  toNumber(): number;
};

export type BudgetConfig = {
  id: string;
  monthly_budget_usd: DecimalLike;
  current_month_spend: DecimalLike;
  budget_month: string;
  is_locked: boolean;
};

export type BudgetGuardPrisma = {
  aIBudgetConfig: {
    findFirst(): Promise<BudgetConfig | null>;
    update(args: {
      where: { id: string };
      data: {
        current_month_spend?: number;
        budget_month?: string;
        is_locked?: boolean;
      };
    }): Promise<BudgetConfig>;
    upsert(args: {
      where: { id: string };
      update: Record<string, never>;
      create: {
        id: string;
        monthly_budget_usd: number;
        current_month_spend: number;
        budget_month: string;
        is_locked: boolean;
        alert_threshold_pct: number;
      };
    }): Promise<BudgetConfig>;
  };
};

function formatBudgetMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function checkBudgetForPaidAiCall(
  prisma: BudgetGuardPrisma,
  options: { estimatedCostUsd: number; now?: Date },
): Promise<{ allowed: true }> {
  const now = options.now ?? new Date();
  const currentBudgetMonth = formatBudgetMonth(now);
  let config = await prisma.aIBudgetConfig.findFirst();

  if (!config) {
    config = await prisma.aIBudgetConfig.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        monthly_budget_usd: 0,
        current_month_spend: 0,
        budget_month: currentBudgetMonth,
        is_locked: false,
        alert_threshold_pct: 80,
      },
    });
  }

  if (config.budget_month !== currentBudgetMonth) {
    config = await prisma.aIBudgetConfig.update({
      where: { id: config.id },
      data: {
        current_month_spend: 0,
        budget_month: currentBudgetMonth,
        is_locked: false,
      },
    });
  }

  const monthlyBudgetUsd = config.monthly_budget_usd.toNumber();
  const currentSpendUsd = config.current_month_spend.toNumber();

  if (monthlyBudgetUsd === 0) {
    throw new Error("AI API is disabled: monthly budget is 0");
  }

  if (config.is_locked) {
    throw new Error("AI budget exceeded");
  }

  if (currentSpendUsd + options.estimatedCostUsd > monthlyBudgetUsd) {
    await prisma.aIBudgetConfig.update({
      where: { id: config.id },
      data: {
        is_locked: true,
      },
    });
    throw new Error("AI budget exceeded");
  }

  return { allowed: true };
}
