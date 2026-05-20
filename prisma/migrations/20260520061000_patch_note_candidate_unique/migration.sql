-- DropIndex
DROP INDEX IF EXISTS "PatchNoteCandidate_change_candidate_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "PatchNoteCandidate_change_candidate_id_key" ON "PatchNoteCandidate"("change_candidate_id");
