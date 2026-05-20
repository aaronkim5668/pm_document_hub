import { describe, expect, it } from "vitest";
import { searchDocuments } from "../lib/document-search";

function makePrisma() {
  const versions = [
    {
      id: "version-latest",
      document_id: "doc-1",
      version_label: "v2.0",
      version_date: new Date("2026-05-20"),
      status: "approved",
      is_latest: true,
      uploaded_at: new Date("2026-05-20"),
      document: { doc_type: "skill_spec" },
      normalized_doc: {
        title: "파이어볼 스킬 기획서",
        summary: "화염 마법 밸런스 조정",
        category: "전투",
        design_items: [{ item_name: "파이어볼", description: "피해량 조정" }],
      },
      tags: [{ tag: { name: "마법사" } }, { tag: { name: "스킬" } }],
      change_candidates: [{ id: "change-1" }],
    },
    {
      id: "version-old",
      document_id: "doc-1",
      version_label: "v1.0",
      version_date: new Date("2026-05-10"),
      status: "approved",
      is_latest: false,
      uploaded_at: new Date("2026-05-10"),
      document: { doc_type: "skill_spec" },
      normalized_doc: {
        title: "파이어볼 스킬 기획서",
        summary: "이전 버전",
        category: "전투",
        design_items: [],
      },
      tags: [],
      change_candidates: [],
    },
    {
      id: "version-deprecated",
      document_id: "doc-2",
      version_label: "v1.0",
      version_date: new Date("2026-05-01"),
      status: "deprecated",
      is_latest: true,
      uploaded_at: new Date("2026-05-01"),
      document: { doc_type: "event_spec" },
      normalized_doc: {
        title: "삭제된 이벤트 문서",
        summary: "파이어볼 이벤트",
        category: "이벤트",
        design_items: [],
      },
      tags: [{ tag: { name: "파이어볼" } }],
      change_candidates: [],
    },
  ];

  return {
    documentVersion: {
      findMany: async () => versions,
    },
    reviewQueueItem: {
      count: async () => 2,
    },
  };
}

describe("searchDocuments", () => {
  it("returns latest non-deprecated versions only", async () => {
    const result = await searchDocuments(makePrisma(), { query: "파이어볼" });

    expect(result.items.map((item) => item.version_id)).toEqual(["version-latest"]);
    expect(result.items[0].is_latest).toBe(true);
    expect(result.items[0].status).toBe("approved");
  });

  it("matches tag and design item text without duplicate cards", async () => {
    const result = await searchDocuments(makePrisma(), { query: "마법사" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].document_id).toBe("doc-1");
  });

  it("uses ilike as the default search mode", async () => {
    const result = await searchDocuments(makePrisma(), { query: "피해량" });

    expect(result.search_mode).toBe("ilike");
    expect(result.items.map((item) => item.version_id)).toEqual(["version-latest"]);
  });
});
