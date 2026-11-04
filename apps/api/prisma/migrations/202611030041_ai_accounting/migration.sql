BEGIN;
CREATE FUNCTION ai_grant_credits(target uuid,amount integer,external_reference text,explanation text)
RETURNS TABLE(id uuid,credits integer,available_extra integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous public.ai_credit_entries%ROWTYPE;wallet public.ai_wallets%ROWTYPE;entry_id uuid;BEGIN
 IF NOT public.ai_platform_can('ai.manage') THEN RAISE EXCEPTION 'AI management required' USING ERRCODE='42501';END IF;
 IF amount NOT BETWEEN 1 AND 100000000 OR external_reference NOT LIKE 'grant:%' OR length(external_reference) NOT BETWEEN 9 AND 126 OR length(explanation) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Invalid credit grant' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=target AND o.deleted_at IS NULL) THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='P0002';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('AI_ORG:'||target::text));
 SELECT e.* INTO previous FROM public.ai_credit_entries e WHERE e.organization_id=target AND e.reference=external_reference;
 IF FOUND THEN
  IF previous.credits<>amount OR previous.reason<>explanation OR previous.kind<>'GRANT' THEN RAISE EXCEPTION 'Credit reference already used' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT previous.id,previous.credits,w.available_extra FROM public.ai_wallets w WHERE w.organization_id=target;RETURN;
 END IF;
 INSERT INTO public.ai_wallets(organization_id) VALUES(target) ON CONFLICT DO NOTHING;
 SELECT w.* INTO wallet FROM public.ai_wallets w WHERE w.organization_id=target FOR UPDATE;
 IF wallet.available_extra::bigint+wallet.reserved_extra::bigint+amount>1000000000 THEN RAISE EXCEPTION 'Wallet limit reached' USING ERRCODE='22003';END IF;
 entry_id:=gen_random_uuid();INSERT INTO public.ai_credit_entries(id,organization_id,credits,kind,reference,reason,platform_actor_id) VALUES(entry_id,target,amount,'GRANT',external_reference,explanation,NULLIF(current_setting('app.platform_account_id',true),'')::uuid);
 UPDATE public.ai_wallets w SET available_extra=w.available_extra+amount,version=w.version+1 WHERE w.organization_id=target;
 INSERT INTO public.ai_audit(id,organization_id,action,detail) VALUES(gen_random_uuid(),target,'CREDITS_GRANTED',jsonb_build_object('credits',amount,'reference',external_reference));
 RETURN QUERY SELECT entry_id,amount,w.available_extra FROM public.ai_wallets w WHERE w.organization_id=target;
END $$;

CREATE FUNCTION ai_settle_request(target uuid,capability uuid,outcome text,p_input integer,p_cached integer,p_output integer,p_response jsonb,p_code text,p_provider_response text)
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
 IF outcome='COMPLETED' THEN
  INSERT INTO public.ai_messages(id,organization_id,conversation_id,membership_id,request_id,role,body,result) VALUES(gen_random_uuid(),r.organization_id,r.conversation_id,r.membership_id,r.id,'ASSISTANT',p_response->>'answer',p_response);
  FOR proposal IN SELECT value FROM jsonb_array_elements(p_response->'proposals') LOOP
   IF jsonb_typeof(proposal)<>'object' OR proposal->>'kind' NOT IN ('CREATE_TASK','CREATE_PROJECT') OR length(proposal->>'title') NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Invalid AI proposal';END IF;
   INSERT INTO public.ai_drafts(id,organization_id,membership_id,request_id,position,kind,proposal) VALUES(gen_random_uuid(),r.organization_id,r.membership_id,r.id,position,proposal->>'kind',proposal);position:=position+1;
  END LOOP;
 END IF;
 INSERT INTO public.ai_audit(id,organization_id,membership_id,request_id,action,detail) VALUES(gen_random_uuid(),r.organization_id,r.membership_id,r.id,outcome,jsonb_build_object('credits',charge,'inputTokens',p_input,'outputTokens',p_output,'estimatedCostUsd',price,'code',p_code));RETURN true;
END $$;

CREATE FUNCTION ai_expire_requests() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record;changed integer:=0;ok boolean;BEGIN
 FOR item IN SELECT r.id,r.lease_token,r.status FROM public.ai_requests r WHERE r.status IN ('RESERVED','RUNNING') AND r.lease_until<now() ORDER BY r.lease_until,r.id LIMIT 100 LOOP
  IF item.status='RESERVED' THEN ok:=public.ai_settle_request(item.id,item.lease_token,'FAILED',0,0,0,NULL,'AI_REQUEST_EXPIRED',NULL);
  ELSE ok:=public.ai_settle_request(item.id,item.lease_token,'UNCERTAIN',NULL,NULL,NULL,NULL,'AI_PROVIDER_UNCERTAIN',NULL);END IF;
  IF ok THEN changed:=changed+1;END IF;
 END LOOP;RETURN changed;
END $$;
CREATE FUNCTION ai_resolve_request(target uuid,p_input integer,p_cached integer,p_output integer,explanation text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.ai_requests%ROWTYPE;ok boolean;BEGIN
 IF NOT public.ai_platform_can('ai.manage') THEN RAISE EXCEPTION 'AI management required' USING ERRCODE='42501';END IF;
 IF length(explanation) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Reconciliation reason required';END IF;
 SELECT q.* INTO r FROM public.ai_requests q WHERE q.id=target;IF NOT FOUND OR r.status<>'UNCERTAIN' THEN RETURN false;END IF;
 ok:=public.ai_settle_request(target,r.lease_token,'FAILED',p_input,p_cached,p_output,NULL,'AI_MANUAL_RECONCILIATION',r.provider_response_id);
 IF ok THEN INSERT INTO public.ai_audit(id,organization_id,request_id,action,detail) VALUES(gen_random_uuid(),r.organization_id,r.id,'MANUALLY_RECONCILED',jsonb_build_object('reason',explanation,'platformActorId',current_setting('app.platform_account_id',true)));END IF;RETURN ok;
END $$;
CREATE FUNCTION ai_platform_usage(search text,limit_rows integer,offset_rows integer)
RETURNS TABLE(organization_id uuid,organization_name text,credits bigint,estimated_cost_usd numeric,reserved_usd numeric,total_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
 IF NOT public.ai_platform_can('ai.read') THEN RAISE EXCEPTION 'AI usage access required' USING ERRCODE='42501';END IF;
 IF limit_rows NOT BETWEEN 1 AND 100 OR offset_rows NOT BETWEEN 0 AND 10000000 OR length(search)>100 THEN RAISE EXCEPTION 'Invalid AI usage query';END IF;
 RETURN QUERY SELECT u.organization_id,o.name::text,sum(u.used_credits)::bigint,sum(u.cost_usd),sum(u.reserved_usd),count(*) OVER() FROM public.ai_monthly_usage u JOIN public.organizations o ON o.id=u.organization_id WHERE o.name ILIKE '%'||search||'%' GROUP BY u.organization_id,o.name ORDER BY o.name,u.organization_id LIMIT limit_rows OFFSET offset_rows;
END $$;
REVOKE ALL ON FUNCTION ai_grant_credits(uuid,integer,text,text),ai_settle_request(uuid,uuid,text,integer,integer,integer,jsonb,text,text),ai_expire_requests(),ai_resolve_request(uuid,integer,integer,integer,text),ai_platform_usage(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_grant_credits(uuid,integer,text,text),ai_settle_request(uuid,uuid,text,integer,integer,integer,jsonb,text,text),ai_expire_requests(),ai_resolve_request(uuid,integer,integer,integer,text),ai_platform_usage(text,integer,integer) TO work_app;
COMMIT;
