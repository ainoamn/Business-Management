-- CreateTable
CREATE TABLE "budget_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_events_organization_id_budget_id_created_at_idx" ON "budget_events"("organization_id", "budget_id", "created_at");

-- CreateIndex
CREATE INDEX "expense_events_organization_id_expense_id_created_at_idx" ON "expense_events"("organization_id", "expense_id", "created_at");

-- AddForeignKey
ALTER TABLE "budget_events" ADD CONSTRAINT "budget_events_organization_id_budget_id_fkey" FOREIGN KEY ("organization_id", "budget_id") REFERENCES "operational_budgets"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_events" ADD CONSTRAINT "expense_events_organization_id_expense_id_fkey" FOREIGN KEY ("organization_id", "expense_id") REFERENCES "operational_expenses"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
