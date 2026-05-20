"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SearchItem = {
  document_id: string;
  version_id: string;
  title: string;
  summary: string | null;
  doc_type: string;
  status: string;
  version_label: string | null;
  version_date: string | null;
  tags: string[];
  design_items: string[];
  change_count: number;
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      const response = await fetch(`/api/documents/search?q=${encodeURIComponent(query)}&limit=50`);
      const result = await response.json();
      setItems(result.items ?? []);
      setReviewCount(result.review_pending_count ?? 0);
      setIsLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <section className="stack">
      <div>
        <h1>게임 기획서 DB</h1>
        <p className="muted">최신 문서 중심으로 검색합니다. 기본 검색 모드는 ILIKE fallback입니다.</p>
      </div>

      <div className="panel stack">
        <label className="label">
          검색
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="기획서, 스킬, 이벤트, 패치노트 검색"
          />
        </label>
        <div className="nav">
          <Link href="/import">AI Import</Link>
          <Link href="/patch-notes/new">PatchNote 생성</Link>
          <Link href="/review">Review 대기 {reviewCount}</Link>
          <Link href="/settings">Settings</Link>
        </div>
      </div>

      <section className="stack">
        <h2>{query ? "검색 결과" : "최근 문서"}</h2>
        {isLoading ? <p className="muted">검색 중...</p> : null}
        <div className="list">
          {items.map((item) => (
            <Link className="row" href={`/docs/${item.document_id}`} key={item.version_id} style={{ textDecoration: "none" }}>
              <strong>{item.title}</strong>
              <div className="muted">
                {item.doc_type} · {item.status} · {item.version_label ?? "Unknown"} · {item.version_date ?? "date unknown"}
              </div>
              {item.summary ? <p>{item.summary}</p> : null}
              <div className="muted">
                태그: {item.tags.join(", ") || "-"} · 기획 항목: {item.design_items.join(", ") || "-"} · 변경사항{" "}
                {item.change_count}건
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
