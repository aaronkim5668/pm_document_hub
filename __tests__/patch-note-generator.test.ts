import { describe, expect, it } from "vitest";
import { createPatchNoteDraft } from "../lib/patch-note-generator";

function makePrisma() {
  const candidates = new Map([
    [
      "candidate-approved",
      {
        id: "candidate-approved",
        category: "balance",
        is_selected: true,
        draft_text: "파이어볼 피해량이 조정됩니다.",
        change_candidate: { id: "change-approved", review_status: "approved" },
      },
    ],
    [
      "candidate-pending",
      {
        id: "candidate-pending",
        category: "bug_fix",
        is_selected: true,
        draft_text: "로그인 오류가 수정됩니다.",
        change_candidate: { id: "change-pending", review_status: "pending" },
      },
    ],
    [
      "candidate-unselected",
      {
        id: "candidate-unselected",
        category: "new_content",
        is_selected: false,
        draft_text: "신규 이벤트가 추가됩니다.",
        change_candidate: { id: "change-unselected", review_status: "approved" },
      },
    ],
  ]);
  const patchNotes: unknown[] = [];

  return {
    candidates,
    patchNotes,
    patchNoteCandidate: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in
          .map((id) => candidates.get(id))
          .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)),
    },
    patchNote: {
      create: async ({ data }: { data: { items: { create: unknown[] } } }) => {
        const row = { id: "patch-note-1", ...data };
        patchNotes.push(row);
        return row;
      },
    },
  };
}

describe("createPatchNoteDraft", () => {
  it("creates items only from selected approved PatchNoteCandidates", async () => {
    const prisma = makePrisma();

    const result = await createPatchNoteDraft(prisma, {
      title: "v2.3.0 패치노트",
      release_version: "v2.3.0",
      patch_date: "2026-05-20",
      candidate_ids: ["candidate-approved"],
    });

    expect(result.markdown).toContain("## 밸런스 조정");
    expect(result.markdown).toContain("- 파이어볼 피해량이 조정됩니다.");
    expect(result.items).toHaveLength(1);
  });

  it("rejects pending/rejected/deferred changes at the API service level", async () => {
    const prisma = makePrisma();

    await expect(
      createPatchNoteDraft(prisma, {
        title: "v2.3.0 패치노트",
        release_version: "v2.3.0",
        candidate_ids: ["candidate-pending"],
      }),
    ).rejects.toThrow("approved");
  });

  it("rejects unselected PatchNoteCandidates", async () => {
    const prisma = makePrisma();

    await expect(
      createPatchNoteDraft(prisma, {
        title: "v2.3.0 패치노트",
        release_version: "v2.3.0",
        candidate_ids: ["candidate-unselected"],
      }),
    ).rejects.toThrow("selected");
  });

  it("blocks draft creation when no candidate ids are selected", async () => {
    const prisma = makePrisma();

    await expect(
      createPatchNoteDraft(prisma, {
        title: "v2.3.0 패치노트",
        release_version: "v2.3.0",
        candidate_ids: [],
      }),
    ).rejects.toThrow("No selected");
  });
});
