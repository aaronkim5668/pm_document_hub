import { describe, expect, it } from "vitest";
import { resolveLatestVersion } from "../lib/version-resolver";

type VersionRow = {
  id: string;
  document_id: string;
  version_label: string | null;
  version_date: Date | null;
  uploaded_at: Date;
  status: string;
  is_latest: boolean;
};

function makePrisma(versions: VersionRow[]) {
  const reviewQueueItems: Array<{ issue_type: string; document_version_id: string }> = [];
  return {
    versions,
    reviewQueueItems,
    documentVersion: {
      findMany: async () => versions,
      updateMany: async ({ data }: { data: { is_latest: boolean } }) => {
        versions.forEach((version) => {
          version.is_latest = data.is_latest;
        });
        return { count: versions.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: { is_latest: boolean } }) => {
        const version = versions.find((row) => row.id === where.id);
        if (!version) throw new Error("version not found");
        version.is_latest = data.is_latest;
        return version;
      },
    },
    reviewQueueItem: {
      create: async ({ data }: { data: { issue_type: string; document_version_id: string } }) => {
        reviewQueueItems.push(data);
        return { id: `review-${reviewQueueItems.length}`, ...data };
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
}

describe("resolveLatestVersion", () => {
  it("marks the latest version by version_date", async () => {
    const prisma = makePrisma([
      {
        id: "old",
        document_id: "doc-1",
        version_label: "v1",
        version_date: new Date("2026-05-01"),
        uploaded_at: new Date("2026-05-02"),
        status: "draft",
        is_latest: true,
      },
      {
        id: "new",
        document_id: "doc-1",
        version_label: "v2",
        version_date: new Date("2026-05-10"),
        uploaded_at: new Date("2026-05-11"),
        status: "draft",
        is_latest: false,
      },
    ]);

    await resolveLatestVersion(prisma, "doc-1");

    expect(prisma.versions.find((version) => version.id === "new")?.is_latest).toBe(true);
    expect(prisma.versions.find((version) => version.id === "old")?.is_latest).toBe(false);
  });

  it("uses uploaded_at as a tie-breaker when version_date is identical", async () => {
    const prisma = makePrisma([
      {
        id: "first",
        document_id: "doc-1",
        version_label: "v1",
        version_date: new Date("2026-05-10"),
        uploaded_at: new Date("2026-05-10T09:00:00Z"),
        status: "draft",
        is_latest: false,
      },
      {
        id: "second",
        document_id: "doc-1",
        version_label: "v1b",
        version_date: new Date("2026-05-10"),
        uploaded_at: new Date("2026-05-10T10:00:00Z"),
        status: "draft",
        is_latest: false,
      },
    ]);

    await resolveLatestVersion(prisma, "doc-1");

    expect(prisma.versions.find((version) => version.id === "second")?.is_latest).toBe(true);
  });

  it("creates no_version review items when version_date is absent", async () => {
    const prisma = makePrisma([
      {
        id: "unknown",
        document_id: "doc-1",
        version_label: null,
        version_date: null,
        uploaded_at: new Date("2026-05-10"),
        status: "draft",
        is_latest: false,
      },
    ]);

    await resolveLatestVersion(prisma, "doc-1");

    expect(prisma.reviewQueueItems).toEqual([
      expect.objectContaining({ issue_type: "no_version", document_version_id: "unknown" }),
    ]);
    expect(prisma.versions[0].is_latest).toBe(false);
  });

  it("creates version_conflict and does not auto-replace approved latest versions", async () => {
    const prisma = makePrisma([
      {
        id: "approved",
        document_id: "doc-1",
        version_label: "v1",
        version_date: new Date("2026-05-01"),
        uploaded_at: new Date("2026-05-01"),
        status: "approved",
        is_latest: true,
      },
      {
        id: "newer",
        document_id: "doc-1",
        version_label: "v2",
        version_date: new Date("2026-05-10"),
        uploaded_at: new Date("2026-05-10"),
        status: "draft",
        is_latest: false,
      },
    ]);

    await resolveLatestVersion(prisma, "doc-1");

    expect(prisma.reviewQueueItems).toEqual([
      expect.objectContaining({ issue_type: "version_conflict", document_version_id: "newer" }),
    ]);
    expect(prisma.versions.find((version) => version.id === "approved")?.is_latest).toBe(true);
    expect(prisma.versions.find((version) => version.id === "newer")?.is_latest).toBe(false);
  });
});
