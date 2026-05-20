-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('system_spec', 'character_spec', 'skill_spec', 'bm_spec', 'event_spec', 'balance_spec', 'patch_note', 'meeting_note', 'ux_spec', 'economy_spec', 'etc');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('draft', 'review', 'approved', 'released', 'deprecated', 'unknown');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('pdf', 'pptx', 'docx', 'xlsx', 'csv', 'txt', 'md', 'image', 'url', 'json', 'other');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('pending', 'success', 'partial', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('add', 'modify', 'remove', 'clarify');

-- CreateEnum
CREATE TYPE "PatchNoteCategory" AS ENUM ('major_update', 'new_content', 'balance', 'system_improvement', 'bug_fix', 'notice');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'deferred');

-- CreateEnum
CREATE TYPE "ReviewIssueType" AS ENUM ('low_confidence', 'conflict', 'version_conflict', 'status_conflict', 'no_version', 'date_conflict', 'duplicate_hash', 'unknown_doc_type');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('raw_upload', 'ai_import', 'manual');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('openai', 'claude', 'gemini', 'local', 'none');

-- CreateEnum
CREATE TYPE "PatchNoteStatus" AS ENUM ('draft', 'review', 'released');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "doc_type" "DocType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_label" TEXT,
    "version_date" TIMESTAMP(3),
    "version_hash" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'unknown',
    "is_latest" BOOLEAN NOT NULL DEFAULT false,
    "import_mode" "ImportMode" NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawSource" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "file_hash" TEXT NOT NULL,
    "upload_status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "parse_status" "ParseStatus" NOT NULL DEFAULT 'pending',
    "parse_error" TEXT,
    "parse_warning" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedText" (
    "id" TEXT NOT NULL,
    "raw_source_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "extraction_method" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "page_count" INTEGER,
    "char_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizedDocument" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "doc_type" "DocType" NOT NULL,
    "category" TEXT,
    "summary" TEXT,
    "review_findings" JSONB,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_provider" "AIProvider",
    "ai_model" TEXT,
    "ai_cost_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormalizedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignItem" (
    "id" TEXT NOT NULL,
    "normalized_doc_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeCandidate" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "design_item_id" TEXT,
    "change_type" "ChangeType" NOT NULL,
    "change_description" TEXT NOT NULL,
    "patch_note_draft" TEXT,
    "category" "PatchNoteCategory",
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchNoteCandidate" (
    "id" TEXT NOT NULL,
    "change_candidate_id" TEXT NOT NULL,
    "draft_text" TEXT NOT NULL,
    "category" "PatchNoteCategory" NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatchNoteCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQueueItem" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT,
    "change_candidate_id" TEXT,
    "issue_type" "ReviewIssueType" NOT NULL,
    "description" TEXT NOT NULL,
    "auto_suggestion" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "release_version" TEXT NOT NULL,
    "patch_date" TIMESTAMP(3),
    "status" "PatchNoteStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatchNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchNoteItem" (
    "id" TEXT NOT NULL,
    "patch_note_id" TEXT NOT NULL,
    "patch_note_candidate_id" TEXT,
    "category" "PatchNoteCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatchNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT,
    "event_type" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "file_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTag" (
    "document_version_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "DocumentTag_pkey" PRIMARY KEY ("document_version_id","tag_id")
);

-- CreateTable
CREATE TABLE "AIBudgetConfig" (
    "id" TEXT NOT NULL,
    "monthly_budget_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "current_month_spend" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "budget_month" TEXT NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "alert_threshold_pct" INTEGER NOT NULL DEFAULT 80,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIBudgetConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentVersion_document_id_idx" ON "DocumentVersion"("document_id");

-- CreateIndex
CREATE INDEX "DocumentVersion_document_id_is_latest_idx" ON "DocumentVersion"("document_id", "is_latest");

-- CreateIndex
CREATE INDEX "DocumentVersion_version_hash_idx" ON "DocumentVersion"("version_hash");

-- CreateIndex
CREATE INDEX "DocumentVersion_status_idx" ON "DocumentVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RawSource_document_version_id_key" ON "RawSource"("document_version_id");

-- CreateIndex
CREATE INDEX "RawSource_file_hash_idx" ON "RawSource"("file_hash");

-- CreateIndex
CREATE INDEX "RawSource_upload_status_idx" ON "RawSource"("upload_status");

-- CreateIndex
CREATE INDEX "RawSource_parse_status_idx" ON "RawSource"("parse_status");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizedDocument_document_version_id_key" ON "NormalizedDocument"("document_version_id");

-- CreateIndex
CREATE INDEX "ChangeCandidate_review_status_idx" ON "ChangeCandidate"("review_status");

-- CreateIndex
CREATE INDEX "ChangeCandidate_document_version_id_idx" ON "ChangeCandidate"("document_version_id");

-- CreateIndex
CREATE INDEX "PatchNoteCandidate_change_candidate_id_idx" ON "PatchNoteCandidate"("change_candidate_id");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_status_idx" ON "ReviewQueueItem"("status");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_issue_type_idx" ON "ReviewQueueItem"("issue_type");

-- CreateIndex
CREATE INDEX "PatchNoteItem_patch_note_id_category_idx" ON "PatchNoteItem"("patch_note_id", "category");

-- CreateIndex
CREATE INDEX "AIUsageLog_provider_idx" ON "AIUsageLog"("provider");

-- CreateIndex
CREATE INDEX "AIUsageLog_created_at_idx" ON "AIUsageLog"("created_at");

-- CreateIndex
CREATE INDEX "AIUsageLog_file_hash_idx" ON "AIUsageLog"("file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSource" ADD CONSTRAINT "RawSource_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedText" ADD CONSTRAINT "ExtractedText_raw_source_id_fkey" FOREIGN KEY ("raw_source_id") REFERENCES "RawSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizedDocument" ADD CONSTRAINT "NormalizedDocument_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignItem" ADD CONSTRAINT "DesignItem_normalized_doc_id_fkey" FOREIGN KEY ("normalized_doc_id") REFERENCES "NormalizedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeCandidate" ADD CONSTRAINT "ChangeCandidate_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeCandidate" ADD CONSTRAINT "ChangeCandidate_design_item_id_fkey" FOREIGN KEY ("design_item_id") REFERENCES "DesignItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchNoteCandidate" ADD CONSTRAINT "PatchNoteCandidate_change_candidate_id_fkey" FOREIGN KEY ("change_candidate_id") REFERENCES "ChangeCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_change_candidate_id_fkey" FOREIGN KEY ("change_candidate_id") REFERENCES "ChangeCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchNoteItem" ADD CONSTRAINT "PatchNoteItem_patch_note_id_fkey" FOREIGN KEY ("patch_note_id") REFERENCES "PatchNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchNoteItem" ADD CONSTRAINT "PatchNoteItem_patch_note_candidate_id_fkey" FOREIGN KEY ("patch_note_candidate_id") REFERENCES "PatchNoteCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTag" ADD CONSTRAINT "DocumentTag_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTag" ADD CONSTRAINT "DocumentTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
