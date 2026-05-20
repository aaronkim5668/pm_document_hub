import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { checkBudgetForPaidAiCall } from "../lib/budget-guard";

function makeConfig(monthlyBudgetUsd: string, currentSpendUsd = "0", overrides: Partial<{
  id: string;
  budget_month: string;
  is_locked: boolean;
}> = {}) {
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

  return {
    updates,
    upserts,
    aIBudgetConfig: {
      findFirst: async () => config,
      update: async (args: unknown) => {
        updates.push(args);
        return { ...(config ?? {}), ...(args as { data?: object }).data };
      },
      upsert: async (args: unknown) => {
        upserts.push(args);
        return (args as { create: unknown }).create;
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

  it("creates a safe default config and blocks when config is missing", async () => {
    const prisma = makePrisma(null);

    await expect(
      checkBudgetForPaidAiCall(prisma, {
        estimatedCostUsd: 0.01,
        now: new Date("2026-05-20T00:00:00Z"),
      }),
    ).rejects.toThrow("AI API is disabled");
    expect(prisma.upserts).toHaveLength(1);
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
        data: {
          is_locked: true,
        },
      }),
    ]);
  });
});
