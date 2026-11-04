BEGIN;
CREATE TABLE billing_settings(
 id varchar(20) PRIMARY KEY DEFAULT 'main',free_plan_id uuid REFERENCES platform_plans(id) ON DELETE RESTRICT ON UPDATE CASCADE,trial_plan_id uuid REFERENCES platform_plans(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 trial_seats integer NOT NULL DEFAULT 3,manual_payments_enabled boolean NOT NULL DEFAULT false,payment_instructions varchar(4000) NOT NULL DEFAULT '',support_email varchar(254) NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,
 created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT billing_settings_values CHECK(id='main' AND trial_seats BETWEEN 1 AND 1000 AND version>0 AND (NOT manual_payments_enabled OR length(trim(payment_instructions))>=10 AND length(support_email)>3))
);
CREATE TABLE billing_coupons(
 id uuid PRIMARY KEY,code varchar(40) NOT NULL UNIQUE,name varchar(120) NOT NULL,kind varchar(10) NOT NULL,basis_points integer,amount numeric(12,3),starts_at timestamptz(3) NOT NULL,ends_at timestamptz(3) NOT NULL,max_uses integer NOT NULL,per_organization integer NOT NULL,allowed_plan_ids uuid[] NOT NULL,
 redeemed_count integer NOT NULL DEFAULT 0,reserved_count integer NOT NULL DEFAULT 0,active boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_by_id uuid NOT NULL REFERENCES platform_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT billing_coupon_values CHECK(code ~ '^[A-Z0-9_-]{3,40}$' AND ends_at>starts_at AND max_uses BETWEEN 1 AND 100000000 AND per_organization BETWEEN 1 AND 1000 AND cardinality(allowed_plan_ids)<=100 AND version>0 AND redeemed_count>=0 AND reserved_count>=0 AND redeemed_count::bigint+reserved_count::bigint<=max_uses
 AND (kind='PERCENT' AND basis_points BETWEEN 1 AND 10000 AND amount IS NULL OR kind='FIXED' AND basis_points IS NULL AND amount>0))
);
CREATE INDEX billing_coupons_active_ends_at_idx ON billing_coupons(active,ends_at);
CREATE FUNCTION billing_platform_can(permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT permission IN ('billing.read','billing.manage','coupons.read','coupons.manage','payments.read','payments.manage','plans.read','plans.manage','subscriptions.read','subscriptions.manage','invoices.read','invoices.manage','ledger.read','ledger.manage') AND EXISTS(
 SELECT 1 FROM public.platform_accounts a JOIN public.platform_sessions s ON s.account_id=a.id LEFT JOIN public.platform_roles r ON r.id=a.role_id WHERE a.id=NULLIF(current_setting('app.platform_account_id',true),'')::uuid AND s.id=NULLIF(current_setting('app.platform_session_id',true),'')::uuid AND a.disabled_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>now() AND (a.is_owner OR permission=ANY(r.permissions)))
$$;
REVOKE ALL ON FUNCTION billing_platform_can(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_platform_can(text) TO work_app;
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;ALTER TABLE billing_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_settings_read ON billing_settings FOR SELECT USING(true);
CREATE POLICY billing_settings_insert ON billing_settings FOR INSERT WITH CHECK(billing_platform_can('billing.manage'));
CREATE POLICY billing_settings_update ON billing_settings FOR UPDATE USING(billing_platform_can('billing.manage')) WITH CHECK(billing_platform_can('billing.manage'));
ALTER TABLE billing_coupons ENABLE ROW LEVEL SECURITY;ALTER TABLE billing_coupons FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_coupon_read ON billing_coupons FOR SELECT USING(billing_platform_can('coupons.read') OR billing_platform_can('coupons.manage'));
CREATE POLICY billing_coupon_insert ON billing_coupons FOR INSERT WITH CHECK(billing_platform_can('coupons.manage') AND created_by_id=NULLIF(current_setting('app.platform_account_id',true),'')::uuid);
CREATE POLICY billing_coupon_update ON billing_coupons FOR UPDATE USING(billing_platform_can('coupons.manage')) WITH CHECK(billing_platform_can('coupons.manage'));
GRANT SELECT,INSERT,UPDATE ON billing_settings,billing_coupons TO work_app;
CREATE FUNCTION billing_coupon_identity_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.id,NEW.created_by_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.created_by_id,OLD.created_at) THEN RAISE EXCEPTION 'Coupon identity is immutable';END IF;RETURN NEW;
END $$;
CREATE TRIGGER billing_coupon_identity BEFORE UPDATE ON billing_coupons FOR EACH ROW EXECUTE FUNCTION billing_coupon_identity_fixed();
COMMIT;
