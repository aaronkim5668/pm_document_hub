import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { checkBudgetForPaidAiCall, type BudgetConfig } from "../lib/budget-guard";

function makeConfig(monthlyBudgetUsd: string | number, currentSpendUsd: string | number = "0", overrides: Partial<{
  id: string;
  budget_month: string;
  is_locked: boolean;
}> = {}): BudgetConfig {
  return {
    id: overrides.id ?? "budget-config-1",
    monthly_budget_usd: new Prisma.Decimal(monthlyBudgetUsd),
    current_month_spend: new Prisma.Decimal(currentSpendUsd),
    budget_month: overrides.budget_month ?? "2026-05",
    is_locked: overrides.is_locked ?? false,
  };
}

function makePrisma(config: ReturnType<typeof makeConfig> | null) {
  const updates: unknown[] = [];
  const upserts: unknown[] = [];
  let storedConfig = config;

  return {
    updates,
    upserts,
    aIBudgetConfig: {
      findFirst: async () => storedConfig,
      update: async (args: unknown): Promise<BudgetConfig> => {
        updates.push(args);
        const data = (args as { data?: Partial<{
          current_month_spend: number;
          budget_month: string;
          is_locked: boolean;
        }> }).data ?? {};
        if (!storedConfig) {
          throw new Error("missing config");
        }
        storedConfig = makeConfig(
          storedConfig.monthly_budget_usd.toNumber(),
          data.current_month_spend ?? storedConfig.current_month_spend.toNumber(),
          {
            id: storedConfig.id,
            budget_month: data.budget_month ?? storedConfig.budget_month,
            is_locked: data.is_locked ?? storedConfig.is_locked,
          },
        );
        return storedConfig;
      },
      upsert: async (args: unknown): Promise<BudgetConfig> => {
        upserts.push(args);
        const create = (args as {
          create: {
            id: string;
            monthly_budget_usd: number;
            current_month_spend: number;
            budget_month: string;
            is_locked: boolean;
          };
        }).create;
        storedConfig = makeConfig(create.monthly_budget_usd, create.current_month_spend, {
          id: create.id,
          budget_month: create.budget_month,
          is_locked: create.is_locked,
        });
        return storedConfig;
      },
    },
  };
}

describe("checkBudgetForPaidAiCall", () => {
  it("blocks paid AI calls when monthly_budget_usd is 0", async () => {
    const prisma = makePrisma(makeConfig("0"));

    await expect(checkBudgetForPaidAiCall(prisma, { estimatedCostUsd: 0.01 })).rejects.toThrow(
      "AI API is disabled",
    );
  });

  it("blocks paid AI calls when estimated cost exceeds remaining budget", async () => {
    const prisma = makePrisma(makeConfig("1.00", "0.99"));

    await expect(checkBudgetForPaidAiCall(prisma, { estimatedCostUsd: 0.02 })).rejects.toThrow(
      "AI budget exceeded",
    );
  });

  it("allows paid AI calls within budget without calling any provider", async () => {
    const prisma = makePrisma(makeConfig("1.00", "0.25"));

    await expect(checkBudgetForPaidAiCall(prisma, { estimatedCostUsd: 0.25 })).resolves.toEqual({
      allowed: true,
    });
  });

  it("blocks paid AI calls when is_locked=true even if budget remains", async () => {
    const prisma = makePrisma(makeConfig("10.00", "0", { is_locked: true }));

    await expect(checkBudgetForPaidAiCall(prisma, { estimatedCostUsd: 0.01 })).rejects.toThrow(
      "AI budget exceeded",
    );
  });

  it("creates a safe default config and blocks by the budget=0 policy when config is missing", async () => {
    const prisma = makePrisma(null);

    await expect(
      checkBudgetForPaidAiCall(prisma, {
        estimatedCostUsd: 0.01,
        now: new Date("2026-05-20T00:00:00Z"),
      }),
    ).rejects.toThrow("monthly budget is 0");
    expect(prisma.upserts).toEqual([
      expect.objectContaining({
        where: { id: "default" },
        create: {
          id: "default",
          monthly_budget_usd: 0,
          current_month_spend: 0,
          budget_month: "2026-05",
          is_locked: false,
          alert_threshold_pct: 80,
        },
      }),
    ]);
  });

  it("rolls over stale budget_month before checking budget", async () => {
    const prisma = makePrisma(makeConfig("1.00", "0.99", { budget_month: "2026-04", is_locked: true }));

    await expect(
      checkBudgetForPaidAiCall(prisma, {
        estimatedCostUsd: 0.50,
        now: new Date("2026-05-20T00:00:00Z"),
      }),
    ).resolves.toEqual({ allowed: true });

    expect(prisma.updates).toEqual([
      expect.objectContaining({
        where: { id: "budget-config-1" },
        data: {
          current_month_spend: 0,
          budget_month: "2026-05",
          is_locked: false,
        },
      }),
    ]);
  });

  it("sets is_locked=true when estimated cost exceeds remaining budget", async () => {
    const prisma = makePrisma(makeConfig("1.00", "0.99"));

    await expect(
      checkBudgetForPaidAiCall(prisma, {
        estimatedCostUsd: 0.02,
        now: new Date("2026-05-20T00:00:00Z"),
      }),
    ).rejects.toThrow("AI budget exceeded");

    expect(prisma.updates).toEqual([
      expect.objectContaining({
        where: { id: "budget-config-1" },
        data: {
          is_locked: true,
        },
      }),
    ]);
  });
});
