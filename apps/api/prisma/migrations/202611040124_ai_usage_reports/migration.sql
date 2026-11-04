CREATE FUNCTION work_ai_usage_metadata(p_from timestamptz,p_to timestamptz)
RETURNS TABLE(id uuid,membership_id uuid,department_id uuid,purpose text,model_name text,status text,charged_credits integer,reserved_credits integer,cost_usd numeric,reserved_usd numeric,input_tokens integer,output_tokens integer,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
 SELECT r.id,r.membership_id,m.department_id,r.purpose::text,r.model_name::text,r.status::text,r.charged_credits,r.reserved_plan+r.reserved_extra,r.cost_usd,r.reserved_usd,r.input_tokens,r.output_tokens,r.created_at
 FROM public.ai_requests r JOIN public.memberships m ON m.organization_id=r.organization_id AND m.id=r.membership_id
 WHERE r.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member()
 AND (public.ai_member_global('ai.read') OR public.ai_member_global('ai.manage') OR public.ai_owns_member(r.membership_id))
 AND (p_from IS NULL OR r.created_at>=p_from) AND (p_to IS NULL OR r.created_at<p_to)
$$;
REVOKE ALL ON FUNCTION work_ai_usage_metadata(timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_ai_usage_metadata(timestamptz,timestamptz) TO work_app;
