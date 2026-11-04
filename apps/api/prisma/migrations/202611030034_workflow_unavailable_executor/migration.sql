CREATE FUNCTION workflow_fail_claimed_run(run uuid,token uuid,code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE node uuid;BEGIN
 SELECT r.current_node_key INTO node FROM public.workflow_runs r WHERE r.id=run AND r.lease_token=token AND r.status='RUNNING' FOR UPDATE;
 IF FOUND THEN PERFORM public.workflow_fail_run(run,token,node,code,false);END IF;
END $$;
CREATE FUNCTION workflow_record_unavailable_executor(event uuid,token uuid,target uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record;new_run uuid;code text;BEGIN
 SELECT w.id,w.organization_id,w.current_revision_id,w.activated_by_id,r.graph,e.id AS event_id,e.chain_id,o.suspended_at INTO item
 FROM public.workflow_events e JOIN public.workflows w ON w.organization_id=e.organization_id AND w.id=target AND w.status='ACTIVE' AND e.created_at>=w.activated_at AND (e.target_workflow_id IS NULL OR e.target_workflow_id=w.id)
 JOIN public.workflow_revisions r ON r.id=w.current_revision_id AND r.organization_id=w.organization_id
 JOIN public.workflow_triggers t ON t.revision_id=r.id AND t.kind=e.kind
 JOIN public.memberships m ON m.id=w.activated_by_id AND m.organization_id=w.organization_id
 JOIN public.users u ON u.id=m.user_id JOIN public.organizations o ON o.id=w.organization_id
 WHERE e.id=event AND e.lease_token=token AND e.status='PROCESSING' AND (NOT m.active OR u.disabled_at IS NOT NULL OR u.deleted_at IS NOT NULL OR u.email_verified_at IS NULL OR o.suspended_at IS NOT NULL)
 FOR UPDATE OF w;
 IF NOT FOUND THEN RETURN;END IF;
 code:=CASE WHEN item.suspended_at IS NOT NULL THEN 'ORG_UNAVAILABLE' ELSE 'ACCOUNT_UNAVAILABLE' END;
 INSERT INTO public.workflow_runs(id,organization_id,workflow_id,revision_id,event_id,chain_id,executor_id,current_node_key,status,error_code,finished_at)
 VALUES(gen_random_uuid(),item.organization_id,item.id,item.current_revision_id,item.event_id,item.chain_id,item.activated_by_id,(item.graph->>'entry')::uuid,'FAILED',code,now())
 ON CONFLICT(organization_id,workflow_id,chain_id) DO NOTHING RETURNING id INTO new_run;
 IF new_run IS NOT NULL THEN INSERT INTO public.workflow_execution_logs(id,organization_id,run_id,actor_id,kind,detail) VALUES(gen_random_uuid(),item.organization_id,new_run,item.activated_by_id,'FAILED',jsonb_build_object('code',code));END IF;
 UPDATE public.workflows SET status='PAUSED',next_schedule_at=NULL,version=version+1,updated_at=now() WHERE id=item.id;
END $$;
REVOKE ALL ON FUNCTION workflow_fail_claimed_run(uuid,uuid,text),workflow_record_unavailable_executor(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow_fail_claimed_run(uuid,uuid,text),workflow_record_unavailable_executor(uuid,uuid,uuid) TO work_app;
