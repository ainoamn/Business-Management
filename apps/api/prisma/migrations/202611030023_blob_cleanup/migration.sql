-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN "upload_request_id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "document_versions" ALTER COLUMN "upload_request_id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "blob_cleanup_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "released" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blob_cleanup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blob_cleanup_jobs_version_id_key" ON "blob_cleanup_jobs"("version_id");

-- CreateIndex
CREATE INDEX "blob_cleanup_jobs_status_next_attempt_at_idx" ON "blob_cleanup_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "blob_cleanup_jobs_organization_id_version_id_key" ON "blob_cleanup_jobs"("organization_id", "version_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_organization_id_id_key" ON "document_versions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_organization_id_upload_request_id_key" ON "document_versions"("organization_id", "upload_request_id");

-- AddForeignKey
ALTER TABLE "blob_cleanup_jobs" ADD CONSTRAINT "blob_cleanup_jobs_organization_id_version_id_fkey" FOREIGN KEY ("organization_id", "version_id") REFERENCES "document_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
