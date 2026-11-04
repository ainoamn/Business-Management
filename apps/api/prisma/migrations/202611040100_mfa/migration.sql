-- Add MFA fields to users
ALTER TABLE "users" 
ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfa_secret_enc" TEXT,
ADD COLUMN "mfa_verified_at" TIMESTAMPTZ(3);

-- Add MFA fields to platform_accounts
ALTER TABLE "platform_accounts"
ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfa_secret_enc" TEXT,
ADD COLUMN "mfa_verified_at" TIMESTAMPTZ(3);

-- Create MFA recovery codes table
CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_type" VARCHAR(10) NOT NULL,
    "account_id" UUID NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_recovery_codes_account_type_account_id_idx" ON "mfa_recovery_codes"("account_type", "account_id");
CREATE INDEX "mfa_recovery_codes_code_hash_idx" ON "mfa_recovery_codes"("code_hash");

-- Create pending MFA challenges table
CREATE TABLE "pending_mfa_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_type" VARCHAR(10) NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_mfa_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_mfa_challenges_token_hash_key" ON "pending_mfa_challenges"("token_hash");
CREATE INDEX "pending_mfa_challenges_account_type_account_id_idx" ON "pending_mfa_challenges"("account_type", "account_id");
CREATE INDEX "pending_mfa_challenges_expires_at_idx" ON "pending_mfa_challenges"("expires_at");

-- Extend notification preferences
ALTER TABLE "notification_preferences"
ADD COLUMN "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "push_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Create push subscriptions table
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "endpoint" VARCHAR(1000) NOT NULL,
    "keys_json" TEXT NOT NULL,
    "user_agent" VARCHAR(500) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_organization_id_membership_id_endpoint_key" 
ON "push_subscriptions"("organization_id", "membership_id", "endpoint");

-- Create organization integrations table
CREATE TABLE "organization_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
    "config_enc" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_integrations_organization_id_kind_key" 
ON "organization_integrations"("organization_id", "kind");

-- Add foreign key for organization integrations
ALTER TABLE "organization_integrations" 
ADD CONSTRAINT "organization_integrations_organization_id_fkey" 
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;
