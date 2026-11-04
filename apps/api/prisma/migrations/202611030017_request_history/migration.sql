-- CreateTable
CREATE TABLE "internal_request_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_request_events_organization_id_request_id_created__idx" ON "internal_request_events"("organization_id", "request_id", "created_at");

-- AddForeignKey
ALTER TABLE "internal_request_events" ADD CONSTRAINT "internal_request_events_organization_id_request_id_fkey" FOREIGN KEY ("organization_id", "request_id") REFERENCES "internal_requests"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
