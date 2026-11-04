-- Add AI tables only. Existing hand-written tenant/actor constraints are retained.
CREATE TABLE "ai_providers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "endpoint_hash" VARCHAR(64) NOT NULL,
    "endpoint_host" VARCHAR(253) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "monthly_budget_usd" DECIMAL(18,9) NOT NULL,
    "max_concurrent" INTEGER NOT NULL DEFAULT 4,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "identifier" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "input_price_usd" DECIMAL(18,9) NOT NULL,
    "cached_input_price_usd" DECIMAL(18,9) NOT NULL,
    "output_price_usd" DECIMAL(18,9) NOT NULL,
    "credits_per_thousand_tokens" INTEGER NOT NULL DEFAULT 1,
    "max_output_tokens" INTEGER NOT NULL DEFAULT 2048,
    "max_input_bytes" INTEGER NOT NULL DEFAULT 32768,
    "price_source" VARCHAR(500) NOT NULL,
    "price_date" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_prompts" (
    "kind" VARCHAR(30) NOT NULL,
    "active_version_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("kind")
);

CREATE TABLE "ai_prompt_versions" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "revision" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_organization_settings" (
    "organization_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "preferred_model_id" UUID,
    "allowed_model_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "consented_provider_hashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "monthly_spend_limit_usd" DECIMAL(18,9),
    "member_daily_credits" INTEGER,
    "consent_by_id" UUID,
    "consented_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_organization_settings_pkey" PRIMARY KEY ("organization_id")
);

CREATE TABLE "ai_monthly_usage" (
    "organization_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "plan_used" INTEGER NOT NULL DEFAULT 0,
    "reserved_plan" INTEGER NOT NULL DEFAULT 0,
    "used_credits" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "cached_input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(24,9) NOT NULL DEFAULT 0,
    "reserved_usd" DECIMAL(24,9) NOT NULL DEFAULT 0,

    CONSTRAINT "ai_monthly_usage_pkey" PRIMARY KEY ("organization_id","period_start")
);

CREATE TABLE "ai_wallets" (
    "organization_id" UUID NOT NULL,
    "available_extra" INTEGER NOT NULL DEFAULT 0,
    "reserved_extra" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ai_wallets_pkey" PRIMARY KEY ("organization_id")
);

CREATE TABLE "ai_credit_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credits" INTEGER NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "reference" VARCHAR(120) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "request_id" UUID,
    "platform_actor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credit_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "erased_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "client_key" UUID NOT NULL,
    "input_hash" VARCHAR(64) NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "purpose" VARCHAR(30) NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "model_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "provider_version" INTEGER NOT NULL,
    "model_version" INTEGER NOT NULL,
    "model_identifier" VARCHAR(160) NOT NULL,
    "model_name" VARCHAR(120) NOT NULL,
    "provider_name" VARCHAR(120) NOT NULL,
    "endpoint_hash" VARCHAR(64) NOT NULL,
    "prompt_version_id" UUID,
    "prompt_label" VARCHAR(80) NOT NULL,
    "context_manifest" JSONB NOT NULL,
    "context_spec" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "provider_period_start" TIMESTAMPTZ(3) NOT NULL,
    "reserved_plan" INTEGER NOT NULL,
    "reserved_extra" INTEGER NOT NULL,
    "reserved_usd" DECIMAL(18,9) NOT NULL,
    "max_input_tokens" INTEGER NOT NULL,
    "max_output_tokens" INTEGER NOT NULL,
    "credit_multiplier" INTEGER NOT NULL,
    "input_price_usd" DECIMAL(18,9) NOT NULL,
    "cached_input_price_usd" DECIMAL(18,9) NOT NULL,
    "output_price_usd" DECIMAL(18,9) NOT NULL,
    "charged_credits" INTEGER,
    "input_tokens" INTEGER,
    "cached_input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_usd" DECIMAL(18,9),
    "provider_response_id" VARCHAR(200),
    "error_code" VARCHAR(60),
    "lease_token" UUID,
    "lease_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "role" VARCHAR(12) NOT NULL,
    "body" TEXT NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_drafts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "proposal" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "task_id" UUID,
    "project_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_provider_monthly_usage" (
    "provider_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "cost_usd" DECIMAL(24,9) NOT NULL DEFAULT 0,
    "reserved_usd" DECIMAL(24,9) NOT NULL DEFAULT 0,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ai_provider_monthly_usage_pkey" PRIMARY KEY ("provider_id","period_start")
);

CREATE TABLE "ai_audit" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID,
    "request_id" UUID,
    "action" VARCHAR(40) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_providers_name_key" ON "ai_providers"("name");

CREATE UNIQUE INDEX "ai_models_id_provider_id_key" ON "ai_models"("id", "provider_id");

CREATE UNIQUE INDEX "ai_models_provider_id_identifier_key" ON "ai_models"("provider_id", "identifier");

CREATE UNIQUE INDEX "ai_prompts_active_version_id_key" ON "ai_prompts"("active_version_id");

CREATE UNIQUE INDEX "ai_prompts_kind_active_version_id_key" ON "ai_prompts"("kind", "active_version_id");

CREATE UNIQUE INDEX "ai_prompt_versions_kind_id_key" ON "ai_prompt_versions"("kind", "id");

CREATE UNIQUE INDEX "ai_prompt_versions_kind_revision_key" ON "ai_prompt_versions"("kind", "revision");

CREATE UNIQUE INDEX "ai_credit_entries_organization_id_reference_key" ON "ai_credit_entries"("organization_id", "reference");

CREATE UNIQUE INDEX "ai_credit_entries_organization_id_request_id_key" ON "ai_credit_entries"("organization_id", "request_id");

CREATE INDEX "ai_conversations_organization_id_membership_id_created_at_idx" ON "ai_conversations"("organization_id", "membership_id", "created_at");

CREATE UNIQUE INDEX "ai_conversations_organization_id_id_key" ON "ai_conversations"("organization_id", "id");

CREATE UNIQUE INDEX "ai_conversations_organization_id_id_membership_id_key" ON "ai_conversations"("organization_id", "id", "membership_id");

CREATE INDEX "ai_requests_status_lease_until_idx" ON "ai_requests"("status", "lease_until");

CREATE INDEX "ai_requests_organization_id_membership_id_created_at_idx" ON "ai_requests"("organization_id", "membership_id", "created_at");

CREATE UNIQUE INDEX "ai_requests_organization_id_id_key" ON "ai_requests"("organization_id", "id");

CREATE UNIQUE INDEX "ai_requests_organization_id_id_membership_id_key" ON "ai_requests"("organization_id", "id", "membership_id");

CREATE UNIQUE INDEX "ai_requests_organization_id_id_conversation_id_key" ON "ai_requests"("organization_id", "id", "conversation_id");

CREATE UNIQUE INDEX "ai_requests_organization_id_membership_id_client_key_key" ON "ai_requests"("organization_id", "membership_id", "client_key");

CREATE INDEX "ai_messages_organization_id_conversation_id_created_at_idx" ON "ai_messages"("organization_id", "conversation_id", "created_at");

CREATE UNIQUE INDEX "ai_messages_organization_id_request_id_role_key" ON "ai_messages"("organization_id", "request_id", "role");

CREATE INDEX "ai_drafts_organization_id_membership_id_status_idx" ON "ai_drafts"("organization_id", "membership_id", "status");

CREATE UNIQUE INDEX "ai_drafts_organization_id_id_key" ON "ai_drafts"("organization_id", "id");

CREATE UNIQUE INDEX "ai_drafts_organization_id_request_id_position_key" ON "ai_drafts"("organization_id", "request_id", "position");

CREATE INDEX "ai_audit_organization_id_created_at_idx" ON "ai_audit"("organization_id", "created_at");

CREATE UNIQUE INDEX "memberships_organization_id_id_user_id_key" ON "memberships"("organization_id", "id", "user_id");

CREATE UNIQUE INDEX "user_sessions_id_user_id_key" ON "user_sessions"("id", "user_id");

ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_kind_active_version_id_fkey" FOREIGN KEY ("kind", "active_version_id") REFERENCES "ai_prompt_versions"("kind", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_kind_fkey" FOREIGN KEY ("kind") REFERENCES "ai_prompts"("kind") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_organization_settings" ADD CONSTRAINT "ai_organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_organization_settings" ADD CONSTRAINT "ai_organization_settings_preferred_model_id_fkey" FOREIGN KEY ("preferred_model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_organization_settings" ADD CONSTRAINT "ai_organization_settings_organization_id_consent_by_id_fkey" FOREIGN KEY ("organization_id", "consent_by_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_monthly_usage" ADD CONSTRAINT "ai_monthly_usage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_wallets" ADD CONSTRAINT "ai_wallets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_credit_entries" ADD CONSTRAINT "ai_credit_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_credit_entries" ADD CONSTRAINT "ai_credit_entries_organization_id_request_id_fkey" FOREIGN KEY ("organization_id", "request_id") REFERENCES "ai_requests"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_credit_entries" ADD CONSTRAINT "ai_credit_entries_platform_actor_id_fkey" FOREIGN KEY ("platform_actor_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_organization_id_membership_id_user_id_fkey" FOREIGN KEY ("organization_id", "membership_id", "user_id") REFERENCES "memberships"("organization_id", "id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_session_id_user_id_fkey" FOREIGN KEY ("session_id", "user_id") REFERENCES "user_sessions"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_organization_id_conversation_id_membership_id_fkey" FOREIGN KEY ("organization_id", "conversation_id", "membership_id") REFERENCES "ai_conversations"("organization_id", "id", "membership_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_model_id_provider_id_fkey" FOREIGN KEY ("model_id", "provider_id") REFERENCES "ai_models"("id", "provider_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_organization_id_period_start_fkey" FOREIGN KEY ("organization_id", "period_start") REFERENCES "ai_monthly_usage"("organization_id", "period_start") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_provider_id_provider_period_start_fkey" FOREIGN KEY ("provider_id", "provider_period_start") REFERENCES "ai_provider_monthly_usage"("provider_id", "period_start") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_organization_id_conversation_id_membership_id_fkey" FOREIGN KEY ("organization_id", "conversation_id", "membership_id") REFERENCES "ai_conversations"("organization_id", "id", "membership_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_organization_id_request_id_conversation_id_fkey" FOREIGN KEY ("organization_id", "request_id", "conversation_id") REFERENCES "ai_requests"("organization_id", "id", "conversation_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_organization_id_request_id_membership_id_fkey" FOREIGN KEY ("organization_id", "request_id", "membership_id") REFERENCES "ai_requests"("organization_id", "id", "membership_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_organization_id_task_id_fkey" FOREIGN KEY ("organization_id", "task_id") REFERENCES "tasks"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "projects"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ai_provider_monthly_usage" ADD CONSTRAINT "ai_provider_monthly_usage_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_audit" ADD CONSTRAINT "ai_audit_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_audit" ADD CONSTRAINT "ai_audit_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_audit" ADD CONSTRAINT "ai_audit_organization_id_request_id_fkey" FOREIGN KEY ("organization_id", "request_id") REFERENCES "ai_requests"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
