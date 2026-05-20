"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Candidate = {
  id: string;
  draft_text: string;
  category: string;
  is_selected: boolean;
  change_candidate: {
    id: string;
    change_description: string;
    review_status: string;
  };
};

function NewPatchNoteContent() {
  const searchParams = useSearchParams();
  const documentVersionId = searchParams.get("document_version_id");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [title, setTitle] = useState("v1.0.0 패치노트");
  const [releaseVersion, setReleaseVersion] = useState("v1.0.0");
  const [patchDate, setPatchDate] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [patchNoteId, setPatchNoteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadCandidates() {
    setError("");
    setIsLoading(true);
    const query = documentVersionId ? `?document_version_id=${documentVersionId}` : "";
    const response = await fetch(`/api/patch-note-candidates${query}`);
    const result = await response.json();
    setIsLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Failed to load candidates");
      return;
    }
    setCandidates(result.candidates);
  }

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentVersionId]);

  async function updateCandidate(id: string, changes: Partial<Pick<Candidate, "draft_text" | "is_selected">>) {
    setCandidates((current) => current.map((candidate) => (candidate.id === id ? { ...candidate, ...changes } : candidate)));
    const current = candidates.find((candidate) => candidate.id === id);
    await fetch("/api/patch-note-candidates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        is_selected: changes.is_selected ?? current?.is_selected,
        draft_text: changes.draft_text ?? current?.draft_text,
      }),
    });
  }

  function editCandidateLocally(id: string, changes: Partial<Pick<Candidate, "draft_text" | "is_selected">>) {
    setCandidates((current) => current.map((candidate) => (candidate.id === id ? { ...candidate, ...changes } : candidate)));
  }

  async function createDraft() {
    setError("");
    const selectedIds = candidates.filter((candidate) => candidate.is_selected).map((candidate) => candidate.id);
    const response = await fetch("/api/patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        release_version: releaseVersion,
        patch_date: patchDate || null,
        candidate_ids: selectedIds,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Failed to create patch note");
      return;
    }
    setMarkdown(result.markdown);
    setPatchNoteId(result.id);
  }

  return (
    <section className="stack">
      <div>
        <h1>새 패치노트 생성</h1>
        <p className="muted">approved ChangeCandidate만 PatchNoteCandidate로 생성됩니다.</p>
      </div>

      <div className="panel grid">
        <label className="label">
          제목
          <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="label">
          릴리즈 버전
          <input className="input" value={releaseVersion} onChange={(event) => setReleaseVersion(event.target.value)} />
        </label>
        <label className="label">
          패치 일자
          <input className="input" type="date" value={patchDate} onChange={(event) => setPatchDate(event.target.value)} />
        </label>
      </div>

      {error ? <div className="panel error">{error}</div> : null}

      <section className="panel stack">
        <div className="topbar" style={{ marginBottom: 0 }}>
          <h2>PatchNoteCandidate</h2>
          <button className="button" type="button" onClick={loadCandidates} disabled={isLoading}>
            후보 불러오기
          </button>
        </div>
        {candidates.length === 0 ? (
          <p className="muted">승인된 변경사항이 없습니다.</p>
        ) : (
          <div className="list">
            {candidates.map((candidate) => (
              <div className="row stack" key={candidate.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={candidate.is_selected}
                    onChange={(event) => updateCandidate(candidate.id, { is_selected: event.target.checked })}
                  />{" "}
                  [{candidate.category}] {candidate.change_candidate.change_description}
                </label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 80 }}
                  value={candidate.draft_text}
                  onChange={(event) => editCandidateLocally(candidate.id, { draft_text: event.target.value })}
                  onBlur={(event) => updateCandidate(candidate.id, { draft_text: event.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        <div>
          <button
            className="button primary"
            type="button"
            onClick={createDraft}
            disabled={!candidates.some((candidate) => candidate.is_selected)}
          >
            초안 생성
          </button>
        </div>
      </section>

      {markdown ? (
        <section className="panel stack">
          <div className="topbar" style={{ marginBottom: 0 }}>
            <h2>생성된 초안</h2>
            {patchNoteId ? <Link className="button" href={`/patch-notes/${patchNoteId}`}>상세 보기</Link> : null}
          </div>
          <textarea className="textarea" readOnly value={markdown} />
        </section>
      ) : null}
    </section>
  );
}

export default function NewPatchNotePage() {
  return (
    <Suspense fallback={<div className="panel">Loading...</div>}>
      <NewPatchNoteContent />
    </Suspense>
  );
}
