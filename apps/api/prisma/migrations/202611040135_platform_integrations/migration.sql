BEGIN;
CREATE FUNCTION platform_integration_counts()
RETURNS TABLE(kind text,connected bigint,pending bigint,disconnected bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
BEGIN
 IF NOT public.platform_ops_can('settings.read') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT i.kind::text,count(*) FILTER(WHERE i.status='CONNECTED'),count(*) FILTER(WHERE i.status='PENDING'),count(*) FILTER(WHERE i.status='DISCONNECTED') FROM public.organization_integrations i GROUP BY i.kind;
END $$;
REVOKE ALL ON FUNCTION platform_integration_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_integration_counts() TO work_app;
COMMIT;
