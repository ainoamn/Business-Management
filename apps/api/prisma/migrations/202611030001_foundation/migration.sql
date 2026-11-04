-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Muscat',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(40) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "resource_type" VARCHAR(80) NOT NULL,
    "resource_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "memberships_user_id_active_idx" ON "memberships"("user_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Normalized identifiers prevent case-variant duplicate accounts.
ALTER TABLE users ADD CONSTRAINT users_email_normalized CHECK (email = lower(trim(email)));
ALTER TABLE organizations ADD CONSTRAINT organizations_locale CHECK (locale IN ('ar', 'en'));
ALTER TABLE memberships ADD CONSTRAINT membership_role CHECK (role IN (
  'ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'GENERAL_MANAGER', 'DEPARTMENT_MANAGER',
  'PROJECT_MANAGER', 'TEAM_LEADER', 'EMPLOYEE', 'ACCOUNTANT', 'REQUESTER',
  'EXTERNAL_CLIENT', 'AUDITOR', 'GUEST'
));

GRANT SELECT, INSERT, UPDATE, DELETE ON users, user_sessions TO work_app;
GRANT SELECT ON organizations, memberships TO work_app;
GRANT SELECT, INSERT ON audit_logs TO work_app;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Missing context evaluates to NULL and grants no access. Membership policies do
-- not query organizations, avoiding recursive RLS policy evaluation.
CREATE POLICY membership_self ON memberships FOR SELECT TO work_app USING (
  user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  AND active
);
CREATE POLICY organization_member ON organizations FOR SELECT TO work_app USING (
  id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  AND deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = organizations.id)
);
CREATE POLICY audit_member_read ON audit_logs FOR SELECT TO work_app USING (
  organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  AND EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = audit_logs.organization_id)
);
CREATE POLICY audit_actor_insert ON audit_logs FOR INSERT TO work_app WITH CHECK (
  organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  AND actor_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = audit_logs.organization_id)
);
