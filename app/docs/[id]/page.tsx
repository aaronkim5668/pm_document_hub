import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ChangeCandidateForm } from "./ChangeCandidateForm";

export default async function DocumentDetailPage({ params }: { params: { id: string } }) {
  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      versions: {
        orderBy: [{ is_latest: "desc" }, { version_date: "desc" }, { uploaded_at: "desc" }],
        include: {
          normalized_doc: {
            include: {
              design_items: true,
            },
          },
          change_candidates: {
            orderBy: { created_at: "desc" },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    notFound();
  }

  const latest = document.versions.find((version) => version.is_latest) ?? document.versions[0];
  const normalized = latest?.normalized_doc;

  return (
    <section className="stack">
      <div>
        <h1>{normalized?.title ?? "Untitled document"}</h1>
        <p className="muted">
          {document.doc_type} · {latest?.status ?? "unknown"} · {latest?.version_label ?? "Unknown"} ·{" "}
          {latest?.version_date ? latest.version_date.toISOString().slice(0, 10) : "date unknown"}
        </p>
      </div>

      <section className="panel">
        <h2>메타데이터</h2>
        <p>{normalized?.summary ?? "요약 없음"}</p>
        <p className="muted">카테고리: {normalized?.category ?? "-"}</p>
        <p className="muted">태그: {latest?.tags.map((tag) => tag.tag.name).join(", ") || "-"}</p>
      </section>

      <section className="panel">
        <h2>버전 목록</h2>
        <div className="list">
          {document.versions.map((version) => (
            <div className="row" key={version.id}>
              <strong>{version.version_label ?? "Unknown"}</strong>
              <div className="muted">
                {version.is_latest ? "latest · " : ""}
                {version.status} · {version.version_date ? version.version_date.toISOString().slice(0, 10) : "date unknown"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>DesignItem</h2>
        <div className="list">
          {normalized?.design_items.map((item) => (
            <div className="row" key={item.id}>
              <strong>{item.item_name}</strong> <span className="muted">({item.item_type})</span>
              {item.description ? <p>{item.description}</p> : null}
            </div>
          )) ?? <p className="muted">없음</p>}
        </div>
      </section>

      <section className="panel">
        <h2>ChangeCandidate</h2>
        <div className="list">
          {latest?.change_candidates.map((candidate) => (
            <div className="row" key={candidate.id}>
              <strong>{candidate.change_type}</strong> · {candidate.review_status} · {candidate.category ?? "category 없음"}
              <p>{candidate.change_description}</p>
              {candidate.patch_note_draft ? <p className="muted">{candidate.patch_note_draft}</p> : null}
            </div>
          )) ?? <p className="muted">없음</p>}
        </div>
      </section>

      {latest ? <ChangeCandidateForm documentVersionId={latest.id} /> : null}
    </section>
  );
}
