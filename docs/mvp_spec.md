# MVP 기능 명세

**버전:** 1.0  
**작성일:** 2026-05-19  
**상태:** APPROVED

---

## 0. 기능 목록 요약

> **Patch-First 전략 (CEO Review 반영):** F07/F16/F17/F18은 Week 1 E2E 검증 핵심. 검색·Review Queue 등 지원 기능(F04~F10)은 Week 2로 이동. Phase 표는 기능 논리 그룹을 나타내며, 구현 순서는 implementation_plan.md Week 배치를 따름.

| Phase | ID | 기능명 | 우선순위 | Week |
|---|---|---|---|---|
| 1 | F01 | AI Pre-Review Import Mode | P0 | 1 |
| 1 | F02 | JSON Schema 검증 | P0 | 1 |
| 1 | F03 | Import 미리보기 화면 | P0 | 1 |
| 1 | F07 | 변경사항 후보 저장 | P0 | 1 |
| 1 | F16 | 문서군 및 버전 관리 (핵심 로직) | P0 | 1 |
| 1 | F17 | 패치노트 후보 관리 | P0 | 1 |
| 1 | F18 | 패치노트 초안 생성 | P0 | 1 |
| 1 | F04 | 문서 CRUD | P0 | 2 |
| 1 | F05 | 문서 검색 (메인 페이지) | P0 | 2 |
| 1 | F06 | Review Queue | P0 | 2 |
| 1 | F08 | 문서 유형/상태/버전/태그 관리 | P0 | 2 |
| 1 | F09 | API 비용 방지 설정 | P0 | 2 |
| 1 | F10 | AI 사용량 로그 구조 | P0 | 2 |
| 2 | F11 | Raw Upload Inbox | P1 | 3 |
| 2 | F12 | 원본 파일 저장 | P1 | 3 |
| 2 | F13 | 기본 텍스트 추출 | P1 | 3 |
| 2 | F14 | 처리 상태 표시 | P1 | 3 |
| 2 | F15 | 업로드/파싱 실패 분리 관리 | P1 | 3 |
| 3 | F19 | 기획서 리뷰 결과 저장 | P2 | 4 |

---

## Phase 1: 핵심 파이프라인 (Week 1-2)

> **Week 1 E2E 핵심:** F01→F02→F03→F07→F16(버전 판단)→F17(후보 선택)→F18(초안 생성) 순으로 구현해 패치노트 초안 1건 생성 E2E를 7일 안에 검증한다. F04~F10은 Week 2.


### F01: AI Pre-Review Import Mode

**목적:** GPT 등 고성능 모델로 1차 정제된 기획서 JSON을 DB에 등록

**사용자 플로우:**
1. 사용자 → GPT에 기획서 입력 → 지정된 프롬프트로 JSON 추출
2. DB 툴 Import 페이지에서 JSON 붙여넣기 또는 .json 파일 업로드
3. JSON Schema 검증 (F02)
4. 미리보기 화면 확인 (F03)
5. 사용자 최종 승인 → DB 저장

**수용 기준 (Acceptance Criteria):**
- [ ] JSON 붙여넣기 또는 파일 업로드 UI 제공
- [ ] 검증 실패 시 필드별 에러 메시지 표시
- [ ] 미리보기에서 문서/기획항목/변경사항/패치노트후보 섹션 분리 표시
- [ ] 사용자 승인 없이 자동 확정 금지
- [ ] 변경사항 후보와 최신 버전 교체는 반드시 사용자 승인 필요
- [ ] GPT 정제본도 자동 확정 금지

**프롬프트 템플릿:**
사용자에게 복사-붙여넣기 가능한 GPT 프롬프트를 제공:
```
다음 게임 기획서를 분석하고 JSON 형식으로 정리해줘.
출력 형식: [docs/data_model.md의 JSON Import Schema 참조]
기획서:
---
{기획서 원문}
---
```

---

### F02: JSON Schema 검증

**목적:** AI Import JSON이 규격에 맞는지 서버 사이드에서 검증

**검증 라이브러리:** Zod (TypeScript 타입 추론 내장. `lib/json-schema.ts`에 정의한 스키마가 곧 TypeScript 타입. Ajv 불필요.)

**검증 항목:**
- `title`, `doc_type`, `import_mode` 필수 필드 존재
- `doc_type`이 허용 enum 값인지 확인
- `version_date`가 있으면 ISO 8601 date 형식
- `change_candidates[].change_type`이 허용 enum 값
- 기타 타입 검증

**수용 기준:**
- [ ] 서버 사이드 검증 (클라이언트만으로 신뢰 불가)
- [ ] 검증 실패 시 HTTP 400 + 필드별 에러 상세 반환
- [ ] 검증 통과 시 미리보기 데이터 반환
- [ ] `requires_review` 필드의 항목은 자동으로 Review Queue에 추가

---

### F03: Import 미리보기 화면

**목적:** 저장 전 사용자가 내용을 확인하고 수정 가능하도록

**미리보기 섹션:**

| 섹션 | 내용 |
|---|---|
| 문서 정보 | 제목, 유형, 카테고리, 상태, 버전, 요약, 태그 |
| 기획 항목 | 추출된 DesignItem 목록 (수정 가능) |
| 변경사항 후보 | ChangeCandidate 목록, 변경 유형, 패치노트 초안 (수정 가능) |
| 패치노트 후보 | PatchNoteCandidate 목록 (선택/해제 가능) |
| Review 필요 항목 | `requires_review` 항목 별도 표시 |
| 버전 충돌 경고 | 기존 Approved/Released 문서 존재 시 경고 배너 |

**수용 기준:**
- [ ] 모든 섹션 수정 가능 (인라인 편집)
- [ ] "승인" 버튼 클릭 시 편집된 데이터를 서버에서 재검증 후 DB 저장 (인라인 편집 값도 JSON Schema 검증 적용)
- [ ] **[B1 승인 플로우]** "승인" 버튼 클릭 시 해당 Import의 ChangeCandidate 전체를 review_status=approved로 일괄 저장 (pending → approved 자동 전환. 이후 PatchNote 생성 대상이 됨)
- [ ] 재검증 실패 시 저장 차단 + 필드별 에러 메시지 표시
- [ ] "취소" 클릭 시 아무것도 저장하지 않음
- [ ] Review 필요 항목이 있으면 별도 강조 표시
- [ ] 버전 충돌 시 사용자가 명시적으로 "교체 승인"을 선택해야 저장

---

### F04: 문서 CRUD

**목적:** 문서와 버전의 기본 생성·조회·수정·삭제

**기능 목록:**

| 액션 | 설명 |
|---|---|
| 문서 생성 | Import 완료 시 자동 생성 |
| 문서 조회 | 상세 페이지: 메타데이터, 버전 이력, 기획 항목, 변경사항 |
| 문서 수정 | 제목, 카테고리, 태그, 상태 수정 |
| 버전 이력 조회 | 문서별 전체 버전 목록, is_latest 표시 |
| 문서 상태 변경 | draft → review → approved → released → deprecated |
| 문서 삭제 | Soft delete (status = deprecated). Hard delete 금지 |
| 버전 비교 | v1 미구현 (Backlog) |

**수용 기준:**
- [ ] Approved/Released 문서 상태 변경 시 확인 모달
- [ ] 문서 삭제는 Soft delete만 허용
- [ ] 버전 이력은 시간 역순 정렬, is_latest 배지 표시

---

### F05: 문서 검색 (메인 페이지)

**목적:** ChatGPT 첫 화면처럼 중앙 검색창이 메인 진입점

**메인 화면 구성:**
```
┌─────────────────────────────────────────────────────┐
│           게임 기획서 DB                             │
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │  🔍 기획서, 스킬, 이벤트, 패치노트 검색...    │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│   최근 문서    ·    검토 대기    ·    패치노트 후보   │
└─────────────────────────────────────────────────────┘
```

**검색 동작:**
- 입력 시 실시간 검색 (debounce 300ms)
- 검색 대상: `title`, `summary`, `content` (ExtractedText), `tags`, `design_item.item_name`
- 한국어 지원: pg_bigm 인덱스 활용

**검색 결과 카드 구조:**
```
┌──────────────────────────────────────────────────┐
│ [skill_spec] [approved] [v2.3]                   │
│ 파이어볼 스킬 기획서                              │
│ 요약: 파이어볼 스킬의 대미지 계수, 쿨다운...       │
│ 관련 기획 항목: 파이어볼, 마나 소비, 피해 계수     │
│ 관련 변경 이력: 2건 · 패치노트 후보: 1건           │
│ 최신 문서 ✓ · 2026-05-18                         │
└──────────────────────────────────────────────────┘
```

**노출 우선순위:**
1. Approved/Released + is_latest=true
2. Draft/Review + is_latest=true
3. Deprecated 또는 is_latest=false (접어서 표시)

**필터 옵션 (검색창 하단):**
- 문서 유형 (DocType)
- 상태 (DocStatus)
- 태그
- 날짜 범위

**수용 기준:**
- [ ] 검색 없을 때: 최근 10개 문서 + Review Queue 배지 + 패치노트 후보 배지
- [ ] 검색 결과: 카드 형태, 우선순위 순 정렬
- [ ] Deprecated/구버전: 접혀서 "이전 버전 N개 보기" 토글
- [ ] **[I5] 검색 응답 < 500ms** — 코퍼스 100건 기준, LIMIT 50 응답 측정 (100건은 결과 수가 아니라 테스트 코퍼스 크기)

---

### F06: Review Queue

**목적:** 자동 처리 불가한 항목을 모아 PM이 수동 검토

**Review Queue 진입 조건:**

> **MVP 초기 필수 2종:** `version_conflict`(기존 Approved/Released 교체 충돌)와 `no_version`(버전/날짜 없음)은 Week 2 구현의 핵심. 나머지 5종은 동일 Phase에서 함께 구현하되, 위 2종이 먼저 동작해야 E2E 파이프라인이 완성된다.

| 조건 | issue_type | MVP 우선순위 |
|---|---|---|
| 기존 Approved/Released 교체 시도 | `version_conflict` | **필수 (Week 2 핵심)** |
| 버전/날짜 정보 없음 | `no_version` | **필수 (Week 2 핵심)** |
| 신뢰도 낮은 메타데이터 | `low_confidence` | Week 2 포함 |
| 동일 이름의 기존 문서와 충돌 | `conflict` | Week 2 포함 |
| 날짜 파싱 불가 | `date_conflict` | Week 2 포함 |
| 같은 해시 파일 재업로드 | `duplicate_hash` | Week 2 포함 |
| doc_type 분류 불확실 | `unknown_doc_type` | Week 2 포함 |

**Review Queue 화면:**
```
┌──────────────────────────────────────────────────┐
│ Review Queue (3건 대기)                           │
├──────────────────────────────────────────────────┤
│ ⚠️ 버전 충돌 · 파이어볼 스킬 기획서 v2.4          │
│ 현재 Approved: v2.3 → 교체하려면 승인 필요         │
│ [교체 승인] [보류] [취소]                          │
├──────────────────────────────────────────────────┤
│ ❓ 날짜 없음 · 영웅 성장 시스템 문서               │
│ 시스템 제안: 업로드 일자 2026-05-17 사용           │
│ [제안 수락] [직접 입력] [보류]                     │
└──────────────────────────────────────────────────┘
```

**수용 기준:**
- [ ] 대기 건수 배지 (메인 헤더 상시 표시)
- [ ] 각 항목별 승인/보류/거절 액션
- [ ] 보류 항목은 "deferred" 상태로 보관 (삭제 아님)
- [ ] Review Queue 화면에 상태 필터 제공 (pending / deferred / resolved) — deferred 항목을 다시 꺼낼 수 있어야 함
- [ ] 해결 시 `resolved_at`, `resolved_by` 기록

---

### F07: 변경사항 후보 저장

**목적:** 패치노트 생성의 원천 데이터 확보

**저장 방식:**
- AI Import 시 JSON의 `change_candidates` 배열에서 자동 저장
- 수동 추가: 문서 상세 화면에서 "변경사항 추가" 버튼

**변경사항 후보 상태 관리:**
```
pending (기본) → approved (PM 승인) → 패치노트 생성 대상
                 ↓
               rejected (제외)
                 ↓
               deferred (보류)
```

**수용 기준:**
- [ ] Import 시 `change_candidates` 자동 파싱 및 저장 (초기 review_status=pending)
- [ ] **[B1 승인 플로우]** Import Preview "승인" 버튼 클릭 시 해당 Import의 ChangeCandidate 전체가 review_status=approved로 자동 전환 (Import 완료 = 변경사항 승인)
- [ ] 문서 상세에서 변경사항 목록 조회/수정
- [ ] approved 상태만 패치노트 생성에 포함 (pending/rejected는 생성에서 제외)
- [ ] 변경 유형(add/modify/remove/clarify) 표시

---

### F08: 문서 유형/상태/버전/태그 관리

**목적:** 문서 분류 및 메타데이터 일관성 유지

**태그 관리:**
- 자유 태그 입력 (Autocomplete)
- 동일 태그 재사용
- 태그 클릭 → 해당 태그 문서 목록

**버전 표시 원칙:**
- `version_label`: 문서에서 추출한 버전 문자열
- `is_latest`: 최신 여부 배지
- 버전 없음: "Unknown" 표시 + Review Queue

**수용 기준:**
- [ ] 11가지 DocType 지원
- [ ] 6가지 DocStatus 지원
- [ ] 태그 Autocomplete
- [ ] 버전 없음 = Review Queue 자동 등록

---

### F09: API 비용 방지 설정

**목적:** 유료 AI API 호출을 완전히 통제

**설정 화면 항목:**

| 설정 | 설명 | 기본값 |
|---|---|---|
| AI Provider | none / local / openai / claude / gemini | none |
| 월 예산 (USD) | 0.00 = 완전 차단 | 0.00 |
| 자동 호출 허용 | OFF = 버튼 클릭 시에만 | OFF |
| 예산 경고 임계값 | 예산의 X% 도달 시 경고 | 80% |

**API 차단 로직:**
```typescript
async function checkBudgetAndCall(estimatedCost: number) {
  const config = await getBudgetConfig();
  
  // [B2] Prisma Decimal 타입 주의: === 로 직접 비교 불가 → .toNumber() 변환 필요
  if (config.monthly_budget_usd.toNumber() === 0) {
    throw new Error("AI API가 비활성화되어 있습니다. 설정에서 예산을 설정하세요.");
  }
  
  if (config.current_month_spend.toNumber() + estimatedCost > config.monthly_budget_usd.toNumber()) {
    throw new Error(`월 예산(${config.monthly_budget_usd} USD)을 초과합니다.`);
  }
  
  // 호출 후 비용 기록
}
```

**수용 기준:**
- [ ] 월 예산 0 설정 시 유료 API 완전 차단 (서버 사이드)
- [ ] 예산 경고 시 UI 배너 표시
- [ ] API 호출은 "고품질 분석" 버튼 클릭 시에만 (자동 호출 없음)
- [ ] 파일 해시 기반 중복 처리 (동일 파일 재분석 차단)
- [ ] `current_month_spend` 월 롤오버: API 호출 시 `budget_month`가 현재 월과 다르면 자동으로 `current_month_spend=0`, `budget_month=현재월`로 리셋 후 진행 (별도 cron 불필요)
- [ ] AI API 429 (Rate Limit): UI에 'API 사용량 제한, 잠시 후 재시도' 메시지 표시
- [ ] AI API timeout (30초): UI에 'AI 호출 시간 초과' 메시지 표시
- [ ] AI 응답 JSON 파싱 실패: UI 오류 표시, 부분 저장 절대 금지
- [ ] 실패한 API 호출은 cost_usd=0으로 AIUsageLog 기록 (비용 추적 연속성)
- [ ] 모든 AI 호출 실패는 사용자에게 명시적으로 표시 (silent fail 금지)

---

### F10: AI 사용량 로그 구조

**목적:** 비용 추적 및 감사

**로그 항목:** provider, model, input_tokens, output_tokens, cost_usd, cache_hit, file_hash

**설정 화면 통계:**
- 이번 달 총 비용
- 문서별 호출 횟수
- 가장 많이 사용한 Provider/Model

**수용 기준:**
- [ ] 모든 API 호출 시 AIUsageLog 자동 기록
- [ ] 설정 페이지에서 월별 사용량 조회 가능
- [ ] cache_hit 여부 기록 (동일 해시 재처리 방지)

---

## Phase 2: Raw Upload (Week 3)

### F11: Raw Upload Inbox

**목적:** 파일을 그대로 올리면 시스템이 처리하는 업로드 진입점

**지원 파일 형식:**

| 형식 | 텍스트 추출 | 메타데이터 자동화 |
|---|---|---|
| PDF | ✅ (pdfminer) | AI 호출 시만 |
| DOCX | ✅ (python-docx) | AI 호출 시만 |
| XLSX | ✅ (openpyxl) | AI 호출 시만 |
| CSV | ✅ (csv parser) | AI 호출 시만 |
| TXT / Markdown | ✅ (plain text) | AI 호출 시만 |
| PPTX | 부분 (텍스트 추출) | AI 호출 시만 |
| 이미지 (PNG/JPG) | ❌ (OCR 미포함, Backlog) | ❌ |
| URL | ❌ (Backlog) | ❌ |

**업로드 플로우:**
```
파일 드래그&드롭 또는 선택
    ↓
파일 해시 계산 → 중복 확인
    ↓ (중복 아님)
RawSource 생성 (upload_status=pending)
    ↓
파일 저장 (로컬 또는 Supabase Storage)
    ↓ 성공         ↓ 실패
upload_status=success  upload_status=failed
    ↓               → 에러 표시 (재업로드 안내)
텍스트 추출 시작
    ↓ 성공         ↓ 실패/부분
parse_status=success  parse_status=failed/partial
    ↓
DocumentVersion 생성 (status=unknown, is_latest=false)
    ↓
메타데이터: 수동 입력 OR "고품질 분석" 버튼으로 AI 호출
```

**수용 기준:**
- [ ] 드래그&드롭 + 파일 선택 UI
- [ ] 업로드 진행률 표시
- [ ] 중복 파일 (해시 동일) 경고 표시
- [ ] 업로드 실패 ≠ 파싱 실패 (에러 메시지 분리)
- [ ] 업로드 완료 후 Inbox 리스트에 처리 상태 표시

---

### F12: 원본 파일 저장

**원칙:** 원본 파일은 절대 변경하지 않는다.

**저장 경로:**
```
/storage/raw/{year}/{month}/{document_version_id}/{original_filename}
```

**수용 기준:**
- [ ] 원본 파일 변경 불가 (읽기 전용 저장)
- [ ] 파일 해시(SHA-256) 저장 및 무결성 확인
- [ ] 파일 다운로드 기능 (원본 그대로)
- [ ] 저장 경로와 URL을 `storage_path`에 기록

---

### F13: 기본 텍스트 추출

**추출 방법별 처리:**

| 파일 형식 | 라이브러리 (Node.js) | 비고 |
|---|---|---|
| PDF | pdf-parse | 레이아웃 복잡 PDF는 partial |
| DOCX | mammoth | 표/이미지 내 텍스트 제외 |
| XLSX | xlsx | 셀 값만 추출 |
| CSV | csv-parse | 전체 추출 |
| TXT/MD | fs.readFile | UTF-8 우선, 실패시 CP949 |
| PPTX | officeparser | 슬라이드 텍스트만 추출 (partial). 한국어 인코딩 안정적. 복잡한 레이아웃·이미지 내 텍스트는 누락 가능 |

**파일 크기 제한 및 타임아웃:**

| 제한 | 값 | 위반 시 처리 |
|---|---|---|
| 최대 파일 크기 | 20MB | 업로드 거부 (upload_status=failed, 에러 메시지) |
| 텍스트 추출 타임아웃 | 30초 | parse_status=failed, parse_error='Extraction timed out' |

> **[UP1] 타임아웃 구현:** `Promise.race([extractText(file), rejectAfter(30000)])` 패턴으로 구현. 타임아웃 발생 시 부분 결과 저장 금지, parse_status=failed + parse_error='Extraction timed out' 기록.
>
> **[B3] Next.js body size 설정:** App Router 기본 body size limit 4MB. 20MB 지원을 위해 `next.config.js`에 `experimental: { serverActions: { bodySizeLimit: '20mb' } }` 추가 또는 `app/api/upload/route.ts`에서 `request.formData()` 스트리밍 처리 필요.

**수용 기준:**
- [ ] 추출 방법 `extraction_method` 필드에 기록
- [ ] 부분 추출 성공 시 `parse_status=partial`, 경고 메시지 포함
- [ ] 추출 실패 시 `parse_status=failed`, 수동 텍스트 입력 가능 (재시도 버튼 제공)
- [ ] 추출 타임아웃(30초) 시 `parse_status=failed`, parse_error='Extraction timed out (파일이 너무 크거나 복잡합니다)'
- [ ] 20MB 초과 파일 업로드 시 즉시 거부 (추출 시도 없음)
- [ ] 추출된 텍스트는 검색 인덱스에 포함

---

### F14: 처리 상태 표시

**Inbox 리스트 상태 배지:**

| 상태 조합 | 표시 |
|---|---|
| upload_status=pending | 🔄 업로드 중 |
| upload_status=failed | ❌ 업로드 실패 |
| upload_status=success, parse_status=pending | 🔄 텍스트 추출 중 |
| upload_status=success, parse_status=success | ✅ 완료 |
| upload_status=success, parse_status=partial | ⚠️ 부분 추출 |
| upload_status=success, parse_status=failed | ⚠️ 추출 실패 (원본 보존됨) |

**수용 기준:**
- [ ] 상태 업데이트: polling 방식, 3초 간격 (`setInterval 3000ms`). WebSocket은 오버엔지니어링 (MVP 단일 사용자, 내부 LAN).
- [ ] 업로드 완료 (upload_status ≠ pending) 후 polling 자동 중지
- [ ] 실패 항목에서 재시도 가능
- [ ] 각 단계별 에러 메시지 표시

---

### F15: 업로드/파싱 실패 분리 관리

업로드 실패와 파싱 실패는 서로 다른 원인과 대응이 필요하다.

**업로드 실패 대응:** 재업로드 버튼, 에러 원인 표시 (파일 크기 초과, 네트워크 오류 등)

**파싱 실패 대응:** 
- 원본 파일은 보존됨 (업로드는 성공)
- 수동 텍스트 입력 폼 제공
- "고품질 분석" 버튼으로 AI 호출 가능

**수용 기준:**
- [ ] `upload_status`와 `parse_status` 별도 필드 유지
- [ ] 파싱 실패해도 원본 파일 다운로드 가능
- [ ] 파싱 실패 항목에 수동 텍스트 입력 UI 제공

---

## Phase 1 — Week 1 핵심: 변경사항 + 버전 판단 + 패치노트 E2E

### F16: 문서군 및 버전 관리 (핵심 로직)

> **Week 1 선행 구현.** AI Import 경로의 버전 판단이 동작해야 E2E 파이프라인이 완성된다. Raw Upload 연결은 Phase 2(Week 3)에서 완성.

**문서군(Document Family):** 동일 `document_id`를 공유하는 모든 `DocumentVersion`

**버전 판단 우선순위:**
1. `version_date` (문서 내 날짜) → 있으면 가장 늦은 날짜가 최신
2. `version_label` 파싱 → 시맨틱 버전 (1.0.0 등) 또는 날짜 형식
3. 둘 다 없음 → Review Queue 등록

**사용자 승인이 필요한 경우:**
- 새 버전 `version_date` > 현재 `is_latest` 버전 AND 현재 버전이 Approved/Released

**수용 기준:**
- [ ] 문서 상세에서 모든 버전 이력 표시
- [ ] `is_latest` 배지 명확히 표시
- [ ] 버전 교체 승인 모달 UI
- [ ] **[M4] is_latest 업데이트는 `prisma.$transaction` 필수:** updateMany(is_latest=false) + update(target=true) 원자적 처리. 트랜잭션 미사용 시 크래시 발생 시 모든 버전이 is_latest=false로 남을 위험 (data_model.md Section 6 참조)

---

### F17: 패치노트 후보 관리

> **Week 1 선행 구현.** ChangeCandidate 목록에서 후보를 선택하는 기본 UI. Week 4에서 기간/버전 필터 고도화.

**목적:** 패치노트에 포함할 변경사항을 선택하고 관리

**패치노트 후보 목록 화면:**
- 기간 필터 (기간 또는 버전 범위)
- 카테고리별 그룹화
- 각 항목 선택/해제
- 패치노트 초안 문구 미리보기 및 수정

**수용 기준:**
- [ ] Approved 변경사항 후보 목록 조회
- [ ] 기간/버전 필터
- [ ] 카테고리별 자동 그룹화
- [ ] 개별 항목 선택/해제 및 문구 수정
- [ ] **[I1] PatchNoteCandidate auto-create:** `/patch-notes/new` 진입 + 기간/버전 범위 선택 시 해당 범위의 approved ChangeCandidate별로 PatchNoteCandidate 1:1 자동 생성 (draft_text는 ChangeCandidate.patch_note_draft 복사, is_selected=false 초기값)
- [ ] **pending/rejected ChangeCandidate는 API 레벨에서 거부:** 서버에서 각 candidate_id를 DB에서 재조회하여 review_status='approved'인 경우만 PatchNoteCandidate 생성 (UI 필터 우회 차단)

---

### F18: 패치노트 초안 생성

> **Week 1 선행 구현 (P0 최우선).** 규칙 기반 Markdown 초안은 Week 1 E2E의 마지막 단계. AI 문구 개선은 Week 4(Phase 3)에서 선택적 추가.

**생성 플로우:**
```
1. 기간 또는 버전 선택
2. 해당 범위의 Approved 변경사항 후보 불러오기
3. PM이 포함할 항목 선택
4. 카테고리별 자동 정렬
5. 패치노트 초안 생성 (AI 선택적 호출)
6. PM 검수/수정
7. 자동 발행 없음 (PM이 직접 배포)
```

**패치노트 카테고리:**
- 주요 업데이트 (`major_update`)
- 신규 콘텐츠 (`new_content`)
- 밸런스 조정 (`balance`)
- 시스템 개선 (`system_improvement`)
- 버그 수정 (`bug_fix`)
- 기타 안내 (`notice`)

**출력 형식:**
```markdown
# [게임명] v2.3.0 패치노트
**패치 일자:** 2026-05-XX

## 주요 업데이트
- 영웅 성장 시스템 전면 개편: ...

## 밸런스 조정
- 파이어볼: 피해량 120% → 100%

## 신규 콘텐츠
- 5월 이벤트: ...
```

**수용 기준:**
- [ ] 기간/버전 필터로 변경사항 후보 필터링
- [ ] **API 레벨 강제:** `POST /api/patch-notes` 서버에서 각 candidate_id를 DB에서 재조회하여 `review_status='approved'`인 경우만 PatchNoteItem 생성 (UI 필터만으론 부족)
- [ ] 선택한 항목만 패치노트에 포함
- [ ] 카테고리별 자동 정렬
- [ ] AI 없이도 기본 Markdown 초안 생성
- [ ] AI 사용 시 문구 개선 (선택적 호출)
- [ ] 자동 발행 금지 (PM 최종 수정 후 별도 배포)
- [ ] PatchNote, PatchNoteItem DB 저장
- [ ] Approved 변경사항이 0건일 때 빈 상태 UI 표시 ("승인된 변경사항이 없습니다. Review Queue에서 변경사항을 승인하세요.") + 생성 버튼 비활성화

---

## Phase 3: 완성 + AI 고도화 + E2E 검증 (Week 4)

### F19: 기획서 리뷰 결과 저장

**MVP 범위:** AI Import JSON의 `review_findings` 필드를 파싱하여 DB에 저장

**표시 방법:** 문서 상세 탭에 "리뷰 결과" 탭 추가
- PM 리뷰 / 데이터 리뷰 / QA 리뷰 / BM 리뷰 / 유저 관점 / 운영 리뷰 섹션

**수용 기준:**
- [ ] `review_findings` JSON 파싱하여 `NormalizedDocument.review_findings` 저장
- [ ] 문서 상세에서 리뷰 결과 조회 가능
- [ ] 리뷰 자동화 Agent UI는 Backlog

---

## Non-Negotiable Requirements 검증 매트릭스

| 요건 | 구현 위치 | Phase |
|---|---|---|
| NR1: Raw + AI Import 둘 다 지원 | F01, F11 | 1, 2 |
| NR2: 직접 정제 없이 등록 가능 | F01, F11, F13 | 1, 2 |
| NR3: 원본 파일 보존 | F12 | 2 |
| NR4: 업로드/파싱 실패 분리 | F15 | 2 |
| NR5: JSON Import MVP 핵심 | F01, F02, F03 | 1 |
| NR6: 검색이 메인 진입점 | F05 | 1 |
| NR7: 변경사항 → 패치노트 원천 | F07, F17, F18 | 1 |
| NR8: 패치노트 생성 MVP 포함 | F18 | 1 (Week 1) |
| NR9: 업로드 순서 ≠ 최신 판단 | F16 (버전 로직) | 1 (Week 1) |
| NR10: Approved/Released 교체 = 사용자 승인 | F03, F06, F16 | 1 |
| NR11: 유료 API 기본 자동 호출 금지 | F09 | 1 |
| NR12: 월 예산 0 = 완전 차단 | F09, F10 | 1 |
| NR13: 제외 기능 → Backlog 명시 | feature_coverage_matrix.md | - |
