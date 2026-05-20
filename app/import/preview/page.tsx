"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PreviewData = {
  title: string;
  doc_type: string;
  version_label?: string;
  version_date?: string;
  status: string;
  category?: string;
  summary?: string;
  tags: string[];
  design_items: Array<{ item_name: string; item_type: string; description?: string }>;
  change_candidates: Array<{
    change_type: string;
    change_description: string;
    patch_note_draft?: string;
    category?: string;
  }>;
  requires_review: Array<{ field?: string; issue?: string; suggestion?: string }>;
};

export default function ImportPreviewPage() {
  const [jsonText, setJsonText] = useState("");
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [saved, setSaved] = useState<{ document_version_id: string; change_candidate_count: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("pm_document_hub.import_preview");
    if (stored) {
      setJsonText(JSON.stringify(JSON.parse(stored), null, 2));
    }
  }, []);

  const preview: PreviewData | null = (() => {
    try {
      return jsonText ? JSON.parse(jsonText) : null;
    } catch {
      return null;
    }
  })();

  async function approve() {
    setErrors([]);
    setIsSaving(true);
    try {
      const payload = JSON.parse(jsonText);
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrors(result.errors ?? [{ path: "save", message: result.error ?? "Save failed" }]);
        return;
      }
      setSaved(result);
    } catch (error) {
      setErrors([{ path: "json", message: error instanceof Error ? error.message : "Invalid JSON" }]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="stack">
      <div className="topbar">
        <div>
          <h1>Import Preview</h1>
          <p className="muted">저장 전에 내용을 확인합니다. 승인 시 ChangeCandidate는 approved로 저장됩니다.</p>
        </div>
        <div className="nav">
          <Link href="/import">취소</Link>
          <button className="button primary" type="button" onClick={approve} disabled={isSaving || !preview || Boolean(saved)}>
            승인 및 저장
          </button>
        </div>
      </div>

      {saved ? (
        <div className="panel stack">
          <h2>저장 완료</h2>
          <p>승인된 변경사항 {saved.change_candidate_count}건이 저장되었습니다.</p>
          <Link className="button primary" href={`/patch-notes/new?document_version_id=${saved.document_version_id}`}>
            패치노트 생성하기
          </Link>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="panel error">
          {errors.map((error) => (
            <div key={`${error.path}-${error.message}`}>
              {error.path}: {error.message}
            </div>
          ))}
        </div>
      ) : null}

      {preview ? (
        <div className="grid">
          <section className="panel">
            <h2>문서 정보</h2>
            <p>{preview.title}</p>
            <p className="muted">
              {preview.doc_type} · {preview.status} · {preview.version_label ?? "version unknown"} ·{" "}
              {preview.version_date ?? "date unknown"}
            </p>
            <p>{preview.summary}</p>
          </section>
          <section className="panel">
            <h2>Review 필요</h2>
            {preview.requires_review.length === 0 ? (
              <p className="muted">없음</p>
            ) : (
              <div className="list">
                {preview.requires_review.map((item, index) => (
                  <div className="row" key={index}>
                    {item.field}: {item.issue}
                    {item.suggestion ? <div className="muted">{item.suggestion}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="panel">
            <h2>기획 항목</h2>
            <div className="list">
              {preview.design_items.map((item, index) => (
                <div className="row" key={`${item.item_name}-${index}`}>
                  {item.item_name} <span className="muted">({item.item_type})</span>
                  {item.description ? <div>{item.description}</div> : null}
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>변경사항 후보</h2>
            <div className="list">
              {preview.change_candidates.map((candidate, index) => (
                <div className="row" key={`${candidate.change_description}-${index}`}>
                  <strong>{candidate.change_type}</strong> {candidate.change_description}
                  <div className="muted">{candidate.category ?? "category empty"}</div>
                  {candidate.patch_note_draft ? <div>{candidate.patch_note_draft}</div> : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="panel error">Preview JSON을 읽을 수 없습니다.</div>
      )}

      <div className="panel stack">
        <label className="label">
          Preview JSON 편집
          <textarea className="textarea" value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
        </label>
      </div>
    </section>
  );
}
