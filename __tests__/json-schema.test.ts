import { describe, expect, it } from "vitest";
import { validateImportJson } from "../lib/json-schema";

const validImport = {
  title: "파이어볼 스킬 기획서",
  doc_type: "skill_spec",
  import_mode: "ai_import",
  version_label: "v2.3",
  version_date: "2026-05-18",
  status: "draft",
  design_items: [
    {
      item_name: "파이어볼",
      item_type: "skill",
      description: "마법사 주력 스킬",
    },
  ],
  change_candidates: [
    {
      change_type: "modify",
      change_description: "피해량 120%에서 100%로 조정",
      patch_note_draft: "파이어볼 피해량이 조정됩니다.",
      category: "balance",
    },
  ],
};

describe("validateImportJson", () => {
  it("accepts a valid minimal AI import payload", () => {
    const result = validateImportJson(validImport);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("파이어볼 스킬 기획서");
      expect(result.data.change_candidates[0].category).toBe("balance");
    }
  });

  it("returns a field error when title is missing", () => {
    const result = validateImportJson({ ...validImport, title: undefined });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.path === "title")).toBe(true);
    }
  });

  it("rejects unknown doc_type values", () => {
    const result = validateImportJson({ ...validImport, doc_type: "gameplay_spec" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.path === "doc_type")).toBe(true);
    }
  });

  it("rejects invalid change candidate category instead of coercing to notice", () => {
    const result = validateImportJson({
      ...validImport,
      change_candidates: [{ ...validImport.change_candidates[0], category: "combat" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.path === "change_candidates.0.category")).toBe(true);
    }
  });

  it("rejects bad version_date format", () => {
    const result = validateImportJson({ ...validImport, version_date: "2026/05/18" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.path === "version_date")).toBe(true);
    }
  });
});
