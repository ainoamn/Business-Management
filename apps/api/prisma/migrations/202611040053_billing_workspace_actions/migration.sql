BEGIN;
CREATE FUNCTION billing_lock_org() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
 IF NOT public.billing_member_global('billing.manage') THEN RAISE EXCEPTION 'BILLING_PERMISSION_REQUIRED' USING ERRCODE='42501';END IF;PERFORM public.billing_lock_internal(NULLIF(current_setting('app.organization_id',true),'')::uuid);
END $$;
CREATE FUNCTION billing_trial_available() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.billing_member_global('billing.manage') AND EXISTS(SELECT 1 FROM public.billing_settings s JOIN public.platform_plans p ON p.id=s.trial_plan_id WHERE s.id='main' AND p.active AND NOT p.custom_pricing AND p.trial_days>0 AND s.trial_seats<=p.max_seats)
 AND NOT EXISTS(SELECT 1 FROM public.billing_trial_uses WHERE organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid OR user_id=NULLIF(current_setting('app.user_id',true),'')::uuid)
 AND NOT EXISTS(SELECT 1 FROM public.platform_subscriptions WHERE organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid)
$$;
CREATE FUNCTION billing_cancel_order(target uuid,expected_version integer,explanation text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.billing_orders%ROWTYPE;invoice_id uuid;member_actor uuid;BEGIN
 IF NOT public.billing_member_global('billing.manage') THEN RAISE EXCEPTION 'BILLING_PERMISSION_REQUIRED' USING ERRCODE='42501';END IF;
 IF explanation IS NULL OR length(trim(explanation)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BILLING_REASON_REQUIRED';END IF;
 SELECT * INTO o FROM public.billing_orders WHERE id=target AND organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid;IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_ORDER_UNAVAILABLE';END IF;
 SELECT id INTO invoice_id FROM public.platform_invoices WHERE billing_order_id=o.id;IF invoice_id IS NOT NULL THEN PERFORM 1 FROM public.platform_invoices WHERE id=invoice_id FOR UPDATE;END IF;
 PERFORM public.billing_lock_internal(o.organization_id);IF o.coupon_id IS NOT NULL THEN PERFORM 1 FROM public.billing_coupons WHERE id=o.coupon_id FOR UPDATE;END IF;SELECT * INTO o FROM public.billing_orders WHERE id=target FOR UPDATE;
 IF o.status='CANCELED' THEN RETURN o.status;END IF;IF o.version<>expected_version THEN RAISE EXCEPTION 'BILLING_ORDER_CHANGED';END IF;
 IF o.status NOT IN ('QUOTED','SCHEDULED','PENDING_PAYMENT') THEN RAISE EXCEPTION 'BILLING_ORDER_FINAL';END IF;
 IF invoice_id IS NOT NULL THEN IF EXISTS(SELECT 1 FROM public.platform_ledger_entries WHERE platform_ledger_entries.invoice_id=billing_cancel_order.invoice_id) THEN RAISE EXCEPTION 'BILLING_INVOICE_HAS_ENTRIES';END IF;UPDATE public.platform_invoices SET status='VOID' WHERE id=invoice_id;END IF;
 UPDATE public.billing_orders SET status='CANCELED',canceled_at=clock_timestamp(),version=version+1 WHERE id=o.id;PERFORM public.billing_release_coupon_internal(o.id);
 SELECT id INTO member_actor FROM public.memberships WHERE organization_id=o.organization_id AND user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND active;
 INSERT INTO public.billing_events(id,organization_id,membership_id,order_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,member_actor,o.id,'BILLING_ORDER_CANCELED',jsonb_build_object('reason',explanation),gen_random_uuid());RETURN 'CANCELED';
END $$;
DO $patch$ DECLARE definition text;old_fragment text;new_fragment text;BEGIN
 definition:=pg_get_functiondef('public.billing_apply_order_internal(uuid)'::regprocedure);
 old_fragment:=$needle$ELSIF o.kind='RENEW' AND prior.id IS NOT NULL AND prior.managed AND prior.ends_at<=now() AND now()<=prior.ends_at+p.grace_days*interval '1 day' THEN$needle$;
 new_fragment:=$replacement$ELSIF o.kind='RENEW' AND prior.id IS NOT NULL AND prior.managed AND prior.status IN ('ACTIVE','PAST_DUE') AND prior.ends_at<=now() AND now()<=prior.ends_at+coalesce((SELECT grace_days FROM public.platform_plans WHERE id=prior.plan_id),0)*interval '1 day' THEN$replacement$;
 IF strpos(definition,old_fragment)=0 THEN RAISE EXCEPTION 'Expected renewal clause not found';END IF;definition:=replace(definition,old_fragment,new_fragment);
 old_fragment:=$needle$IF o.kind IN ('PURCHASE','FREE') AND prior.status='ACTIVE' AND prior.ends_at>now() THEN reason:='BILLING_DOWNGRADE_AT_RENEWAL';END IF;$needle$;
 new_fragment:=old_fragment||$replacement$
 IF o.kind='RENEW' AND prior.ends_at>now() THEN reason:='BILLING_RENEWAL_NOT_DUE';END IF;$replacement$;
 IF strpos(definition,old_fragment)=0 THEN RAISE EXCEPTION 'Expected purchase clause not found';END IF;definition:=replace(definition,old_fragment,new_fragment);EXECUTE definition;
 definition:=pg_get_functiondef('public.billing_accept_order(uuid,uuid,text,numeric,uuid,text)'::regprocedure);
 old_fragment:=$needle$reason:=public.billing_capacity_reason(o.organization_id,o.plan_id,o.seats);IF reason IS NOT NULL THEN RAISE EXCEPTION '%',reason;END IF;$needle$;
 new_fragment:=$replacement$IF EXISTS(SELECT 1 FROM public.billing_orders WHERE organization_id=o.organization_id AND status='PENDING_PAYMENT') THEN RAISE EXCEPTION 'BILLING_INVOICE_ALREADY_PENDING';END IF;
 $replacement$||old_fragment;
 IF strpos(definition,old_fragment)=0 THEN RAISE EXCEPTION 'Expected acceptance capacity check not found';END IF;definition:=replace(definition,old_fragment,new_fragment);EXECUTE definition;
END $patch$;
REVOKE ALL ON FUNCTION billing_lock_org(),billing_trial_available(),billing_cancel_order(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_lock_org(),billing_trial_available(),billing_cancel_order(uuid,integer,text) TO work_app;
COMMIT;
