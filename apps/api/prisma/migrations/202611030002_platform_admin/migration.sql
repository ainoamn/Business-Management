-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disabled_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "suspended_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "platform_roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "permissions" TEXT[],

    CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "disabled_at" TIMESTAMPTZ(3),
    "role_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "platform_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_login_attempts" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "resource" VARCHAR(80) NOT NULL,
    "resource_id" UUID,
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "price" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "max_seats" INTEGER NOT NULL,
    "storage_mb" INTEGER NOT NULL,
    "ai_credits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "seats" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" VARCHAR(80) NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ledger_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID,
    "reference" VARCHAR(100) NOT NULL,
    "direction" VARCHAR(8) NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "note" VARCHAR(500) NOT NULL,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" VARCHAR(10) NOT NULL DEFAULT 'main',
    "platform_name" VARCHAR(120) NOT NULL,
    "support_email" VARCHAR(254) NOT NULL,
    "footer_text" VARCHAR(300) NOT NULL,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "public_pages_enabled" BOOLEAN NOT NULL DEFAULT true,
    "session_minutes" INTEGER NOT NULL DEFAULT 60,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_roles_name_key" ON "platform_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_email_key" ON "platform_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_sessions_token_hash_key" ON "platform_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "platform_sessions_account_id_expires_at_idx" ON "platform_sessions"("account_id", "expires_at");

-- CreateIndex
CREATE INDEX "platform_login_attempts_key_created_at_idx" ON "platform_login_attempts"("key", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_created_at_idx" ON "platform_audit"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_plans_name_key" ON "platform_plans"("name");

-- CreateIndex
CREATE INDEX "platform_subscriptions_organization_id_status_idx" ON "platform_subscriptions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_invoices_number_key" ON "platform_invoices"("number");

-- CreateIndex
CREATE INDEX "platform_invoices_organization_id_status_idx" ON "platform_invoices"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_ledger_entries_reference_key" ON "platform_ledger_entries"("reference");

-- CreateIndex
CREATE INDEX "platform_ledger_entries_organization_id_created_at_idx" ON "platform_ledger_entries"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_pages_slug_key" ON "platform_pages"("slug");

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_sessions" ADD CONSTRAINT "platform_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_ledger_entries" ADD CONSTRAINT "platform_ledger_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_ledger_entries" ADD CONSTRAINT "platform_ledger_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "platform_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE platform_accounts ADD CONSTRAINT platform_email_normalized CHECK(email=lower(trim(email)));
ALTER TABLE platform_plans ADD CONSTRAINT platform_plan_limits CHECK(price>=0 AND max_seats>0 AND storage_mb>=0 AND ai_credits>=0 AND currency='OMR');
ALTER TABLE platform_subscriptions ADD CONSTRAINT platform_subscription_state CHECK(status IN ('TRIAL','ACTIVE','PAST_DUE','CANCELED') AND seats>0 AND unit_price>=0);
CREATE UNIQUE INDEX platform_single_live_subscription ON platform_subscriptions(organization_id) WHERE status IN ('TRIAL','ACTIVE','PAST_DUE');
ALTER TABLE platform_invoices ADD CONSTRAINT platform_invoice_values CHECK(amount>0 AND currency='OMR' AND status IN ('ISSUED','PAID','VOID'));
ALTER TABLE platform_ledger_entries ADD CONSTRAINT platform_ledger_values CHECK(amount>0 AND currency='OMR' AND direction IN ('IN','OUT'));
ALTER TABLE platform_pages ADD CONSTRAINT platform_page_status CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_limits CHECK(id='main' AND session_minutes BETWEEN 15 AND 480);

GRANT SELECT,INSERT,UPDATE ON platform_accounts,platform_roles,platform_sessions,platform_login_attempts,platform_plans,platform_subscriptions,platform_invoices,platform_pages,platform_settings TO work_app;
GRANT SELECT,INSERT ON platform_audit,platform_ledger_entries TO work_app;
-- No DELETE grants for administrative data; audit and ledger are append-only.

CREATE FUNCTION platform_can(permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.platform_accounts a LEFT JOIN public.platform_roles r ON r.id=a.role_id
    WHERE a.id=NULLIF(current_setting('app.platform_account_id',true),'')::uuid AND a.disabled_at IS NULL
      AND (a.is_owner OR permission=ANY(r.permissions)))
$$;
REVOKE ALL ON FUNCTION platform_can(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_can(text) TO work_app;

CREATE FUNCTION platform_list_organizations(term text, page_size int, page_offset int)
RETURNS TABLE(id uuid,name varchar,slug varchar,suspended_at timestamptz,created_at timestamptz,total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT public.platform_can('organizations.read') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT o.id,o.name,o.slug,o.suspended_at,o.created_at,count(*) OVER() FROM public.organizations o
    WHERE o.deleted_at IS NULL AND (strpos(lower(o.name),lower(term))>0 OR strpos(lower(o.slug),lower(term))>0)
    ORDER BY o.created_at DESC,o.id LIMIT least(greatest(page_size,1),100) OFFSET greatest(page_offset,0);
END $$;
REVOKE ALL ON FUNCTION platform_list_organizations(text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_list_organizations(text,int,int) TO work_app;

CREATE FUNCTION platform_organization_count() RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT public.platform_can('overview.read') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
  RETURN (SELECT count(*) FROM public.organizations WHERE deleted_at IS NULL);
END $$;
REVOKE ALL ON FUNCTION platform_organization_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_organization_count() TO work_app;

CREATE FUNCTION platform_organization_exists(target uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT public.platform_can('subscriptions.manage') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
  RETURN EXISTS(SELECT 1 FROM public.organizations WHERE id=target AND deleted_at IS NULL AND suspended_at IS NULL);
END $$;
REVOKE ALL ON FUNCTION platform_organization_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_organization_exists(uuid) TO work_app;

CREATE FUNCTION platform_suspend_organization(target uuid, suspended boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE changed uuid;
BEGIN
  IF NOT public.platform_can('organizations.manage') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
  UPDATE public.organizations SET suspended_at=CASE WHEN suspended THEN now() ELSE NULL END WHERE id=target AND deleted_at IS NULL RETURNING id INTO changed;
  RETURN changed;
END $$;
REVOKE ALL ON FUNCTION platform_suspend_organization(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_suspend_organization(uuid,boolean) TO work_app;
-- Platform metadata operations deliberately expose no tenant content.
