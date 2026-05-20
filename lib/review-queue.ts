type ReviewQueuePrisma = {
  $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
  reviewQueueItem: {
    findMany?(args: unknown): Promise<any[]>;
    findUnique(args: unknown): Promise<any | null>;
    update(args: unknown): Promise<any>;
  };
  documentVersion: {
    updateMany(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<any>;
  };
};

async function requireQueueItem(prisma: any, id: string) {
  const item = await prisma.reviewQueueItem.findUnique({
    where: { id },
    include: { document_version: true, change_candidate: true },
  });
  if (!item) throw new Error("ReviewQueueItem not found");
  return item;
}

export async function listReviewQueueItems(prisma: { reviewQueueItem: { findMany(args: unknown): Promise<any[]> } }, status?: string) {
  return prisma.reviewQueueItem.findMany({
    where: status ? { status } : undefined,
    include: {
      document_version: {
        include: {
          normalized_doc: true,
        },
      },
      change_candidate: true,
    },
    orderBy: { created_at: "desc" },
  });
}

export async function approveReviewQueueItem(prisma: ReviewQueuePrisma, id: string) {
  return prisma.$transaction(async (tx) => {
    const item = await requireQueueItem(tx, id);
    if (item.issue_type !== "version_conflict") {
      throw new Error("Only version_conflict can be approved with latest replacement");
    }
    const version = item.document_version;
    if (!version?.document_id) {
      throw new Error("ReviewQueueItem has no document version");
    }

    await tx.documentVersion.updateMany({
      where: { document_id: version.document_id },
      data: { is_latest: false },
    });
    await tx.documentVersion.update({
      where: { id: version.id },
      data: { is_latest: true },
    });
    return tx.reviewQueueItem.update({
      where: { id },
      data: {
        status: "approved",
        resolved_at: new Date(),
        resolution_note: "version_conflict approved",
      },
    });
  });
}

export async function approveReviewQueueItemFromRequest(
  prisma: ReviewQueuePrisma,
  id: string,
  input: { version_date?: string; version_label?: string },
) {
  const item = await requireQueueItem(prisma, id);

  if (item.issue_type === "version_conflict") {
    return approveReviewQueueItem(prisma, id);
  }

  if (item.issue_type === "no_version") {
    if (!input.version_date && !input.version_label) {
      throw new Error("version_date or version_label is required");
    }
    return resolveNoVersionReviewItem(prisma, id, {
      version_date: input.version_date,
      version_label: input.version_label,
    });
  }

  throw new Error(`Unsupported review issue type: ${item.issue_type}`);
}

export async function rejectReviewQueueItem(prisma: ReviewQueuePrisma, id: string) {
  return prisma.$transaction(async (tx) => {
    const item = await requireQueueItem(tx, id);
    if (item.document_version_id) {
      await tx.documentVersion.update({
        where: { id: item.document_version_id },
        data: { status: "deprecated" },
      });
    }
    return tx.reviewQueueItem.update({
      where: { id },
      data: {
        status: "rejected",
        resolved_at: new Date(),
        resolution_note: "rejected",
      },
    });
  });
}

export async function deferReviewQueueItem(prisma: ReviewQueuePrisma, id: string) {
  return prisma.reviewQueueItem.update({
    where: { id },
    data: {
      status: "deferred",
    },
  });
}

export async function resolveNoVersionReviewItem(
  prisma: ReviewQueuePrisma,
  id: string,
  input: { version_date?: string; version_label?: string },
) {
  if (!input.version_date && !input.version_label) {
    throw new Error("version_date or version_label is required");
  }

  return prisma.$transaction(async (tx) => {
    const item = await requireQueueItem(tx, id);
    if (item.issue_type !== "no_version") {
      throw new Error("Only no_version can be resolved with metadata");
    }
    await tx.documentVersion.update({
      where: { id: item.document_version_id },
      data: {
        version_date: input.version_date ? new Date(`${input.version_date}T00:00:00.000Z`) : undefined,
        version_label: input.version_label,
      },
    });
    return tx.reviewQueueItem.update({
      where: { id },
      data: {
        status: "approved",
        resolved_at: new Date(),
        resolution_note: "no_version metadata resolved without latest replacement",
      },
    });
  });
}
