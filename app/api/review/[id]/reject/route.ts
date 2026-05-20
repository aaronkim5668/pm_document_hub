import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rejectReviewQueueItem } from "@/lib/review-queue";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const item = await rejectReviewQueueItem(prisma as any, params.id);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject review item" },
      { status: 400 },
    );
  }
}
