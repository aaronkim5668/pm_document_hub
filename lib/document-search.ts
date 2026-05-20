type SearchPrisma = {
  documentVersion: {
    findMany(args: unknown): Promise<any[]>;
  };
  reviewQueueItem?: {
    count(args?: unknown): Promise<number>;
  };
};

export type DocumentSearchItem = {
  document_id: string;
  version_id: string;
  title: string;
  summary: string | null;
  doc_type: string;
  status: string;
  version_label: string | null;
  version_date: string | null;
  is_latest: boolean;
  tags: string[];
  design_items: string[];
  change_count: number;
};

function includesText(value: unknown, query: string) {
  return typeof value === "string" && value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function rowMatches(row: any, query: string) {
  if (!query) return true;
  return (
    includesText(row.normalized_doc?.title, query) ||
    includesText(row.normalized_doc?.summary, query) ||
    includesText(row.normalized_doc?.category, query) ||
    row.tags?.some((entry: any) => includesText(entry.tag?.name, query)) ||
    row.normalized_doc?.design_items?.some(
      (item: any) => includesText(item.item_name, query) || includesText(item.description, query),
    )
  );
}

function toSearchItem(row: any): DocumentSearchItem {
  return {
    document_id: row.document_id,
    version_id: row.id,
    title: row.normalized_doc?.title ?? "(untitled)",
    summary: row.normalized_doc?.summary ?? null,
    doc_type: row.document?.doc_type ?? row.normalized_doc?.doc_type ?? "etc",
    status: row.status,
    version_label: row.version_label ?? null,
    version_date: row.version_date ? new Date(row.version_date).toISOString().slice(0, 10) : null,
    is_latest: Boolean(row.is_latest),
    tags: row.tags?.map((entry: any) => entry.tag?.name).filter(Boolean) ?? [],
    design_items: row.normalized_doc?.design_items?.map((item: any) => item.item_name).filter(Boolean) ?? [],
    change_count: row.change_candidates?.length ?? 0,
  };
}

export async function searchDocuments(
  prisma: SearchPrisma,
  options: { query?: string; limit?: number; searchMode?: string } = {},
) {
  const query = options.query?.trim() ?? "";
  const limit = Math.min(Math.max(options.limit ?? (query ? 50 : 10), 1), 50);
  const searchMode = options.searchMode ?? process.env.SEARCH_MODE ?? "ilike";

  const rows = await prisma.documentVersion.findMany({
    where: {
      is_latest: true,
      status: { not: "deprecated" },
    },
    include: {
      document: true,
      normalized_doc: {
        include: {
          design_items: true,
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      change_candidates: true,
    },
    orderBy: [{ uploaded_at: "desc" }],
    take: limit * 3,
  });

  const seenVersionIds = new Set<string>();
  const items: DocumentSearchItem[] = [];
  for (const row of rows) {
    if (row.status === "deprecated" || !row.is_latest || seenVersionIds.has(row.id) || !rowMatches(row, query)) {
      continue;
    }
    seenVersionIds.add(row.id);
    items.push(toSearchItem(row));
    if (items.length >= limit) break;
  }

  return {
    search_mode: searchMode === "bigm" ? "bigm" : "ilike",
    items,
    review_pending_count: prisma.reviewQueueItem ? await prisma.reviewQueueItem.count({ where: { status: "pending" } }) : 0,
  };
}
