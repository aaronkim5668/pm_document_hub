import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPatchNoteDraft } from "@/lib/patch-note-generator";

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const result = await createPatchNoteDraft(prisma as any, {
      title: String(body.title ?? ""),
      release_version: String(body.release_version ?? ""),
      patch_date: body.patch_date ? String(body.patch_date) : null,
      candidate_ids: Array.isArray(body.candidate_ids) ? body.candidate_ids.map(String) : [],
    });
    const patchNote = result.patchNote as { id?: string };
    return NextResponse.json({
      id: patchNote.id,
      markdown: result.markdown,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create patch note" },
      { status: 400 },
    );
  }
}
