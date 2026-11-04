ALTER TABLE workflows ADD COLUMN schedule_cursor uuid;
CREATE FUNCTION workflow_yield_run(run uuid,token uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE public.workflow_runs SET status='WAITING',next_run_at=now(),lease_token=NULL,lease_until=NULL WHERE id=run AND lease_token=token AND status='RUNNING';
$$;
REVOKE ALL ON FUNCTION workflow_yield_run(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow_yield_run(uuid,uuid) TO work_app;
