# Feature Coverage Matrix

**버전:** 1.2  
**작성일:** 2026-05-19  
**최종 수정:** 2026-05-19 (Patch-First 전파 반영)  
**상태:** REVIEWED

---

## 변경 이력 (v1.1 → v1.2)

| 변경 | 내용 |
|---|---|
| **[C1] Patch-First 전파** | F-01/F-02/F-03/F-05/F-08, D-03을 Phase 3 → **Phase 1 Week 1**로 재배치 |
| F-04 분리 | AI 패치노트 초안 생성만 Phase 3 Week 4 (AI 고도화)로 유지 |
| NR-08 매핑 갱신 | Phase 1 Week 1 (규칙 기반) + Phase 3 Week 4 (AI 고도화)로 분리 |
| 집계 재계산 | Phase 1: 35 → **41**, Phase 3: 8 → **2** |
| D-02 보강 | Import Preview 승인 시 ChangeCandidate 전체 approved 일괄 전환 [B1] |

---

## 변경 이력 (v1.0 → v1.1)

| 변경 | 내용 |
|---|---|
| A-09 PPTX | BACKLOG → ✅ Phase 2 (부분 지원). mvp_spec.md F11과 정합 |
| A-15 신규 | 처리 상태 표시 (Processing Status) — mvp_spec F14 매핑 누락 반영 |
| A-16 신규 | 업로드/파싱 실패 분리 관리 — mvp_spec F15 매핑 누락 반영 |
| D-04 수정 | 모델 참조 오류: `source_version_id` → `document_version_id` |
| E-04 수정 | 모델 참조 오류: `confidence_score` (스키마에 없음) → `issue_type: low_confidence` |
| H-08 신규 | 기획서 리뷰 결과 저장 — mvp_spec F19 매핑 누락 반영 |
| K 그룹 신규 | CSV 게임데이터, validation_runs/findings, design_review_runs/findings BACKLOG 등록 |
| NR-04 수정 | 참조 기능을 A-15/A-16으로 교정 |
| 집계 수정 | 원래 37/19=56 표기 오류 → 실제 수 반영 |

---

## 범례

- **MVP Phase**: 포함 Phase (1/2/3) 또는 BACKLOG
- **MVP 포함**: ✅ 포함 / ❌ 제외(Backlog) / ⏳ 이후 버전(Backlog)
- **관련 화면**: screen_flow.md의 라우트
- **관련 모델**: data_model.md의 Prisma 모델

---

## 기능 목록 전체

### 그룹 A — 문서 등록 및 업로드

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 / Backlog 이동 여부 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| A-01 | AI Pre-Review Import (JSON 붙여넣기) | ✅ | 1 | — | `/import` | DocumentVersion, NormalizedDocument |
| A-02 | JSON Schema 검증 | ✅ | 1 | — | `/import` | (server validation) |
| A-03 | Import Preview (등록 전 미리보기) | ✅ | 1 | — | `/import/preview` | (preview only) |
| A-04 | Raw Upload Mode (원본 파일 그대로 업로드) | ✅ | 2 | — | `/upload` | RawSource |
| A-05 | 지원 파일 형식: PDF | ✅ | 2 | — | `/upload` | RawSource |
| A-06 | 지원 파일 형식: DOCX | ✅ | 2 | — | `/upload` | RawSource |
| A-07 | 지원 파일 형식: XLSX / CSV | ✅ | 2 | — | `/upload` | RawSource |
| A-08 | 지원 파일 형식: TXT / MD | ✅ | 2 | — | `/upload` | RawSource |
| A-09 | 지원 파일 형식: PPTX | ✅ | 2 | 부분 지원 (슬라이드 텍스트만 추출). mvp_spec F11 기준 | `/upload` | RawSource, ExtractedText |
| A-10 | 지원 파일 형식: HWP / HWPX | ❌ | BACKLOG | 파서 복잡도 높음, 오픈소스 지원 미흡 | — | — |
| A-11 | 지원 파일 형식: 이미지 (PNG/JPG) | ❌ | BACKLOG | OCR 파이프라인 별도 필요 | — | — |
| A-12 | URL에서 직접 가져오기 | ❌ | BACKLOG | 외부 의존성, MVP 범위 초과 | — | — |
| A-13 | 중복 파일 감지 (SHA-256 해시) | ✅ | 2 | — | `/upload` | RawSource.file_hash |
| A-14 | 원본 파일 영구 보존 | ✅ | 2 | — | 내부 (storage/) | RawSource.storage_path |
| A-15 | 처리 상태 표시 (Processing Status) | ✅ | 2 | v1.0 Matrix 누락. mvp_spec F14 | `/upload` | RawSource.upload_status, RawSource.parse_status |
| A-16 | 업로드/파싱 실패 분리 관리 | ✅ | 2 | v1.0 Matrix 누락. mvp_spec F15 | `/upload` | RawSource.upload_status / .parse_status (별도 필드) |

---

### 그룹 B — 버전 관리

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 / Backlog 이동 여부 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| B-01 | 버전 판단: version_date 우선 | ✅ | 1 | — | 내부 로직 | DocumentVersion.version_date |
| B-02 | 버전 판단: version_label 파싱 (v1.2 형식) | ✅ | 1 | — | 내부 로직 | DocumentVersion.version_label |
| B-03 | 버전 충돌 → Review Queue 이동 | ✅ | 1 | — | `/review` | ReviewQueueItem |
| B-04 | Approved/Released 문서 교체 시 사용자 승인 | ✅ | 1 | Non-Negotiable #10 | `/review` | ReviewQueueItem (version_conflict) |
| B-05 | 유사도 기반 버전 감지 (임베딩) | ❌ | BACKLOG | LLM 의존, 임베딩 인프라 필요. MVP 이후 | — | — |
| B-06 | 업로드 순서로 최신 판단 금지 | ✅ | 1 | Non-Negotiable #9 — 로직으로 보장 | 내부 로직 | DocumentVersion.is_latest |
| B-07 | 문서 Soft Delete (status=deprecated) | ✅ | 1 | Non-Negotiable — 하드 삭제 금지 | `/docs/[id]` | DocumentVersion.status |
| B-08 | 문서군 및 버전 이력 전체 조회 | ✅ | 1 | — | `/docs/[id]`, `/docs/[id]/versions` | DocumentVersion |

---

### 그룹 C — 검색

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 / Backlog 이동 여부 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| C-01 | 메인 검색 화면 (키워드 전문 검색, 한국어 포함) | ✅ | 1 | — | `/` (메인) | pg_bigm 인덱스 |
| C-02 | 문서 유형별 필터 | ✅ | 1 | — | `/` | Document.doc_type |
| C-03 | 태그 필터 | ✅ | 1 | — | `/` | DocumentTag |
| C-04 | 날짜 범위 필터 | ✅ | 1 | — | `/` | DocumentVersion.version_date |
| C-05 | 검색 응답 500ms 이내 (100건 기준) | ✅ | 1 | 성공 기준 지표 | — | pg_bigm 인덱스 |
| C-06 | 자연어 시맨틱 검색 (RAG) | ❌ | BACKLOG | 벡터 DB + LLM 인프라 필요 | — | — |
| C-07 | 고급 벡터 검색 (pg_vector) | ❌ | BACKLOG | pg_bigm + FTS로 MVP 충분 | — | — |
| C-08 | 문서 유형 자동 분류 (11종) | ✅ | 1 | AI Import: JSON 필드로 수신. Raw Upload: 수동 선택 | `/import`, `/upload` | Document.doc_type |

---

### 그룹 D — 변경사항 추적

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 / Backlog 이동 여부 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| D-01 | 변경사항 후보 자동 추출 (Import 시 JSON 파싱 → pending으로 저장) | ✅ | 1 | — | `/import/preview` → `/docs/[id]` (변경사항 탭) | ChangeCandidate |
| D-02 | 변경사항 상태 관리 (Import 승인 시 pending→approved 일괄 전환, 개별 수정 가능) | ✅ | 1 | [B1] Import Preview "승인" 클릭 = ChangeCandidate 전체 approved 자동 저장 | `/import/preview`, `/docs/[id]` | ChangeCandidate.review_status |
| D-03 | 변경사항 → 패치노트 후보 연결 | ✅ | **1 (Week 1)** | **Patch-First 재배치:** /patch-notes/new 진입 시 approved ChangeCandidate → PatchNoteCandidate auto-create | `/patch-notes/new` | PatchNoteCandidate |
| D-04 | 변경사항 원천 문서 추적 | ✅ | 1 | Non-Negotiable #7 | `/docs/[id]` | ChangeCandidate.document_version_id |
| D-05 | 변경 이력 타임라인 뷰 (시각화) | ⏳ | BACKLOG | MVP는 탭형 목록으로 충분. 시각화는 v2 | — | — |

---

### 그룹 E — Review Queue

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 / Backlog 이동 여부 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| E-01 | Review Queue 목록 | ✅ | 1 | — | `/review` | ReviewQueueItem |
| E-02 | 충돌 항목 승인 (새 버전 → is_latest) | ✅ | 1 | — | `/review` | ReviewQueueItem, DocumentVersion |
| E-03 | 충돌 항목 거부 (새 버전 → deprecated) | ✅ | 1 | — | `/review` | ReviewQueueItem |
| E-04 | 신뢰도 낮은 항목 플래그 | ✅ | 1 | — | `/review` | ReviewQueueItem.issue_type (low_confidence) |
| E-05 | 복잡한 권한/승인 워크플로우 | ❌ | BACKLOG | 단일 사용자 MVP 불필요 | — | — |

---

### 그룹 F — 패치노트 생성

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 / Backlog 이동 여부 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| F-01 | 패치노트 후보 선택 UI | ✅ | **1 (Week 1)** | **Patch-First 재배치:** approved ChangeCandidate → PatchNoteCandidate auto-create | `/patch-notes/new` | PatchNoteCandidate |
| F-02 | 카테고리 분류 (버그픽스/밸런스/이벤트 등) | ✅ | **1 (Week 1)** | **Patch-First 재배치** | `/patch-notes/new` | PatchNoteCategory enum |
| F-03 | 패치노트 초안 자동 생성 (규칙 기반 마크다운) | ✅ | **1 (Week 1)** | **Patch-First 재배치** — AI 없이 Markdown 출력 | `/patch-notes/new` | PatchNote |
| F-04 | AI 패치노트 초안 생성 (선택적 호출) | ✅ | 3 (Week 4) | AI 고도화 분리 — Budget guard 통과 시만 호출 | `/patch-notes/new` | AIUsageLog |
| F-05 | 패치노트 편집 (마크다운 에디터) | ✅ | **1 (Week 1)** | **Patch-First 재배치** | `/patch-notes/[id]` | PatchNote |
| F-06 | 패치노트 자동 발행 | ❌ | BACKLOG | 사람의 최종 검수 원칙과 충돌 | — | — |
| F-07 | Slack 공유 | ❌ | BACKLOG | 외부 연동 후순위 | — | — |
| F-08 | 패치노트 버전 이력 저장 (PatchNote.status: draft/review/released) | ✅ | **1 (Week 1)** | **Patch-First 재배치** | `/patch-notes/[id]` | PatchNote.status |

---

### 그룹 G — AI 비용 관리

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 / Backlog 이동 여부 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| G-01 | API 비용 방지 설정 — 월 예산 설정 (USD) | ✅ | 1 | Non-Negotiable #11/12 | `/settings` | AIBudgetConfig |
| G-02 | 예산 0 설정 시 AI API 완전 차단 | ✅ | 1 | Non-Negotiable #12 | 서버 미들웨어 | AIBudgetConfig.monthly_budget_usd |
| G-03 | 현재 월 AI 사용량 표시 | ✅ | 1 | — | `/settings` | AIBudgetConfig.current_month_spend |
| G-04 | 예산 80% 도달 시 경고 | ✅ | 1 | — | `/settings` (UI 배너) | AIBudgetConfig.alert_threshold_pct |
| G-05 | AI 사용량 로그 (모델/토큰/비용/캐시) | ✅ | 1 | — | `/settings` | AIUsageLog |
| G-06 | 유료 API 기본 자동 호출 금지 | ✅ | 1 | Non-Negotiable #11 — 명시적 버튼 클릭 시만 | 서버 로직 | AIBudgetConfig |
| G-07 | 다중 AI 공급자 지원 (Anthropic 등) | ⏳ | BACKLOG | MVP는 OpenAI만. AIProvider enum으로 추상화는 유지 | — | AIProvider enum |

---

### 그룹 H — 문서 관리 (CRUD + 리뷰)

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 / Backlog 이동 여부 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| H-01 | 문서 목록 조회 | ✅ | 1 | — | `/docs` | Document, DocumentVersion |
| H-02 | 문서 상세 조회 | ✅ | 1 | — | `/docs/[id]` | DocumentVersion, NormalizedDocument |
| H-03 | 메타데이터 수동 편집 | ✅ | 1 | — | `/docs/[id]` | NormalizedDocument |
| H-04 | 문서 태그 관리 | ✅ | 1 | — | `/docs/[id]` | DocumentTag |
| H-05 | 문서 유형 수동 지정 (11종) | ✅ | 1 | — | `/import`, `/upload` | Document.doc_type |
| H-06 | 문서 Deprecated 처리 (Soft Delete) | ✅ | 1 | — | `/docs/[id]` | DocumentVersion.status |
| H-07 | 문서 하드 삭제 | ❌ | BACKLOG | Non-Negotiable — Soft delete만 허용. Hard delete 금지 | — | — |
| H-08 | 기획서 리뷰 결과 저장 | ✅ | 3 | v1.0 Matrix 누락. mvp_spec F19 | `/docs/[id]` (리뷰 탭) | NormalizedDocument.review_findings (JSON) |

---

### 그룹 I — 외부 연동 (모두 BACKLOG)

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| I-01 | Google Drive 실시간 동기화 | ❌ | BACKLOG | API 연동 복잡도 높음 | — | — |
| I-02 | Notion 자동 연동 | ❌ | BACKLOG | 외부 API 의존성 | — | — |
| I-03 | Confluence 자동 연동 | ❌ | BACKLOG | 외부 API 의존성 | — | — |
| I-04 | 다국어 자동 번역 | ❌ | BACKLOG | 별도 파이프라인 필요 | — | — |

---

### 그룹 J — 에이전트 기능 (모두 BACKLOG)

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| J-01 | 완전한 RAG 챗봇 | ❌ | BACKLOG | 벡터 DB + LLM 인프라 필요 | — | — |
| J-02 | 패치노트·게임데이터 불일치 검수 Agent | ❌ | BACKLOG 1.5차 | 1.5차로 분리. 별도 설계 문서 참조 | — | validation_runs, validation_findings (K-02) |
| J-03 | 기획서 리뷰 자동화 Agent (별도 UI) | ❌ | BACKLOG 2차 | review_findings JSON 필드로 통합 후 고도화 | — | design_review_runs, design_review_findings (K-03) |
| J-04 | 완전 자동 게임데이터 불일치 검수 | ❌ | BACKLOG 1.5차 | CSV 기반 단순 검수도 1.5차 | — | — |

---

### 그룹 K — 게임데이터 검수/리뷰 인프라 (모두 BACKLOG, 신규 추가)

> v1.0 Matrix에서 누락. validation_runs/findings, design_review_runs/findings는 data_model.md 섹션 8 참조.

| # | 기능명 | MVP 포함 | Phase | 제외 시 사유 | 관련 화면 | 관련 모델 |
|---|---|---|---|---|---|---|
| K-01 | CSV 게임데이터 업로드 (불일치 검수용) | ❌ | BACKLOG 1.5차 | 검수 Agent(J-02) 전제 필요. 일반 CSV 업로드(A-07)와 별개 기능 | — | RawSource (file_type=csv), 검수 전용 파이프라인 |
| K-02 | validation_runs / validation_findings | ❌ | BACKLOG 1.5차 | 불일치 검수 Agent(J-02) 실행 이력 및 결과 저장용 스키마. MVP에선 불필요 | — | ValidationRun, ValidationFinding (Backlog 스키마) |
| K-03 | design_review_runs / design_review_findings | ❌ | BACKLOG 2차 | 기획서 리뷰 자동화 Agent(J-03) 실행 이력 및 결과 저장용. MVP는 review_findings JSON 필드로 대체 | — | DesignReviewRun, DesignReviewFinding (Backlog 스키마) |

---

## 요약 집계

> ※ v1.0의 37/19=56 집계는 오류였음. v1.2에서 Patch-First 적용 후 Phase별 재계산.

| 구분 | 건수 |
|---|---|
| MVP 포함 (✅) | 53 |
| BACKLOG (❌/⏳) | 23 |
| **전체** | **76** |

| Phase | 기능 수 | 비고 |
|---|---|---|
| Phase 1 (Week 1+2) | 41 | Patch-First로 F-01/02/03/05/08 + D-03 (6건)이 Phase 3 → Phase 1로 이동 |
| Phase 2 (Week 3) | 10 | Raw Upload 그대로 |
| Phase 3 (Week 4) | 2 | F-04 (AI 초안), H-08 (기획서 리뷰 결과) — 나머지는 Week 1으로 흡수 |
| BACKLOG | 23 | 변동 없음 |

---

## Non-Negotiable Requirements × 기능 매핑

| NR# | 요구사항 | 보장 기능 |
|---|---|---|
| NR-01 | Raw Upload + AI Import 둘 다 지원 | A-01, A-04 |
| NR-02 | 직접 정제 없이 등록 가능 | A-01 (JSON 붙여넣기), A-04 (원본 파일) |
| NR-03 | 원본 파일 보존 | A-14 |
| NR-04 | 업로드 실패 / 파싱 실패 분리 | **A-15, A-16** (upload_status / parse_status 별도 필드) |
| NR-05 | GPT 정제본 JSON Import 1차 핵심 | A-01, A-02, A-03 |
| NR-06 | 검색이 메인 진입점 | C-01 (/ 라우트) |
| NR-07 | 변경사항 후보 = 패치노트 원천 | D-01~D-03, F-01~F-04 |
| NR-08 | 패치노트 생성 1차 MVP 포함 | **F-01~F-03, F-05, F-08 (Phase 1 Week 1 — Patch-First 규칙 기반)**, F-04 (Phase 3 Week 4 — AI 고도화) |
| NR-09 | 업로드 순서로 최신 판단 금지 | B-01, B-02, B-06 |
| NR-10 | Approved/Released 교체 시 사용자 승인 | B-04, E-02, E-03 |
| NR-11 | 유료 AI API 기본 자동 호출 금지 | G-06 |
| NR-12 | 예산 0 = 완전 차단 | G-02 |
| NR-13 | 제외 기능 Backlog 이동 명시 | 본 문서 (그룹 A~K 전체) |
