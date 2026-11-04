BEGIN;
CREATE FUNCTION ai_platform_pending(limit_rows integer,offset_rows integer)
RETURNS TABLE(id uuid,organization_name text,model_name text,provider_name text,provider_response_id text,input_limit integer,output_limit integer,reserved_credits integer,reserved_usd numeric,error_code text,created_at timestamptz,has_receipt boolean,total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
 IF NOT public.ai_platform_can('ai.read') THEN RAISE EXCEPTION 'AI usage access required' USING ERRCODE='42501';END IF;
 IF limit_rows NOT BETWEEN 1 AND 100 OR offset_rows NOT BETWEEN 0 AND 10000000 THEN RAISE EXCEPTION 'Invalid pagination';END IF;
 RETURN QUERY SELECT q.id,o.name::text,q.model_name::text,q.provider_name::text,q.provider_response_id::text,q.max_input_tokens,q.max_output_tokens,q.reserved_plan+q.reserved_extra,q.reserved_usd,q.error_code::text,q.created_at,EXISTS(SELECT 1 FROM public.ai_provider_receipts r WHERE r.request_id=q.id),count(*) OVER()
 FROM public.ai_requests q JOIN public.organizations o ON o.id=q.organization_id WHERE q.status='UNCERTAIN' ORDER BY q.created_at,q.id LIMIT limit_rows OFFSET offset_rows;
END $$;
REVOKE ALL ON FUNCTION ai_platform_pending(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_platform_pending(integer,integer) TO work_app;
COMMIT;
