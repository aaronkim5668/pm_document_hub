import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentVersionId = url.searchParams.get("document_version_id");

  const changes = await prisma.changeCandidate.findMany({
    where: {
      review_status: "approved",
      ...(documentVersionId ? { document_version_id: documentVersionId } : {}),
    },
    orderBy: { created_at: "asc" },
  });

  const candidates = [];
  for (const change of changes) {
    if (change.review_status !== "approved") {
      return NextResponse.json({ error: `ChangeCandidate ${change.id} is not approved` }, { status: 400 });
    }

    const existing = await prisma.patchNoteCandidate.findFirst({
      where: { change_candidate_id: change.id },
      include: { change_candidate: true },
    });

    if (existing) {
      candidates.push(existing);
      continue;
    }

    candidates.push(
      await prisma.patchNoteCandidate.create({
        data: {
          change_candidate_id: change.id,
          draft_text: change.patch_note_draft ?? change.change_description,
          category: change.category ?? "notice",
          is_selected: false,
        },
        include: { change_candidate: true },
      }),
    );
  }

  return NextResponse.json({ candidates });
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
