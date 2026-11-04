-- CreateTable
CREATE TABLE "work_counters" (
    "organization_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_counters_pkey" PRIMARY KEY ("organization_id","kind")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" VARCHAR(64) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "branch_id" UUID,
    "department_id" UUID,
    "team_id" UUID,
    "manager_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "client" VARCHAR(180) NOT NULL DEFAULT '',
    "category" VARCHAR(80) NOT NULL DEFAULT '',
    "status" VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "start_date" TIMESTAMPTZ(3),
    "end_date" TIMESTAMPTZ(3),
    "budget" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("organization_id","project_id","membership_id")
);

-- CreateTable
CREATE TABLE "project_phases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "due_date" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_risks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "likelihood" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "mitigation" TEXT NOT NULL DEFAULT '',
    "owner_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "project_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_statuses" (
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("organization_id","key")
);

-- CreateTable
CREATE TABLE "task_transitions" (
    "organization_id" UUID NOT NULL,
    "from_status" VARCHAR(40) NOT NULL,
    "to_status" VARCHAR(40) NOT NULL,
    "permission" VARCHAR(60) NOT NULL,

    CONSTRAINT "task_transitions_pkey" PRIMARY KEY ("organization_id","from_status","to_status")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" VARCHAR(64) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "department_id" UUID,
    "team_id" UUID,
    "project_id" UUID,
    "phase_id" UUID,
    "parent_task_id" UUID,
    "created_by_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "reviewer_id" UUID,
    "approver_id" UUID,
    "start_date" TIMESTAMPTZ(3),
    "due_date" TIMESTAMPTZ(3),
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "status" VARCHAR(40) NOT NULL DEFAULT 'NEW',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "estimated_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cost_estimate" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "category" VARCHAR(80) NOT NULL DEFAULT '',
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    "confidentiality" VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    "recurrence" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "recurrence_until" TIMESTAMPTZ(3),
    "reviewed_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_participants" (
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,

    CONSTRAINT "task_participants_pkey" PRIMARY KEY ("organization_id","task_id","membership_id")
);

-- CreateTable
CREATE TABLE "task_checklist_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "predecessor_id" UUID NOT NULL,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("organization_id","task_id","predecessor_id")
);

-- CreateTable
CREATE TABLE "task_changes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_organization_id_archived_at_status_end_date_idx" ON "projects"("organization_id", "archived_at", "status", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_id_key" ON "projects"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_number_key" ON "projects"("organization_id", "number");

-- CreateIndex
CREATE INDEX "project_phases_organization_id_project_id_position_idx" ON "project_phases"("organization_id", "project_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "project_phases_organization_id_id_key" ON "project_phases"("organization_id", "id");

-- CreateIndex
CREATE INDEX "project_milestones_organization_id_project_id_due_date_idx" ON "project_milestones"("organization_id", "project_id", "due_date");

-- CreateIndex
CREATE INDEX "project_risks_organization_id_project_id_idx" ON "project_risks"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "project_decisions_organization_id_project_id_created_at_idx" ON "project_decisions"("organization_id", "project_id", "created_at");

-- CreateIndex
CREATE INDEX "tasks_organization_id_archived_at_status_due_date_idx" ON "tasks"("organization_id", "archived_at", "status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_organization_id_assigned_to_id_status_idx" ON "tasks"("organization_id", "assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "tasks_organization_id_project_id_idx" ON "tasks"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_id_key" ON "tasks"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_number_key" ON "tasks"("organization_id", "number");

-- CreateIndex
CREATE INDEX "task_checklist_items_organization_id_task_id_position_idx" ON "task_checklist_items"("organization_id", "task_id", "position");

-- CreateIndex
CREATE INDEX "task_comments_organization_id_task_id_created_at_idx" ON "task_comments"("organization_id", "task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_changes_organization_id_task_id_created_at_idx" ON "task_changes"("organization_id", "task_id", "created_at");

-- AddForeignKey
ALTER TABLE "work_counters" ADD CONSTRAINT "work_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_decisions" ADD CONSTRAINT "project_decisions_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transitions" ADD CONSTRAINT "task_transitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_participants" ADD CONSTRAINT "task_participants_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_organization_id_predecessor_id_fkey" FOREIGN KEY ("organization_id", "predecessor_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_changes" ADD CONSTRAINT "task_changes_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
