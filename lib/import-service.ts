import crypto from "node:crypto";
import { validateImportJson, type ImportJsonInput } from "./json-schema";
import { resolveLatestVersion } from "./version-resolver";

type ImportServicePrisma = any;

function hashImportPayload(input: ImportJsonInput) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function toDate(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function saveApprovedImport(input: ImportJsonInput, deps: { prisma: ImportServicePrisma }) {
  const validation = validateImportJson(input);
  if (!validation.success) {
    throw new Error(`Invalid import JSON: ${validation.errors.map((error) => error.path).join(", ")}`);
  }

  const data = validation.data;
  const saved = await deps.prisma.$transaction(async (tx: any) => {
    const existingDocument = await tx.document.findFirst({
      where: {
        doc_type: data.doc_type,
        versions: {
          some: {
            normalized_doc: {
              is: {
                title: data.title,
              },
            },
          },
        },
      },
    });

    const document =
      existingDocument ??
      (await tx.document.create({
        data: {
          doc_type: data.doc_type,
        },
      }));

    const documentVersion = await tx.documentVersion.create({
      data: {
        document_id: document.id,
        version_label: data.version_label,
        version_date: toDate(data.version_date),
        version_hash: hashImportPayload(data),
        status: data.status,
        is_latest: false,
        import_mode: "ai_import",
      },
    });

    const normalizedDocument = await tx.normalizedDocument.create({
      data: {
        document_version_id: documentVersion.id,
        title: data.title,
        doc_type: data.doc_type,
        category: data.category,
        summary: data.summary,
        review_findings: data.review_findings,
        ai_generated: true,
        ai_provider: "none",
      },
    });

    const designItems = [];
    for (const [index, item] of data.design_items.entries()) {
      designItems.push(
        await tx.designItem.create({
          data: {
            normalized_doc_id: normalizedDocument.id,
            item_name: item.item_name,
            item_type: item.item_type,
            description: item.description,
            order_index: index,
          },
        }),
      );
    }

    for (const tagName of data.tags) {
      const tag = await tx.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      });
      await tx.documentTag.upsert({
        where: {
          document_version_id_tag_id: {
            document_version_id: documentVersion.id,
            tag_id: tag.id,
          },
        },
        update: {},
        create: {
          document_version_id: documentVersion.id,
          tag_id: tag.id,
        },
      });
    }

    const changeCandidates = [];
    for (const candidate of data.change_candidates) {
      changeCandidates.push(
        await tx.changeCandidate.create({
          data: {
            document_version_id: documentVersion.id,
            // Week 1 JSON does not carry a stable item reference per change.
            // Keep this null instead of guessing with the first DesignItem.
            design_item_id: null,
            change_type: candidate.change_type,
            change_description: candidate.change_description,
            patch_note_draft: candidate.patch_note_draft,
            category: candidate.category ?? null,
            review_status: "approved",
            reviewed_at: new Date(),
          },
        }),
      );
    }

    for (const reviewItem of data.requires_review) {
      await tx.reviewQueueItem.create({
        data: {
          document_version_id: documentVersion.id,
          issue_type: "low_confidence",
          description: reviewItem.issue ?? `검토 필요: ${reviewItem.field ?? "unknown"}`,
          auto_suggestion: reviewItem.suggestion,
        },
      });
    }

    return {
      document_id: document.id,
      document_version_id: documentVersion.id,
      change_candidate_count: changeCandidates.length,
    };
  });

  const versionResult = await resolveLatestVersion(deps.prisma as any, saved.document_id);
  return { ...saved, version_result: versionResult };
}
