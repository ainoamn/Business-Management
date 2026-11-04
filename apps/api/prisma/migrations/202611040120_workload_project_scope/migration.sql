BEGIN;
DO $patch$ DECLARE definition text;needle text;BEGIN
 definition:=pg_get_functiondef('public.workload_can_read(uuid)'::regprocedure);
 needle:=$needle$OR actor.role='DEPARTMENT_MANAGER' AND actor.department_id IS NOT NULL AND actor.department_id=subject.department_id$needle$;
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected workload scope clause not found';END IF;
 EXECUTE replace(definition,needle,needle||$replacement$
 OR actor.role='PROJECT_MANAGER' AND EXISTS(SELECT 1 FROM public.projects p WHERE p.organization_id=actor.organization_id AND p.manager_id=actor.id AND p.archived_at IS NULL AND (EXISTS(SELECT 1 FROM public.project_members pm WHERE pm.organization_id=actor.organization_id AND pm.project_id=p.id AND pm.membership_id=subject.id) OR EXISTS(SELECT 1 FROM public.tasks t WHERE t.organization_id=actor.organization_id AND t.project_id=p.id AND t.assigned_to_id=subject.id AND t.archived_at IS NULL)))
 $replacement$);
END $patch$;
COMMIT;
