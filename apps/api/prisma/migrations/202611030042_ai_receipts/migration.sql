BEGIN;
CREATE TABLE ai_provider_receipts(request_id uuid PRIMARY KEY,organization_id uuid NOT NULL,membership_id uuid NOT NULL,outcome varchar(20) NOT NULL,input_tokens integer NOT NULL,cached_input_tokens integer NOT NULL,output_tokens integer NOT NULL,response jsonb,error_code varchar(60),provider_response_id varchar(200),created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT ai_provider_receipts_request_fkey FOREIGN KEY(organization_id,request_id,membership_id) REFERENCES ai_requests(organization_id,id,membership_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT ai_receipt_usage CHECK(input_tokens>=0 AND cached_input_tokens BETWEEN 0 AND input_tokens AND output_tokens>=0),CONSTRAINT ai_receipt_outcome CHECK(outcome IN ('COMPLETED','FAILED')),
 CONSTRAINT ai_receipt_response CHECK(outcome<>'COMPLETED' OR response IS NOT NULL AND jsonb_typeof(response)='object' AND octet_length(response::text)<=2097152));
CREATE UNIQUE INDEX ai_provider_receipts_organization_id_request_id_membership_id_key ON ai_provider_receipts(organization_id,request_id,membership_id);
CREATE INDEX ai_provider_receipts_organization_id_membership_id_created_at_idx ON ai_provider_receipts(organization_id,membership_id,created_at);
ALTER TABLE ai_provider_receipts ENABLE ROW LEVEL SECURITY;ALTER TABLE ai_provider_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_receipt_owner ON ai_provider_receipts FOR SELECT TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.ai_owns_member(membership_id));
GRANT SELECT ON ai_provider_receipts TO work_app;
CREATE TRIGGER ai_receipt_immutable BEFORE UPDATE OR DELETE ON ai_provider_receipts FOR EACH ROW EXECUTE FUNCTION ai_immutable_record();

CREATE FUNCTION ai_record_receipt(target uuid,capability uuid,p_outcome text,p_input integer,p_cached integer,p_output integer,p_response jsonb,p_code text,p_provider_response text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.ai_requests%ROWTYPE;previous public.ai_provider_receipts%ROWTYPE;BEGIN
 SELECT q.* INTO r FROM public.ai_requests q WHERE q.id=target FOR UPDATE;
 IF NOT FOUND OR capability IS NULL OR r.lease_token IS DISTINCT FROM capability OR r.status NOT IN ('RUNNING','UNCERTAIN') THEN RETURN false;END IF;
 IF p_outcome NOT IN ('COMPLETED','FAILED') OR p_input IS NULL OR p_output IS NULL OR p_cached IS NULL OR p_input NOT BETWEEN 0 AND r.max_input_tokens OR p_cached NOT BETWEEN 0 AND p_input OR p_output NOT BETWEEN 0 AND r.max_output_tokens OR (p_outcome='COMPLETED' AND (p_response IS NULL OR jsonb_typeof(p_response)<>'object' OR octet_length(p_response::text)>2097152)) THEN RAISE EXCEPTION 'Invalid provider receipt';END IF;
 SELECT receipt.* INTO previous FROM public.ai_provider_receipts receipt WHERE receipt.request_id=target;
 IF FOUND THEN
  IF ROW(previous.outcome,previous.input_tokens,previous.cached_input_tokens,previous.output_tokens,previous.response,previous.error_code,previous.provider_response_id) IS DISTINCT FROM ROW(p_outcome,p_input,p_cached,p_output,p_response,p_code,p_provider_response) THEN RAISE EXCEPTION 'Provider receipt differs';END IF;RETURN true;
 END IF;
 INSERT INTO public.ai_provider_receipts(request_id,organization_id,membership_id,outcome,input_tokens,cached_input_tokens,output_tokens,response,error_code,provider_response_id) VALUES(target,r.organization_id,r.membership_id,p_outcome,p_input,p_cached,p_output,p_response,p_code,p_provider_response);
 RETURN true;
END $$;
CREATE FUNCTION ai_retry_receipts() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record;done integer:=0;ok boolean;BEGIN
 FOR item IN SELECT receipt.*,r.lease_token FROM public.ai_provider_receipts receipt JOIN public.ai_requests r ON r.id=receipt.request_id WHERE r.status IN ('RUNNING','UNCERTAIN') ORDER BY receipt.created_at,receipt.request_id LIMIT 20 LOOP
  BEGIN
   ok:=public.ai_settle_request(item.request_id,item.lease_token,item.outcome,item.input_tokens,item.cached_input_tokens,item.output_tokens,item.response,item.error_code,item.provider_response_id);
   IF ok THEN done:=done+1;END IF;
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.ai_requests SET status='UNCERTAIN',error_code='AI_ACCOUNTING_PENDING',lease_until=NULL WHERE id=item.request_id AND status IN ('RUNNING','UNCERTAIN') AND lease_token=item.lease_token;
  END;
 END LOOP;RETURN done;
END $$;
REVOKE ALL ON FUNCTION ai_record_receipt(uuid,uuid,text,integer,integer,integer,jsonb,text,text),ai_retry_receipts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_record_receipt(uuid,uuid,text,integer,integer,integer,jsonb,text,text),ai_retry_receipts() TO work_app;
COMMIT;
