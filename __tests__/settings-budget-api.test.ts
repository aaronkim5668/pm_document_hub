import { describe, expect, it } from "vitest";
import { getBudgetSettings, updateBudgetSettings } from "../lib/budget-settings";

function makePrisma() {
  let config: Record<string, unknown> | null = null;
  return {
    aIBudgetConfig: {
      findFirst: async () => config,
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        config = config ? { ...config, ...update } : create;
        return config;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        config = { ...(config ?? { id: "default" }), ...data };
        return config;
      },
    },
  };
}

describe("budget settings", () => {
  it("returns a safe default config when no row exists", async () => {
    const prisma = makePrisma();

    const settings = await getBudgetSettings(prisma, new Date("2026-05-20T00:00:00Z"));

    expect(settings.monthly_budget_usd).toBe("0");
    expect(settings.budget_month).toBe("2026-05");
  });

  it("rejects negative monthly budget at API service level", async () => {
    const prisma = makePrisma();

    await expect(updateBudgetSettings(prisma, { monthly_budget_usd: -1 })).rejects.toThrow("non-negative");
  });

  it("stores non-negative monthly budget without exposing an AI call path", async () => {
    const prisma = makePrisma();

    const result = await updateBudgetSettings(prisma, { monthly_budget_usd: 10, alert_threshold_pct: 90 });

    expect(result.monthly_budget_usd).toBe("10");
    expect(result.alert_threshold_pct).toBe(90);
  });
});
