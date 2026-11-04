BEGIN;
CREATE FUNCTION billing_member_global(permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT permission IN ('billing.read','billing.manage') AND public.work_is_member() AND EXISTS(
 SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active AND u.email_verified_at IS NOT NULL
 AND (m.role='ORGANIZATION_OWNER' OR permission='billing.read' AND m.role IN ('ORGANIZATION_ADMIN','ACCOUNTANT','AUDITOR') OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND mr.scope='ORGANIZATION' AND rp.permission=permission)))
$$;
REVOKE ALL ON FUNCTION billing_member_global(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_member_global(text) TO work_app;
ALTER TABLE billing_orders ADD CONSTRAINT billing_order_values CHECK(
 kind IN ('PURCHASE','UPGRADE','RENEW','SCHEDULE','TRIAL','FREE') AND status IN ('QUOTED','SCHEDULED','PENDING_PAYMENT','APPLIED','CANCELED','EXPIRED','NEEDS_REVIEW','CONVERTED') AND timing IN ('IMMEDIATE','NEXT_PERIOD') AND cycle IN ('MONTHLY','ANNUAL') AND currency='OMR'
 AND seats BETWEEN 1 AND 100000 AND unit_price>=0 AND subtotal>=0 AND discount>=0 AND discount<=subtotal AND total_due>=0 AND renewal_total>=0 AND version>0 AND expires_at>created_at
 AND (kind IN ('TRIAL','FREE','SCHEDULE') AND total_due=0 OR kind IN ('PURCHASE','RENEW') AND total_due=subtotal-discount OR kind='UPGRADE' AND total_due<=subtotal-discount)
 AND ((expected_subscription_id IS NULL AND expected_subscription_version IS NULL) OR (expected_subscription_id IS NOT NULL AND expected_subscription_version IS NOT NULL AND expected_subscription_version>0))
 AND (request_hash IS NULL OR request_hash ~ '^[a-f0-9]{64}$') AND (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{1,59}$')
 AND jsonb_typeof(plan_snapshot)='object' AND octet_length(plan_snapshot::text)<=32768 AND jsonb_typeof(coupon_snapshot)='object' AND octet_length(coupon_snapshot::text)<=4096
 AND (status<>'APPLIED' OR applied_at IS NOT NULL AND (kind='FREE' OR applied_subscription_id IS NOT NULL))
);
CREATE UNIQUE INDEX billing_single_pending_payment ON billing_orders(organization_id) WHERE status='PENDING_PAYMENT';
CREATE UNIQUE INDEX billing_single_scheduled_change ON billing_orders(organization_id) WHERE status='SCHEDULED';
ALTER TABLE billing_coupon_uses ADD CONSTRAINT billing_coupon_use_state CHECK(state IN ('RESERVED','CONSUMED','RELEASED') AND expires_at>created_at AND (state<>'CONSUMED' OR consumed_at IS NOT NULL));
ALTER TABLE billing_events ADD CONSTRAINT billing_event_shape CHECK(jsonb_typeof(detail)='object' AND octet_length(detail::text)<=16384 AND action ~ '^[A-Z][A-Z0-9_]{1,79}$' AND (membership_id IS NULL OR platform_actor_id IS NULL));

ALTER TABLE billing_orders ENABLE ROW LEVEL SECURITY;ALTER TABLE billing_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_order_read ON billing_orders FOR SELECT USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.read') OR billing_platform_can('billing.read') OR billing_platform_can('subscriptions.read'));
CREATE POLICY billing_order_insert ON billing_orders FOR INSERT WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.manage') AND status='QUOTED' AND user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND EXISTS(SELECT 1 FROM user_sessions s WHERE s.id=session_id AND s.user_id=user_id AND s.revoked_at IS NULL AND s.expires_at>now()));
CREATE POLICY billing_order_update ON billing_orders FOR UPDATE USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.manage')) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.manage'));
GRANT SELECT,INSERT,UPDATE ON billing_orders TO work_app;
ALTER TABLE billing_coupon_uses ENABLE ROW LEVEL SECURITY;ALTER TABLE billing_coupon_uses FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_coupon_use_read ON billing_coupon_uses FOR SELECT USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.read') OR billing_platform_can('coupons.read'));
GRANT SELECT ON billing_coupon_uses TO work_app;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;ALTER TABLE billing_events FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_event_read ON billing_events FOR SELECT USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.read') OR billing_platform_can('billing.read'));
CREATE POLICY billing_event_insert ON billing_events FOR INSERT WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.manage') AND platform_actor_id IS NULL AND membership_id IS NOT NULL AND EXISTS(SELECT 1 FROM memberships m WHERE m.id=membership_id AND m.organization_id=organization_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid));
GRANT SELECT,INSERT ON billing_events TO work_app;
ALTER TABLE billing_trial_uses ENABLE ROW LEVEL SECURITY;ALTER TABLE billing_trial_uses FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_trial_read ON billing_trial_uses FOR SELECT USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.read') OR billing_platform_can('billing.read'));
GRANT SELECT ON billing_trial_uses TO work_app;

CREATE FUNCTION billing_order_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','accepted_at','applied_at','canceled_at','client_key','request_hash','applied_subscription_id','error_code','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','accepted_at','applied_at','canceled_at','client_key','request_hash','applied_subscription_id','error_code','version']) THEN RAISE EXCEPTION 'Billing quotation identity and prices are immutable';END IF;
 IF OLD.client_key IS NOT NULL AND (NEW.client_key,NEW.request_hash) IS DISTINCT FROM (OLD.client_key,OLD.request_hash) THEN RAISE EXCEPTION 'Billing acceptance reference is immutable';END IF;
 IF OLD.status IN ('APPLIED','CANCELED','EXPIRED','CONVERTED') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Final billing orders are immutable';END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Billing order version must advance once';END IF;
 IF current_user=session_user THEN
  IF NEW.applied_subscription_id IS DISTINCT FROM OLD.applied_subscription_id OR NEW.applied_at IS DISTINCT FROM OLD.applied_at OR NEW.error_code IS DISTINCT FROM OLD.error_code THEN RAISE EXCEPTION 'Settlement function required';END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT(OLD.status='QUOTED' AND NEW.status IN ('SCHEDULED','PENDING_PAYMENT','CANCELED','EXPIRED') OR OLD.status='SCHEDULED' AND NEW.status='CANCELED' OR OLD.status='PENDING_PAYMENT' AND NEW.status='CANCELED' AND EXISTS(SELECT 1 FROM platform_invoices i WHERE i.billing_order_id=OLD.id AND i.status='VOID')) THEN RAISE EXCEPTION 'Settlement function required for billing transition';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER billing_order_identity BEFORE UPDATE ON billing_orders FOR EACH ROW EXECUTE FUNCTION billing_order_fixed();
CREATE FUNCTION billing_history_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Billing history is append-only';END $$;
CREATE TRIGGER billing_event_immutable BEFORE UPDATE OR DELETE ON billing_events FOR EACH ROW EXECUTE FUNCTION billing_history_fixed();
CREATE TRIGGER billing_trial_immutable BEFORE UPDATE OR DELETE ON billing_trial_uses FOR EACH ROW EXECUTE FUNCTION billing_history_fixed();
CREATE FUNCTION billing_coupon_use_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.id,NEW.organization_id,NEW.order_id,NEW.coupon_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.order_id,OLD.coupon_id,OLD.created_at) OR OLD.state<>'RESERVED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Coupon allocation history is immutable';END IF;RETURN NEW;
END $$;
CREATE TRIGGER billing_coupon_use_identity BEFORE UPDATE ON billing_coupon_uses FOR EACH ROW EXECUTE FUNCTION billing_coupon_use_fixed();
COMMIT;
