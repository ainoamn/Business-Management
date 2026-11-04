-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "project_id" UUID,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "source" VARCHAR(10) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_timers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_timers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "department_id" UUID,
    "team_id" UUID,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "location" VARCHAR(300) NOT NULL DEFAULT '',
    "meeting_url" VARCHAR(1000) NOT NULL DEFAULT '',
    "chair_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "approver_id" UUID,
    "agenda" TEXT NOT NULL DEFAULT '',
    "minutes" TEXT NOT NULL DEFAULT '',
    "recommendations" TEXT NOT NULL DEFAULT '',
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "approved_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "organization_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "response" VARCHAR(20) NOT NULL DEFAULT 'INVITED',

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("organization_id","meeting_id","membership_id")
);

-- CreateTable
CREATE TABLE "meeting_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "responsible_id" UUID NOT NULL,
    "due_date" TIMESTAMPTZ(3),
    "task_id" UUID,

    CONSTRAINT "meeting_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "resource_type" VARCHAR(30) NOT NULL,
    "resource_id" UUID NOT NULL,
    "deduplication_key" VARCHAR(200) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminders_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("organization_id","membership_id")
);

-- CreateTable
CREATE TABLE "reminder_deliveries" (
    "organization_id" UUID NOT NULL,
    "resource_type" VARCHAR(30) NOT NULL,
    "resource_id" UUID NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "stage" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_deliveries_pkey" PRIMARY KEY ("organization_id","resource_type","resource_id","due_at","stage")
);

-- CreateTable
CREATE TABLE "internal_request_types" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "fields" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "internal_request_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_type_approval_steps" (
    "organization_id" UUID NOT NULL,
    "request_type_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "approver_id" UUID NOT NULL,

    CONSTRAINT "request_type_approval_steps_pkey" PRIMARY KEY ("organization_id","request_type_id","position")
);

-- CreateTable
CREATE TABLE "internal_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" VARCHAR(64) NOT NULL,
    "request_type_id" UUID NOT NULL,
    "template_snapshot" JSONB NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "answers" JSONB NOT NULL,
    "requester_id" UUID NOT NULL,
    "department_id" UUID,
    "responsible_id" UUID,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "due_date" TIMESTAMPTZ(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "approver_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL DEFAULT '',
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "request_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_budgets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "amount" DECIMAL(18,3) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "operational_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_expenses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "task_id" UUID,
    "budget_id" UUID,
    "title" VARCHAR(180) NOT NULL,
    "supplier" VARCHAR(180) NOT NULL DEFAULT '',
    "category" VARCHAR(80) NOT NULL DEFAULT '',
    "currency" VARCHAR(3) NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "exchange_rate" DECIMAL(20,9) NOT NULL,
    "rate_source" VARCHAR(300) NOT NULL,
    "rate_date" TIMESTAMPTZ(3) NOT NULL,
    "base_currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "base_amount" DECIMAL(18,3) NOT NULL,
    "expense_date" TIMESTAMPTZ(3) NOT NULL,
    "requester_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL DEFAULT '',
    "decided_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_organization_id_membership_id_started_at_idx" ON "time_entries"("organization_id", "membership_id", "started_at");

-- CreateIndex
CREATE INDEX "time_entries_organization_id_task_id_idx" ON "time_entries"("organization_id", "task_id");

-- CreateIndex
CREATE INDEX "time_entries_organization_id_project_id_idx" ON "time_entries"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "active_timers_user_id_key" ON "active_timers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "active_timers_organization_id_membership_id_key" ON "active_timers"("organization_id", "membership_id");

-- CreateIndex
CREATE INDEX "meetings_organization_id_starts_at_idx" ON "meetings"("organization_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_organization_id_id_key" ON "meetings"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_decisions_task_id_key" ON "meeting_decisions"("task_id");

-- CreateIndex
CREATE INDEX "meeting_decisions_organization_id_meeting_id_idx" ON "meeting_decisions"("organization_id", "meeting_id");

-- CreateIndex
CREATE INDEX "work_notifications_organization_id_membership_id_read_at_cr_idx" ON "work_notifications"("organization_id", "membership_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_notifications_organization_id_membership_id_deduplicat_key" ON "work_notifications"("organization_id", "membership_id", "deduplication_key");

-- CreateIndex
CREATE UNIQUE INDEX "internal_request_types_organization_id_id_key" ON "internal_request_types"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "internal_request_types_organization_id_name_key" ON "internal_request_types"("organization_id", "name");

-- CreateIndex
CREATE INDEX "internal_requests_organization_id_requester_id_status_idx" ON "internal_requests"("organization_id", "requester_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "internal_requests_organization_id_id_key" ON "internal_requests"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "internal_requests_organization_id_number_key" ON "internal_requests"("organization_id", "number");

-- CreateIndex
CREATE INDEX "request_approvals_organization_id_approver_id_status_idx" ON "request_approvals"("organization_id", "approver_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "request_approvals_organization_id_request_id_position_key" ON "request_approvals"("organization_id", "request_id", "position");

-- CreateIndex
CREATE INDEX "operational_budgets_organization_id_project_id_idx" ON "operational_budgets"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "operational_budgets_organization_id_id_key" ON "operational_budgets"("organization_id", "id");

-- CreateIndex
CREATE INDEX "operational_expenses_organization_id_project_id_status_idx" ON "operational_expenses"("organization_id", "project_id", "status");

-- CreateIndex
CREATE INDEX "operational_expenses_organization_id_requester_id_status_idx" ON "operational_expenses"("organization_id", "requester_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "operational_expenses_organization_id_id_key" ON "operational_expenses"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_organization_id_meeting_id_fkey" FOREIGN KEY ("organization_id", "meeting_id") REFERENCES "meetings"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_organization_id_meeting_id_fkey" FOREIGN KEY ("organization_id", "meeting_id") REFERENCES "meetings"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_notifications" ADD CONSTRAINT "work_notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_request_types" ADD CONSTRAINT "internal_request_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_type_approval_steps" ADD CONSTRAINT "request_type_approval_steps_organization_id_request_type_i_fkey" FOREIGN KEY ("organization_id", "request_type_id") REFERENCES "internal_request_types"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_requests" ADD CONSTRAINT "internal_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_requests" ADD CONSTRAINT "internal_requests_organization_id_request_type_id_fkey" FOREIGN KEY ("organization_id", "request_type_id") REFERENCES "internal_request_types"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_organization_id_request_id_fkey" FOREIGN KEY ("organization_id", "request_id") REFERENCES "internal_requests"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_budgets" ADD CONSTRAINT "operational_budgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
