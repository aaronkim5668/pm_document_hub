import { describe, expect, it } from "vitest";
import { approveReviewQueueItem, deferReviewQueueItem, rejectReviewQueueItem, resolveNoVersionReviewItem } from "../lib/review-queue";

function makePrisma(issueType: "version_conflict" | "no_version" = "version_conflict") {
  const versions = [
    { id: "current", document_id: "doc-1", status: "approved", is_latest: true },
    { id: "candidate", document_id: "doc-1", status: "draft", is_latest: false },
  ];
  const queue = {
    id: "queue-1",
    issue_type: issueType,
    status: "pending",
    document_version_id: "candidate",
    document_version: versions[1],
  };
  const calls: string[] = [];

  const tx = {
    reviewQueueItem: {
      findUnique: async () => queue,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push(`queue:${String(data.status)}`);
        Object.assign(queue, data);
        return queue;
      },
    },
    documentVersion: {
      updateMany: async ({ data }: { data: { is_latest?: boolean } }) => {
        calls.push("versions:updateMany");
        versions.forEach((version) => {
          if (version.document_id === "doc-1") version.is_latest = Boolean(data.is_latest);
        });
        return { count: versions.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push(`version:${where.id}`);
        const version = versions.find((item) => item.id === where.id);
        if (!version) throw new Error("missing version");
        Object.assign(version, data);
        return version;
      },
    },
  };

  return {
    calls,
    versions,
    queue,
    reviewQueueItem: tx.reviewQueueItem,
    documentVersion: tx.documentVersion,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };
}

describe("review queue actions", () => {
  it("approves version_conflict with a transaction latest switch", async () => {
    const prisma = makePrisma("version_conflict");

    await approveReviewQueueItem(prisma, "queue-1");

    expect(prisma.calls).toContain("versions:updateMany");
    expect(prisma.versions.find((version) => version.id === "current")?.is_latest).toBe(false);
    expect(prisma.versions.find((version) => version.id === "candidate")?.is_latest).toBe(true);
    expect(prisma.queue.status).toBe("approved");
  });

  it("rejects by deprecating target version and resolving queue", async () => {
    const prisma = makePrisma("version_conflict");

    await rejectReviewQueueItem(prisma, "queue-1");

    expect(prisma.versions.find((version) => version.id === "candidate")?.status).toBe("deprecated");
    expect(prisma.queue.status).toBe("rejected");
  });

  it("defers queue item without touching document versions", async () => {
    const prisma = makePrisma("version_conflict");

    await deferReviewQueueItem(prisma, "queue-1");

    expect(prisma.queue.status).toBe("deferred");
    expect(prisma.calls.some((call) => call.startsWith("version:"))).toBe(false);
  });

  it("resolves no_version metadata without changing latest automatically", async () => {
    const prisma = makePrisma("no_version");

    await resolveNoVersionReviewItem(prisma, "queue-1", { version_label: "v2.0" });

    expect(prisma.versions.find((version) => version.id === "candidate")?.is_latest).toBe(false);
    expect(prisma.queue.status).toBe("approved");
  });
});
