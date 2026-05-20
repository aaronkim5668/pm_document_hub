# Implementation Plan

**버전:** 1.0  
**작성일:** 2026-05-19  
**상태:** DRAFT

---

## 1. 기술 스택 확정

| 레이어 | 선택 | 비고 |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | |
| UI | Tailwind CSS + shadcn/ui | 빠른 프로토타이핑 |
| Backend | Next.js API Routes (서버리스) | 별도 서버 불필요 |
| ORM | Prisma | PostgreSQL 타입 안전 |
| DB | PostgreSQL 15+ | Week 1은 공식 postgres 이미지 사용. Week 2 검색에서 pg_bigm 또는 ILIKE fallback 검토 |
| 파일 저장 | 로컬 파일시스템 (MVP) → Supabase Storage (v2) | |
| 텍스트 추출 | pdf-parse (PDF), mammoth (DOCX), xlsx (XLSX/CSV), officeparser (PPTX) | PPTX는 officeparser 사용 (unzipper+xml2js 대비 한국어 인코딩 안정적) |
| JSON 검증 | Zod | Ajv 대신 Zod — TypeScript 타입 추론 내장, 필드별 에러 메시지 지원 |
| AI 연동 | OpenAI SDK (선택적 호출) | budget guard 필수 |
| 배포 | 오피스 LAN (PM 머신에서 실행, 팀 공유) | HOST=0.0.0.0, PORT=8787, APP_URL=http://172.31.201.23:8787. 인터넷 노출 없음. |

### 환경 설정 결정사항

**파일 저장: 로컬 우선**
- MVP 기간 동안 `./storage/` 디렉토리에 원본 파일 보관
- Supabase Storage는 v2로 이동 (외부 의존성 최소화)
- 환경 변수 `STORAGE_TYPE=local|supabase`로 전환 가능하게 추상화

**검색 설정**
- Week 1 Vertical Slice는 검색 고도화가 범위 밖이므로 공식 `postgres:15` 이미지로 우선 진행
- Week 2 검색 구현 시 `SEARCH_MODE=ilike` fallback을 기본 동작 기준으로 검토
- pg_bigm은 설치 가능한 환경에서 선택적으로 활성화하며, 미설치 시 `ILIKE '%keyword%'` fallback으로 동작

**AI API**
- `.env`의 `OPENAI_API_KEY` 없으면 AI 기능 자동 비활성화
- `monthly_budget_usd = 0`이면 서버 레벨에서 완전 차단

---

## 2. 환경 초기 설정 체크리스트

```
[ ] PostgreSQL 설치 (Docker 권장: docker-compose up -d)
[ ] Week 2 검색 구현 시 pg_bigm 활성화 여부 확인. 미설치 환경은 `SEARCH_MODE=ilike` fallback 사용
[ ] Node.js 20+ 설치
[ ] pnpm 설치 (또는 npm)
[ ] .env 파일 설정 (DATABASE_URL, OPENAI_API_KEY, STORAGE_PATH, APP_URL)
[ ] npx prisma migrate dev
[ ] npx prisma db seed (초기 AIBudgetConfig 레코드)
[ ] mkdir -p ./storage/raw ./storage/temp
[ ] pnpm dev --hostname 0.0.0.0 --port 8787 → http://172.31.201.23:8787 팀 접속 확인
[ ] [NET1] Windows Firewall 인바운드 규칙: 포트 8787 TCP 허용 (Windows Defender 방화벽 → 인바운드 규칙 → 새 규칙 → 포트 → TCP 8787 → 허용) — 팀원 LAN 접속을 위해 필수
[ ] [B3] Next.js body size 설정: `next.config.js`에 `experimental: { serverActions: { bodySizeLimit: '20mb' } }` 추가 (20MB 파일 업로드 지원)
```

> **네트워크 설정 (LAN 팀 공유 모드):**
> - **HOST=0.0.0.0** — 오피스 내부망 전체에서 접근 허용 (팀원 공유용)
> - **PORT=8787** — 포트 3000(오피스 방화벽 차단), 8080(다른 로컬 툴 점유) 사용 금지
> - **APP_URL=http://172.31.201.23:8787** (PM 머신 내부 IP — 팀원 접속 URL)
> - **확정 dev 명령:** `next dev --hostname 0.0.0.0 --port 8787`
> - **접속 URL:** http://172.31.201.23:8787
>
> **보안 전제 조건:**
> - 이 툴은 오피스 내부망(사무실 LAN)에서만 접근 가능. 공용 인터넷 노출 없음.
> - v1은 인증 없이 운영 (팀 내 신뢰 기반). 팀 외부 공유 또는 외부망 배포 시 인증 필수.
> - 인증 기능 (로그인, 권한 관리)은 v1.5 Backlog 항목으로 등록.
> - 이 서버를 직접 인터넷에 노출(포트포워딩, 클라우드 배포 등)하면 기획 문서 전체 유출 위험.

**환경변수 명세 (M5 — 한 곳 정리):**

| 변수 | 용도 | 기본값 | 비고 |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://postgres:localdev@localhost:5432/pm_document_hub` | Docker Compose 기본값 |
| `OPENAI_API_KEY` | OpenAI API 키 (선택) | 미설정 | 없으면 AI 기능 자동 비활성화 |
| `STORAGE_PATH` | 로컬 파일 저장 루트 | `./storage` | year/month/document_version_id 구조로 자동 분할 |
| `STORAGE_TYPE` | 파일 저장 백엔드 | `local` | `local` \| `supabase` (v2) |
| `APP_URL` | 앱 접속 URL | `http://172.31.201.23:8787` | PM 머신 내부 IP |
| `HOST` | dev 서버 바인딩 | `0.0.0.0` | LAN 공유 모드 (R-S1) |
| `PORT` | dev 서버 포트 | `8787` | 3000(방화벽)/8080(점유) 회피 |
| `SEARCH_MODE` | 검색 백엔드 | `ilike` | Week 2 검색 구현 시 `bigm` \| `ilike` 검토. pg_bigm 미설치 시 ILIKE fallback |

---

**Docker Compose (Week 1 기본 PostgreSQL):**
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: pm_document_hub
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: localdev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

---

## 3. 전체 일정 개요

> **Patch-First 전략 (D1 결정):** Week 1에 Import → ChangeCandidate → PatchNote 핵심 파이프라인을 완성해 7일 안에 핵심 가치를 검증한다. 검색·Review Queue 등 지원 기능은 Week 2로 이동.

| Phase | 기간 | 목표 |
|---|---|---|
| Phase 1 | Week 1 | AI Import + 변경사항 후보 + **패치노트 초안 E2E** (핵심 가치 검증) |
| Phase 1 | Week 2 | 검색 + Review Queue + CRUD + Budget Guard |
| Phase 2 | Week 3 | Raw Upload Inbox + 텍스트 추출 + 처리 상태 |
| Phase 3 | Week 4 | Raw Upload → PatchNote 연결 + AI 초안 + 리뷰 결과 + E2E 검증 |

---

## 4. Phase 1 — Week 1 (핵심 파이프라인: Import → 변경사항 → 패치노트)

**목표:** JSON Import 1건으로 패치노트 초안까지 생성되는 E2E 파이프라인

### Week 1 태스크

| # | 태스크 | 산출물 | 예상 시간 |
|---|---|---|---|
| 1-1 | 프로젝트 초기화 + DB 마이그레이션 + seed | Next.js + Prisma + Tailwind 설정, `prisma migrate dev`, `prisma/seed.ts` (AIBudgetConfig 초기 레코드 — budget=0, all AI locked). 검색 인덱스/pg_bigm은 Week 2로 분리 | 6h |
| 1-2 | AI Import UI (`/import`) + Zod Schema 검증 + 테스트 | JSON 붙여넣기/파일업로드 UI, `zod` 스키마 정의 (`lib/json-schema.ts`), 필드별 에러 표시, **[I3] `__tests__/json-schema.test.ts`** | 6h |
| 1-3 | Import Preview (`/import/preview`) + 저장 API + 테스트 | 파싱 결과 표시·편집, 재검증, `POST /api/documents` (DocumentVersion + ChangeCandidate 저장, **[B1] 승인 시 ChangeCandidate 전체 review_status=approved 일괄 설정**), **[I3] `__tests__/change-candidate-approval.test.ts`** | 8h |
| 1-4 | 버전 판단 로직 (`resolveLatestVersion`) + 테스트 | version_date 기준 is_latest 판단, prisma.$transaction 래핑, **[I3] `__tests__/version-resolver.test.ts`** | 3h |
| 1-5 | 패치노트 후보 선택 UI (`/patch-notes/new`) | **[I1] /patch-notes/new 진입 시 approved ChangeCandidate → PatchNoteCandidate 1:1 auto-create (서버 upsert)**, 체크박스(is_selected 토글), 카테고리 분류, draft_text 인라인 편집 | 4h |
| 1-6 | 패치노트 초안 생성 + 상세/편집 + 테스트 | 카테고리 정렬 → 마크다운 초안, `/patch-notes/[id]` 에디터, PatchNote/PatchNoteItem DB 저장 (**is_selected=true 인 PatchNoteCandidate만 변환, API에서 ChangeCandidate.review_status='approved' 재검증**), **[I3] `__tests__/patch-note-generator.test.ts`** | 5h |

**Week 1 총 시간:** 6 + 6 + 8 + 3 + 4 + 5 = **32h** (5일 × 8h = 40h 대비 80% — 8h 버퍼)

**Week 1 완료 기준 (핵심 가치 검증):**
- JSON Import로 기획서 1건 등록 → ChangeCandidate 자동 approved 전환 → PatchNoteCandidate auto-create → 패치노트 초안 1건 생성 E2E 동작
- 카테고리 정렬 정상 동작
- AI 없이 Markdown 초안 생성 확인
- 단위 테스트 5종(json-schema, change-candidate-approval, version-resolver, patch-note-generator) 작성 및 통과

---

## 5. Phase 1 — Week 2 (검색 + Review Queue + 지원 기능)

**목표:** 검색·조회·Review Queue·예산 관리 완성

### Week 2 태스크

| # | 태스크 | 산출물 | 예상 시간 |
|---|---|---|---|
| 2-1 | 메인 페이지 검색 UI (`/`) | 검색창, 필터, 결과 카드 | 4h |
| 2-2 | 검색 API (`GET /api/documents/search`) | `SEARCH_MODE=ilike` fallback 우선 구현, latest DocumentVersion 중심, deprecated 제외, LIMIT 50. pg_bigm은 설치된 환경에서만 선택 최적화로 검토하며 미설치 시 앱이 깨지지 않아야 함. **[I5] 코퍼스 100건 기준 응답 500ms 이내** (100건은 결과 수가 아닌 테스트 코퍼스 크기) | 4h |
| 2-3 | 문서 상세 페이지 (`/docs/[id]`) | 버전 목록, 메타데이터, 변경사항 탭 | 3h |
| 2-4 | Review Queue UI (`/review`) | pending/deferred 필터, 승인/거부/보류 버튼 | 3h |
| 2-5 | Review Queue API | 승인 → is_latest 교체, 거부 → deprecated | 2h |
| 2-6 | 변경사항 후보 수동 추가 | 문서 상세에서 ChangeCandidate 직접 추가 | 2h |
| 2-7 | AI 비용 설정 UI (`/settings`) + Budget Guard 미들웨어 + 테스트 | 월 예산, 사용량, budget 0 → AI 차단, 월 롤오버, **[I2] is_locked 자동 트리거** (100% 초과 시 true, 예산 증액/롤오버 시 false 자동 해제 — 수동 잠금 해제 버튼 없음). `lib/db.ts` Prisma singleton + HMR guard (`if (process.env.NODE_ENV !== 'production') global.prisma = prisma`), **[I3] `__tests__/budget-guard.test.ts` + `__tests__/decimal-comparison.test.ts`** | 5h |

**Week 2 완료 기준 (Phase 1 완료):**
- 기획서 등록 → 검색 → 변경사항 확인 플로우 동작
- Review Queue 승인/거부/보류 + deferred 필터 동작
- 유료 API 월 예산 0 설정 시 완전 차단 확인

---

## 6. Phase 2 — Week 3 (Raw Upload Inbox)

**목표:** 원본 파일 그대로 업로드하고 처리 상태를 확인할 수 있는 상태

### Week 3 태스크

| # | 태스크 | 산출물 | 예상 시간 |
|---|---|---|---|
| 3-1 | Raw Upload UI (`/upload`) | 파일 드래그앤드롭, 메타데이터 입력 | 3h |
| 3-2 | 파일 저장 API (`POST /api/upload`) | `./storage/raw/` 저장, SHA-256 해시 | 2h |
| 3-3 | 중복 파일 감지 | file_hash 기반, 경고 표시 | 1h |
| 3-4 | 텍스트 추출 파이프라인 | pdf-parse, mammoth, xlsx, officeparser(PPTX) 연동. **[UP1]** `Promise.race([extractText(file), rejectAfter(30000)])` 타임아웃 처리, 실패 시 parse_status=failed | 5h |
| 3-5 | 업로드/파싱 상태 분리 | upload_status / parse_status 독립 관리 | 2h |
| 3-6 | Inbox 목록 UI (`/upload` 하단) | 처리 상태 배지 (pending/processing/done/failed), 3초 polling | 2h |
| 3-7 | 파싱 완료 후 DocumentVersion 연결 | ExtractedText → NormalizedDocument 연결 | 2h |

**Week 3 완료 기준 (Phase 2 완료):**
- PDF 1건 업로드 → 텍스트 추출 → 처리 상태 확인
- upload_status=success, parse_status=failed 구분 표시 가능
- 중복 파일 업로드 시 경고

---

## 7. Phase 3 — Week 4 (완성 + AI + E2E 검증)

**목표:** Raw Upload → PatchNote 연결, AI 초안 생성, 리뷰 결과 저장, E2E 검증

### Week 4 태스크

| # | 태스크 | 산출물 | 예상 시간 |
|---|---|---|---|
| 4-1 | Raw Upload → ChangeCandidate 연결 | 추출 텍스트 기반 변경사항 후보 생성 플로우 | 3h |
| 4-2 | AI 초안 생성 (선택적) | Budget guard 통과 시만 호출, 문구 개선 | 2h |
| 4-3 | 기획서 리뷰 결과 저장 (F19) | review_findings JSON 필드 업데이트, 상세 탭 표시 | 2h |
| 4-4 | E2E 스모크 테스트 실행 | Section 10 체크리스트 전체 수동 검증 | 2h |
| 4-5 | 버퍼 / 폴리시 | UI 정리, 에러 메시지 개선, 누락 엣지 케이스 처리 | 3h |

**Week 4 완료 기준 (MVP 완료):**
- Raw Upload → 텍스트 추출 → ChangeCandidate → PatchNote E2E 동작
- AI 초안 생성 (budget 허용 시)
- Section 10 스모크 테스트 체크리스트 전항목 통과

---

## 8. API 라우트 목록

| Method | Path | 기능 | Phase |
|---|---|---|---|
| POST | `/api/documents` | 문서 등록 (AI Import) | 1 |
| GET | `/api/documents/search` | 전문 검색 | 1 |
| GET | `/api/documents/[id]` | 문서 상세 | 1 |
| PUT | `/api/documents/[id]` | 메타데이터 수정 | 1 |
| GET | `/api/review` | Review Queue 목록 | 1 |
| POST | `/api/review/[id]/approve` | 승인 처리 | 1 |
| POST | `/api/review/[id]/reject` | 거부 처리 | 1 |
| GET | `/api/changes` | 변경사항 후보 목록 | 1 |
| GET | `/api/settings/budget` | 예산 현황 조회 | 1 |
| PUT | `/api/settings/budget` | 예산 설정 | 1 |
| POST | `/api/upload` | Raw 파일 업로드 | 2 |
| GET | `/api/upload/[id]/status` | 처리 상태 조회 | 2 |
| POST | `/api/patch-notes` | 패치노트 생성 | 1 (Week 1) |
| GET | `/api/patch-notes/[id]` | 패치노트 상세 | 3 |
| PUT | `/api/patch-notes/[id]` | 패치노트 편집 | 3 |

---

## 9. 디렉토리 구조

```
pm_document_hub/
├── app/                        # Next.js App Router
│   ├── page.tsx                # 메인 (검색)
│   ├── docs/
│   │   └── [id]/page.tsx       # 문서 상세
│   ├── import/
│   │   ├── page.tsx            # AI Import
│   │   └── preview/page.tsx    # Import Preview
│   ├── upload/page.tsx         # Raw Upload Inbox
│   ├── review/page.tsx         # Review Queue
│   ├── patch-notes/
│   │   ├── new/page.tsx        # 패치노트 생성
│   │   └── [id]/page.tsx       # 패치노트 상세
│   ├── settings/page.tsx       # 설정
│   └── api/                    # API Routes (App Router 규칙 — app/api/**/route.ts)
├── lib/
│   ├── db.ts                   # Prisma client singleton
│   ├── version-resolver.ts     # resolveLatestVersion
│   ├── budget-guard.ts         # AI API 비용 차단
│   ├── extractors/             # pdf-parse, mammoth, xlsx
│   └── json-schema.ts          # Import JSON Schema 검증
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── storage/
│   ├── raw/{YYYY}/{MM}/{document_version_id}/{original_filename}  # [M2] 업로드된 원본 파일 (불변, year/month/id 중첩)
│   └── temp/                   # 추출 임시 파일
├── __tests__/                  # vitest 단위 테스트
│   ├── json-schema.test.ts
│   ├── change-candidate-approval.test.ts
│   ├── version-resolver.test.ts
│   ├── patch-note-generator.test.ts
│   ├── budget-guard.test.ts
│   └── decimal-comparison.test.ts
├── docs/                       # 기획 문서
└── .env
```

---

## 10. 단위 테스트 (vitest)

> **Eng Review + Adversarial Review 결정:** 6개 핵심 경로에 자동화 테스트 필수. vitest는 Next.js 14 App Router와 zero-config 호환.

```
__tests__/
├── budget-guard.test.ts            (Task 2-7, [I3])
│   ├── monthly_budget_usd = 0 → throws
│   ├── current_spend + estimated > budget → throws + is_locked=true 자동 전환
│   ├── budget_month stale → rollover → is_locked=false 해제 + allows
│   ├── 예산 증액 시 is_locked=false 자동 해제 (수동 잠금 해제 버튼 없음)
│   ├── no config row → upsert safe default (budget=0)
│   └── within budget → resolves
├── decimal-comparison.test.ts      (Task 2-7, [I3] B2 회귀 방지)
│   ├── new Decimal(0) === 0 → false 확인 (직접 비교 함정)
│   ├── new Decimal(0).toNumber() === 0 → true 확인
│   ├── Prisma.Decimal.equals(new Decimal(0), 0) → true
│   └── 0.000001 단위 비교 정확도
├── version-resolver.test.ts        (Task 1-4, [I3])
│   ├── version_date present → latest by date
│   ├── version_date tie → latest by uploaded_at (documented behavior)
│   ├── version_date absent → ReviewQueueItem(no_version)
│   ├── new > current Approved → ReviewQueueItem(version_conflict)
│   └── transaction rollback simulation (M4)
├── json-schema.test.ts             (Task 1-2, [I3])
│   ├── valid minimal import → passes
│   ├── missing title → ZodError at "title"
│   ├── invalid doc_type → ZodError with enum list
│   ├── change_candidates[0] missing change_type → ZodError
│   └── version_date bad format → ZodError
├── change-candidate-approval.test.ts  (Task 1-3, [I3] B1 회귀 방지)
│   ├── Import 승인 시 ChangeCandidate N건 모두 review_status=approved 전환
│   ├── 트랜잭션 롤백 시뮬레이션 (DocumentVersion 저장 실패 → ChangeCandidate도 미저장)
│   ├── 빈 change_candidates 배열도 정상 처리 (PatchNote 0건 가능)
│   └── 승인 후 다시 Import 시 별개 ChangeCandidate 생성 확인
└── patch-note-generator.test.ts    (Task 1-6, [I3])
    ├── approved 변경사항만 PatchNoteItem 생성
    ├── pending/rejected는 API 레벨에서 거부 (UI 필터 우회 시도 차단)
    ├── PatchNoteCandidate.is_selected=true만 변환
    ├── 카테고리별 정렬 순서 결정성 (Markdown 출력 안정성)
    └── Approved 0건 → 빈 상태 (생성 차단)
```

**구현 위치:** `__tests__/` 또는 `lib/__tests__/`. vitest 설정: `vitest.config.ts` + `@vitest/coverage-v8`.

---

## 11. MVP 스모크 테스트 체크리스트

Phase 완료 전 수동으로 확인해야 하는 최소 검증 목록.

### Phase 1 스모크 테스트 — Week 1 (Patch-First E2E)

```
[ ] JSON Import → 검증 통과 → 미리보기 표시 → 승인 → DB 저장 확인
[ ] [I4-B1] Import 승인 후 DB의 ChangeCandidate.review_status가 모두 'approved'로 저장됨 확인
[ ] [I4-B1] /patch-notes/new 진입 → approved 변경사항만 PatchNoteCandidate로 노출되는지 확인 (pending/rejected 미노출)
[ ] [I4] DB에서 ChangeCandidate를 수동으로 pending으로 변경 후 POST /api/patch-notes 호출 → 거부 응답 확인 (API 레벨 강제)
[ ] [I4] PatchNote/PatchNoteItem DB 저장 확인 + Markdown 초안 출력 확인 (카테고리별 정렬)
[ ] Approved ChangeCandidate 0건 상태에서 패치노트 생성 버튼 비활성화 확인
```

### Phase 1 스모크 테스트 — Week 2 (검색·Review·예산)

```
[ ] 동일 문서 두 번 import → Review Queue 버전충돌 항목 생성 확인
[ ] 월 예산 $0 설정 후 "고품질 분석" 버튼 클릭 → 차단 메시지 표시 확인 (AI API 호출 없음)
[ ] [I2] 월 예산을 사용량 미달로 강제 100% 설정 후 호출 → is_locked=true 자동 전환 + 호출 차단 확인
[ ] [I2] 예산 증액 또는 월 롤오버 후 is_locked=false 자동 해제 확인 (수동 해제 버튼 없음 확인)
[ ] [I5] 검색창에서 한글 키워드 입력 → 코퍼스 100건 기준 LIMIT 50 응답 < 500ms (F12 Network 탭 확인)
```

### Phase 2 스모크 테스트

```
[ ] PDF 파일 업로드 → upload_status=success, parse_status=success 확인
[ ] 20MB 초과 파일 → 업로드 거부 메시지 확인
[ ] 동일 파일 재업로드 → 중복 경고 표시 확인
[ ] parse_status=failed 항목에서 수동 텍스트 입력 폼 표시 확인
```

### Phase 3 (E2E) 스모크 테스트

```
[ ] JSON Import → ChangeCandidate 생성 → 승인 → 패치노트 생성 → 초안 표시
[ ] Approved ChangeCandidate 0건 상태에서 패치노트 생성 버튼 비활성화 확인
[ ] 패치노트 저장 → PatchNote DB 레코드 생성 확인
```

---

## 12. 마일스톤 요약

| 마일스톤 | 날짜 | 검증 방법 |
|---|---|---|
| M1: AI Import 동작 | Week 1 종료 | JSON Import → 등록 → 조회 |
| M2: 검색 + Review Queue | Week 2 종료 | 검색 500ms, 충돌 승인/거부 |
| M3: Raw Upload 동작 | Week 3 종료 | PDF 업로드 → 추출 → 상태 확인 |
| M4: MVP 완료 | Week 4 종료 | 패치노트 초안 생성 E2E |

> **검증 방법:** 각 Phase 완료 시 Section 10의 스모크 테스트 체크리스트 수동 실행.
