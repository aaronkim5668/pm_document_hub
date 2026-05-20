"use client";

import { useEffect, useState } from "react";

type ReviewItem = {
  id: string;
  issue_type: string;
  status: string;
  description: string;
  auto_suggestion?: string | null;
  document_version?: {
    version_label?: string | null;
    version_date?: string | null;
    normalized_doc?: {
      title: string;
    } | null;
  } | null;
};

export default function ReviewPage() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [message, setMessage] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [versionDate, setVersionDate] = useState("");

  async function load() {
    const response = await fetch(`/api/review?status=${encodeURIComponent(status)}`);
    const result = await response.json();
    setItems(result.items ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function action(id: string, actionName: "approve" | "reject" | "defer") {
    setMessage("");
    const body =
      actionName === "approve" && (versionLabel || versionDate)
        ? JSON.stringify({ version_label: versionLabel || undefined, version_date: versionDate || undefined })
        : "{}";
    const response = await fetch(`/api/review/${id}/${actionName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const result = await response.json();
    setMessage(response.ok ? "처리되었습니다." : result.error ?? "처리 실패");
    await load();
  }

  return (
    <section className="stack">
      <div>
        <h1>Review Queue</h1>
        <p className="muted">version_conflict 승인만 latest 교체를 수행합니다.</p>
      </div>

      <div className="panel">
        <label className="label">
          상태
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="pending">pending</option>
            <option value="deferred">deferred</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
      </div>

      {message ? <div className="panel muted">{message}</div> : null}

      <div className="list">
        {items.map((item) => (
          <div className="panel stack" key={item.id}>
            <div>
              <strong>{item.issue_type}</strong> · {item.status}
              <p>{item.document_version?.normalized_doc?.title ?? item.description}</p>
              {item.auto_suggestion ? <p className="muted">{item.auto_suggestion}</p> : null}
            </div>
            {item.issue_type === "no_version" ? (
              <div className="grid">
                <label className="label">
                  version_label
                  <input className="input" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} />
                </label>
                <label className="label">
                  version_date
                  <input className="input" type="date" value={versionDate} onChange={(event) => setVersionDate(event.target.value)} />
                </label>
              </div>
            ) : null}
            <div className="nav">
              <button className="button primary" type="button" onClick={() => action(item.id, "approve")}>
                승인
              </button>
              <button className="button" type="button" onClick={() => action(item.id, "defer")}>
                보류
              </button>
              <button className="button" type="button" onClick={() => action(item.id, "reject")}>
                거부
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
