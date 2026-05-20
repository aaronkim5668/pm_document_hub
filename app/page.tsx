import Link from "next/link";

export default function HomePage() {
  return (
    <section className="stack">
      <div>
        <h1>Week 1 Vertical Slice</h1>
        <p className="muted">
          JSON Import부터 규칙 기반 패치노트 초안 생성까지의 최소 흐름만 제공합니다.
        </p>
      </div>
      <div className="grid">
        <Link className="panel" href="/import" style={{ textDecoration: "none" }}>
          <h2>AI Import</h2>
          <p className="muted">GPT 정제본 JSON을 붙여넣고 검증 후 Preview로 이동합니다.</p>
        </Link>
        <Link className="panel" href="/patch-notes/new" style={{ textDecoration: "none" }}>
          <h2>PatchNote Draft</h2>
          <p className="muted">승인된 ChangeCandidate에서 후보를 만들고 초안을 생성합니다.</p>
        </Link>
      </div>
    </section>
  );
}
