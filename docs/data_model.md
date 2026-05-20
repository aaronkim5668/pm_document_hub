# 데이터 모델

**버전:** 1.1  
**작성일:** 2026-05-19  
**최종 수정:** 2026-05-19 (재점검 반영 — 섹션 8 추가)  
**DB:** PostgreSQL  
**ORM:** Prisma

---

## 1. 엔티티 관계 개요

```
RawSource ─────────────────────── DocumentVersion ─── Document
    │                                      │
ExtractedText                    NormalizedDocument
                                           │
                                    DesignItem[]
                                           │
                                 ChangeCandidate[]
                                      │        │
                              ReviewQueueItem  PatchNoteCandidate[]
                                                      │
                                               PatchNoteItem
                                                      │
                                                PatchNote

AIUsageLog ──── DocumentVersion (FK, nullable)
Tag ──── DocumentTag ──── DocumentVersion
```

---

## 2. 문서 레이어 구조

| 레이어 | 테이블 | 설명 |
|---|---|---|
| Layer 1 | `raw_sources` | 원본 파일 (불변) |
| Layer 2 | `extracted_texts` | 텍스트 추출 결과 |
| Layer 3 | `normalized_documents` | 정규화된 메타데이터 |
| Layer 4 | `change_candidates` | 변경사항 후보 |
| Layer 5 | `patch_note_candidates` | 패치노트 후보 문구 |
| Layer 6 | `review_queue_items` | 검토 대기 항목 |

---

## 3. 핵심 Enum 정의

```prisma
enum DocType {
  system_spec
  character_spec
  skill_spec
  bm_spec
  event_spec
  balance_spec
  patch_note
  meeting_note
  ux_spec
  economy_spec
  etc
}

enum DocStatus {
  draft
  review
  approved
  released
  deprecated
  unknown
}

enum FileType {
  pdf
  pptx
  docx
  xlsx
  csv
  txt
  md
  image
  url
  json
  other
}

enum UploadStatus {
  pending
  success
  failed
}

enum ParseStatus {
  pending
  success
  partial
  failed
  skipped  // [Backlog] MVP 미사용. 향후 "텍스트 추출 건너뛰기" 옵션용 (예: PM이 파싱 불필요 선언). MVP 구현 시 enum에는 보존하되 코드 경로 없음
}

enum ChangeType {
  add
  modify
  remove
  clarify
}

enum PatchNoteCategory {
  major_update
  new_content
  balance
  system_improvement
  bug_fix
  notice
}

enum ReviewStatus {
  pending
  approved
  rejected
  deferred
}

enum ReviewIssueType {
  low_confidence
  conflict
  version_conflict
  status_conflict
  no_version
  date_conflict
  duplicate_hash
  unknown_doc_type
}

enum ImportMode {
  raw_upload
  ai_import
  manual
}

enum AIProvider {
  openai
  claude
  gemini
  local
  none
}

enum PatchNoteStatus {
  draft
  review
  released
}
```

---

## 4. 스키마 정의

### 4.1 Document (문서 마스터)

```prisma
model Document {
  id          String    @id @default(uuid())
  // slug: Phase 2 이후 구현 (MVP에서는 id로 접근. URL slug 생성 로직은 Phase 2 Backlog.)
  doc_type    DocType
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt

  versions    DocumentVersion[]
}
```

**설계 결정:**
- `Document`는 문서 "계통"을 나타냄. 실제 내용은 `DocumentVersion`에 있음.
- 최신 버전은 `DocumentVersion.is_latest = true`인 항목이지만, 이는 비즈니스 로직으로 판단 (업로드 순서 아님).

---

### 4.2 DocumentVersion (문서 버전)

```prisma
model DocumentVersion {
  id               String      @id @default(uuid())
  document_id      String
  document         Document    @relation(fields: [document_id], references: [id])

  // 버전 식별
  version_label    String?     // 문서에서 추출한 버전 (e.g., "v2.3", "2026-05-19")
  version_date     DateTime?   // 문서 내 작성일/수정일/적용일 (없으면 null)
  version_hash     String      // SHA-256 of raw content (중복 감지용)

  // 상태
  status           DocStatus   @default(unknown)
  is_latest        Boolean     @default(false)
  import_mode      ImportMode

  // 메타
  uploaded_at      DateTime    @default(now())
  uploaded_by      String?

  // 관계
  raw_source       RawSource?
  normalized_doc   NormalizedDocument?
  change_candidates ChangeCandidate[]
  review_queue_items ReviewQueueItem[]
  tags             DocumentTag[]
  ai_usage_logs    AIUsageLog[]

  @@index([document_id])
  @@index([document_id, is_latest])  // is_latest=true 빠른 조회용
  @@index([version_hash])
  @@index([status])
}
```

**버전 판단 로직 (업로드 순서 배제):**

```
is_latest 판단 기준 (우선순위 순):
1. version_date가 있으면 → 가장 늦은 날짜가 최신
2. version_label이 있으면 → 시맨틱 버전 또는 날짜 형식 파싱
3. 위 둘 다 없으면 → Review Queue로 이동 (자동 최신 판단 불가)

기존 Approved/Released 버전 교체:
- 새 버전의 version_date > 현재 is_latest 버전의 version_date → 사용자 승인 요청
- 승인 없이는 is_latest 업데이트 금지
```

---

### 4.3 RawSource (원본 파일)

```prisma
model RawSource {
  id                  String       @id @default(uuid())
  document_version_id String       @unique
  document_version    DocumentVersion @relation(fields: [document_version_id], references: [id])

  original_filename   String
  file_type           FileType
  storage_path        String       // 로컬 경로 또는 Supabase Storage URL
  file_size_bytes     Int
  file_hash           String       // SHA-256 (중복 업로드 감지)

  upload_status       UploadStatus @default(pending)
  parse_status        ParseStatus  @default(pending)
  parse_error         String?      // 파싱 실패 시 에러 메시지
  parse_warning       String?      // 부분 성공 시 경고

  created_at          DateTime     @default(now())

  extracted_texts     ExtractedText[]

  @@index([file_hash])
  @@index([upload_status])
  @@index([parse_status])
}
```

**업로드 실패 vs 파싱 실패 분리:**

| 상태 | 의미 | 처리 |
|---|---|---|
| `upload_status=failed` | 파일이 서버에 저장되지 못함 | 재업로드 필요 |
| `upload_status=success, parse_status=failed` | 파일은 저장됐지만 텍스트 추출 실패 | 파일은 보존, 수동 텍스트 입력 가능 |
| `upload_status=success, parse_status=partial` | 일부 페이지/섹션 추출 실패 | 경고와 함께 부분 결과 사용 |

---

### 4.4 ExtractedText (추출된 텍스트)

```prisma
model ExtractedText {
  id                String    @id @default(uuid())
  raw_source_id     String
  raw_source        RawSource @relation(fields: [raw_source_id], references: [id])

  content           String    // @db.Text
  extraction_method String    // "pdfminer", "python-docx", "markdownparser", "manual", "tesseract"
  confidence        Float?    // 0.0-1.0 (이미지 OCR 등에서 유의미)
  page_count        Int?
  char_count        Int?

  created_at        DateTime  @default(now())
}
```

---

### 4.5 NormalizedDocument (정규화된 문서)

```prisma
model NormalizedDocument {
  id                  String       @id @default(uuid())
  document_version_id String       @unique
  document_version    DocumentVersion @relation(fields: [document_version_id], references: [id])

  title               String
  doc_type            DocType
  category            String?
  summary             String?      // @db.Text
  review_findings     Json?        // 기획서 리뷰 결과 (review_findings 필드)

  // AI 생성 여부
  ai_generated        Boolean      @default(false)
  ai_provider         AIProvider?  // String? 아님 — enum 타입 강제
  ai_model            String?
  ai_cost_tokens      Int?

  created_at          DateTime     @default(now())
  updated_at          DateTime     @updatedAt

  design_items        DesignItem[]
}
```

**`review_findings` JSON 구조 (기획서 리뷰 결과):**

```json
{
  "pm_review": {
    "user_value": "string",
    "core_fun": "string",
    "kpi_impact": "string"
  },
  "data_review": {
    "log_gaps": ["string"],
    "metrics_affected": ["string"]
  },
  "qa_review": {
    "checkpoints": ["string"],
    "risk_areas": ["string"]
  },
  "bm_review": {
    "bm_risk": "string",
    "monetization_notes": "string"
  },
  "user_perspective": {
    "user_backlash_risk": "string",
    "feedback_prediction": "string"
  },
  "ops_review": {
    "ops_burden": "string",
    "live_ops_notes": "string"
  },
  "improvement_suggestions": ["string"],
  "generated_by": "string",
  "generated_at": "datetime"
}
```

> **주의:** `review_findings`는 MVP F19 기능으로 JSON 필드 저장. 별도 테이블(`design_review_runs`, `design_review_findings`)로 분리하는 것은 2차(J-03). 섹션 8 참조.

---

### 4.6 DesignItem (기획 항목)

```prisma
model DesignItem {
  id                    String             @id @default(uuid())
  normalized_doc_id     String
  normalized_doc        NormalizedDocument @relation(fields: [normalized_doc_id], references: [id])

  item_name             String
  item_type             String             // "skill", "item", "event", "system", "character", "balance", etc.
  description           String?            // @db.Text
  order_index           Int                @default(0)

  created_at            DateTime           @default(now())

  change_candidates     ChangeCandidate[]
}
```

---

### 4.7 ChangeCandidate (변경사항 후보)

```prisma
model ChangeCandidate {
  id                  String       @id @default(uuid())
  document_version_id String
  document_version    DocumentVersion @relation(fields: [document_version_id], references: [id])
  design_item_id      String?
  design_item         DesignItem?  @relation(fields: [design_item_id], references: [id])

  change_type         ChangeType
  change_description  String       // @db.Text
  patch_note_draft    String?      // @db.Text  AI/Import 원본 제안 (읽기 전용 원본). PM 수정 버전은 PatchNoteCandidate.draft_text가 원천.
  category            PatchNoteCategory?

  review_status       ReviewStatus @default(pending)
  reviewed_by         String?
  reviewed_at         DateTime?

  created_at          DateTime     @default(now())

  patch_note_candidates PatchNoteCandidate[]
  review_queue_items    ReviewQueueItem[]

  @@index([review_status])
  @@index([document_version_id])
}
```

---

### 4.8 PatchNoteCandidate (패치노트 후보 문구)

```prisma
// [I1] 생성 시점/주체 (Adversarial Review 결정):
// - 트리거: /patch-notes/new 화면(F17) 진입 시 PM이 기간/버전 범위 선택 → "후보 불러오기" 클릭
// - 서버 처리: GET /api/changes?status=approved&date_range=... 로 approved ChangeCandidate 조회 →
//   각 항목별로 PatchNoteCandidate 1:1 upsert (draft_text는 ChangeCandidate.patch_note_draft 복사)
// - 사용자 액션: PM이 체크박스로 is_selected 토글, draft_text 인라인 편집
// - 패치노트 생성: is_selected=true인 PatchNoteCandidate만 PatchNoteItem으로 변환 (F18 [생성] 클릭 시)
// - API 레벨 강제: POST /api/patch-notes는 각 candidate_id를 DB에서 재조회하여
//   연결된 ChangeCandidate.review_status='approved'인 경우만 PatchNoteItem 생성
//   (UI 필터 우회 차단 — pending/rejected ChangeCandidate는 절대 패치노트에 포함되지 않음)
model PatchNoteCandidate {
  id                  String          @id @default(uuid())
  change_candidate_id String          @unique
  change_candidate    ChangeCandidate @relation(fields: [change_candidate_id], references: [id])

  draft_text          String          // @db.Text
  category            PatchNoteCategory
  is_selected         Boolean         @default(false)  // 패치노트 포함 여부

  created_at          DateTime        @default(now())
  updated_at          DateTime        @updatedAt

  patch_note_items    PatchNoteItem[]
}
```

---

### 4.9 ReviewQueueItem (검토 대기 항목)

```prisma
// [권장사항] document_version_id 또는 change_candidate_id 중 최소 하나 필수 (앱 레벨 강제)
// Prisma는 DB 레벨 CHECK 제약 미지원 → 저장 전 app-level 검증 필요 (둘 다 null이면 저장 거부)
model ReviewQueueItem {
  id                  String          @id @default(uuid())
  document_version_id String?
  document_version    DocumentVersion? @relation(fields: [document_version_id], references: [id])
  change_candidate_id String?
  change_candidate    ChangeCandidate? @relation(fields: [change_candidate_id], references: [id])

  issue_type          ReviewIssueType
  description         String          // @db.Text
  auto_suggestion     String?         // @db.Text  시스템 제안 해결책

  status              ReviewStatus    @default(pending)
  resolved_by         String?
  resolved_at         DateTime?
  resolution_note     String?

  created_at          DateTime        @default(now())

  @@index([status])
  @@index([issue_type])
}
```

---

### 4.10 PatchNote (패치노트)

```prisma
model PatchNote {
  id              String          @id @default(uuid())
  title           String
  release_version String          // e.g., "v2.3.0", "2026-05-15". [M3] DocumentVersion.version_label과 혼동 방지 위해 release_ 접두사
  patch_date      DateTime?
  status          PatchNoteStatus @default(draft)

  created_at      DateTime        @default(now())
  updated_at      DateTime        @updatedAt

  items           PatchNoteItem[]
}
```

---

### 4.11 PatchNoteItem (패치노트 항목)

```prisma
model PatchNoteItem {
  id                      String              @id @default(uuid())
  patch_note_id           String
  patch_note              PatchNote           @relation(fields: [patch_note_id], references: [id])
  patch_note_candidate_id String?
  patch_note_candidate    PatchNoteCandidate? @relation(fields: [patch_note_candidate_id], references: [id])

  category                PatchNoteCategory
  content                 String              // @db.Text  PM이 최종 수정한 내용
  order_index             Int                 @default(0)

  created_at              DateTime            @default(now())

  @@index([patch_note_id, category])
}
```

---

### 4.12 AIUsageLog (AI 사용량 로그)

```prisma
model AIUsageLog {
  id                  String       @id @default(uuid())
  document_version_id String?
  document_version    DocumentVersion? @relation(fields: [document_version_id], references: [id])

  event_type          String       // "extraction", "normalization", "review", "patch_note_draft"
  provider            AIProvider
  model               String       // e.g., "gpt-4o", "claude-sonnet-4-6"
  input_tokens        Int
  output_tokens       Int
  cost_usd            Decimal      @db.Decimal(10, 6)

  // 캐시 처리
  cache_hit           Boolean      @default(false)
  file_hash           String?      // 동일 파일 재처리 방지

  created_at          DateTime     @default(now())

  @@index([provider])
  @@index([created_at])
  @@index([file_hash])
}
```

---

### 4.13 Tag / DocumentTag

```prisma
model Tag {
  id          String        @id @default(uuid())
  name        String        @unique
  created_at  DateTime      @default(now())

  doc_tags    DocumentTag[]
}

model DocumentTag {
  document_version_id String
  document_version    DocumentVersion @relation(fields: [document_version_id], references: [id])
  tag_id              String
  tag                 Tag             @relation(fields: [tag_id], references: [id])

  @@id([document_version_id, tag_id])
}
```

---

### 4.14 AIBudgetConfig (API 비용 제어)

```prisma
model AIBudgetConfig {
  id                  String      @id @default(uuid())
  monthly_budget_usd  Decimal     @db.Decimal(10, 2)  // 0.00 = 완전 차단
  current_month_spend Decimal     @db.Decimal(10, 6)  @default(0)
  budget_month        String      // e.g., "2026-05"
  is_locked           Boolean     @default(false)     // 예산 100% 초과 시 budget-guard가 자동 true 설정 (수동 잠금 해제 버튼 없음)

  // [C2] auto_approve_threshold 필드 제거됨 (Adversarial Review 결정).
  // 사유: 어떤 금액이든 사용자 명시 액션(버튼 클릭) 없이 호출되면 NR11 위반.
  // 비용이 낮아도 "자동 승인"이라는 개념 자체를 금지한다.

  alert_threshold_pct    Int      @default(80)        // 예산 80% 도달 시 UI 경고 배너 (호출 차단은 아님)

  updated_at          DateTime    @updatedAt
}
```

**설계 결정:**
- **[권장사항] Singleton row:** 앱에서 row가 1개만 존재. `prisma/seed.ts`에서 `upsert`로 초기 레코드 생성 (budget=0, all AI locked). 런타임에서 row 부재 시 upsert로 safe default 반환.
- **[B2] Decimal 비교 주의:** `monthly_budget_usd`와 `current_month_spend`는 Prisma `Decimal` 타입 — JavaScript `number`가 아님. 비교 시 반드시 `.toNumber()` 변환 또는 `Prisma.Decimal.equals()` 사용. `=== 0` 직접 비교는 항상 `false` 반환 (budget guard 우회됨).
- **[C2] NR11 강제 (auto_approve_threshold 제거):** 비용이 낮든 높든 사용자 명시 액션("고품질 분석" 버튼 클릭 등) 없이는 절대 호출 금지. budget-guard.ts는 항상 사용자 액션 트리거를 검증하며, 어떤 임계값에 의해서도 자동 통과되지 않음.
- **[I2] is_locked 트리거 흐름:**
  - **자동 잠금:** budget-guard가 호출 직전 잔액 검사 → `current_month_spend + estimatedCost > monthly_budget_usd` 시 `is_locked=true` 자동 설정 + 호출 차단 + AIUsageLog 기록(cost_usd=0)
  - **해제 1 (예산 증액):** PM이 `/settings`에서 `monthly_budget_usd` 증액 → 잔액 회복 확인 후 budget-guard가 다음 호출 시 `is_locked=false` 자동 전환
  - **해제 2 (월 롤오버):** 호출 시 `budget_month != 현재월` 감지 → `current_month_spend=0, budget_month=현재월, is_locked=false` 자동 리셋
  - **수동 잠금 해제 버튼 없음** (NR12 강제 — 예산 0이면 어떤 수동 액션으로도 호출 불가)

---

## 5. 검색 인덱스 설계

### PostgreSQL Full Text Search (한국어)

> Week 1 Vertical Slice에서는 검색 고도화를 구현하지 않는다. Week 2 검색 구현 시 pg_bigm은 선택 사항이며, 미설치 환경에서는 `SEARCH_MODE=ilike` fallback을 우선 사용한다.
> Week 2 기본 검색은 `DocumentVersion.is_latest=true`와 `status != deprecated`를 기준으로 조회하고, Tag/DesignItem 매칭으로 인한 중복은 DocumentVersion ID 기준으로 제거한다.

```sql
-- pg_bigm 확장 설치 필요 (한국어 n-gram 검색)
CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- 검색용 tsvector 컬럼 (NormalizedDocument)
ALTER TABLE normalized_documents 
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('simple', 
    coalesce(title, '') || ' ' || 
    coalesce(summary, '') || ' ' ||
    coalesce(category, '')
  )
) STORED;

CREATE INDEX idx_normalized_docs_search 
ON normalized_documents USING GIN (search_vector);

-- pg_bigm 인덱스 (한국어 포함 검색)
CREATE INDEX idx_normalized_docs_title_bigm
ON normalized_documents USING GIN (title gin_bigm_ops);

-- ExtractedText 검색 (전문 검색)
CREATE INDEX idx_extracted_text_bigm
ON extracted_texts USING GIN (content gin_bigm_ops);
```

**참고:** pg_bigm은 한국어 2-gram 인덱싱으로 기본 PostgreSQL FTS보다 한국어 검색 품질이 크게 향상된다. Supabase 환경에서는 `pg_bigm` 확장 활성화 가능.

---

## 6. 버전 판단 비즈니스 로직

```typescript
// DocumentVersion 최신 판단 알고리즘
// IMPORTANT: is_latest update must be wrapped in a transaction.
// Without it, a crash between updateMany and update leaves ALL versions with is_latest=false.
async function resolveLatestVersion(documentId: string): Promise<void> {
  const versions = await prisma.documentVersion.findMany({
    where: { document_id: documentId },
    include: { normalized_doc: true }
  });

  // 1단계: version_date가 있는 버전들 정렬
  // Tie-breaking: version_date 동일하면 uploaded_at 최신 순 → 그래도 같으면 Review Queue 등록
  const datedVersions = versions.filter(v => v.version_date != null)
    .sort((a, b) => {
      const dateDiff = new Date(b.version_date!).getTime() - new Date(a.version_date!).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
    });

  if (datedVersions.length > 0) {
    const candidateLatest = datedVersions[0];
    const currentLatest = versions.find(v => v.is_latest);
    // Edge case: candidateLatest === currentLatest (same version re-uploaded)
    // → skip conflict check, proceed to updateMany to re-confirm is_latest=true

    // 기존 Approved/Released 문서 교체 시 사용자 승인 필요
    if (currentLatest && 
        ['approved', 'released'].includes(currentLatest.status) &&
        candidateLatest.id !== currentLatest.id) {
      await createReviewQueueItem({
        document_version_id: candidateLatest.id,
        issue_type: 'version_conflict',
        description: `새 버전(${candidateLatest.version_label})이 현재 ${currentLatest.status} 상태인 버전을 교체하려 합니다. 승인이 필요합니다.`
      });
      return; // 자동 업데이트 하지 않음
    }

    // 날짜 기반으로 최신 설정 — 반드시 트랜잭션으로 묶어야 함
    await prisma.$transaction([
      prisma.documentVersion.updateMany({
        where: { document_id: documentId },
        data: { is_latest: false }
      }),
      prisma.documentVersion.update({
        where: { id: candidateLatest.id },
        data: { is_latest: true }
      }),
    ]);
    return;
  }

  // 2단계: version_date 없으면 Review Queue로
  for (const version of versions.filter(v => !v.version_date)) {
    await createReviewQueueItem({
      document_version_id: version.id,
      issue_type: 'no_version',
      description: '문서에서 버전 또는 날짜 정보를 추출할 수 없습니다. 수동 확인이 필요합니다.'
    });
  }
}
```

---

## 7. JSON Import Schema (AI Pre-Review Import)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["title", "doc_type", "import_mode"],
  "properties": {
    "title": { "type": "string" },
    "doc_type": {
      "type": "string",
      "enum": ["system_spec","character_spec","skill_spec","bm_spec","event_spec",
               "balance_spec","patch_note","meeting_note","ux_spec","economy_spec","etc"]
    },
    "import_mode": { "type": "string", "enum": ["ai_import"] },
    "version_label": { "type": "string" },
    "version_date": { "type": "string", "format": "date" },
    "category": { "type": "string" },
    "summary": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "status": {
      "type": "string",
      "enum": ["draft","review","approved","released","deprecated","unknown"]
    },
    "design_items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["item_name"],
        "properties": {
          "item_name": { "type": "string" },
          "item_type": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    },
    "change_candidates": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["change_type", "change_description"],
        "properties": {
          "change_type": { "type": "string", "enum": ["add","modify","remove","clarify"] },
          "change_description": { "type": "string" },
          "patch_note_draft": { "type": "string" },
          "category": { "type": "string" }
        }
      }
    },
    "review_findings": { "type": "object" },
    "requires_review": {
      "type": "array",
      "description": "신뢰도 낮거나 충돌 있는 항목 목록",
      "items": {
        "type": "object",
        "properties": {
          "field": { "type": "string" },
          "issue": { "type": "string" },
          "suggestion": { "type": "string" }
        }
      }
    }
  }
}
```

---

## 8. Backlog 데이터 모델 (1.5차 / 2차)

> 아래 스키마는 MVP에 포함되지 않으며 구현하지 않는다. 향후 1.5차/2차 작업 시 참조용으로 보관.
>
> **[권장사항] 주의:** 아래 모델들은 `prisma/schema.prisma`에 포함 금지. Prisma migrate 실행 시 불필요한 테이블이 자동 생성되므로, 구현 시점에 별도 마이그레이션 파일로 추가할 것.

---

### 8.1 ValidationRun / ValidationFinding (1.5차 — 불일치 검수 Agent)

**연관 기능:** K-02, J-02 (패치노트·게임데이터 불일치 검수 Agent)

```prisma
// 1.5차 Backlog — 구현 금지 (MVP 아님)
model ValidationRun {
  id              String    @id @default(uuid())
  run_label       String?   // e.g., "2026-05-15 패치 검수"
  patch_note_id   String?   // 검수 대상 패치노트
  game_data_ref   String?   // 게임데이터 CSV 파일 경로 또는 식별자
  status          String    // pending | running | completed | failed
  started_at      DateTime  @default(now())
  completed_at    DateTime?
  summary_high    Int       @default(0)   // HIGH 심각도 건수
  summary_medium  Int       @default(0)
  summary_low     Int       @default(0)

  findings        ValidationFinding[]
}

model ValidationFinding {
  id              String        @id @default(uuid())
  run_id          String
  run             ValidationRun @relation(fields: [run_id], references: [id])

  entity_type     String        // reward | event | item | feature | balance
  entity_id       String?
  field           String?       // 불일치 발생 필드
  expected_value  String?       // 기대값 (패치노트 기준)
  actual_value    String?       // 실제값 (게임데이터 기준)
  severity        String        // HIGH | MEDIUM | LOW | INFO
  source_doc      String?       // 출처 문서 식별자
  note            String?

  created_at      DateTime      @default(now())
}
```

**설계 메모:**
- `ValidationRun`은 단일 검수 실행 단위 (한 번의 릴리즈 검수 = 한 Run)
- `ValidationFinding`은 Run당 N건의 불일치 항목
- severity: HIGH(값 불일치), MEDIUM(번역 누락), LOW(포맷 차이), INFO(참고)
- MVP의 `RawSource`에서 file_type=csv로 업로드한 게임데이터를 연결

---

### 8.2 DesignReviewRun / DesignReviewFinding (2차 — 기획서 리뷰 자동화 Agent)

**연관 기능:** K-03, J-03 (기획서 리뷰 자동화 Agent)

> **MVP와의 차이:** MVP(F19)는 `NormalizedDocument.review_findings` JSON 필드에 GPT 출력을 직접 저장. 2차는 이 필드를 별도 테이블로 마이그레이션하여 구조적 관리.

```prisma
// 2차 Backlog — 구현 금지 (MVP 아님)
model DesignReviewRun {
  id                  String    @id @default(uuid())
  document_version_id String    // 리뷰 대상 DocumentVersion
  review_type         String    // pm | data | qa | bm | user | ops | full
  ai_provider         String?
  ai_model            String?
  cost_usd            Decimal?  @db.Decimal(10, 6)
  status              String    // pending | running | completed | failed
  started_at          DateTime  @default(now())
  completed_at        DateTime?

  findings            DesignReviewFinding[]
}

model DesignReviewFinding {
  id          String            @id @default(uuid())
  run_id      String
  run         DesignReviewRun   @relation(fields: [run_id], references: [id])

  review_type String            // pm | data | qa | bm | user | ops
  category    String            // risk | suggestion | question | info
  severity    String            // HIGH | MEDIUM | LOW | INFO
  finding     String            // @db.Text — 발견 사항 본문
  field_ref   String?           // 관련 기획 항목 (item_name 등)

  created_at  DateTime          @default(now())
}
```

**설계 메모:**
- 2차 전환 시 `NormalizedDocument.review_findings` JSON 필드는 deprecated 처리
- `DesignReviewRun` 1건 = 단일 문서 버전에 대한 1회 리뷰 실행
- `DesignReviewFinding` N건 = 해당 리뷰에서 발견된 개별 이슈

---

### 8.3 마이그레이션 경로 (MVP → 1.5차 → 2차)

```
MVP (현재)
  NormalizedDocument.review_findings (JSON)
  ↓ 2차 마이그레이션
  DesignReviewRun + DesignReviewFinding (구조화 테이블)

MVP (현재)
  RawSource (file_type=csv) — 게임데이터도 일반 파일로 업로드
  ↓ 1.5차 마이그레이션
  ValidationRun + ValidationFinding (검수 전용 파이프라인)
```
