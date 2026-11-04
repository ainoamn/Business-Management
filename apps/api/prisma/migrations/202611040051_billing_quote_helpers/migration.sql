BEGIN;
ALTER POLICY billing_order_insert ON billing_orders WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.manage') AND status='QUOTED' AND user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND EXISTS(SELECT 1 FROM user_sessions s WHERE s.id=billing_orders.session_id AND s.user_id=billing_orders.user_id AND s.revoked_at IS NULL AND s.expires_at>now()));
ALTER POLICY billing_event_insert ON billing_events WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND billing_member_global('billing.manage') AND platform_actor_id IS NULL AND membership_id IS NOT NULL AND EXISTS(SELECT 1 FROM memberships m WHERE m.id=billing_events.membership_id AND m.organization_id=billing_events.organization_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid));
ALTER TABLE billing_orders ADD CONSTRAINT billing_order_subtotal_exact CHECK(subtotal=unit_price*seats AND (coupon_id IS NOT NULL OR discount=0));
CREATE INDEX billing_coupon_uses_expiry ON billing_coupon_uses(coupon_id,state,expires_at);
CREATE SEQUENCE billing_invoice_number_seq;

CREATE FUNCTION billing_add_period(start_at timestamptz,cycle text,anchor_day integer) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE local_time timestamp;month_start timestamp;last_day integer;BEGIN
 IF NOT isfinite(start_at) OR cycle NOT IN ('MONTHLY','ANNUAL') OR anchor_day NOT BETWEEN 1 AND 31 THEN RAISE EXCEPTION 'BILLING_DATE_INVALID';END IF;
 local_time:=start_at AT TIME ZONE 'UTC';month_start:=date_trunc('month',local_time)+CASE cycle WHEN 'ANNUAL' THEN interval '1 year' ELSE interval '1 month' END;
 last_day:=extract(day FROM month_start+interval '1 month - 1 day')::integer;
 RETURN (month_start+(least(anchor_day,last_day)-1)*interval '1 day'+(local_time-date_trunc('day',local_time))) AT TIME ZONE 'UTC';
END $$;
CREATE FUNCTION billing_lock_internal(target uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('BILLING:'||target));PERFORM pg_advisory_xact_lock(hashtext('seats:'||target));PERFORM pg_advisory_xact_lock(hashtext('PROJECT_CAP:'||target));PERFORM pg_advisory_xact_lock(hashtext('documents:'||target));
END $$;
CREATE FUNCTION billing_capacity_reason(target uuid,target_plan uuid,seat_count integer) RETURNS text LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE p public.platform_plans%ROWTYPE;used bigint;BEGIN
 SELECT * INTO p FROM public.platform_plans WHERE id=target_plan;IF NOT FOUND OR NOT p.active OR p.custom_pricing OR seat_count NOT BETWEEN 1 AND p.max_seats THEN RETURN 'BILLING_PLAN_UNAVAILABLE';END IF;
 SELECT (SELECT count(*) FROM public.memberships WHERE organization_id=target AND active)+(SELECT count(*) FROM public.invitations WHERE organization_id=target AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()) INTO used;
 IF used>seat_count THEN RETURN 'BILLING_SEATS_IN_USE';END IF;
 IF p.max_projects IS NOT NULL AND (SELECT count(*) FROM public.projects WHERE organization_id=target AND archived_at IS NULL AND status NOT IN ('COMPLETED','CLOSED','CANCELLED'))>p.max_projects THEN RETURN 'BILLING_PROJECT_LIMIT';END IF;
 IF EXISTS(SELECT 1 FROM public.organization_storage_usage WHERE organization_id=target AND used_bytes+reserved_bytes>p.storage_mb::bigint*1048576) THEN RETURN 'BILLING_STORAGE_LIMIT';END IF;
 SELECT count(*) INTO used FROM public.workflows WHERE organization_id=target AND status='ACTIVE';IF used>p.active_workflows OR used>0 AND NOT('AUTOMATION'=ANY(p.features)) THEN RETURN 'BILLING_WORKFLOW_LIMIT';END IF;
 IF NOT('TIME'=ANY(p.features)) AND EXISTS(SELECT 1 FROM public.active_timers WHERE organization_id=target) THEN RETURN 'BILLING_TIMER_ACTIVE';END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION billing_quote_price_fixed() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE p public.platform_plans%ROWTYPE;settings public.billing_settings%ROWTYPE;expected numeric;BEGIN
 IF current_user<>session_user THEN RETURN NEW;END IF;
 SELECT * INTO p FROM public.platform_plans WHERE id=NEW.plan_id;IF NOT FOUND OR NOT p.active OR p.custom_pricing THEN RAISE EXCEPTION 'BILLING_PLAN_UNAVAILABLE';END IF;
 SELECT * INTO settings FROM public.billing_settings WHERE id='main';
 expected:=CASE WHEN NEW.cycle='ANNUAL' THEN p.annual_price ELSE p.price END;
 IF NEW.kind='TRIAL' THEN IF NEW.plan_id IS DISTINCT FROM settings.trial_plan_id OR p.trial_days=0 OR NEW.unit_price<>0 OR NEW.seats<>settings.trial_seats THEN RAISE EXCEPTION 'BILLING_TRIAL_UNAVAILABLE';END IF;
 ELSIF NEW.kind='FREE' THEN IF NEW.plan_id IS DISTINCT FROM settings.free_plan_id OR NEW.unit_price<>0 OR p.price<>0 THEN RAISE EXCEPTION 'BILLING_FREE_PLAN_UNAVAILABLE';END IF;
 ELSE IF expected IS NULL OR NEW.unit_price<>expected THEN RAISE EXCEPTION 'BILLING_PRICE_CHANGED';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER billing_quote_price BEFORE INSERT ON billing_orders FOR EACH ROW EXECUTE FUNCTION billing_quote_price_fixed();

CREATE FUNCTION billing_coupon_for_quote(coupon_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.billing_coupons%ROWTYPE;BEGIN
 IF NOT public.billing_member_global('billing.manage') OR coupon_code !~ '^[A-Z0-9_-]{3,40}$' THEN RAISE EXCEPTION 'BILLING_COUPON_UNAVAILABLE';END IF;
 PERFORM public.billing_lock_internal(NULLIF(current_setting('app.organization_id',true),'')::uuid);
 SELECT * INTO c FROM public.billing_coupons WHERE code=coupon_code FOR UPDATE;
 IF NOT FOUND OR NOT c.active OR c.starts_at>now() OR c.ends_at<=now() THEN RAISE EXCEPTION 'BILLING_COUPON_UNAVAILABLE';END IF;
 RETURN jsonb_build_object('id',c.id,'code',c.code,'kind',c.kind,'basisPoints',c.basis_points,'amount',c.amount::text,'allowedPlanIds',c.allowed_plan_ids,'version',c.version);
END $$;
CREATE FUNCTION billing_reserve_coupon(target uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.billing_orders%ROWTYPE;c public.billing_coupons%ROWTYPE;expired_count integer;expected numeric;BEGIN
 IF NOT public.billing_member_global('billing.manage') THEN RAISE EXCEPTION 'BILLING_PERMISSION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO o FROM public.billing_orders WHERE id=target AND organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 IF NOT FOUND OR o.status<>'QUOTED' OR o.expires_at<=now() OR o.coupon_id IS NULL THEN RAISE EXCEPTION 'BILLING_QUOTE_UNAVAILABLE';END IF;
 PERFORM public.billing_lock_internal(o.organization_id);SELECT * INTO c FROM public.billing_coupons WHERE id=o.coupon_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.billing_coupon_uses WHERE order_id=o.id AND state='RESERVED') THEN RETURN true;END IF;
 IF NOT c.active OR c.starts_at>now() OR c.ends_at<=now() OR cardinality(c.allowed_plan_ids)>0 AND NOT(o.plan_id=ANY(c.allowed_plan_ids)) THEN RAISE EXCEPTION 'BILLING_COUPON_UNAVAILABLE';END IF;
 WITH stale AS(SELECT id FROM public.billing_coupon_uses WHERE coupon_id=c.id AND state='RESERVED' AND expires_at<=now() ORDER BY expires_at,id LIMIT 1000 FOR UPDATE),released AS(UPDATE public.billing_coupon_uses u SET state='RELEASED' FROM stale WHERE u.id=stale.id RETURNING u.id) SELECT count(*)::integer INTO expired_count FROM released;
 IF expired_count>0 THEN UPDATE public.billing_coupons SET reserved_count=reserved_count-expired_count WHERE id=c.id;END IF;
 SELECT * INTO c FROM public.billing_coupons WHERE id=c.id;
 IF c.redeemed_count+c.reserved_count>=c.max_uses OR (SELECT count(*) FROM public.billing_coupon_uses WHERE coupon_id=c.id AND organization_id=o.organization_id AND (state='CONSUMED' OR state='RESERVED' AND expires_at>now()))>=c.per_organization THEN RAISE EXCEPTION 'BILLING_COUPON_LIMIT';END IF;
 expected:=least(o.subtotal,CASE WHEN c.kind='PERCENT' THEN round(o.subtotal*c.basis_points/10000,3) ELSE c.amount END);
 IF expected IS NULL OR o.discount<>expected OR o.coupon_snapshot->>'version' IS DISTINCT FROM c.version::text THEN RAISE EXCEPTION 'BILLING_PRICE_CHANGED';END IF;
 UPDATE public.billing_coupons SET reserved_count=reserved_count+1 WHERE id=c.id;
 INSERT INTO public.billing_coupon_uses(id,organization_id,order_id,coupon_id,expires_at) VALUES(gen_random_uuid(),o.organization_id,o.id,c.id,o.expires_at);RETURN true;
END $$;
CREATE FUNCTION billing_release_coupon_internal(target uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c_id uuid;u public.billing_coupon_uses%ROWTYPE;BEGIN
 SELECT coupon_id INTO c_id FROM public.billing_coupon_uses WHERE order_id=target;IF c_id IS NULL THEN RETURN false;END IF;
 PERFORM 1 FROM public.billing_coupons WHERE id=c_id FOR UPDATE;SELECT * INTO u FROM public.billing_coupon_uses WHERE order_id=target FOR UPDATE;
 IF u.state<>'RESERVED' THEN RETURN false;END IF;UPDATE public.billing_coupon_uses SET state='RELEASED' WHERE id=u.id;UPDATE public.billing_coupons SET reserved_count=reserved_count-1 WHERE id=c_id;RETURN true;
END $$;
CREATE FUNCTION billing_consume_coupon_internal(target uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c_id uuid;u public.billing_coupon_uses%ROWTYPE;BEGIN
 SELECT coupon_id INTO c_id FROM public.billing_orders WHERE id=target;IF c_id IS NULL THEN RETURN true;END IF;
 PERFORM 1 FROM public.billing_coupons WHERE id=c_id FOR UPDATE;SELECT * INTO u FROM public.billing_coupon_uses WHERE order_id=target FOR UPDATE;
 IF NOT FOUND OR u.state<>'RESERVED' THEN RETURN false;END IF;UPDATE public.billing_coupon_uses SET state='CONSUMED',consumed_at=clock_timestamp() WHERE id=u.id;UPDATE public.billing_coupons SET reserved_count=reserved_count-1,redeemed_count=redeemed_count+1 WHERE id=c_id;RETURN true;
END $$;
REVOKE ALL ON FUNCTION billing_add_period(timestamptz,text,integer),billing_lock_internal(uuid),billing_capacity_reason(uuid,uuid,integer),billing_coupon_for_quote(text),billing_reserve_coupon(uuid),billing_release_coupon_internal(uuid),billing_consume_coupon_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_add_period(timestamptz,text,integer),billing_coupon_for_quote(text),billing_reserve_coupon(uuid) TO work_app;
COMMIT;
