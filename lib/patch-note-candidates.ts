type ApprovedChangeCandidate = {
  id: string;
  document_version_id: string;
  review_status: string;
  patch_note_draft: string | null;
  change_description: string;
  category: string | null;
  created_at: Date;
};

type PatchNoteCandidatePrisma = {
  changeCandidate: {
    findMany(args: unknown): Promise<ApprovedChangeCandidate[]>;
  };
  patchNoteCandidate: {
    upsert(args: unknown): Promise<unknown>;
  };
};

export async function ensurePatchNoteCandidates(
  prisma: PatchNoteCandidatePrisma,
  options: { documentVersionId?: string | null } = {},
) {
  const changes = await prisma.changeCandidate.findMany({
    where: {
      review_status: "approved",
      ...(options.documentVersionId ? { document_version_id: options.documentVersionId } : {}),
    },
    orderBy: { created_at: "asc" },
  });

  const candidates = [];
  for (const change of changes) {
    // Defense-in-depth: the query filters approved rows, and this guard protects
    // future call sites that may pass a different query shape.
    if (change.review_status !== "approved") {
      throw new Error(`ChangeCandidate ${change.id} is not approved`);
    }

    candidates.push(
      await prisma.patchNoteCandidate.upsert({
        where: { change_candidate_id: change.id },
        update: {},
        create: {
          change_candidate_id: change.id,
          draft_text: change.patch_note_draft ?? change.change_description,
          category: change.category ?? "notice",
          is_selected: false,
        },
        include: { change_candidate: true },
      }),
    );
  }

  return candidates;
}
