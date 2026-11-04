CREATE FUNCTION workflow_pause_unavailable_executors() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record;paused integer:=0;BEGIN
 FOR item IN SELECT w.id,w.organization_id,m.user_id FROM public.workflows w JOIN public.memberships m ON m.organization_id=w.organization_id AND m.id=w.activated_by_id JOIN public.users u ON u.id=m.user_id JOIN public.organizations o ON o.id=w.organization_id
 WHERE w.status='ACTIVE' AND (NOT m.active OR u.disabled_at IS NOT NULL OR u.deleted_at IS NOT NULL OR u.email_verified_at IS NULL OR o.suspended_at IS NOT NULL) ORDER BY w.id LIMIT 100 FOR UPDATE OF w SKIP LOCKED LOOP
 UPDATE public.workflows SET status='PAUSED',version=version+1,next_schedule_at=NULL,updated_at=now() WHERE id=item.id;
 INSERT INTO public.audit_logs(id,organization_id,actor_id,action,resource_type,resource_id,request_id) VALUES(gen_random_uuid(),item.organization_id,item.user_id,'WORKFLOW_EXECUTOR_UNAVAILABLE','workflow',item.id,gen_random_uuid());paused:=paused+1;
 END LOOP;
 FOR item IN SELECT r.id FROM public.workflow_runs r JOIN public.workflows w ON w.id=r.workflow_id AND w.organization_id=r.organization_id WHERE w.status='PAUSED' AND r.status='RUNNING' ORDER BY r.id LIMIT 100 FOR UPDATE OF r SKIP LOCKED LOOP
 UPDATE public.workflow_runs SET status='WAITING',next_run_at=now(),lease_token=NULL,lease_until=NULL WHERE id=item.id;
 END LOOP;
 RETURN paused;
END $$;
REVOKE ALL ON FUNCTION workflow_pause_unavailable_executors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow_pause_unavailable_executors() TO work_app;
