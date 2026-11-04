BEGIN;
CREATE FUNCTION ai_active_request_counts(target_provider uuid,target_organization uuid,target_member uuid)
RETURNS TABLE(provider_count bigint,organization_count bigint,member_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
 IF NOT public.ai_member_can_use() OR target_organization IS DISTINCT FROM NULLIF(current_setting('app.organization_id',true),'')::uuid OR NOT public.ai_owns_member(target_member) THEN RAISE EXCEPTION 'AI access required' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT count(*) FILTER(WHERE r.provider_id=target_provider),count(*) FILTER(WHERE r.organization_id=target_organization),count(*) FILTER(WHERE r.organization_id=target_organization AND r.membership_id=target_member) FROM public.ai_requests r WHERE r.status IN ('RESERVED','RUNNING') AND r.lease_until>now() AND (r.provider_id=target_provider OR r.organization_id=target_organization);
END $$;
CREATE OR REPLACE FUNCTION ai_resolve_request(target uuid,p_input integer,p_cached integer,p_output integer,explanation text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.ai_requests%ROWTYPE;ok boolean;BEGIN
 IF NOT public.ai_platform_can('ai.manage') THEN RAISE EXCEPTION 'AI management required' USING ERRCODE='42501';END IF;
 IF length(explanation) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Reconciliation reason required';END IF;
 IF EXISTS(SELECT 1 FROM public.ai_provider_receipts receipt WHERE receipt.request_id=target) THEN RAISE EXCEPTION 'A recorded provider receipt must be settled from its recorded usage';END IF;
 SELECT q.* INTO r FROM public.ai_requests q WHERE q.id=target;IF NOT FOUND OR r.status<>'UNCERTAIN' THEN RETURN false;END IF;
 ok:=public.ai_settle_request(target,r.lease_token,'FAILED',p_input,p_cached,p_output,NULL,'AI_MANUAL_RECONCILIATION',r.provider_response_id);
 IF ok THEN INSERT INTO public.ai_audit(id,organization_id,request_id,action,detail) VALUES(gen_random_uuid(),r.organization_id,r.id,'MANUALLY_RECONCILED',jsonb_build_object('reason',explanation,'platformActorId',current_setting('app.platform_account_id',true)));END IF;RETURN ok;
END $$;
REVOKE ALL ON FUNCTION ai_active_request_counts(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_active_request_counts(uuid,uuid,uuid) TO work_app;
CREATE INDEX ai_requests_active_org ON ai_requests(organization_id,lease_until) WHERE status IN ('RESERVED','RUNNING');
CREATE INDEX ai_requests_active_provider ON ai_requests(provider_id,lease_until) WHERE status IN ('RESERVED','RUNNING');
COMMIT;
