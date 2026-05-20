type DecimalLike = {
  toNumber(): number;
};

type BudgetConfig = {
  monthly_budget_usd: DecimalLike;
  current_month_spend: DecimalLike;
  budget_month: string;
  is_locked: boolean;
};

type BudgetGuardPrisma = {
  aIBudgetConfig: {
    findFirst(): Promise<BudgetConfig | null>;
  };
};

export async function checkBudgetForPaidAiCall(
  prisma: BudgetGuardPrisma,
  options: { estimatedCostUsd: number },
): Promise<{ allowed: true }> {
  const config = await prisma.aIBudgetConfig.findFirst();
  if (!config) {
    throw new Error("AI API is disabled: budget config is missing");
  }

  const monthlyBudgetUsd = config.monthly_budget_usd.toNumber();
  const currentSpendUsd = config.current_month_spend.toNumber();

  if (monthlyBudgetUsd === 0) {
    throw new Error("AI API is disabled: monthly budget is 0");
  }

  if (config.is_locked || currentSpendUsd + options.estimatedCostUsd > monthlyBudgetUsd) {
    throw new Error("AI budget exceeded");
  }

  return { allowed: true };
}
