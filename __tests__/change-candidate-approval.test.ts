import { describe, expect, it } from "vitest";
import { saveApprovedImport } from "../lib/import-service";
import type { ImportJsonInput } from "../lib/json-schema";

function makeImport(changeCount = 2): ImportJsonInput {
  return {
    title: "파이어볼 스킬 기획서",
    doc_type: "skill_spec",
    import_mode: "ai_import",
    version_label: "v2.3",
    version_date: "2026-05-18",
    status: "draft",
    tags: [],
    design_items: [{ item_name: "파이어볼", item_type: "skill" }],
    change_candidates: Array.from({ length: changeCount }, (_, index) => ({
      change_type: index === 0 ? "modify" : "add",
      change_description: `변경사항 ${index + 1}`,
      patch_note_draft: `패치노트 ${index + 1}`,
      category: "balance",
    })),
    requires_review: [],
  };
}

function createTransactionalPrisma(options: { failOnDocumentVersion?: boolean } = {}) {
  const state = {
    documents: [] as unknown[],
    versions: [] as unknown[],
    normalizedDocuments: [] as unknown[],
    designItems: [] as unknown[],
    changeCandidates: [] as Array<{ review_status: string }>,
    reviewQueueItems: [] as unknown[],
  };

  const makeTx = (target: typeof state) => ({
    document: {
      findFirst: async () => null,
      create: async ({ data }: { data: unknown }) => {
        const row = { id: `doc-${target.documents.length + 1}`, ...(data as object) };
        target.documents.push(row);
        return row;
      },
    },
    documentVersion: {
      create: async ({ data }: { data: unknown }) => {
        if (options.failOnDocumentVersion) {
          throw new Error("DocumentVersion create failed");
        }
        const row = { id: `version-${target.versions.length + 1}`, ...(data as object) };
        target.versions.push(row);
        return row;
      },
      findMany: async () => target.versions,
      updateMany: async () => ({ count: target.versions.length }),
      update: async ({ where }: { where: { id: string } }) => ({ id: where.id }),
    },
    normalizedDocument: {
      create: async ({ data }: { data: unknown }) => {
        const row = { id: `normalized-${target.normalizedDocuments.length + 1}`, ...(data as object) };
        target.normalizedDocuments.push(row);
        return row;
      },
    },
    designItem: {
      create: async ({ data }: { data: unknown }) => {
        const row = { id: `item-${target.designItems.length + 1}`, ...(data as object) };
        target.designItems.push(row);
        return row;
      },
    },
    changeCandidate: {
      create: async ({ data }: { data: { review_status: string } }) => {
        const row = { id: `change-${target.changeCandidates.length + 1}`, ...data };
        target.changeCandidates.push(row);
        return row;
      },
    },
    reviewQueueItem: {
      create: async ({ data }: { data: unknown }) => {
        const row = { id: `review-${target.reviewQueueItems.length + 1}`, ...(data as object) };
        target.reviewQueueItems.push(row);
        return row;
      },
    },
  });

  const root = makeTx(state);

  return {
    state,
    documentVersion: root.documentVersion,
    reviewQueueItem: root.reviewQueueItem,
    $transaction: async <T>(callbackOrOperations: ((tx: ReturnType<typeof makeTx>) => Promise<T>) | Array<Promise<T>>) => {
      if (Array.isArray(callbackOrOperations)) {
        return Promise.all(callbackOrOperations);
      }
      const draft = {
        documents: [...state.documents],
        versions: [...state.versions],
        normalizedDocuments: [...state.normalizedDocuments],
        designItems: [...state.designItems],
        changeCandidates: [...state.changeCandidates],
        reviewQueueItems: [...state.reviewQueueItems],
      };
      const result = await callbackOrOperations(makeTx(draft));
      Object.assign(state, draft);
      return result;
    },
  };
}

describe("saveApprovedImport", () => {
  it("stores all imported ChangeCandidates as approved after import approval", async () => {
    const prisma = createTransactionalPrisma();

    await saveApprovedImport(makeImport(2), { prisma });

    expect(prisma.state.changeCandidates).toHaveLength(2);
    expect(prisma.state.changeCandidates.every((candidate) => candidate.review_status === "approved")).toBe(true);
  });

  it("rolls back ChangeCandidates when DocumentVersion save fails", async () => {
    const prisma = createTransactionalPrisma({ failOnDocumentVersion: true });

    await expect(saveApprovedImport(makeImport(2), { prisma })).rejects.toThrow("DocumentVersion create failed");
    expect(prisma.state.changeCandidates).toHaveLength(0);
    expect(prisma.state.documents).toHaveLength(0);
  });

  it("handles an import with no change candidates", async () => {
    const prisma = createTransactionalPrisma();

    await saveApprovedImport(makeImport(0), { prisma });

    expect(prisma.state.versions).toHaveLength(1);
    expect(prisma.state.changeCandidates).toHaveLength(0);
  });
});
