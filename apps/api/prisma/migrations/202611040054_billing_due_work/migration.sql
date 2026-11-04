BEGIN;
-- These jobs fulfil already accepted contracts; they never initiate a payment or debit.
CREATE INDEX billing_due_scheduled ON billing_orders(effective_at,id) WHERE status='SCHEDULED';
CREATE UNIQUE INDEX billing_automatic_renewal_once ON billing_orders(expected_subscription_id,expected_subscription_version) WHERE plan_snapshot ? 'automaticRenewal';
CREATE FUNCTION billing_dispatch_due() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target_org uuid;s public.platform_subscriptions%ROWTYPE;o public.billing_orders%ROWTYPE;source_order public.billing_orders%ROWTYPE;p public.platform_plans%ROWTYPE;settings public.billing_settings%ROWTYPE;reason text;new_id uuid;invoice_id uuid;invoice_number text;new_kind text;total numeric;deadline timestamptz;grace_at timestamptz;automatic boolean;BEGIN
 SELECT candidate.organization_id INTO target_org FROM (
  SELECT organization_id,effective_at AS due_at FROM public.billing_orders WHERE status='SCHEDULED' AND effective_at<=clock_timestamp()
  UNION ALL
  SELECT sub.organization_id,sub.ends_at FROM public.platform_subscriptions sub WHERE sub.managed AND sub.status='ACTIVE' AND sub.automatic_invoices AND NOT sub.cancel_at_period_end AND sub.ends_at<=clock_timestamp()
   AND NOT EXISTS(SELECT 1 FROM public.billing_orders b WHERE b.organization_id=sub.organization_id AND b.status IN ('PENDING_PAYMENT','SCHEDULED'))
   AND NOT EXISTS(SELECT 1 FROM public.billing_orders b WHERE b.expected_subscription_id=sub.id AND b.expected_subscription_version=sub.version AND b.plan_snapshot ? 'automaticRenewal')
 ) candidate ORDER BY due_at,organization_id LIMIT 1;
 IF target_org IS NULL THEN RETURN false;END IF;
 IF NOT pg_try_advisory_xact_lock(hashtext('BILLING:'||target_org)) THEN RETURN false;END IF;
 PERFORM public.billing_lock_internal(target_org);
 SELECT * INTO s FROM public.platform_subscriptions WHERE organization_id=target_org AND status IN ('ACTIVE','TRIAL','PAST_DUE') FOR UPDATE;
 SELECT * INTO source_order FROM public.billing_orders WHERE organization_id=target_org AND status='SCHEDULED' AND effective_at<=clock_timestamp() ORDER BY effective_at,id LIMIT 1 FOR UPDATE;
 automatic:=source_order.id IS NULL;
 IF automatic THEN
  IF s.id IS NULL OR NOT s.managed OR s.status<>'ACTIVE' OR NOT s.automatic_invoices OR s.cancel_at_period_end OR s.ends_at>clock_timestamp()
   OR EXISTS(SELECT 1 FROM public.billing_orders b WHERE b.organization_id=target_org AND b.status IN ('PENDING_PAYMENT','SCHEDULED'))
   OR EXISTS(SELECT 1 FROM public.billing_orders b WHERE b.expected_subscription_id=s.id AND b.expected_subscription_version=s.version AND b.plan_snapshot ? 'automaticRenewal') THEN RETURN false;END IF;
  SELECT * INTO source_order FROM public.billing_orders WHERE organization_id=target_org AND applied_subscription_id=s.id AND status='APPLIED' ORDER BY applied_at DESC,id LIMIT 1;
  IF source_order.id IS NULL THEN RETURN false;END IF;
  SELECT * INTO p FROM public.platform_plans WHERE id=s.plan_id;
  total:=s.unit_price*s.seats;
 ELSE
  SELECT * INTO p FROM public.platform_plans WHERE id=source_order.plan_id;total:=source_order.renewal_total;
  IF s.id IS DISTINCT FROM source_order.expected_subscription_id OR s.version IS DISTINCT FROM source_order.expected_subscription_version OR NOT coalesce(s.managed,false) OR s.cancel_at_period_end THEN reason:='BILLING_SUBSCRIPTION_CHANGED';END IF;
 END IF;
 IF reason IS NULL THEN reason:=public.billing_capacity_reason(target_org,p.id,CASE WHEN automatic THEN s.seats ELSE source_order.seats END);END IF;
 SELECT * INTO settings FROM public.billing_settings WHERE id='main';
 IF reason IS NULL AND total>0 AND NOT coalesce(settings.manual_payments_enabled,false) THEN reason:='BILLING_PAYMENT_NOT_CONFIGURED';END IF;
 grace_at:=s.ends_at+coalesce((SELECT grace_days FROM public.platform_plans WHERE id=s.plan_id),0)*interval '24 hours';
 new_kind:=CASE WHEN p.id=settings.free_plan_id AND total=0 THEN 'FREE' WHEN s.status IN ('ACTIVE','PAST_DUE') AND clock_timestamp()<=grace_at THEN 'RENEW' ELSE 'PURCHASE' END;
 new_id:=gen_random_uuid();
 INSERT INTO public.billing_orders(id,organization_id,membership_id,user_id,session_id,plan_id,expected_subscription_id,expected_subscription_version,kind,status,timing,cycle,seats,unit_price,subtotal,discount,total_due,renewal_total,currency,plan_snapshot,effective_at,expires_at,accepted_at,error_code)
 VALUES(new_id,target_org,source_order.membership_id,source_order.user_id,source_order.session_id,p.id,s.id,s.version,new_kind,CASE WHEN reason IS NULL THEN 'QUOTED' ELSE 'NEEDS_REVIEW' END,'IMMEDIATE',CASE WHEN automatic THEN s.cycle ELSE source_order.cycle END,CASE WHEN automatic THEN s.seats ELSE source_order.seats END,CASE WHEN automatic THEN s.unit_price ELSE source_order.unit_price END,total,0,total,total,'OMR',source_order.plan_snapshot||CASE WHEN automatic THEN jsonb_build_object('automaticRenewal',true,'sourceOrderId',source_order.id) ELSE jsonb_build_object('scheduledOrderId',source_order.id) END,CASE WHEN new_kind='RENEW' THEN s.ends_at ELSE clock_timestamp() END,clock_timestamp()+interval '24 hours',clock_timestamp(),reason);
 IF NOT automatic THEN UPDATE public.billing_orders SET status='CONVERTED',version=version+1 WHERE id=source_order.id;END IF;
 IF reason IS NOT NULL THEN
  INSERT INTO public.billing_events(id,organization_id,order_id,subscription_id,action,detail,request_id) VALUES(gen_random_uuid(),target_org,new_id,s.id,'ORDER_REVIEW_REQUIRED',jsonb_build_object('code',reason,'sourceOrderId',source_order.id),gen_random_uuid());RETURN true;
 END IF;
 IF total=0 THEN PERFORM public.billing_apply_order_internal(new_id);RETURN true;END IF;
 deadline:=clock_timestamp()+interval '24 hours';invoice_id:=gen_random_uuid();invoice_number:='SUB-'||to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY')||'-'||lpad(nextval('public.billing_invoice_number_seq')::text,10,'0');
 INSERT INTO public.platform_invoices(id,organization_id,number,amount,currency,status,due_at,billing_order_id) VALUES(invoice_id,target_org,invoice_number,total,'OMR','ISSUED',deadline,new_id);
 UPDATE public.billing_orders SET status='PENDING_PAYMENT',version=version+1 WHERE id=new_id;
 INSERT INTO public.billing_events(id,organization_id,order_id,subscription_id,action,detail,request_id) VALUES(gen_random_uuid(),target_org,new_id,s.id,'INVOICE_ISSUED',jsonb_build_object('invoiceId',invoice_id,'number',invoice_number,'amount',total::text,'currency','OMR','automatic',automatic,'sourceOrderId',source_order.id),gen_random_uuid());RETURN true;
END $$;
REVOKE ALL ON FUNCTION billing_dispatch_due() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_dispatch_due() TO work_app;
DO $patch$ DECLARE definition text;BEGIN
 definition:=pg_get_functiondef('public.billing_apply_order_internal(uuid)'::regprocedure);
 definition:=replace(definition,$needle$interval '1 day'$needle$,$replacement$interval '24 hours'$replacement$);
 EXECUTE definition;
END $patch$;
COMMIT;
