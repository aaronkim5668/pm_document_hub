import { describe, expect, it } from "vitest";
import { createManualChangeCandidate } from "../lib/change-candidates";

function makePrisma() {
  const created: unknown[] = [];
  return {
    created,
    documentVersion: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "version-1" ? { id: "version-1" } : null,
    },
    changeCandidate: {
      create: async ({ data }: { data: unknown }) => {
        created.push(data);
        return { id: "change-1", ...(data as object) };
      },
    },
  };
}

describe("createManualChangeCandidate", () => {
  it("always creates manual ChangeCandidate as pending", async () => {
    const prisma = makePrisma();

    const result = await createManualChangeCandidate(prisma, {
      document_version_id: "version-1",
      change_type: "modify",
      change_description: "수동 변경사항",
      patch_note_draft: "수동 패치노트 후보",
      category: "balance",
      review_status: "approved",
    });

    expect(result.review_status).toBe("pending");
    expect(prisma.created).toEqual([
      expect.objectContaining({
        review_status: "pending",
      }),
    ]);
  });

  it("rejects invalid change_type and category values", async () => {
    const prisma = makePrisma();

    await expect(
      createManualChangeCandidate(prisma, {
        document_version_id: "version-1",
        change_type: "buff",
        change_description: "잘못된 유형",
        category: "combat",
      }),
    ).rejects.toThrow("Invalid manual ChangeCandidate");
  });
});
