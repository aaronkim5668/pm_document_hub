import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBudgetSettings, updateBudgetSettings } from "@/lib/budget-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getBudgetSettings(prisma as any);
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const body = await request.json();
  try {
    const settings = await updateBudgetSettings(prisma as any, {
      monthly_budget_usd: Number(body.monthly_budget_usd),
      alert_threshold_pct: body.alert_threshold_pct == null ? undefined : Number(body.alert_threshold_pct),
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update budget settings" },
      { status: 400 },
    );
  }
}
