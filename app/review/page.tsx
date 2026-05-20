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

type NoVersionInputs = Record<string, { version_label: string; version_date: string }>;

export default function ReviewPage() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [message, setMessage] = useState("");
  const [noVersionInputs, setNoVersionInputs] = useState<NoVersionInputs>({});

  async function load() {
    const response = await fetch(`/api/review?status=${encodeURIComponent(status)}`);
    const result = await response.json();
    setItems(result.items ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function updateNoVersionInput(id: string, field: "version_label" | "version_date", value: string) {
    setNoVersionInputs((current) => ({
      ...current,
      [id]: {
        version_label: current[id]?.version_label ?? "",
        version_date: current[id]?.version_date ?? "",
        [field]: value,
      },
    }));
  }

  async function action(item: ReviewItem, actionName: "approve" | "reject" | "defer") {
    setMessage("");
    const metadata = noVersionInputs[item.id];
    const body =
      actionName === "approve" && item.issue_type === "no_version"
        ? JSON.stringify({
            version_label: metadata?.version_label || undefined,
            version_date: metadata?.version_date || undefined,
          })
        : "{}";

    const response = await fetch(`/api/review/${item.id}/${actionName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const result = await response.json();
    setMessage(response.ok ? "처리되었습니다." : result.error ?? "처리 실패");
    if (response.ok) {
      setNoVersionInputs((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
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
        {items.map((item) => {
          const metadata = noVersionInputs[item.id] ?? { version_label: "", version_date: "" };
          return (
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
                    <input
                      className="input"
                      value={metadata.version_label}
                      onChange={(event) => updateNoVersionInput(item.id, "version_label", event.target.value)}
                    />
                  </label>
                  <label className="label">
                    version_date
                    <input
                      className="input"
                      type="date"
                      value={metadata.version_date}
                      onChange={(event) => updateNoVersionInput(item.id, "version_date", event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              <div className="nav">
                <button className="button primary" type="button" onClick={() => action(item, "approve")}>
                  승인
                </button>
                <button className="button" type="button" onClick={() => action(item, "defer")}>
                  보류
                </button>
                <button className="button" type="button" onClick={() => action(item, "reject")}>
                  거부
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
