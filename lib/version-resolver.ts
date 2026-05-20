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

type ParsedVersion = {
  kind: "date" | "semver";
  score: number[];
};

function parseVersionLabel(label: string | null): ParsedVersion | null {
  if (!label) return null;

  const trimmed = label.trim();
  const dateMatch = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
      return { kind: "date", score: [parsed.getTime()] };
    }
  }

  const semverMatch = trimmed.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/i);
  if (semverMatch) {
    return {
      kind: "semver",
      score: [Number(semverMatch[1]), Number(semverMatch[2] ?? 0), Number(semverMatch[3] ?? 0)],
    };
  }

  return null;
}

function compareScoreDesc(a: number[], b: number[]) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (b[index] ?? 0) - (a[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function markNeedsVersionReview(prisma: VersionResolverPrisma, versions: VersionRow[]) {
  for (const version of versions) {
    await prisma.reviewQueueItem.create({
      data: {
        document_version_id: version.id,
        issue_type: "no_version",
        description: "version_date가 없고 version_label을 파싱할 수 없습니다. 수동 확인이 필요합니다.",
      },
    });
  }
  return { status: "needs_review" as const, issue_type: "no_version" as const };
}

export async function resolveLatestVersion(prisma: VersionResolverPrisma, documentId: string) {
  const versions = await prisma.documentVersion.findMany({
    where: { document_id: documentId },
  });

  let sortableVersions = versions
    .filter((version) => version.version_date != null)
    .map((version) => ({ version, score: [version.version_date!.getTime()] }))
    .sort((a, b) => {
      const dateDiff = compareScoreDesc(a.score, b.score);
      if (dateDiff !== 0) return dateDiff;
      return b.version.uploaded_at.getTime() - a.version.uploaded_at.getTime();
    });

  if (sortableVersions.length === 0) {
    const parsedVersions = versions
      .map((version) => ({ version, parsed: parseVersionLabel(version.version_label) }))
      .filter((entry): entry is { version: VersionRow; parsed: ParsedVersion } => entry.parsed != null);

    if (parsedVersions.length === 0) {
      return markNeedsVersionReview(prisma, versions);
    }

    const firstKind = parsedVersions[0].parsed.kind;
    if (parsedVersions.length !== versions.length || parsedVersions.some((entry) => entry.parsed.kind !== firstKind)) {
      return markNeedsVersionReview(prisma, versions);
    }

    sortableVersions = parsedVersions
      .map((entry) => ({ version: entry.version, score: entry.parsed.score }))
      .sort((a, b) => {
        const scoreDiff = compareScoreDesc(a.score, b.score);
        if (scoreDiff !== 0) return scoreDiff;
        return b.version.uploaded_at.getTime() - a.version.uploaded_at.getTime();
      });
  }

  const candidateLatest = sortableVersions[0].version;
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
