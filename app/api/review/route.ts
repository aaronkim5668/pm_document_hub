import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listReviewQueueItems } from "@/lib/review-queue";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const items = await listReviewQueueItems(prisma as any, status);
  return NextResponse.json({ items });
}
