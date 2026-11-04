BEGIN;
CREATE OR REPLACE FUNCTION billing_lock_internal(target uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('BILLING:'||target));PERFORM pg_advisory_xact_lock(hashtext('seats:'||target));PERFORM pg_advisory_xact_lock(hashtext('PROJECT_CAP:'||target));PERFORM pg_advisory_xact_lock(hashtext('documents:'||target));PERFORM pg_advisory_xact_lock(hashtext('workflow_definitions:'||target));
END $$;
CREATE FUNCTION billing_seat_limit_internal(target uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT coalesce((SELECT s.seats FROM public.platform_subscriptions s JOIN public.platform_plans p ON p.id=s.plan_id WHERE s.organization_id=target AND (s.status IN ('ACTIVE','TRIAL') AND s.ends_at>now() OR s.status<>'TRIAL' AND NOT s.cancel_at_period_end AND (s.status='PAST_DUE' AND s.grace_ends_at>now() OR s.status='ACTIVE' AND s.managed AND s.ends_at+p.grace_days*interval '24 hours'>now())) LIMIT 1),(SELECT p.max_seats FROM public.billing_settings cfg JOIN public.platform_plans p ON p.id=cfg.free_plan_id WHERE cfg.id='main' AND p.active AND NOT p.custom_pricing AND p.price=0),3)
$$;
REVOKE ALL ON FUNCTION billing_seat_limit_internal(uuid) FROM PUBLIC;
DO $patch$ DECLARE definition text;needle text;BEGIN
 definition:=pg_get_functiondef('public.work_accept_invitation(text)'::regprocedure);
 needle:=$needle$SELECT seats INTO maximum FROM public.platform_subscriptions WHERE organization_id=target.organization_id AND status IN ('ACTIVE','TRIAL') AND ends_at>now() LIMIT 1;
 maximum:=coalesce(maximum,3);$needle$;
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected invitation seat clause not found';END IF;
 EXECUTE replace(definition,needle,'maximum:=public.billing_seat_limit_internal(target.organization_id);');
 definition:=pg_get_functiondef('public.billing_dispatch_due()'::regprocedure);
 needle:=$needle$IF reason IS NULL THEN reason:=public.billing_capacity_reason(target_org,p.id,CASE WHEN automatic THEN s.seats ELSE source_order.seats END);END IF;$needle$;
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected scheduled capacity clause not found';END IF;
 EXECUTE replace(definition,needle,$replacement$IF reason IS NULL AND EXISTS(SELECT 1 FROM public.billing_orders WHERE organization_id=target_org AND status='PENDING_PAYMENT') THEN reason:='BILLING_INVOICE_ALREADY_PENDING';END IF;
 $replacement$||needle);
END $patch$;
COMMIT;
