# AGENTS.md — pm_document_hub 구현 지침

이 파일은 Codex(또는 다른 구현 에이전트)가 이 프로젝트를 구현할 때 반드시 따라야 할 프로젝트 전용 구현 지침이다.

---

## 구현 시작 전 필수 확인

구현을 시작하기 전에 반드시 아래 파일을 읽어야 한다.

1. `CLAUDE.md` — 제품 목적, Non-Negotiable Requirements, MVP 범위, Backlog 구분
2. `AGENTS.md` (이 파일) — 구현 규칙 전체
3. `docs/mvp_spec.md` — 구현할 기능의 Acceptance Criteria
4. `docs/data_model.md` — Prisma 스키마, Enum 정의, 버전 판단 로직
5. `docs/feature_coverage_matrix.md` — 기능의 MVP 포함 여부 및 Phase 배치
6. `docs/screen_flow.md` — 화면 구조 및 UI 흐름
7. `docs/implementation_plan.md` — 주차별 태스크, API 라우트, 디렉토리 구조

**docs와 충돌하는 구현은 하지 않는다.** 충돌을 발견하면 구현 전에 보고한다.

---

## 구현 절차 규칙

### 계획 먼저, 구현 나중

모든 구현 태스크에서 코드를 작성하기 전에 아래를 먼저 제시한다.

1. **구현 계획:** 무엇을 어떻게 구현할지, 어떤 파일을 변경/생성할지
2. **파일 변경 계획:** 변경할 파일 목록과 각 파일의 변경 범위
3. **리스크:** 예상되는 엣지 케이스, 데이터 정합성 위험

계획 제시 후 승인을 받은 다음 구현한다. 단, 명백히 단순한 단일 파일 수정은 예외.

### 테스트 우선 개발

리스크가 있는 로직은 구현 전에 테스트를 먼저 작성한다.

필수 테스트 파일 (구현 전 작성):

| 테스트 파일 | 대상 로직 | 구현 태스크 |
|---|---|---|
| `__tests__/json-schema.test.ts` | Zod Schema 검증 | Task 1-2 |
| `__tests__/change-candidate-approval.test.ts` | Import 승인 → ChangeCandidate approved 일괄 전환 | Task 1-3 |
| `__tests__/version-resolver.test.ts` | is_latest 판단 로직, 트랜잭션 | Task 1-4 |
| `__tests__/patch-note-generator.test.ts` | 패치노트 생성, approved 강제 | Task 1-6 |
| `__tests__/budget-guard.test.ts` | AI 예산 차단 로직 | Task 2-7 |
| `__tests__/decimal-comparison.test.ts` | Prisma Decimal 타입 비교 (B2 회귀 방지) | Task 2-7 |

테스트 프레임워크: vitest (`vitest.config.ts` + `@vitest/coverage-v8`)

---

## Implementation Rules

### Rule 1 — Non-Negotiable Requirements 제거 금지

`CLAUDE.md`에 명시된 13개 Non-Negotiable Requirements를 제거하거나 약화시키지 않는다. 일정이나 복잡도를 이유로 우회하지 않는다.

### Rule 2 — MVP 범위 외 기능은 Backlog으로 명시

구현하지 않는 기능은 코드에서 삭제하지 않는다. `docs/feature_coverage_matrix.md`에 BACKLOG로 명시하고 사유를 기록한다. 기능 코드가 이미 있다면 제거하지 않고 `// Backlog: Phase X` 주석을 남긴다.

### Rule 3 — 리스크 로직은 테스트 먼저

버전 판단, ChangeCandidate 상태 전환, Budget Guard, 패치노트 생성 로직처럼 데이터 정합성에 영향을 주는 코드는 테스트를 먼저 작성한 뒤 구현한다.

### Rule 4 — 스키마/기능 변경 시 docs 동시 업데이트

- Prisma 스키마(모델, 필드, Enum) 변경 시 → `docs/data_model.md` 업데이트
- 기능 범위 변경 시 → `docs/feature_coverage_matrix.md` 업데이트
- 기능 Acceptance Criteria 변경 시 → `docs/mvp_spec.md` 해당 기능 섹션 업데이트
- docs 업데이트 없이 스키마나 기능을 변경하지 않는다.

### Rule 5 — 유료 AI API 자동 호출 금지

유료 AI API(OpenAI, Claude, Gemini 등)는 사용자가 명시적으로 버튼을 클릭했을 때만 호출한다. 파일 업로드, 문서 저장, 페이지 로드, 백그라운드 작업 등 어떤 자동 트리거로도 호출하지 않는다.

```typescript
// 금지: 자동 호출
async function onFileUpload(file: File) {
  await callOpenAI(file); // NR-11 위반
}

// 허용: 명시적 버튼 클릭 핸들러에서만
async function onAnalyzeButtonClick(file: File) {
  await checkBudgetAndCall(...);
}
```

### Rule 6 — 월 예산 0이면 유료 API 호출 완전 차단

`AIBudgetConfig.monthly_budget_usd`가 0이면 서버 레벨에서 모든 유료 API 호출을 차단한다. UI 단 조건만으로는 부족하며, `lib/budget-guard.ts`에서 서버 사이드로 강제한다.

```typescript
// Prisma Decimal 타입 주의 (B2): === 로 직접 비교 불가, .toNumber() 필수
if (config.monthly_budget_usd.toNumber() === 0) {
  throw new Error("AI API가 비활성화되어 있습니다.");
}
```

`monthly_budget_usd === 0` 체크는 반드시 `.toNumber()` 변환 후 수행한다. Prisma Decimal과 JavaScript number는 `===` 비교 시 항상 `false`를 반환한다.

### Rule 7 — 버전 충돌 시 자동 교체 금지

새 DocumentVersion의 `version_date`가 기존 `is_latest` 버전보다 최신이고, 기존 버전이 `approved` 또는 `released` 상태이면 자동으로 `is_latest`를 교체하지 않는다. 반드시 `ReviewQueueItem(issue_type: version_conflict)`를 생성하고 사용자 승인을 기다린다.

`is_latest` 업데이트는 반드시 `prisma.$transaction`으로 래핑한다. 트랜잭션 없이 updateMany + update를 분리 실행하면 크래시 시 모든 버전이 `is_latest=false`로 남을 위험이 있다.

### Rule 8 — 미승인 ChangeCandidate는 패치노트 포함 금지

`ChangeCandidate.review_status`가 `approved`인 경우만 `PatchNoteItem` 생성 대상이 된다. UI 필터만으로는 부족하며, `POST /api/patch-notes` 서버에서 각 `candidate_id`를 DB에서 재조회하여 `review_status='approved'`를 검증한다. `pending`, `rejected`, `deferred` 상태의 ChangeCandidate는 API 레벨에서 거부한다.

```typescript
// API 레벨 강제 예시
const candidate = await prisma.changeCandidate.findUnique({ where: { id: candidateId } });
if (candidate?.review_status !== 'approved') {
  throw new Error(`ChangeCandidate ${candidateId}는 approved 상태가 아닙니다.`);
}
```

### Rule 9 — 업로드 실패와 파싱 실패는 별도 상태로 관리

`RawSource`의 `upload_status`와 `parse_status`는 별도 필드로 독립적으로 관리한다. 업로드 실패 시 재업로드를, 파싱 실패 시 수동 텍스트 입력을 제공한다. 파싱이 실패해도 원본 파일(RawSource)은 보존된다.

| 상태 | 의미 | 대응 |
|---|---|---|
| `upload_status=failed` | 파일이 서버에 저장되지 못함 | 재업로드 버튼 |
| `upload_status=success, parse_status=failed` | 파일은 저장됐지만 텍스트 추출 실패 | 원본 보존 + 수동 입력 폼 |
| `upload_status=success, parse_status=partial` | 일부 추출 성공 | 경고 + 부분 결과 사용 |

### Rule 10 — 원본 파일 보존

업로드된 원본 파일(`RawSource`)은 절대 변경하지 않는다. 저장 경로는 `./storage/raw/{year}/{month}/{document_version_id}/{original_filename}` 구조로 고정한다. 파일은 읽기 전용으로 저장하며, 파일 다운로드 기능은 원본 그대로 제공한다.

---

## 추가 구현 주의사항

### 버전 판단 로직

```
is_latest 판단 우선순위:
1. version_date 있음 → 가장 늦은 날짜가 최신 (동일 날짜 시 uploaded_at으로 Tie-break)
2. version_label 있음 → 시맨틱 버전 또는 날짜 형식 파싱
3. 둘 다 없음 → ReviewQueueItem(no_version) 생성, 자동 판단 불가
```

업로드 순서(uploaded_at 단독)로 최신 여부를 판단하지 않는다. NR-09.

### Import 승인 플로우 (B1)

Import Preview에서 "승인 및 저장" 클릭 시:
1. Zod Schema 재검증 (인라인 편집 포함)
2. DocumentVersion + NormalizedDocument + DesignItem DB 저장
3. 해당 Import의 ChangeCandidate 전체를 `review_status=approved`로 **일괄** 저장
4. 저장 완료 후 "패치노트 생성하기" 버튼 표시

3번 단계는 트랜잭션으로 묶는다. DocumentVersion 저장 실패 시 ChangeCandidate도 저장되지 않아야 한다.

### Budget Guard 월 롤오버

AI API 호출 시 `budget_month`가 현재 월과 다르면 자동으로 `current_month_spend=0`, `budget_month=현재월`, `is_locked=false`로 리셋한 뒤 진행한다. 별도 cron job 불필요.

### 텍스트 추출 타임아웃

```typescript
// 30초 타임아웃 패턴
const result = await Promise.race([
  extractText(file),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Extraction timed out')), 30000))
]);
```

타임아웃 시 부분 결과를 저장하지 않는다. `parse_status=failed`, `parse_error='Extraction timed out'`로 기록.

### 파일 크기 제한

20MB 초과 파일은 업로드 즉시 거부 (`upload_status=failed`). 텍스트 추출 시도 없음. Next.js App Router body size 설정 필수:

```js
// next.config.js
experimental: { serverActions: { bodySizeLimit: '20mb' } }
```

### 검색 응답 시간

코퍼스 100건 기준, LIMIT 50 응답 < 500ms. pg_bigm 미설치 환경에서는 `SEARCH_MODE=ilike`로 ILIKE fallback 자동 전환.

### Backlog 스키마 포함 금지

`ValidationRun`, `ValidationFinding`, `DesignReviewRun`, `DesignReviewFinding`은 `prisma/schema.prisma`에 추가하지 않는다. `docs/data_model.md` 섹션 8에 참조용으로만 보관.

---

## 디렉토리 구조 (docs/implementation_plan.md 기준)

```
pm_document_hub/
├── app/                        # Next.js App Router
│   ├── page.tsx                # 메인 (검색)
│   ├── docs/[id]/page.tsx
│   ├── import/page.tsx
│   ├── import/preview/page.tsx
│   ├── upload/page.tsx
│   ├── review/page.tsx
│   ├── patch-notes/new/page.tsx
│   ├── patch-notes/[id]/page.tsx
│   ├── settings/page.tsx
│   └── api/                    # API Routes (app/api/**/route.ts)
├── lib/
│   ├── db.ts                   # Prisma client singleton (HMR guard 포함)
│   ├── version-resolver.ts     # resolveLatestVersion (트랜잭션 필수)
│   ├── budget-guard.ts         # AI API 비용 차단
│   ├── extractors/             # pdf-parse, mammoth, xlsx, officeparser
│   └── json-schema.ts          # Import JSON Schema (Zod)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── storage/
│   └── raw/{YYYY}/{MM}/{document_version_id}/{original_filename}
├── __tests__/                  # vitest 단위 테스트
├── docs/                       # 기획 문서 (읽기 전용, 수정 시 사유 명시)
├── CLAUDE.md
├── AGENTS.md
└── .env
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:localdev@localhost:5432/pm_document_hub` | PostgreSQL 연결 |
| `OPENAI_API_KEY` | (미설정) | 없으면 AI 기능 자동 비활성화 |
| `STORAGE_PATH` | `./storage` | 로컬 파일 저장 루트 |
| `STORAGE_TYPE` | `local` | `local` \| `supabase` |
| `APP_URL` | `http://172.31.201.23:8787` | 팀 내부망 접속 URL |
| `HOST` | `0.0.0.0` | LAN 공유 바인딩 |
| `PORT` | `8787` | 개발 서버 포트 |
| `SEARCH_MODE` | `bigm` | `bigm` \| `ilike` (pg_bigm 미설치 시 fallback) |
