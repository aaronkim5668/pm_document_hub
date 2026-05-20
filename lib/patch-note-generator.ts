type PatchNoteCandidateRow = {
  id: string;
  draft_text: string;
  category: string;
  is_selected: boolean;
  change_candidate: {
    id: string;
    review_status: string;
  };
};

type PatchNotePrisma = {
  patchNoteCandidate: {
    findMany(args: {
      where: { id: { in: string[] } };
      include?: { change_candidate: boolean };
    }): Promise<PatchNoteCandidateRow[]>;
  };
  patchNote: {
    create(args: { data: unknown; include?: unknown }): Promise<unknown>;
  };
};

const categoryLabels: Record<string, string> = {
  major_update: "주요 업데이트",
  new_content: "신규 콘텐츠",
  balance: "밸런스 조정",
  system_improvement: "시스템 개선",
  bug_fix: "버그 수정",
  notice: "기타 안내",
};

const categoryOrder = ["major_update", "new_content", "balance", "system_improvement", "bug_fix", "notice"];

export function renderPatchNoteMarkdown(input: {
  title: string;
  release_version: string;
  patch_date?: string | null;
  items: Array<{ category: string; content: string }>;
}) {
  const lines = [`# ${input.title}`, ""];
  if (input.patch_date) {
    lines.push(`**패치 일자:** ${input.patch_date}`, "");
  }

  for (const category of categoryOrder) {
    const items = input.items.filter((item) => item.category === category);
    if (items.length === 0) continue;

    lines.push(`## ${categoryLabels[category] ?? category}`);
    for (const item of items) {
      lines.push(`- ${item.content}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export async function createPatchNoteDraft(
  prisma: PatchNotePrisma,
  input: {
    title: string;
    release_version: string;
    patch_date?: string | null;
    candidate_ids: string[];
  },
) {
  if (input.candidate_ids.length === 0) {
    throw new Error("No selected PatchNoteCandidates");
  }

  const candidates = await prisma.patchNoteCandidate.findMany({
    where: { id: { in: input.candidate_ids } },
    include: { change_candidate: true },
  });

  if (candidates.length !== input.candidate_ids.length) {
    throw new Error("Some PatchNoteCandidates were not found");
  }

  for (const candidate of candidates) {
    if (!candidate.is_selected) {
      throw new Error(`PatchNoteCandidate ${candidate.id} is not selected`);
    }
    if (candidate.change_candidate.review_status !== "approved") {
      throw new Error(`ChangeCandidate ${candidate.change_candidate.id} is not approved`);
    }
  }

  const sortedItems = [...candidates]
    .sort((a, b) => {
      const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
      if (categoryDiff !== 0) return categoryDiff;
      return a.id.localeCompare(b.id);
    })
    .map((candidate, index) => ({
      patch_note_candidate_id: candidate.id,
      category: candidate.category,
      content: candidate.draft_text,
      order_index: index,
    }));

  const markdown = renderPatchNoteMarkdown({
    title: input.title,
    release_version: input.release_version,
    patch_date: input.patch_date,
    items: sortedItems,
  });

  const patchNote = await prisma.patchNote.create({
    data: {
      title: input.title,
      release_version: input.release_version,
      patch_date: input.patch_date ? new Date(`${input.patch_date}T00:00:00.000Z`) : null,
      status: "draft",
      items: {
        create: sortedItems,
      },
    },
    include: { items: true },
  });

  return { patchNote, items: sortedItems, markdown };
}
