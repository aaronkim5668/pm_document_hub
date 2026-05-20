"use client";

import { useState } from "react";

export function ChangeCandidateForm({ documentVersionId }: { documentVersionId: string }) {
  const [changeType, setChangeType] = useState("modify");
  const [category, setCategory] = useState("notice");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    setMessage("");
    const response = await fetch("/api/changes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_version_id: documentVersionId,
        change_type: changeType,
        change_description: description,
        patch_note_draft: draft || undefined,
        category,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "저장 실패");
      return;
    }
    setDescription("");
    setDraft("");
    setMessage("pending 변경사항이 추가되었습니다.");
  }

  return (
    <div className="panel stack">
      <h3>수동 ChangeCandidate 추가</h3>
      <div className="grid">
        <label className="label">
          변경 유형
          <select className="select" value={changeType} onChange={(event) => setChangeType(event.target.value)}>
            <option value="add">add</option>
            <option value="modify">modify</option>
            <option value="remove">remove</option>
            <option value="clarify">clarify</option>
          </select>
        </label>
        <label className="label">
          패치노트 카테고리
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="major_update">major_update</option>
            <option value="new_content">new_content</option>
            <option value="balance">balance</option>
            <option value="system_improvement">system_improvement</option>
            <option value="bug_fix">bug_fix</option>
            <option value="notice">notice</option>
          </select>
        </label>
      </div>
      <label className="label">
        변경 설명
        <textarea className="textarea" style={{ minHeight: 90 }} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label className="label">
        패치노트 초안
        <textarea className="textarea" style={{ minHeight: 90 }} value={draft} onChange={(event) => setDraft(event.target.value)} />
      </label>
      <div>
        <button className="button primary" type="button" onClick={submit} disabled={!description.trim()}>
          pending으로 추가
        </button>
      </div>
      {message ? <p className={message.includes("실패") ? "error" : "muted"}>{message}</p> : null}
    </div>
  );
}
