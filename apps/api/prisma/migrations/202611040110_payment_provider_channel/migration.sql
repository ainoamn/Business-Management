BEGIN;
DO $patch$ DECLARE definition text;old_fragment text;new_fragment text;BEGIN
 definition:=pg_get_functiondef('public.billing_accept_order(uuid,uuid,text,numeric,uuid,text)'::regprocedure);
 old_fragment:=$needle$SELECT * INTO settings FROM public.billing_settings WHERE id='main';IF channel<>'MANUAL' OR NOT coalesce(settings.manual_payments_enabled,false) THEN RAISE EXCEPTION 'BILLING_PAYMENT_NOT_CONFIGURED';END IF;$needle$;
 new_fragment:=$replacement$SELECT * INTO settings FROM public.billing_settings WHERE id='main';IF channel NOT IN ('MANUAL','PROVIDER') THEN RAISE EXCEPTION 'BILLING_PAYMENT_NOT_CONFIGURED';END IF;IF channel='MANUAL' AND NOT coalesce(settings.manual_payments_enabled,false) THEN RAISE EXCEPTION 'BILLING_PAYMENT_NOT_CONFIGURED';END IF;$replacement$;
 IF strpos(definition,old_fragment)=0 THEN RAISE EXCEPTION 'Expected billing_accept_order channel guard not found';END IF;
 definition:=replace(definition,old_fragment,new_fragment);EXECUTE definition;
END $patch$;
CREATE FUNCTION billing_settle_hosted_payment(event_id text,checkout_id text,reference uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.billing_orders%ROWTYPE;i public.platform_invoices%ROWTYPE;owner_id uuid;ledger_ref text;BEGIN
 IF event_id IS NULL OR checkout_id IS NULL OR reference IS NULL OR event_id !~ '^[A-Za-z0-9_.:-]{1,200}$' THEN RAISE EXCEPTION 'PAYMENT_EVENT_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM public.billing_events WHERE action='HOSTED_PAYMENT_SETTLED' AND detail->>'eventId'=event_id) THEN RETURN 'DUPLICATE';END IF;
 SELECT * INTO o FROM public.billing_orders WHERE id=reference FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_ORDER_UNAVAILABLE';END IF;
 IF o.status<>'PENDING_PAYMENT' THEN RAISE EXCEPTION 'BILLING_ORDER_FINAL';END IF;
 SELECT * INTO i FROM public.platform_invoices WHERE billing_order_id=o.id FOR UPDATE;
 IF NOT FOUND OR i.status<>'ISSUED' THEN RAISE EXCEPTION 'BILLING_VERIFIED_PAYMENT_REQUIRED';END IF;
 SELECT id INTO owner_id FROM public.platform_accounts WHERE is_owner AND disabled_at IS NULL ORDER BY created_at LIMIT 1;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_CONFIGURED';END IF;
 ledger_ref:='hosted:'||event_id;
 IF length(ledger_ref)>100 THEN RAISE EXCEPTION 'PAYMENT_EVENT_INVALID';END IF;
 INSERT INTO public.platform_ledger_entries(id,organization_id,invoice_id,reference,direction,amount,currency,note,actor_id) VALUES(gen_random_uuid(),o.organization_id,i.id,ledger_ref,'IN',i.amount,i.currency,'Hosted payment settlement',owner_id);
 UPDATE public.platform_invoices SET status='PAID' WHERE id=i.id;
 INSERT INTO public.billing_events(id,organization_id,order_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,o.id,'HOSTED_PAYMENT_SETTLED',jsonb_build_object('eventId',event_id,'checkoutId',checkout_id,'provider','hosted'),gen_random_uuid());
 RETURN 'PAID';
END $$;
CREATE UNIQUE INDEX billing_events_hosted_event_id ON billing_events ((detail->>'eventId')) WHERE action='HOSTED_PAYMENT_SETTLED';
REVOKE ALL ON FUNCTION billing_settle_hosted_payment(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_settle_hosted_payment(text,text,uuid) TO work_app;
COMMIT;
