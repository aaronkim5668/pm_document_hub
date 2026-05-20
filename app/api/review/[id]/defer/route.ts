import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deferReviewQueueItem } from "@/lib/review-queue";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const item = await deferReviewQueueItem(prisma as any, params.id);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to defer review item" },
      { status: 400 },
    );
  }
}
