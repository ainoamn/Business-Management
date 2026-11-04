BEGIN;
-- Provider settlement has its own system provenance; never impersonate a human owner.
ALTER TABLE platform_ledger_entries ALTER COLUMN actor_id DROP NOT NULL;
CREATE FUNCTION billing_ledger_actor_required() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.actor_id IS NULL AND current_user=session_user THEN RAISE EXCEPTION 'Verified system settlement required';END IF;RETURN NEW;
END $$;
CREATE TRIGGER billing_ledger_actor BEFORE INSERT ON platform_ledger_entries FOR EACH ROW EXECUTE FUNCTION billing_ledger_actor_required();
DROP FUNCTION billing_settle_hosted_payment(text,text,uuid);
CREATE UNIQUE INDEX billing_hosted_payment_once ON billing_events((detail->>'paymentId'),(detail->>'mode')) WHERE action='HOSTED_PAYMENT_SETTLED';
CREATE FUNCTION billing_settle_hosted_payment(event_id text,checkout_id text,reference uuid,amount_minor text,payment_currency text,payment_mode text,payment_id text,paid_at timestamptz) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.billing_orders%ROWTYPE;i public.platform_invoices%ROWTYPE;ledger_ref text;BEGIN
 IF event_id IS NULL OR event_id !~ '^[A-Za-z0-9_.:-]{1,200}$' OR checkout_id IS NULL OR length(checkout_id) NOT BETWEEN 1 AND 200 OR reference IS NULL OR amount_minor IS NULL OR amount_minor !~ '^[1-9][0-9]{0,11}$' OR payment_currency IS DISTINCT FROM 'OMR' OR payment_mode IS NULL OR payment_mode NOT IN ('SANDBOX','LIVE') OR payment_id IS NULL OR length(payment_id) NOT BETWEEN 1 AND 200 OR paid_at IS NULL OR NOT isfinite(paid_at) OR paid_at>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'PAYMENT_EVENT_INVALID';END IF;
 SELECT * INTO o FROM public.billing_orders WHERE id=reference;IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_ORDER_UNAVAILABLE';END IF;
 SELECT * INTO i FROM public.platform_invoices WHERE billing_order_id=o.id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_VERIFIED_PAYMENT_REQUIRED';END IF;
 PERFORM public.billing_lock_internal(o.organization_id);SELECT * INTO o FROM public.billing_orders WHERE id=reference FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.billing_events WHERE action='HOSTED_PAYMENT_SETTLED' AND (detail->>'eventId'=event_id OR detail->>'paymentId'=payment_id AND detail->>'mode'=payment_mode)) THEN
  IF EXISTS(SELECT 1 FROM public.billing_events WHERE action='HOSTED_PAYMENT_SETTLED' AND order_id=o.id AND detail->>'paymentId'=payment_id AND detail->>'mode'=payment_mode AND detail->>'checkoutId'=checkout_id) THEN RETURN 'DUPLICATE';END IF;RAISE EXCEPTION 'PAYMENT_REFERENCE_REUSED';
 END IF;
 IF o.total_due*1000<>amount_minor::numeric OR i.amount<>o.total_due OR i.currency<>payment_currency OR o.currency<>payment_currency THEN RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.billing_events WHERE order_id=o.id AND action='PAYMENT_CHECKOUT_CREATED' AND detail->>'checkoutId'=checkout_id AND detail->>'mode'=payment_mode) THEN RAISE EXCEPTION 'PAYMENT_CHECKOUT_UNBOUND';END IF;
 IF o.status NOT IN ('PENDING_PAYMENT','CANCELED','EXPIRED','NEEDS_REVIEW') OR i.status NOT IN ('ISSUED','VOID') THEN RAISE EXCEPTION 'BILLING_ORDER_FINAL';END IF;
 ledger_ref:='hosted:'||md5(payment_mode||':'||payment_id);
 INSERT INTO public.platform_ledger_entries(id,organization_id,invoice_id,reference,direction,amount,currency,note,actor_id) VALUES(gen_random_uuid(),o.organization_id,i.id,ledger_ref,'IN',i.amount,i.currency,'System: verified hosted provider receipt',NULL);
 INSERT INTO public.billing_events(id,organization_id,order_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,o.id,'HOSTED_PAYMENT_SETTLED',jsonb_build_object('eventId',event_id,'checkoutId',checkout_id,'paymentId',payment_id,'mode',payment_mode,'amountMinor',amount_minor,'currency',payment_currency,'paidAt',paid_at,'provider','hosted'),gen_random_uuid());
 IF o.status='PENDING_PAYMENT' AND i.status='ISSUED' THEN UPDATE public.platform_invoices SET status='PAID' WHERE id=i.id;
 ELSE INSERT INTO public.billing_events(id,organization_id,order_id,action,detail,request_id) VALUES(gen_random_uuid(),o.organization_id,o.id,'LATE_PAYMENT_REVIEW_REQUIRED',jsonb_build_object('paymentId',payment_id),gen_random_uuid());END IF;
 RETURN 'RECORDED';
END $$;
REVOKE ALL ON FUNCTION billing_settle_hosted_payment(text,text,uuid,text,text,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_settle_hosted_payment(text,text,uuid,text,text,text,text,timestamptz) TO work_app;
COMMIT;
