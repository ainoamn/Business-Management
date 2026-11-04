BEGIN;
CREATE OR REPLACE FUNCTION ai_settle_request(target uuid,capability uuid,outcome text,p_input integer,p_cached integer,p_output integer,p_response jsonb,p_code text,p_provider_response text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE seed record;r public.ai_requests%ROWTYPE;usage public.ai_monthly_usage%ROWTYPE;wallet public.ai_wallets%ROWTYPE;provider_usage public.ai_provider_monthly_usage%ROWTYPE;charge integer;plan_charge integer;extra_charge integer;price numeric;proposal jsonb;position integer:=0;BEGIN
 SELECT q.provider_id,q.organization_id INTO seed FROM public.ai_requests q WHERE q.id=target;IF NOT FOUND THEN RETURN false;END IF;
 PERFORM p.id FROM public.ai_providers p WHERE p.id=seed.provider_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtext('AI_ORG:'||seed.organization_id::text));
 SELECT q.* INTO r FROM public.ai_requests q WHERE q.id=target FOR UPDATE;
 IF r.lease_token IS DISTINCT FROM capability OR capability IS NULL OR r.status NOT IN ('RESERVED','RUNNING','UNCERTAIN') THEN RETURN false;END IF;
 IF outcome NOT IN ('COMPLETED','FAILED','UNCERTAIN') THEN RAISE EXCEPTION 'Invalid AI outcome';END IF;
 IF p_provider_response IS NOT NULL AND p_provider_response !~ '^[A-Za-z0-9_.:-]{1,200}$' THEN RAISE EXCEPTION 'Invalid provider reference';END IF;
 IF p_code IS NOT NULL AND p_code NOT IN ('AI_PROVIDER_AUTH','AI_MODEL_UNSUPPORTED','AI_PROVIDER_RATE_LIMIT','AI_OUTPUT_INVALID','AI_OUTPUT_INCOMPLETE','AI_PROVIDER_NOT_CONFIGURED','AI_AUTHORIZATION_REVOKED','AI_CONTEXT_CHANGED','AI_REQUEST_EXPIRED','AI_PROVIDER_UNCERTAIN','AI_USAGE_INVALID','AI_MANUAL_RECONCILIATION','AI_CONFIGURATION_CHANGED','AI_POLICY_DISABLED','AI_CONSENT_REQUIRED','AI_ORG_UNAVAILABLE') THEN RAISE EXCEPTION 'Invalid AI error code';END IF;
 IF outcome='UNCERTAIN' THEN
  IF r.status='UNCERTAIN' THEN RETURN false;END IF;
  IF r.status<>'RUNNING' THEN RAISE EXCEPTION 'Only a dispatched request may be uncertain';END IF;
  UPDATE public.ai_requests SET status='UNCERTAIN',error_code=coalesce(p_code,'AI_PROVIDER_UNCERTAIN'),lease_until=NULL,provider_response_id=p_provider_response WHERE id=target;
  INSERT INTO public.ai_audit(id,organization_id,membership_id,request_id,action,detail) VALUES(gen_random_uuid(),r.organization_id,r.membership_id,target,'UNCERTAIN',jsonb_build_object('code',coalesce(p_code,'AI_PROVIDER_UNCERTAIN')));RETURN true;
 END IF;
 IF outcome='COMPLETED' AND (r.status='RESERVED' OR p_response IS NULL OR jsonb_typeof(p_response)<>'object' OR jsonb_typeof(p_response->'answer')<>'string' OR length(p_response->>'answer')>32000 OR jsonb_typeof(p_response->'proposals')<>'array' OR jsonb_array_length(p_response->'proposals')>5) THEN RAISE EXCEPTION 'Invalid AI response';END IF;
 IF p_input IS NULL OR p_cached IS NULL OR p_output IS NULL OR p_input NOT BETWEEN 0 AND r.max_input_tokens OR p_cached NOT BETWEEN 0 AND p_input OR p_output NOT BETWEEN 0 AND r.max_output_tokens THEN RAISE EXCEPTION 'Invalid AI usage';END IF;
 charge:=ceil((p_input::numeric+p_output::numeric)*r.credit_multiplier/1000)::integer;
 price:=round(((p_input-p_cached)::numeric*r.input_price_usd+p_cached::numeric*r.cached_input_price_usd+p_output::numeric*r.output_price_usd)/1000000,9);
 IF charge>r.reserved_plan+r.reserved_extra OR price>r.reserved_usd THEN RAISE EXCEPTION 'AI usage exceeds reservation';END IF;
 SELECT u.* INTO usage FROM public.ai_monthly_usage u WHERE u.organization_id=r.organization_id AND u.period_start=r.period_start FOR UPDATE;
 SELECT w.* INTO wallet FROM public.ai_wallets w WHERE w.organization_id=r.organization_id FOR UPDATE;
 SELECT u.* INTO provider_usage FROM public.ai_provider_monthly_usage u WHERE u.provider_id=r.provider_id AND u.period_start=r.provider_period_start FOR UPDATE;
 IF usage.reserved_plan<r.reserved_plan OR usage.reserved_usd<r.reserved_usd OR wallet.reserved_extra<r.reserved_extra OR provider_usage.reserved_usd<r.reserved_usd THEN RAISE EXCEPTION 'AI reservation balance mismatch';END IF;
 plan_charge:=least(charge,r.reserved_plan);extra_charge:=charge-plan_charge;
 UPDATE public.ai_monthly_usage u SET plan_used=u.plan_used+plan_charge,reserved_plan=u.reserved_plan-r.reserved_plan,used_credits=u.used_credits+charge,input_tokens=u.input_tokens+p_input,cached_input_tokens=u.cached_input_tokens+p_cached,output_tokens=u.output_tokens+p_output,cost_usd=u.cost_usd+price,reserved_usd=u.reserved_usd-r.reserved_usd WHERE u.organization_id=r.organization_id AND u.period_start=r.period_start;
 UPDATE public.ai_wallets w SET available_extra=w.available_extra+r.reserved_extra-extra_charge,reserved_extra=w.reserved_extra-r.reserved_extra,version=w.version+1 WHERE w.organization_id=r.organization_id;
 UPDATE public.ai_provider_monthly_usage u SET cost_usd=u.cost_usd+price,reserved_usd=u.reserved_usd-r.reserved_usd,input_tokens=u.input_tokens+p_input,output_tokens=u.output_tokens+p_output WHERE u.provider_id=r.provider_id AND u.period_start=r.provider_period_start;
 IF extra_charge>0 THEN INSERT INTO public.ai_credit_entries(id,organization_id,credits,kind,reference,reason,request_id) VALUES(gen_random_uuid(),r.organization_id,-extra_charge,'CONSUME','consume:'||r.id::text,'AI request usage',r.id);END IF;
 UPDATE public.ai_requests SET status=outcome,charged_credits=charge,input_tokens=p_input,cached_input_tokens=p_cached,output_tokens=p_output,cost_usd=price,error_code=CASE WHEN outcome='FAILED' THEN coalesce(p_code,'AI_OUTPUT_INVALID') ELSE NULL END,provider_response_id=p_provider_response,finished_at=clock_timestamp(),lease_token=NULL,lease_until=NULL WHERE id=target;
 IF outcome='COMPLETED' AND EXISTS(SELECT 1 FROM public.ai_conversations c WHERE c.id=r.conversation_id AND c.organization_id=r.organization_id AND c.erased_at IS NULL) THEN
  INSERT INTO public.ai_messages(id,organization_id,conversation_id,membership_id,request_id,role,body,result) VALUES(gen_random_uuid(),r.organization_id,r.conversation_id,r.membership_id,r.id,'ASSISTANT',p_response->>'answer',p_response);
  FOR proposal IN SELECT value FROM jsonb_array_elements(p_response->'proposals') LOOP
   IF jsonb_typeof(proposal)<>'object' OR proposal->>'kind' NOT IN ('CREATE_TASK','CREATE_PROJECT') OR length(proposal->>'title') NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Invalid AI proposal';END IF;
   INSERT INTO public.ai_drafts(id,organization_id,membership_id,request_id,position,kind,proposal) VALUES(gen_random_uuid(),r.organization_id,r.membership_id,r.id,position,proposal->>'kind',proposal);position:=position+1;
  END LOOP;
 END IF;
 INSERT INTO public.ai_audit(id,organization_id,membership_id,request_id,action,detail) VALUES(gen_random_uuid(),r.organization_id,r.membership_id,r.id,outcome,jsonb_build_object('credits',charge,'inputTokens',p_input,'outputTokens',p_output,'estimatedCostUsd',price,'code',p_code));RETURN true;
END $$;

CREATE OR REPLACE FUNCTION ai_record_receipt(target uuid,capability uuid,p_outcome text,p_input integer,p_cached integer,p_output integer,p_response jsonb,p_code text,p_provider_response text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.ai_requests%ROWTYPE;previous public.ai_provider_receipts%ROWTYPE;safe_response jsonb:=p_response;BEGIN
 SELECT q.* INTO r FROM public.ai_requests q WHERE q.id=target FOR UPDATE;
 IF NOT FOUND OR capability IS NULL OR r.lease_token IS DISTINCT FROM capability OR r.status NOT IN ('RUNNING','UNCERTAIN') THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.ai_conversations c WHERE c.id=r.conversation_id AND c.organization_id=r.organization_id AND c.erased_at IS NOT NULL) THEN safe_response:=CASE WHEN p_outcome='COMPLETED' THEN '{"answer":"","sources":[],"confidence":"LOW","dataSufficiency":"NONE","limitations":"","proposals":[]}'::jsonb ELSE NULL END;END IF;
 IF p_outcome NOT IN ('COMPLETED','FAILED') OR p_input IS NULL OR p_output IS NULL OR p_cached IS NULL OR p_input NOT BETWEEN 0 AND r.max_input_tokens OR p_cached NOT BETWEEN 0 AND p_input OR p_output NOT BETWEEN 0 AND r.max_output_tokens OR (p_outcome='COMPLETED' AND (safe_response IS NULL OR jsonb_typeof(safe_response)<>'object' OR octet_length(safe_response::text)>2097152)) THEN RAISE EXCEPTION 'Invalid provider receipt';END IF;
 SELECT receipt.* INTO previous FROM public.ai_provider_receipts receipt WHERE receipt.request_id=target;
 IF FOUND THEN
  IF ROW(previous.outcome,previous.input_tokens,previous.cached_input_tokens,previous.output_tokens,previous.response,previous.error_code,previous.provider_response_id) IS DISTINCT FROM ROW(p_outcome,p_input,p_cached,p_output,safe_response,p_code,p_provider_response) THEN RAISE EXCEPTION 'Provider receipt differs';END IF;RETURN true;
 END IF;
 INSERT INTO public.ai_provider_receipts(request_id,organization_id,membership_id,outcome,input_tokens,cached_input_tokens,output_tokens,response,error_code,provider_response_id) VALUES(target,r.organization_id,r.membership_id,p_outcome,p_input,p_cached,p_output,safe_response,p_code,p_provider_response);
 RETURN true;
END $$;


CREATE OR REPLACE FUNCTION ai_identity_fixed() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.membership_id IS DISTINCT FROM OLD.membership_id THEN RAISE EXCEPTION 'AI ownership is immutable'; END IF;
 IF current_user<>session_user AND current_setting('app.ai_private_erasure',true)='owned' THEN
  IF TG_TABLE_NAME='ai_requests' THEN
   IF NEW.context_manifest='[]'::jsonb AND NEW.context_spec='{}'::jsonb AND (to_jsonb(NEW)-ARRAY['context_manifest','context_spec'])=(to_jsonb(OLD)-ARRAY['context_manifest','context_spec']) THEN RETURN NEW;END IF;
  END IF;
  IF TG_TABLE_NAME='ai_drafts' THEN
   IF NEW.proposal='{}'::jsonb AND NEW.version=OLD.version+1 AND NEW.status=(CASE WHEN OLD.status='PENDING' THEN 'DISCARDED' ELSE OLD.status END) AND (to_jsonb(NEW)-ARRAY['proposal','status','version'])=(to_jsonb(OLD)-ARRAY['proposal','status','version']) THEN RETURN NEW;END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='ai_requests' AND (to_jsonb(NEW)-ARRAY['status','charged_credits','input_tokens','cached_input_tokens','output_tokens','cost_usd','provider_response_id','error_code','lease_token','lease_until','finished_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','charged_credits','input_tokens','cached_input_tokens','output_tokens','cost_usd','provider_response_id','error_code','lease_token','lease_until','finished_at']) THEN RAISE EXCEPTION 'AI request snapshot is immutable'; END IF;
 IF TG_TABLE_NAME='ai_drafts' THEN IF OLD.status<>'PENDING' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'A final AI draft is immutable'; END IF;END IF;
 IF TG_TABLE_NAME='ai_conversations' THEN IF OLD.erased_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'An erased conversation cannot be restored';END IF;END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION ai_private_history_fixed() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' AND current_user<>session_user AND current_setting('app.ai_private_erasure',true)='owned' THEN
  IF TG_TABLE_NAME='ai_messages' THEN IF NEW.body='' AND NEW.result IS NULL AND (to_jsonb(NEW)-ARRAY['body','result'])=(to_jsonb(OLD)-ARRAY['body','result']) THEN RETURN NEW;END IF;END IF;
  IF TG_TABLE_NAME='ai_provider_receipts' THEN IF NEW.response IS NOT DISTINCT FROM (CASE WHEN OLD.outcome='COMPLETED' THEN '{"answer":"","sources":[],"confidence":"LOW","dataSufficiency":"NONE","limitations":"","proposals":[]}'::jsonb ELSE NULL END) AND (to_jsonb(NEW)-'response')=(to_jsonb(OLD)-'response') THEN RETURN NEW;END IF;END IF;
 END IF;
 RAISE EXCEPTION 'AI private history is immutable outside an authenticated erasure';
END $$;
DROP TRIGGER ai_receipt_immutable ON ai_provider_receipts;
CREATE TRIGGER ai_receipt_immutable BEFORE UPDATE OR DELETE ON ai_provider_receipts FOR EACH ROW EXECUTE FUNCTION ai_private_history_fixed();
CREATE TRIGGER ai_message_immutable BEFORE UPDATE OR DELETE ON ai_messages FOR EACH ROW EXECUTE FUNCTION ai_private_history_fixed();
ALTER TABLE ai_conversations ADD CONSTRAINT ai_erased_conversation_state CHECK(erased_at IS NULL OR title='' AND archived_at IS NOT NULL);
CREATE FUNCTION ai_erase_conversation(target uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE conversation public.ai_conversations%ROWTYPE;BEGIN
 SELECT c.* INTO conversation FROM public.ai_conversations c WHERE c.id=target AND c.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 IF NOT FOUND OR NOT public.ai_owns_member(conversation.membership_id) THEN RAISE EXCEPTION 'Own conversation required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('AI_ORG:'||conversation.organization_id::text));
 SELECT c.* INTO conversation FROM public.ai_conversations c WHERE c.id=target FOR UPDATE;
 IF conversation.erased_at IS NOT NULL THEN RETURN false;END IF;
 PERFORM r.id FROM public.ai_requests r WHERE r.organization_id=conversation.organization_id AND r.conversation_id=target ORDER BY r.id FOR UPDATE;
 UPDATE public.ai_conversations SET title='',archived_at=coalesce(archived_at,now()),erased_at=now() WHERE id=target;
 PERFORM set_config('app.ai_private_erasure','owned',true);
 UPDATE public.ai_messages SET body='',result=NULL WHERE organization_id=conversation.organization_id AND conversation_id=target;
 UPDATE public.ai_provider_receipts receipt SET response=CASE WHEN receipt.outcome='COMPLETED' THEN '{"answer":"","sources":[],"confidence":"LOW","dataSufficiency":"NONE","limitations":"","proposals":[]}'::jsonb ELSE NULL END WHERE receipt.organization_id=conversation.organization_id AND EXISTS(SELECT 1 FROM public.ai_requests r WHERE r.id=receipt.request_id AND r.organization_id=conversation.organization_id AND r.conversation_id=target);
 UPDATE public.ai_drafts draft SET proposal='{}'::jsonb,status=CASE WHEN draft.status='PENDING' THEN 'DISCARDED' ELSE draft.status END,version=draft.version+1 WHERE draft.organization_id=conversation.organization_id AND EXISTS(SELECT 1 FROM public.ai_requests r WHERE r.id=draft.request_id AND r.organization_id=conversation.organization_id AND r.conversation_id=target);
 UPDATE public.ai_requests SET context_manifest='[]'::jsonb,context_spec='{}'::jsonb WHERE organization_id=conversation.organization_id AND conversation_id=target;
 INSERT INTO public.ai_audit(id,organization_id,membership_id,action,detail) VALUES(gen_random_uuid(),conversation.organization_id,conversation.membership_id,'CONVERSATION_ERASED',jsonb_build_object('conversationId',target));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION ai_private_history_fixed(),ai_erase_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_erase_conversation(uuid) TO work_app;

COMMIT;
