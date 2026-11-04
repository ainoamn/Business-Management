-- DropIndex
DROP INDEX "request_approvals_organization_id_request_id_position_key";

-- AlterTable
ALTER TABLE "internal_requests" ADD COLUMN     "approval_round" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "request_approvals" ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "request_approvals_organization_id_request_id_round_position_key" ON "request_approvals"("organization_id", "request_id", "round", "position");

-- The organization/department foreign key already exists from operations integrity.
ALTER TABLE internal_requests ADD CONSTRAINT request_round_nonnegative CHECK(approval_round>=0);
ALTER TABLE request_approvals ADD CONSTRAINT approval_round_positive CHECK(round>0),ADD CONSTRAINT approval_status CHECK(status IN ('PENDING','APPROVED','REJECTED'));
