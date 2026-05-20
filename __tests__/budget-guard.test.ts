import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { checkBudgetForPaidAiCall } from "../lib/budget-guard";

function makeConfig(monthlyBudgetUsd: string, currentSpendUsd = "0") {
  return {
    monthly_budget_usd: new Prisma.Decimal(monthlyBudgetUsd),
    current_month_spend: new Prisma.Decimal(currentSpendUsd),
    budget_month: "2026-05",
    is_locked: false,
  };
}

describe("checkBudgetForPaidAiCall", () => {
  it("blocks paid AI calls when monthly_budget_usd is 0", async () => {
    const prisma = {
      aIBudgetConfig: {
        findFirst: async () => makeConfig("0"),
      },
    };

    await expect(checkBudgetForPaidAiCall(prisma, { estimatedCostUsd: 0.01 })).rejects.toThrow(
      "AI API is disabled",
    );
  });

  it("blocks paid AI calls when estimated cost exceeds remaining budget", async () => {
    const prisma = {
      aIBudgetConfig: {
        findFirst: async () => makeConfig("1.00", "0.99"),
      },
    };

    await expect(checkBudgetForPaidAiCall(prisma, { estimatedCostUsd: 0.02 })).rejects.toThrow(
      "AI budget exceeded",
    );
  });

  it("allows paid AI calls within budget without calling any provider", async () => {
    const prisma = {
      aIBudgetConfig: {
        findFirst: async () => makeConfig("1.00", "0.25"),
      },
    };

    await expect(checkBudgetForPaidAiCall(prisma, { estimatedCostUsd: 0.25 })).resolves.toEqual({
      allowed: true,
    });
  });
});
