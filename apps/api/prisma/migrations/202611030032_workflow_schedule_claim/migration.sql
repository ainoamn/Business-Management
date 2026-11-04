ALTER TABLE workflows ADD COLUMN next_schedule_at timestamptz(3);
UPDATE workflows w SET next_schedule_at=now() WHERE status='ACTIVE' AND EXISTS(SELECT 1 FROM workflow_triggers t WHERE t.revision_id=w.current_revision_id AND t.kind IN ('TASK_DUE_SOON','TASK_OVERDUE','REQUEST_WAITING','MEETING_WAITING','BUDGET_LOW'));
CREATE INDEX workflows_schedule_due ON workflows(next_schedule_at) WHERE status='ACTIVE' AND next_schedule_at IS NOT NULL;
CREATE OR REPLACE FUNCTION workflow_scheduled_candidates() RETURNS TABLE(workflow_id uuid,organization_id uuid,executor_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record;BEGIN
 FOR item IN SELECT w.id,w.organization_id,m.user_id FROM public.workflows w
 JOIN public.workflow_triggers t ON t.revision_id=w.current_revision_id AND t.organization_id=w.organization_id AND t.kind IN ('TASK_DUE_SOON','TASK_OVERDUE','REQUEST_WAITING','MEETING_WAITING','BUDGET_LOW')
 JOIN public.memberships m ON m.organization_id=w.organization_id AND m.id=w.activated_by_id AND m.active
 JOIN public.users u ON u.id=m.user_id AND u.disabled_at IS NULL AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL
 JOIN public.organizations o ON o.id=w.organization_id AND o.suspended_at IS NULL
 WHERE w.status='ACTIVE' AND w.next_schedule_at<=now()
 ORDER BY w.next_schedule_at,w.id LIMIT 100 FOR UPDATE OF w SKIP LOCKED LOOP
 UPDATE public.workflows SET next_schedule_at=now()+interval '1 minute' WHERE id=item.id;
 workflow_id:=item.id;organization_id:=item.organization_id;executor_user_id:=item.user_id;RETURN NEXT;
 END LOOP;
END $$;
