-- CreateTable
CREATE TABLE "document_folders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "owner_id" UUID NOT NULL,
    "project_id" UUID,
    "department_id" UUID,
    "team_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_closure" (
    "organization_id" UUID NOT NULL,
    "ancestor_id" UUID NOT NULL,
    "descendant_id" UUID NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "folder_closure_pkey" PRIMARY KEY ("organization_id","ancestor_id","descendant_id")
);

-- CreateTable
CREATE TABLE "folder_shares" (
    "organization_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "permission" VARCHAR(10) NOT NULL,

    CONSTRAINT "folder_shares_pkey" PRIMARY KEY ("organization_id","folder_id","membership_id")
);

-- CreateTable
CREATE TABLE "work_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "folder_id" UUID,
    "project_id" UUID,
    "department_id" UUID,
    "team_id" UUID,
    "title" VARCHAR(180) NOT NULL,
    "category" VARCHAR(80) NOT NULL DEFAULT '',
    "tags" TEXT[],
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    "confidentiality" VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "current_version_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "filename" VARCHAR(200) NOT NULL,
    "mime" VARCHAR(120) NOT NULL,
    "bytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "object_key" VARCHAR(200) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "scan_status" VARCHAR(20) NOT NULL DEFAULT 'NOT_SCANNED',
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_shares" (
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "permission" VARCHAR(10) NOT NULL,

    CONSTRAINT "document_shares_pkey" PRIMARY KEY ("organization_id","document_id","membership_id")
);

-- CreateTable
CREATE TABLE "document_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "project_id" UUID,
    "task_id" UUID,
    "meeting_id" UUID,
    "request_id" UUID,
    "expense_id" UUID,

    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_storage_usage" (
    "organization_id" UUID NOT NULL,
    "used_bytes" BIGINT NOT NULL DEFAULT 0,
    "reserved_bytes" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_storage_usage_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "document_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_folders_organization_id_parent_id_archived_at_idx" ON "document_folders"("organization_id", "parent_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_folders_organization_id_id_key" ON "document_folders"("organization_id", "id");

-- CreateIndex
CREATE INDEX "folder_closure_organization_id_descendant_id_depth_idx" ON "folder_closure"("organization_id", "descendant_id", "depth");

-- CreateIndex
CREATE INDEX "work_documents_organization_id_folder_id_archived_at_status_idx" ON "work_documents"("organization_id", "folder_id", "archived_at", "status");

-- CreateIndex
CREATE INDEX "work_documents_organization_id_owner_id_idx" ON "work_documents"("organization_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_documents_organization_id_id_key" ON "work_documents"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_object_key_key" ON "document_versions"("object_key");

-- CreateIndex
CREATE INDEX "document_versions_status_created_at_idx" ON "document_versions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_organization_id_document_id_id_key" ON "document_versions"("organization_id", "document_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_organization_id_document_id_number_key" ON "document_versions"("organization_id", "document_id", "number");

-- CreateIndex
CREATE INDEX "document_links_organization_id_task_id_idx" ON "document_links"("organization_id", "task_id");

-- CreateIndex
CREATE INDEX "document_links_organization_id_meeting_id_idx" ON "document_links"("organization_id", "meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_links_organization_id_document_id_project_id_key" ON "document_links"("organization_id", "document_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_links_organization_id_document_id_task_id_key" ON "document_links"("organization_id", "document_id", "task_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_links_organization_id_document_id_meeting_id_key" ON "document_links"("organization_id", "document_id", "meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_links_organization_id_document_id_request_id_key" ON "document_links"("organization_id", "document_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_links_organization_id_document_id_expense_id_key" ON "document_links"("organization_id", "document_id", "expense_id");

-- CreateIndex
CREATE INDEX "document_comments_organization_id_document_id_created_at_idx" ON "document_comments"("organization_id", "document_id", "created_at");

-- CreateIndex
CREATE INDEX "document_events_organization_id_document_id_created_at_idx" ON "document_events"("organization_id", "document_id", "created_at");

-- CreateIndex
CREATE INDEX "folder_events_organization_id_folder_id_created_at_idx" ON "folder_events"("organization_id", "folder_id", "created_at");

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_organization_id_parent_id_fkey" FOREIGN KEY ("organization_id", "parent_id") REFERENCES "document_folders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_organization_id_department_id_fkey" FOREIGN KEY ("organization_id", "department_id") REFERENCES "departments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_organization_id_team_id_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_closure" ADD CONSTRAINT "folder_closure_organization_id_ancestor_id_fkey" FOREIGN KEY ("organization_id", "ancestor_id") REFERENCES "document_folders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_closure" ADD CONSTRAINT "folder_closure_organization_id_descendant_id_fkey" FOREIGN KEY ("organization_id", "descendant_id") REFERENCES "document_folders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_shares" ADD CONSTRAINT "folder_shares_organization_id_folder_id_fkey" FOREIGN KEY ("organization_id", "folder_id") REFERENCES "document_folders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_documents" ADD CONSTRAINT "work_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_documents" ADD CONSTRAINT "work_documents_organization_id_folder_id_fkey" FOREIGN KEY ("organization_id", "folder_id") REFERENCES "document_folders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_documents" ADD CONSTRAINT "work_documents_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_documents" ADD CONSTRAINT "work_documents_organization_id_department_id_fkey" FOREIGN KEY ("organization_id", "department_id") REFERENCES "departments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_documents" ADD CONSTRAINT "work_documents_organization_id_team_id_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_documents" ADD CONSTRAINT "document_current_version" FOREIGN KEY ("organization_id", "id", "current_version_id") REFERENCES "document_versions"("organization_id", "document_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "work_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "work_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "work_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_meeting_id_fkey" FOREIGN KEY ("organization_id", "meeting_id") REFERENCES "meetings"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_request_id_fkey" FOREIGN KEY ("organization_id", "request_id") REFERENCES "internal_requests"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_expense_id_fkey" FOREIGN KEY ("organization_id", "expense_id") REFERENCES "operational_expenses"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_storage_usage" ADD CONSTRAINT "organization_storage_usage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "work_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "work_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_events" ADD CONSTRAINT "folder_events_organization_id_folder_id_fkey" FOREIGN KEY ("organization_id", "folder_id") REFERENCES "document_folders"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
