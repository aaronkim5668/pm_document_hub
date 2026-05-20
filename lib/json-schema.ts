import { z } from "zod";

const docTypeSchema = z.enum([
  "system_spec",
  "character_spec",
  "skill_spec",
  "bm_spec",
  "event_spec",
  "balance_spec",
  "patch_note",
  "meeting_note",
  "ux_spec",
  "economy_spec",
  "etc",
]);

const docStatusSchema = z.enum(["draft", "review", "approved", "released", "deprecated", "unknown"]);
const changeTypeSchema = z.enum(["add", "modify", "remove", "clarify"]);
const patchNoteCategorySchema = z.enum([
  "major_update",
  "new_content",
  "balance",
  "system_improvement",
  "bug_fix",
  "notice",
]);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date format YYYY-MM-DD")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), "Invalid date");

export const importJsonSchema = z.object({
  title: z.string().min(1, "title is required"),
  doc_type: docTypeSchema,
  import_mode: z.literal("ai_import"),
  version_label: z.string().min(1).optional(),
  version_date: isoDateSchema.optional(),
  category: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
  status: docStatusSchema.default("draft"),
  design_items: z
    .array(
      z.object({
        item_name: z.string().min(1, "item_name is required"),
        item_type: z.string().default("etc"),
        description: z.string().optional(),
      }),
    )
    .default([]),
  change_candidates: z
    .array(
      z.object({
        change_type: changeTypeSchema,
        change_description: z.string().min(1, "change_description is required"),
        patch_note_draft: z.string().optional(),
        category: patchNoteCategorySchema.optional(),
      }),
    )
    .default([]),
  review_findings: z.record(z.unknown()).optional(),
  requires_review: z
    .array(
      z.object({
        field: z.string().optional(),
        issue: z.string().optional(),
        suggestion: z.string().optional(),
      }),
    )
    .default([]),
});

export type ImportJsonInput = z.infer<typeof importJsonSchema>;

export type ValidationFieldError = {
  path: string;
  message: string;
};

export type ValidationResult =
  | { success: true; data: ImportJsonInput }
  | { success: false; errors: ValidationFieldError[] };

export function validateImportJson(input: unknown): ValidationResult {
  const result = importJsonSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
