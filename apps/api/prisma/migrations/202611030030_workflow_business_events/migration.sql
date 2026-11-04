CREATE FUNCTION workflow_emit_internal(org uuid,resource text,resource_id uuid,event_kind text,event_key text,payload jsonb,actor uuid,chain uuid,event_depth integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF event_depth>=8 THEN RETURN;END IF;
 INSERT INTO public.workflow_events(id,organization_id,kind,resource_type,resource_id,actor_user_id,chain_id,depth,dedupe_key,snapshot)
 VALUES(gen_random_uuid(),org,event_kind,resource,resource_id,actor,chain,event_depth,event_key,payload)
 ON CONFLICT(organization_id,dedupe_key) DO NOTHING;
END $$;
CREATE FUNCTION workflow_capture_business_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid;chain uuid;event_depth integer;payload jsonb;prefix text;item_version text; BEGIN
 actor:=NULLIF(current_setting('app.user_id',true),'')::uuid;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.memberships WHERE organization_id=NEW.organization_id AND user_id=actor AND active) THEN RETURN NEW;END IF;
 chain:=COALESCE(NULLIF(current_setting('app.workflow_chain_id',true),'')::uuid,gen_random_uuid());
 event_depth:=COALESCE(NULLIF(current_setting('app.workflow_depth',true),'')::integer,0);
 IF event_depth<0 OR event_depth>=8 THEN RETURN NEW;END IF;
 item_version:=NEW.version::text;
 payload:=jsonb_build_object('version',NEW.version,'status',NEW.status);
 IF TG_TABLE_NAME='tasks' THEN
 payload:=payload||jsonb_build_object('priority',NEW.priority,'progress',NEW.progress,'projectId',NEW.project_id,'departmentId',NEW.department_id,'teamId',NEW.team_id,'assignedToId',NEW.assigned_to_id);
 prefix:='task:'||NEW.id::text||':'||item_version||':';
 IF TG_OP='INSERT' THEN
 PERFORM public.workflow_emit_internal(NEW.organization_id,'TASK',NEW.id,'TASK_CREATED',prefix||'created',payload,actor,chain,event_depth);
 ELSE
 IF NEW.status IS DISTINCT FROM OLD.status THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'TASK',NEW.id,'TASK_STATUS_CHANGED',prefix||'status',payload,actor,chain,event_depth);END IF;
 IF NEW.progress IS DISTINCT FROM OLD.progress THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'TASK',NEW.id,'TASK_PROGRESS_CHANGED',prefix||'progress',payload,actor,chain,event_depth);END IF;
 IF NEW.approved_at IS NOT NULL AND NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'TASK',NEW.id,'TASK_APPROVED',prefix||'approved',payload,actor,chain,event_depth);END IF;
 IF NEW.project_id IS NOT NULL AND NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL AND NOT EXISTS(
 SELECT 1 FROM public.tasks t LEFT JOIN public.task_statuses s ON s.organization_id=t.organization_id AND s.key=t.status WHERE t.organization_id=NEW.organization_id AND t.project_id=NEW.project_id AND t.archived_at IS NULL AND t.completed_at IS NULL AND COALESCE(s.category,'OPEN')<>'CANCELLED') THEN
 PERFORM public.workflow_emit_internal(NEW.organization_id,'PROJECT',NEW.project_id,'PROJECT_TASKS_COMPLETED',prefix||'project_complete',jsonb_build_object('completedTaskId',NEW.id),actor,chain,event_depth);
 END IF;
 END IF;
 ELSIF TG_TABLE_NAME='internal_requests' THEN
 prefix:='request:'||NEW.id::text||':'||item_version||':';
 IF TG_OP='INSERT' THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'REQUEST',NEW.id,'REQUEST_CREATED',prefix||'created',payload,actor,chain,event_depth);
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
 IF NEW.status='PENDING' THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'REQUEST',NEW.id,'REQUEST_SUBMITTED',prefix||'submitted',payload,actor,chain,event_depth);
 ELSIF NEW.status='APPROVED' THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'REQUEST',NEW.id,'REQUEST_APPROVED',prefix||'approved',payload,actor,chain,event_depth);
 ELSIF NEW.status='REJECTED' THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'REQUEST',NEW.id,'REQUEST_REJECTED',prefix||'rejected',payload,actor,chain,event_depth);END IF;
 END IF;
 ELSIF TG_TABLE_NAME='operational_expenses' THEN
 prefix:='expense:'||NEW.id::text||':'||item_version||':';
 IF TG_OP='INSERT' THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'EXPENSE',NEW.id,'EXPENSE_CREATED',prefix||'created',payload,actor,chain,event_depth);
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
 IF NEW.status='PENDING' THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'EXPENSE',NEW.id,'EXPENSE_SUBMITTED',prefix||'submitted',payload,actor,chain,event_depth);
 ELSIF NEW.status='APPROVED' THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'EXPENSE',NEW.id,'EXPENSE_APPROVED',prefix||'approved',payload,actor,chain,event_depth);
 ELSIF NEW.status='REJECTED' THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'EXPENSE',NEW.id,'EXPENSE_REJECTED',prefix||'rejected',payload,actor,chain,event_depth);END IF;
 END IF;
 ELSIF TG_TABLE_NAME='projects' THEN
 IF TG_OP='UPDATE' AND NEW.status IN ('COMPLETED','CLOSED') AND OLD.status NOT IN ('COMPLETED','CLOSED') THEN PERFORM public.workflow_emit_internal(NEW.organization_id,'PROJECT',NEW.id,'PROJECT_COMPLETED','project:'||NEW.id::text||':'||item_version||':completed',payload,actor,chain,event_depth);END IF;
 ELSIF TG_TABLE_NAME='meetings' AND TG_OP='INSERT' THEN
 PERFORM public.workflow_emit_internal(NEW.organization_id,'MEETING',NEW.id,'MEETING_CREATED','meeting:'||NEW.id::text||':'||item_version||':created',payload,actor,chain,event_depth);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER workflow_task_events AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION workflow_capture_business_change();
CREATE TRIGGER workflow_request_events AFTER INSERT OR UPDATE ON internal_requests FOR EACH ROW EXECUTE FUNCTION workflow_capture_business_change();
CREATE TRIGGER workflow_expense_events AFTER INSERT OR UPDATE ON operational_expenses FOR EACH ROW EXECUTE FUNCTION workflow_capture_business_change();
CREATE TRIGGER workflow_project_events AFTER INSERT OR UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION workflow_capture_business_change();
CREATE TRIGGER workflow_meeting_events AFTER INSERT OR UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION workflow_capture_business_change();
REVOKE ALL ON FUNCTION workflow_emit_internal(uuid,text,uuid,text,text,jsonb,uuid,uuid,integer),workflow_capture_business_change() FROM PUBLIC;
