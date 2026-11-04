BEGIN;
CREATE UNIQUE INDEX billing_trial_uses_user_id_key ON billing_trial_uses(user_id);
CREATE FUNCTION billing_apply_order_internal(target uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.billing_orders%ROWTYPE;p public.platform_plans%ROWTYPE;prior public.platform_subscriptions%ROWTYPE;i public.platform_invoices%ROWTYPE;settings public.billing_settings%ROWTYPE;reason text;net numeric;new_id uuid;start_at timestamptz;end_at timestamptz;anchor integer;member_actor uuid;platform_actor uuid;BEGIN
 SELECT * INTO o FROM public.billing_orders WHERE id=target;IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_ORDER_UNAVAILABLE';END IF;
 PERFORM public.billing_lock_internal(o.organization_id);IF o.coupon_id IS NOT NULL THEN PERFORM 1 FROM public.billing_coupons WHERE id=o.coupon_id FOR UPDATE;END IF;
 SELECT * INTO o FROM public.billing_orders WHERE id=target FOR UPDATE;
 IF o.status='APPLIED' THEN RETURN o.status;END IF;
 IF o.status IN ('CANCELED','EXPIRED','CONVERTED') THEN INSERT INTO public.billing_events(id,organization_id,order_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,o.id,'LATE_PAYMENT_REVIEW_REQUIRED','{}',gen_random_uuid());RETURN 'NEEDS_REVIEW';END IF;
 IF o.status NOT IN ('QUOTED','PENDING_PAYMENT') OR o.kind='SCHEDULE' THEN RETURN o.status;END IF;
 IF o.total_due>0 THEN
  SELECT * INTO i FROM public.platform_invoices WHERE billing_order_id=o.id;
  IF NOT FOUND OR i.status<>'PAID' OR i.amount<>o.total_due OR i.currency<>o.currency THEN RAISE EXCEPTION 'BILLING_VERIFIED_PAYMENT_REQUIRED';END IF;
  SELECT coalesce(sum(CASE direction WHEN 'IN' THEN amount ELSE -amount END),0) INTO net FROM public.platform_ledger_entries WHERE invoice_id=i.id;
  IF net<i.amount THEN RAISE EXCEPTION 'BILLING_VERIFIED_PAYMENT_REQUIRED';END IF;
 END IF;
 SELECT * INTO p FROM public.platform_plans WHERE id=o.plan_id;SELECT * INTO settings FROM public.billing_settings WHERE id='main';
 SELECT * INTO prior FROM public.platform_subscriptions WHERE organization_id=o.organization_id AND status IN ('ACTIVE','TRIAL','PAST_DUE') FOR UPDATE;
 IF o.expected_subscription_id IS NULL AND prior.id IS NOT NULL OR o.expected_subscription_id IS NOT NULL AND (prior.id IS DISTINCT FROM o.expected_subscription_id OR prior.version IS DISTINCT FROM o.expected_subscription_version) THEN reason:='BILLING_SUBSCRIPTION_CHANGED';END IF;
 IF reason IS NULL THEN reason:=public.billing_capacity_reason(o.organization_id,o.plan_id,o.seats);END IF;
 IF o.kind='TRIAL' AND (o.plan_id IS DISTINCT FROM settings.trial_plan_id OR p.trial_days<1 OR o.seats<>settings.trial_seats OR EXISTS(SELECT 1 FROM public.billing_trial_uses WHERE organization_id=o.organization_id OR user_id=o.user_id) OR EXISTS(SELECT 1 FROM public.platform_subscriptions WHERE organization_id=o.organization_id)) THEN reason:='BILLING_TRIAL_USED';END IF;
 IF o.kind='FREE' AND (o.plan_id IS DISTINCT FROM settings.free_plan_id OR p.price<>0) THEN reason:='BILLING_FREE_PLAN_UNAVAILABLE';END IF;
 IF prior.id IS NOT NULL AND NOT prior.managed AND prior.ends_at>now() THEN reason:='BILLING_MANAGED_BY_PLATFORM';END IF;
 IF o.kind='UPGRADE' AND (prior.id IS NULL OR prior.status<>'ACTIVE' OR prior.ends_at<=now() OR prior.cycle<>o.cycle) THEN reason:='BILLING_SUBSCRIPTION_CHANGED';END IF;
 IF o.kind IN ('PURCHASE','FREE') AND prior.status='ACTIVE' AND prior.ends_at>now() THEN reason:='BILLING_DOWNGRADE_AT_RENEWAL';END IF;
 IF o.coupon_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.billing_coupon_uses WHERE order_id=o.id AND state='RESERVED') THEN reason:='BILLING_COUPON_RELEASED';END IF;
 IF reason IS NOT NULL THEN
  UPDATE public.billing_orders SET status='NEEDS_REVIEW',error_code=reason,version=version+1 WHERE id=o.id;
  INSERT INTO public.billing_events(id,organization_id,order_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,o.id,'ORDER_REVIEW_REQUIRED',jsonb_build_object('code',reason),gen_random_uuid());RETURN 'NEEDS_REVIEW';
 END IF;
 IF NOT public.billing_consume_coupon_internal(o.id) THEN RAISE EXCEPTION 'BILLING_COUPON_RELEASED';END IF;
 start_at:=clock_timestamp();anchor:=extract(day FROM start_at AT TIME ZONE 'UTC')::integer;
 IF o.kind='FREE' THEN
  IF prior.id IS NOT NULL THEN UPDATE public.platform_subscriptions SET status='CANCELED',canceled_at=start_at,cancel_at_period_end=false,version=version+1 WHERE id=prior.id;END IF;new_id:=NULL;
 ELSIF o.kind='UPGRADE' THEN
  new_id:=prior.id;UPDATE public.platform_subscriptions SET plan_id=o.plan_id,seats=o.seats,unit_price=o.unit_price,version=version+1 WHERE id=new_id;
 ELSIF o.kind='RENEW' AND prior.id IS NOT NULL AND prior.managed AND prior.ends_at<=now() AND now()<=prior.ends_at+p.grace_days*interval '1 day' THEN
  new_id:=prior.id;start_at:=prior.ends_at;end_at:=public.billing_add_period(start_at,o.cycle,prior.anchor_day);
  UPDATE public.platform_subscriptions SET plan_id=o.plan_id,status='ACTIVE',seats=o.seats,unit_price=o.unit_price,cycle=o.cycle,period_start=start_at,ends_at=end_at,grace_ends_at=NULL,cancel_at_period_end=false,canceled_at=NULL,cancellation_reason='',version=version+1 WHERE id=new_id;
 ELSE
  IF prior.id IS NOT NULL THEN UPDATE public.platform_subscriptions SET status='CANCELED',canceled_at=start_at,cancel_at_period_end=false,version=version+1 WHERE id=prior.id;END IF;
  new_id:=gen_random_uuid();end_at:=CASE WHEN o.kind='TRIAL' THEN start_at+p.trial_days*interval '1 day' ELSE public.billing_add_period(start_at,o.cycle,anchor) END;
  INSERT INTO public.platform_subscriptions(id,organization_id,plan_id,status,seats,unit_price,ends_at,created_at,cycle,managed,period_start,usage_anchor_at,anchor_day) VALUES(new_id,o.organization_id,o.plan_id,CASE WHEN o.kind='TRIAL' THEN 'TRIAL' ELSE 'ACTIVE' END,o.seats,o.unit_price,end_at,start_at,o.cycle,true,start_at,start_at,anchor);
 END IF;
 IF o.kind='TRIAL' THEN INSERT INTO public.billing_trial_uses(organization_id,membership_id,user_id,plan_id) VALUES(o.organization_id,o.membership_id,o.user_id,o.plan_id);END IF;
 UPDATE public.billing_orders SET status='APPLIED',applied_subscription_id=new_id,applied_at=clock_timestamp(),error_code=NULL,version=version+1 WHERE id=o.id;
 SELECT id INTO member_actor FROM public.memberships WHERE organization_id=o.organization_id AND user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND active;
 IF member_actor IS NULL THEN SELECT id INTO platform_actor FROM public.platform_accounts WHERE id=NULLIF(current_setting('app.platform_account_id',true),'')::uuid AND disabled_at IS NULL;END IF;
 INSERT INTO public.billing_events(id,organization_id,membership_id,platform_actor_id,order_id,subscription_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,member_actor,platform_actor,o.id,new_id,CASE WHEN o.kind='TRIAL' THEN 'TRIAL_STARTED' WHEN o.kind='FREE' THEN 'FREE_PLAN_SELECTED' ELSE 'SUBSCRIPTION_APPLIED' END,jsonb_build_object('kind',o.kind,'planId',o.plan_id,'seats',o.seats,'amount',o.total_due::text,'currency',o.currency),gen_random_uuid());RETURN 'APPLIED';
END $$;
CREATE FUNCTION billing_accept_order(target uuid,nonce uuid,payload_hash text,approved numeric,active_session uuid,channel text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.billing_orders%ROWTYPE;prior public.platform_subscriptions%ROWTYPE;settings public.billing_settings%ROWTYPE;new_invoice uuid;invoice_number text;deadline timestamptz;reason text;member_actor uuid;BEGIN
 IF NOT public.billing_member_global('billing.manage') OR NOT public.billing_member_global('billing.read') OR NOT EXISTS(SELECT 1 FROM public.user_sessions s WHERE s.id=active_session AND s.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND s.revoked_at IS NULL AND s.expires_at>now()) THEN RAISE EXCEPTION 'BILLING_PERMISSION_REQUIRED' USING ERRCODE='42501';END IF;
 IF nonce IS NULL OR payload_hash IS NULL OR payload_hash !~ '^[a-f0-9]{64}$' OR approved IS NULL OR approved<0 THEN RAISE EXCEPTION 'BILLING_ACCEPTANCE_INVALID';END IF;
 SELECT * INTO o FROM public.billing_orders WHERE id=target AND organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_ORDER_UNAVAILABLE';END IF;PERFORM public.billing_lock_internal(o.organization_id);
 IF o.coupon_id IS NOT NULL THEN PERFORM 1 FROM public.billing_coupons WHERE id=o.coupon_id FOR UPDATE;END IF;SELECT * INTO o FROM public.billing_orders WHERE id=target FOR UPDATE;
 IF o.client_key IS NOT NULL THEN IF o.client_key=nonce AND o.request_hash=payload_hash THEN RETURN o.status;ELSE RAISE EXCEPTION 'BILLING_REFERENCE_REUSED';END IF;END IF;
 IF o.status<>'QUOTED' OR o.expires_at<=now() THEN RAISE EXCEPTION 'BILLING_QUOTE_EXPIRED';END IF;IF o.total_due>approved THEN RAISE EXCEPTION 'BILLING_APPROVED_AMOUNT_EXCEEDED';END IF;
 SELECT * INTO prior FROM public.platform_subscriptions WHERE organization_id=o.organization_id AND status IN ('ACTIVE','TRIAL','PAST_DUE');
 IF o.expected_subscription_id IS NULL AND prior.id IS NOT NULL OR o.expected_subscription_id IS NOT NULL AND (prior.id IS DISTINCT FROM o.expected_subscription_id OR prior.version IS DISTINCT FROM o.expected_subscription_version) THEN RAISE EXCEPTION 'BILLING_SUBSCRIPTION_CHANGED';END IF;
 reason:=public.billing_capacity_reason(o.organization_id,o.plan_id,o.seats);IF reason IS NOT NULL THEN RAISE EXCEPTION '%',reason;END IF;
 SELECT id INTO member_actor FROM public.memberships WHERE organization_id=o.organization_id AND user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND active;
 IF o.kind='SCHEDULE' THEN
  IF o.timing<>'NEXT_PERIOD' OR prior.id IS NULL OR NOT prior.managed OR prior.ends_at<=now() OR o.effective_at<>prior.ends_at THEN RAISE EXCEPTION 'BILLING_SCHEDULE_UNAVAILABLE';END IF;
  UPDATE public.billing_orders SET status='SCHEDULED',client_key=nonce,request_hash=payload_hash,accepted_at=clock_timestamp(),version=version+1 WHERE id=o.id;
  INSERT INTO public.billing_events(id,organization_id,membership_id,order_id,subscription_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,member_actor,o.id,prior.id,'PLAN_CHANGE_SCHEDULED',jsonb_build_object('effectiveAt',o.effective_at,'planId',o.plan_id,'seats',o.seats,'renewalAmount',o.renewal_total::text),gen_random_uuid());RETURN 'SCHEDULED';
 ELSIF o.total_due=0 THEN
  UPDATE public.billing_orders SET client_key=nonce,request_hash=payload_hash,accepted_at=clock_timestamp(),version=version+1 WHERE id=o.id;RETURN public.billing_apply_order_internal(o.id);
 END IF;
 SELECT * INTO settings FROM public.billing_settings WHERE id='main';IF channel<>'MANUAL' OR NOT coalesce(settings.manual_payments_enabled,false) THEN RAISE EXCEPTION 'BILLING_PAYMENT_NOT_CONFIGURED';END IF;
 IF EXISTS(SELECT 1 FROM public.billing_orders WHERE organization_id=o.organization_id AND status='PENDING_PAYMENT') THEN RAISE EXCEPTION 'BILLING_INVOICE_ALREADY_PENDING';END IF;
 new_invoice:=gen_random_uuid();deadline:=clock_timestamp()+interval '24 hours';invoice_number:='SUB-'||to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY')||'-'||lpad(nextval('public.billing_invoice_number_seq')::text,10,'0');
 INSERT INTO public.platform_invoices(id,organization_id,number,amount,currency,status,due_at,billing_order_id) VALUES(new_invoice,o.organization_id,invoice_number,o.total_due,o.currency,'ISSUED',deadline,o.id);
 UPDATE public.billing_orders SET status='PENDING_PAYMENT',client_key=nonce,request_hash=payload_hash,accepted_at=clock_timestamp(),version=version+1 WHERE id=o.id;
 UPDATE public.billing_coupon_uses SET expires_at=deadline WHERE order_id=o.id AND state='RESERVED';
 INSERT INTO public.billing_events(id,organization_id,membership_id,order_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,member_actor,o.id,'INVOICE_ISSUED',jsonb_build_object('invoiceId',new_invoice,'number',invoice_number,'amount',o.total_due::text,'currency',o.currency,'channel',channel),gen_random_uuid());RETURN 'PENDING_PAYMENT';
END $$;
CREATE FUNCTION billing_invoice_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (OLD.billing_order_id IS NOT NULL OR NEW.billing_order_id IS NOT NULL) AND (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Subscription invoice prices and identity are immutable';END IF;RETURN NEW;
END $$;
CREATE TRIGGER billing_invoice_identity BEFORE UPDATE ON platform_invoices FOR EACH ROW EXECUTE FUNCTION billing_invoice_fixed();
CREATE FUNCTION billing_invoice_settled() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
 IF NEW.billing_order_id IS NOT NULL AND NEW.status='PAID' AND OLD.status IS DISTINCT FROM 'PAID' THEN PERFORM public.billing_apply_order_internal(NEW.billing_order_id);END IF;RETURN NEW;
END $$;
CREATE TRIGGER billing_invoice_payment AFTER UPDATE OF status ON platform_invoices FOR EACH ROW EXECUTE FUNCTION billing_invoice_settled();
REVOKE ALL ON FUNCTION billing_apply_order_internal(uuid),billing_accept_order(uuid,uuid,text,numeric,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_accept_order(uuid,uuid,text,numeric,uuid,text) TO work_app;
COMMIT;
