import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensurePatchNoteCandidates } from "@/lib/patch-note-candidates";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentVersionId = url.searchParams.get("document_version_id");

  try {
    const candidates = await ensurePatchNoteCandidates(prisma as any, { documentVersionId });
    return NextResponse.json({ candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load patch note candidates" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const candidate = await prisma.patchNoteCandidate.findUnique({
    where: { id },
    include: { change_candidate: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "PatchNoteCandidate not found" }, { status: 404 });
  }

  if (candidate.change_candidate.review_status !== "approved") {
    return NextResponse.json({ error: "ChangeCandidate is not approved" }, { status: 400 });
  }

  const updated = await prisma.patchNoteCandidate.update({
    where: { id },
    data: {
      is_selected: typeof body.is_selected === "boolean" ? body.is_selected : candidate.is_selected,
      draft_text: typeof body.draft_text === "string" ? body.draft_text : candidate.draft_text,
    },
    include: { change_candidate: true },
  });

  return NextResponse.json({ candidate: updated });
}
