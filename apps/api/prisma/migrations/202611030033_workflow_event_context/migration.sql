ALTER TABLE workflow_triggers ADD CONSTRAINT workflow_trigger_kind CHECK(kind IN ('TASK_CREATED','TASK_STATUS_CHANGED','TASK_PROGRESS_CHANGED','TASK_DUE_SOON','TASK_OVERDUE','TASK_APPROVED','REQUEST_CREATED','REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_WAITING','EXPENSE_CREATED','EXPENSE_SUBMITTED','EXPENSE_APPROVED','EXPENSE_REJECTED','BUDGET_LOW','PROJECT_COMPLETED','PROJECT_TASKS_COMPLETED','MEETING_CREATED','MEETING_WAITING'));
ALTER TABLE workflow_events ADD CONSTRAINT workflow_event_kind CHECK(kind IN ('TASK_CREATED','TASK_STATUS_CHANGED','TASK_PROGRESS_CHANGED','TASK_DUE_SOON','TASK_OVERDUE','TASK_APPROVED','REQUEST_CREATED','REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_WAITING','EXPENSE_CREATED','EXPENSE_SUBMITTED','EXPENSE_APPROVED','EXPENSE_REJECTED','BUDGET_LOW','PROJECT_COMPLETED','PROJECT_TASKS_COMPLETED','MEETING_CREATED','MEETING_WAITING'));
CREATE OR REPLACE FUNCTION workflow_emit_internal(org uuid,resource text,resource_id uuid,event_kind text,event_key text,payload jsonb,actor uuid,chain uuid,event_depth integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE source jsonb; project uuid; department uuid; team uuid; task_context record; project_context record;
BEGIN
 IF event_depth>=8 THEN RETURN;END IF;
 CASE resource
 WHEN 'TASK' THEN SELECT to_jsonb(t) INTO source FROM public.tasks t WHERE t.organization_id=org AND t.id=resource_id;
 WHEN 'PROJECT' THEN SELECT to_jsonb(p) INTO source FROM public.projects p WHERE p.organization_id=org AND p.id=resource_id;
 WHEN 'REQUEST' THEN SELECT to_jsonb(r) INTO source FROM public.internal_requests r WHERE r.organization_id=org AND r.id=resource_id;
 WHEN 'EXPENSE' THEN SELECT to_jsonb(e) INTO source FROM public.operational_expenses e WHERE e.organization_id=org AND e.id=resource_id;
 WHEN 'MEETING' THEN SELECT to_jsonb(m) INTO source FROM public.meetings m WHERE m.organization_id=org AND m.id=resource_id;
 ELSE source:='{}'::jsonb;
 END CASE;
 project:=CASE WHEN resource='PROJECT' THEN resource_id ELSE (source->>'project_id')::uuid END;
 department:=(source->>'department_id')::uuid;team:=(source->>'team_id')::uuid;
 IF resource='EXPENSE' AND source->>'task_id' IS NOT NULL THEN
 SELECT t.project_id,t.department_id,t.team_id INTO task_context FROM public.tasks t WHERE t.organization_id=org AND t.id=(source->>'task_id')::uuid;
 IF FOUND THEN project:=COALESCE(project,task_context.project_id);department:=COALESCE(department,task_context.department_id);team:=COALESCE(team,task_context.team_id);END IF;
 END IF;
 IF project IS NOT NULL THEN
 SELECT p.department_id,p.team_id INTO project_context FROM public.projects p WHERE p.organization_id=org AND p.id=project;
 IF FOUND THEN department:=COALESCE(department,project_context.department_id);team:=COALESCE(team,project_context.team_id);END IF;
 END IF;
 payload:=payload||jsonb_build_object('projectId',project,'departmentId',department,'teamId',team);
 INSERT INTO public.workflow_events(id,organization_id,kind,resource_type,resource_id,actor_user_id,chain_id,depth,dedupe_key,snapshot)
 VALUES(gen_random_uuid(),org,event_kind,resource,resource_id,actor,chain,event_depth,event_key,payload)
 ON CONFLICT(organization_id,dedupe_key) DO NOTHING;
END $$;
