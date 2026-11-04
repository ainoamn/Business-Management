BEGIN;
DO $patch$ DECLARE definition text;needle text;BEGIN
 definition:=pg_get_functiondef('public.billing_cancel_order(uuid,integer,text)'::regprocedure);
 needle:='platform_ledger_entries.invoice_id=billing_cancel_order.invoice_id';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected invoice cancellation clause not found';END IF;
 definition:=replace(definition,'invoice_id uuid','target_invoice_id uuid');
 definition:=replace(definition,'INTO invoice_id','INTO target_invoice_id');
 definition:=replace(definition,'IF invoice_id IS NOT NULL','IF target_invoice_id IS NOT NULL');
 definition:=replace(definition,'id=invoice_id','id=target_invoice_id');
 definition:=replace(definition,needle,'platform_ledger_entries.invoice_id=target_invoice_id');
 EXECUTE definition;
END $patch$;
COMMIT;
