type VersionRow = {
  id: string;
  document_id: string;
  version_label: string | null;
  version_date: Date | null;
  uploaded_at: Date;
  status: string;
  is_latest: boolean;
};

type VersionResolverPrisma = {
  documentVersion: {
    findMany(args: { where: { document_id: string } }): Promise<VersionRow[]>;
    updateMany(args: { where: { document_id: string }; data: { is_latest: boolean } }): Promise<unknown>;
    update(args: { where: { id: string }; data: { is_latest: boolean } }): Promise<unknown>;
  };
  reviewQueueItem: {
    create(args: {
      data: {
        document_version_id: string;
        issue_type: "no_version" | "version_conflict";
        description: string;
      };
    }): Promise<unknown>;
  };
  $transaction(operations: Array<Promise<unknown>>): Promise<unknown[]>;
};

export async function resolveLatestVersion(prisma: VersionResolverPrisma, documentId: string) {
  const versions = await prisma.documentVersion.findMany({
    where: { document_id: documentId },
  });

  const datedVersions = versions
    .filter((version) => version.version_date != null)
    .sort((a, b) => {
      const dateDiff = b.version_date!.getTime() - a.version_date!.getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.uploaded_at.getTime() - a.uploaded_at.getTime();
    });

  if (datedVersions.length === 0) {
    for (const version of versions) {
      await prisma.reviewQueueItem.create({
        data: {
          document_version_id: version.id,
          issue_type: "no_version",
          description: "문서에서 version_date를 확인할 수 없습니다. 수동 확인이 필요합니다.",
        },
      });
    }
    return { status: "needs_review" as const, issue_type: "no_version" as const };
  }

  const candidateLatest = datedVersions[0];
  const currentLatest = versions.find((version) => version.is_latest);

  if (
    currentLatest &&
    currentLatest.id !== candidateLatest.id &&
    ["approved", "released"].includes(currentLatest.status)
  ) {
    await prisma.reviewQueueItem.create({
      data: {
        document_version_id: candidateLatest.id,
        issue_type: "version_conflict",
        description: `새 버전(${candidateLatest.version_label ?? candidateLatest.id})이 현재 ${currentLatest.status} 상태인 최신 버전을 교체하려 합니다. 승인이 필요합니다.`,
      },
    });
    return { status: "needs_review" as const, issue_type: "version_conflict" as const };
  }

  await prisma.$transaction([
    prisma.documentVersion.updateMany({
      where: { document_id: documentId },
      data: { is_latest: false },
    }),
    prisma.documentVersion.update({
      where: { id: candidateLatest.id },
      data: { is_latest: true },
    }),
  ]);

  return { status: "updated" as const, latest_version_id: candidateLatest.id };
}
