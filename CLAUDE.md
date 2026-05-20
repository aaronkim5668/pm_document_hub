# CLAUDE.md — pm_document_hub 프로젝트 지침

이 파일은 Claude Code가 이 프로젝트를 이해하고, 리뷰·QA·기획 정합성 검토·디자인·UX 리뷰 시 따라야 할 프로젝트 전용 지침이다.

---

## 제품 목적 및 포지션

**게임 PM 릴리즈/패치노트 자동화 보조 툴.**

게임 서비스 및 라이브 운영 PM을 위한 내부 툴이다. 기획서·시스템 문서·이벤트 기획서·BM 기획서·회의록 등 분산된 문서를 한 곳에 수집·저장·검색하고, 승인된 변경사항을 기반으로 패치노트 초안을 생성한다.

**핵심 전제:** 사용자가 문서를 직접 정제하지 않아도 등록 가능해야 한다.

---

## 핵심 파이프라인

```
AI Pre-Review JSON Import
        ↓
  Zod Schema 검증
        ↓
  Import 미리보기 (사용자 승인)
        ↓
  ChangeCandidate (review_status = approved)
        ↓
  PatchNoteCandidate auto-create
        ↓
  PatchNote Draft (규칙 기반 Markdown)
```

두 번째 경로 (Phase 2):
```
Raw Upload (원본 파일)
        ↓
  텍스트 추출 (upload_status / parse_status 분리)
        ↓
  DocumentVersion 생성
        ↓
  (수동 또는 AI 호출로) ChangeCandidate 생성
```

---

## Non-Negotiable Requirements (13개)

이 요구사항들은 어떤 이유로도 제거하거나 약화시킬 수 없다. 구현 우선순위나 일정을 이유로 변경 불가.

| # | 요구사항 |
|---|---|
| NR-01 | Raw Upload Mode와 AI Pre-Review Import Mode 둘 다 지원 |
| NR-02 | 사용자가 문서를 직접 정제해야만 등록 가능한 구조 금지 |
| NR-03 | 원본 파일 반드시 보존 (읽기 전용, 변경 불가) |
| NR-04 | 업로드 실패(upload_status)와 파싱 실패(parse_status) 분리 관리 |
| NR-05 | GPT 정제본 JSON Import는 1차 MVP 핵심 기능 |
| NR-06 | 문서 검색 기능은 메인 페이지 핵심 진입점 |
| NR-07 | 변경사항 후보(ChangeCandidate)는 패치노트 생성의 원천 데이터 |
| NR-08 | 패치노트 생성 기능은 1차 MVP 포함 (Week 1 E2E) |
| NR-09 | 업로드 순서로 최신 문서 판단 금지 (version_date 또는 version_label 기준) |
| NR-10 | 기존 Approved/Released 문서 교체는 반드시 사용자 명시적 승인 필요 |
| NR-11 | 유료 AI API 기본 자동 호출 금지 (사용자 버튼 클릭 시에만) |
| NR-12 | 월 예산(monthly_budget_usd) = 0 설정 시 유료 API 완전 차단 (서버 레벨) |
| NR-13 | 제외 기능은 삭제하지 않고 Backlog 또는 후속 Phase로 명확히 이동 |

---

## MVP 범위 (4주, Patch-First 전략)

> **Patch-First 전략 (CEO Review 결정):** Week 1에 핵심 파이프라인 E2E를 완성해 7일 안에 핵심 가치를 검증한다.

### Phase 1 — Week 1 (핵심 파이프라인 E2E)

1차 Vertical Slice. 이 범위가 Week 1에 작동해야 MVP의 핵심 가치가 검증된다.

| 기능 ID | 기능명 |
|---|---|
| F01 | AI Pre-Review Import Mode (JSON 붙여넣기 / 파일 업로드) |
| F02 | JSON Schema 검증 (Zod, 서버 사이드) |
| F03 | Import 미리보기 화면 (사용자 승인 후 저장) |
| F07 | 변경사항 후보 저장 (Import 승인 시 전체 approved 일괄 전환) |
| F16 | 문서군 및 버전 관리 (version_date 기준 is_latest 판단, prisma.$transaction 필수) |
| F17 | 패치노트 후보 관리 (/patch-notes/new 진입 시 PatchNoteCandidate auto-create) |
| F18 | 패치노트 초안 생성 (규칙 기반 Markdown, AI 없이 동작) |

**Week 1 완료 기준:** JSON Import 1건 → ChangeCandidate approved → PatchNoteCandidate → 패치노트 초안 E2E 동작

### Phase 1 — Week 2 (지원 기능)

| 기능 ID | 기능명 |
|---|---|
| F04 | 문서 CRUD (Soft delete만, Hard delete 금지) |
| F05 | 문서 검색 (메인 페이지, pg_bigm, 응답 < 500ms) |
| F06 | Review Queue (version_conflict, no_version 필수 2종) |
| F08 | 문서 유형/상태/버전/태그 관리 (11종 DocType, 6종 DocStatus) |
| F09 | API 비용 방지 설정 (월 예산, Budget Guard) |
| F10 | AI 사용량 로그 구조 |

### Phase 2 — Week 3 (Raw Upload)

| 기능 ID | 기능명 |
|---|---|
| F11 | Raw Upload Inbox (PDF, DOCX, XLSX, CSV, TXT, MD, PPTX 부분 지원) |
| F12 | 원본 파일 저장 (읽기 전용, SHA-256 해시) |
| F13 | 기본 텍스트 추출 (30초 타임아웃, 20MB 제한) |
| F14 | 처리 상태 표시 (3초 polling) |
| F15 | 업로드/파싱 실패 분리 관리 |

### Phase 3 — Week 4 (완성 + E2E 검증)

| 기능 ID | 기능명 |
|---|---|
| F19 | 기획서 리뷰 결과 저장 (review_findings JSON 필드) |
| — | AI 패치노트 초안 생성 — F18 AI 고도화 단계, budget guard 통과 시 선택적 호출 |
| — | Raw Upload → ChangeCandidate 연결 완성 |
| — | MVP 전체 E2E 검증 |

---

## Backlog / 1.5차 / 2차 범위

아래 항목은 MVP 범위에서 제외되었으나 **삭제된 것이 아니다**. Backlog에 보존되며 후속 작업 시 재검토한다.

### Backlog (v2 이후)

- 완전한 RAG 챗봇 (벡터 DB + LLM 인프라 필요)
- 유사도 기반 버전 감지 (임베딩 의존)
- HWP/HWPX 파일 지원 (파서 복잡도 높음)
- 이미지 파일 OCR (별도 파이프라인)
- URL 직접 가져오기
- Google Drive / Notion / Confluence 자동 연동
- Slack 공유
- 패치노트 자동 발행 (사람의 최종 검수 원칙과 충돌)
- 다국어 자동 번역
- 복잡한 권한/승인 워크플로우
- 고급 벡터 검색 (pg_vector)
- 문서 하드 삭제
- 버전 비교 UI
- 변경 이력 타임라인 시각화
- 인증/로그인 (v1.5 Backlog — 오피스 LAN 내부망 신뢰 기반 v1 무인증)

### 1.5차 Backlog

- 패치노트·게임데이터 불일치 검수 Agent (J-02)
- CSV 게임데이터 업로드 — 검수 Agent 전용 (K-01)
- validation_runs / validation_findings 스키마 (K-02)

### 2차 Backlog

- 기획서 리뷰 자동화 Agent 별도 UI (J-03)
- design_review_runs / design_review_findings 스키마 (K-03)

> **주의:** Backlog 스키마(ValidationRun, ValidationFinding, DesignReviewRun, DesignReviewFinding)는 `prisma/schema.prisma`에 포함 금지. 구현 시점에 별도 마이그레이션 파일로 추가.

---

## 기술 스택

| 레이어 | 선택 |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes |
| ORM | Prisma |
| DB | PostgreSQL 15+ + pg_bigm (한국어 검색) |
| 파일 저장 | 로컬 (`./storage/`) → v2 Supabase Storage |
| JSON 검증 | Zod (Ajv 사용 금지) |
| 텍스트 추출 | pdf-parse, mammoth, xlsx, officeparser (PPTX) |
| 테스트 | vitest |
| 배포 | 오피스 LAN (HOST=0.0.0.0, PORT=8787) |

---

## 문서 업데이트 규칙

- 스키마 변경 시 → `docs/data_model.md` 업데이트
- 기능 범위 변경 시 → `docs/feature_coverage_matrix.md` 업데이트
- 기능 추가/변경 시 → `docs/mvp_spec.md` 해당 기능 섹션 업데이트
- docs 간 충돌 발생 시 → 변경 전에 Claude Code에게 보고, 의사결정 후 반영

**제거 금지:** 기능을 구현하지 않더라도 docs에서 삭제하지 않는다. 반드시 "Backlog" 또는 후속 Phase로 명시하며 이동 사유를 기록한다.

---

## Claude Code의 역할 정의

Claude Code는 이 프로젝트에서 **구현보다 리뷰와 기획 정합성 검토를 우선 담당**한다.

**주요 역할:**
- 기획 문서(docs/)와 구현 계획(AGENTS.md)의 정합성 검토
- Non-Negotiable Requirements 준수 여부 리뷰
- 구현된 코드의 QA (로직 오류, 엣지 케이스, 보안 취약점)
- 화면 흐름(screen_flow.md)과 실제 UI 구현의 일치 여부 검토
- 데이터 모델(data_model.md)과 Prisma 스키마의 정합성 검토
- 패치노트 파이프라인 비즈니스 로직 검수
- Budget Guard 및 API 비용 통제 로직 검토

**구현은 Codex(AGENTS.md)가 담당.** Claude Code는 구현 결과를 리뷰하고, 기획 의도에서 벗어난 구현을 발견하면 AGENTS.md 기준으로 피드백을 제공한다.
