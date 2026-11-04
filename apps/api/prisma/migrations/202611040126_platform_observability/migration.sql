BEGIN;
CREATE FUNCTION platform_ops_can(permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT permission ~ '^[a-z][a-z-]*\.(read|manage)$' AND EXISTS(SELECT 1 FROM public.platform_accounts a JOIN public.platform_sessions s ON s.account_id=a.id LEFT JOIN public.platform_roles r ON r.id=a.role_id
 WHERE a.id=NULLIF(current_setting('app.platform_account_id',true),'')::uuid AND s.id=NULLIF(current_setting('app.platform_session_id',true),'')::uuid AND a.disabled_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>now()
 AND s.created_at+make_interval(mins=>coalesce((SELECT session_minutes FROM public.platform_settings WHERE id='main'),60))>now() AND (a.is_owner OR permission=ANY(r.permissions)))
$$;
REVOKE ALL ON FUNCTION platform_ops_can(text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION platform_ops_can(text) TO work_app;
CREATE FUNCTION platform_storage_usage(term text,page_size integer,page_offset integer)
RETURNS TABLE(id uuid,name text,used_bytes bigint,reserved_bytes bigint,documents bigint,versions bigint,total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
BEGIN
 IF NOT public.platform_ops_can('storage.read') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY WITH chosen AS(SELECT o.id,o.name,count(*) OVER() AS total FROM public.organizations o WHERE o.name ILIKE '%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%' ORDER BY o.name,o.id LIMIT least(greatest(page_size,1),100) OFFSET greatest(page_offset,0))
 SELECT o.id,o.name::text,coalesce(u.used_bytes,0),coalesce(u.reserved_bytes,0),(SELECT count(*) FROM public.work_documents d WHERE d.organization_id=o.id),(SELECT count(*) FROM public.document_versions v WHERE v.organization_id=o.id),o.total
 FROM chosen o LEFT JOIN public.organization_storage_usage u ON u.organization_id=o.id ORDER BY o.name,o.id;
END $$;
REVOKE ALL ON FUNCTION platform_storage_usage(text,integer,integer) FROM PUBLIC;GRANT EXECUTE ON FUNCTION platform_storage_usage(text,integer,integer) TO work_app;
CREATE TABLE system_events(id uuid PRIMARY KEY,request_id uuid NOT NULL,category varchar(40) NOT NULL,method varchar(10) NOT NULL,route varchar(200) NOT NULL,created_at timestamptz(3) NOT NULL DEFAULT now());
CREATE INDEX system_events_created_at_idx ON system_events(created_at);CREATE INDEX system_events_request_id_idx ON system_events(request_id);
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;ALTER TABLE system_events FORCE ROW LEVEL SECURITY;
CREATE POLICY system_event_read ON system_events FOR SELECT TO work_app USING(public.platform_ops_can('monitoring.read'));
CREATE POLICY system_event_insert ON system_events FOR INSERT TO work_app WITH CHECK(true);
GRANT SELECT,INSERT ON system_events TO work_app;REVOKE UPDATE,DELETE,TRUNCATE ON system_events FROM work_app;
COMMIT;
