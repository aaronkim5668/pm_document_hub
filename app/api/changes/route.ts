import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createManualChangeCandidate } from "@/lib/change-candidates";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const candidate = await createManualChangeCandidate(prisma as any, body);
    return NextResponse.json({ candidate });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create ChangeCandidate" },
      { status: 400 },
    );
  }
}
