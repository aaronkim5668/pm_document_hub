import { z } from "zod";

const manualChangeCandidateSchema = z.object({
  document_version_id: z.string().min(1),
  change_type: z.enum(["add", "modify", "remove", "clarify"]),
  change_description: z.string().min(1),
  patch_note_draft: z.string().optional(),
  category: z.enum(["major_update", "new_content", "balance", "system_improvement", "bug_fix", "notice"]).optional(),
  review_status: z.unknown().optional(),
});

type ChangeCandidatePrisma = {
  documentVersion: {
    findUnique(args: { where: { id: string } }): Promise<unknown | null>;
  };
  changeCandidate: {
    create(args: { data: unknown }): Promise<any>;
  };
};

export async function createManualChangeCandidate(prisma: ChangeCandidatePrisma, input: unknown) {
  const parsed = manualChangeCandidateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid manual ChangeCandidate");
  }

  const documentVersion = await prisma.documentVersion.findUnique({
    where: { id: parsed.data.document_version_id },
  });
  if (!documentVersion) {
    throw new Error("DocumentVersion not found");
  }

  return prisma.changeCandidate.create({
    data: {
      document_version_id: parsed.data.document_version_id,
      change_type: parsed.data.change_type,
      change_description: parsed.data.change_description,
      patch_note_draft: parsed.data.patch_note_draft,
      category: parsed.data.category,
      review_status: "pending",
    },
  });
}
