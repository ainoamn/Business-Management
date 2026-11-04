CREATE FUNCTION workflow_claim_events() RETURNS TABLE(event_id uuid,organization_id uuid,kind text,resource_type text,resource_id uuid,actor_user_id uuid,target_workflow_id uuid,chain_id uuid,depth integer,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; token uuid; BEGIN
 FOR item IN SELECT e.* FROM public.workflow_events e WHERE e.attempts<5 AND ((e.status='PENDING' AND e.next_attempt_at<=now()) OR (e.status='PROCESSING' AND e.lease_until<now())) ORDER BY e.next_attempt_at,e.created_at LIMIT 20 FOR UPDATE SKIP LOCKED LOOP
 token:=gen_random_uuid();UPDATE public.workflow_events SET status='PROCESSING',attempts=attempts+1,lease_token=token,lease_until=now()+interval '2 minutes' WHERE id=item.id;
 event_id:=item.id;organization_id:=item.organization_id;kind:=item.kind;resource_type:=item.resource_type;resource_id:=item.resource_id;actor_user_id:=item.actor_user_id;target_workflow_id:=item.target_workflow_id;chain_id:=item.chain_id;depth:=item.depth;lease_token:=token;RETURN NEXT;
 END LOOP;
END $$;
CREATE FUNCTION workflow_finish_event(event uuid,token uuid,success boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.workflow_events SET status=CASE WHEN success THEN 'DONE' WHEN attempts>=5 THEN 'FAILED' ELSE 'PENDING' END,next_attempt_at=now()+interval '5 seconds'*power(2,attempts)::integer,lease_token=NULL,lease_until=NULL WHERE id=event AND lease_token=token AND status='PROCESSING';
END $$;
CREATE FUNCTION workflow_claim_runs() RETURNS TABLE(run_id uuid,organization_id uuid,workflow_id uuid,executor_id uuid,executor_user_id uuid,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; token uuid; BEGIN
 FOR item IN SELECT r.id,r.organization_id,r.workflow_id,r.executor_id,m.user_id FROM public.workflow_runs r JOIN public.workflows w ON w.id=r.workflow_id AND w.organization_id=r.organization_id JOIN public.memberships m ON m.id=r.executor_id AND m.organization_id=r.organization_id
 WHERE w.status='ACTIVE' AND ((r.status IN ('PENDING','WAITING') AND r.next_run_at<=now()) OR (r.status='RUNNING' AND r.lease_until<now())) ORDER BY r.next_run_at,r.created_at LIMIT 20 FOR UPDATE OF r SKIP LOCKED LOOP
 token:=gen_random_uuid();UPDATE public.workflow_runs SET status='RUNNING',lease_token=token,lease_until=now()+interval '2 minutes',started_at=COALESCE(started_at,now()) WHERE id=item.id;
 run_id:=item.id;organization_id:=item.organization_id;workflow_id:=item.workflow_id;executor_id:=item.executor_id;executor_user_id:=item.user_id;lease_token:=token;RETURN NEXT;
 END LOOP;
END $$;
CREATE FUNCTION workflow_fail_run(run uuid,token uuid,node uuid,code text,transient_failure boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; retry boolean; BEGIN
 IF code NOT IN ('AUTHORIZATION_REVOKED','ACCOUNT_UNAVAILABLE','ORG_UNAVAILABLE','RESOURCE_UNAVAILABLE','ACTION_NOT_ALLOWED','TRANSIENT_FAILURE','INVALID_DEFINITION','LOOP_LIMIT','STALE_EXECUTOR','INTERNAL_ERROR','APPROVAL_REQUIRES_HUMAN') THEN RAISE EXCEPTION 'Invalid automation error code';END IF;
 SELECT r.* INTO item FROM public.workflow_runs r WHERE r.id=run AND r.lease_token=token AND r.current_node_key=node AND r.status='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 retry:=transient_failure AND item.attempts<3;
 UPDATE public.workflow_runs SET attempts=attempts+1,status=CASE WHEN retry THEN 'WAITING' ELSE 'FAILED' END,error_code=code,next_run_at=now()+interval '5 seconds'*power(2,item.attempts)::integer,finished_at=CASE WHEN retry THEN NULL ELSE now() END,lease_token=NULL,lease_until=NULL WHERE id=run;
 INSERT INTO public.workflow_execution_logs(id,organization_id,run_id,node_key,actor_id,kind,detail) VALUES(gen_random_uuid(),item.organization_id,run,node,item.executor_id,CASE WHEN retry THEN 'RETRY_SCHEDULED' ELSE 'FAILED' END,jsonb_build_object('code',code,'attempt',item.attempts+1));
END $$;
CREATE FUNCTION workflow_expire_work() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; BEGIN
 FOR item IN SELECT e.id FROM public.workflow_events e WHERE (e.status='PENDING' OR (e.status='PROCESSING' AND e.lease_until<now())) AND (e.created_at<now()-interval '90 days' OR e.attempts>=5) ORDER BY e.created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.workflow_events SET status='FAILED',lease_token=NULL,lease_until=NULL WHERE id=item.id;
 END LOOP;
 FOR item IN SELECT r.* FROM public.workflow_runs r WHERE r.status IN ('PENDING','RUNNING','WAITING') AND r.created_at<now()-interval '120 days' ORDER BY r.created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.workflow_runs SET status='CANCELLED',error_code='EXPIRED',finished_at=now(),lease_token=NULL,lease_until=NULL WHERE id=item.id;
 INSERT INTO public.workflow_execution_logs(id,organization_id,run_id,node_key,kind,detail) VALUES(gen_random_uuid(),item.organization_id,item.id,item.current_node_key,'CANCELLED','{"code":"EXPIRED"}'::jsonb);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION workflow_claim_events(),workflow_finish_event(uuid,uuid,boolean),workflow_claim_runs(),workflow_fail_run(uuid,uuid,uuid,text,boolean),workflow_expire_work() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow_claim_events(),workflow_finish_event(uuid,uuid,boolean),workflow_claim_runs(),workflow_fail_run(uuid,uuid,uuid,text,boolean),workflow_expire_work() TO work_app;
