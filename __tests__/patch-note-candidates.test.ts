import { describe, expect, it } from "vitest";
import { ensurePatchNoteCandidates } from "../lib/patch-note-candidates";

function makePrisma() {
  const changes = [
    {
      id: "change-1",
      document_version_id: "version-1",
      review_status: "approved",
      patch_note_draft: "파이어볼 피해량이 조정됩니다.",
      change_description: "파이어볼 피해량 조정",
      category: "balance",
      created_at: new Date("2026-05-20T00:00:00Z"),
    },
  ];
  const candidates = new Map<string, unknown>();

  return {
    candidates,
    changeCandidate: {
      findMany: async () => changes,
    },
    patchNoteCandidate: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { change_candidate_id: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = candidates.get(where.change_candidate_id);
        if (existing) {
          const updated = { ...(existing as object), ...update };
          candidates.set(where.change_candidate_id, updated);
          return updated;
        }
        const created = {
          id: `candidate-${candidates.size + 1}`,
          ...create,
          change_candidate: changes.find((change) => change.id === create.change_candidate_id),
        };
        candidates.set(where.change_candidate_id, created);
        return created;
      },
    },
  };
}

describe("ensurePatchNoteCandidates", () => {
  it("does not create duplicate PatchNoteCandidates on repeated entry", async () => {
    const prisma = makePrisma();

    await ensurePatchNoteCandidates(prisma, { documentVersionId: "version-1" });
    await ensurePatchNoteCandidates(prisma, { documentVersionId: "version-1" });

    expect(prisma.candidates.size).toBe(1);
  });
});
