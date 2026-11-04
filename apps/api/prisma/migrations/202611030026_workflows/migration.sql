-- AlterTable
ALTER TABLE "platform_plans" ADD COLUMN     "active_workflows" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "automation_runs" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "current_revision_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_revisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "graph" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "project_id" UUID,
    "department_id" UUID,
    "team_id" UUID,
    "hours" DECIMAL(10,3) NOT NULL DEFAULT 24,
    "threshold_percent" DECIMAL(7,3) NOT NULL DEFAULT 20,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "node_key" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "next_key" UUID,
    "yes_key" UUID,
    "no_key" UUID,
    "delay_seconds" INTEGER,

    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_conditions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "node_key" UUID NOT NULL,
    "predicate" JSONB NOT NULL,

    CONSTRAINT "workflow_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_actions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "node_key" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "parameters" JSONB NOT NULL,

    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "resource_type" VARCHAR(20) NOT NULL,
    "resource_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "target_workflow_id" UUID,
    "chain_id" UUID NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "dedupe_key" VARCHAR(200) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_token" UUID,
    "lease_until" TIMESTAMPTZ(3),
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "current_node_key" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "next_run_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_token" UUID,
    "lease_until" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(60),
    "charged" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_execution_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "node_key" UUID,
    "actor_id" UUID,
    "kind" VARCHAR(30) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_action_receipts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "node_key" UUID NOT NULL,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_action_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_monthly_usage" (
    "organization_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "executions" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_monthly_usage_pkey" PRIMARY KEY ("organization_id","period_start")
);

-- CreateIndex
CREATE INDEX "workflows_organization_id_status_idx" ON "workflows"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_organization_id_id_key" ON "workflows"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_revisions_organization_id_id_key" ON "workflow_revisions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_revisions_organization_id_workflow_id_id_key" ON "workflow_revisions"("organization_id", "workflow_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_revisions_organization_id_workflow_id_number_key" ON "workflow_revisions"("organization_id", "workflow_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_triggers_revision_id_key" ON "workflow_triggers"("revision_id");

-- CreateIndex
CREATE INDEX "workflow_triggers_kind_idx" ON "workflow_triggers"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_triggers_organization_id_revision_id_key" ON "workflow_triggers"("organization_id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_nodes_organization_id_revision_id_node_key_key" ON "workflow_nodes"("organization_id", "revision_id", "node_key");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_conditions_organization_id_revision_id_node_key_key" ON "workflow_conditions"("organization_id", "revision_id", "node_key");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_actions_organization_id_revision_id_node_key_key" ON "workflow_actions"("organization_id", "revision_id", "node_key");

-- CreateIndex
CREATE INDEX "workflow_events_status_next_attempt_at_idx" ON "workflow_events"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_events_organization_id_id_key" ON "workflow_events"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_events_organization_id_dedupe_key_key" ON "workflow_events"("organization_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "workflow_runs_status_next_run_at_idx" ON "workflow_runs"("status", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_organization_id_id_key" ON "workflow_runs"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_organization_id_workflow_id_event_id_key" ON "workflow_runs"("organization_id", "workflow_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_organization_id_workflow_id_chain_id_key" ON "workflow_runs"("organization_id", "workflow_id", "chain_id");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_organization_id_run_id_created_at_idx" ON "workflow_execution_logs"("organization_id", "run_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_action_receipts_organization_id_run_id_node_key_key" ON "workflow_action_receipts"("organization_id", "run_id", "node_key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "operational_expenses_budget_status" ON "operational_expenses"("organization_id", "budget_id", "status");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_id_current_revision_id_fkey" FOREIGN KEY ("organization_id", "id", "current_revision_id") REFERENCES "workflow_revisions"("organization_id", "workflow_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_revisions" ADD CONSTRAINT "workflow_revisions_organization_id_workflow_id_fkey" FOREIGN KEY ("organization_id", "workflow_id") REFERENCES "workflows"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_organization_id_revision_id_fkey" FOREIGN KEY ("organization_id", "revision_id") REFERENCES "workflow_revisions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_organization_id_department_id_fkey" FOREIGN KEY ("organization_id", "department_id") REFERENCES "departments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_organization_id_team_id_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_organization_id_revision_id_fkey" FOREIGN KEY ("organization_id", "revision_id") REFERENCES "workflow_revisions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_conditions" ADD CONSTRAINT "workflow_conditions_organization_id_revision_id_node_key_fkey" FOREIGN KEY ("organization_id", "revision_id", "node_key") REFERENCES "workflow_nodes"("organization_id", "revision_id", "node_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_organization_id_revision_id_node_key_fkey" FOREIGN KEY ("organization_id", "revision_id", "node_key") REFERENCES "workflow_nodes"("organization_id", "revision_id", "node_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_organization_id_target_workflow_id_fkey" FOREIGN KEY ("organization_id", "target_workflow_id") REFERENCES "workflows"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_workflow_id_fkey" FOREIGN KEY ("organization_id", "workflow_id") REFERENCES "workflows"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_workflow_id_revision_id_fkey" FOREIGN KEY ("organization_id", "workflow_id", "revision_id") REFERENCES "workflow_revisions"("organization_id", "workflow_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_event_id_fkey" FOREIGN KEY ("organization_id", "event_id") REFERENCES "workflow_events"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_revision_id_current_node_key_fkey" FOREIGN KEY ("organization_id", "revision_id", "current_node_key") REFERENCES "workflow_nodes"("organization_id", "revision_id", "node_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_organization_id_run_id_fkey" FOREIGN KEY ("organization_id", "run_id") REFERENCES "workflow_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_action_receipts" ADD CONSTRAINT "workflow_action_receipts_organization_id_run_id_fkey" FOREIGN KEY ("organization_id", "run_id") REFERENCES "workflow_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_monthly_usage" ADD CONSTRAINT "workflow_monthly_usage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
