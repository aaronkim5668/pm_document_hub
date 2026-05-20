import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { approveReviewQueueItem, resolveNoVersionReviewItem } from "@/lib/review-queue";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  try {
    const result =
      body.version_date || body.version_label
        ? await resolveNoVersionReviewItem(prisma as any, params.id, {
            version_date: body.version_date ? String(body.version_date) : undefined,
            version_label: body.version_label ? String(body.version_label) : undefined,
          })
        : await approveReviewQueueItem(prisma as any, params.id);
    return NextResponse.json({ item: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve review item" },
      { status: 400 },
    );
  }
}
