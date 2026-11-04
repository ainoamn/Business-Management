ALTER TABLE workflows ADD COLUMN activated_at timestamptz(3);
UPDATE workflows SET activated_at=created_at WHERE status='ACTIVE';
ALTER TABLE workflows ADD CONSTRAINT workflow_active_since CHECK(status<>'ACTIVE' OR activated_at IS NOT NULL);
CREATE FUNCTION workflow_event_candidates(event uuid,token uuid) RETURNS TABLE(workflow_id uuid,executor_user_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT w.id,m.user_id FROM public.workflow_events e
 JOIN public.workflows w ON w.organization_id=e.organization_id AND w.status='ACTIVE' AND e.created_at>=w.activated_at AND (e.target_workflow_id IS NULL OR e.target_workflow_id=w.id)
 JOIN public.workflow_triggers t ON t.revision_id=w.current_revision_id AND t.organization_id=w.organization_id AND t.kind=e.kind
 JOIN public.memberships m ON m.organization_id=w.organization_id AND m.id=w.activated_by_id
 WHERE e.id=event AND e.lease_token=token AND e.status='PROCESSING'
 ORDER BY w.created_at LIMIT 200;
$$;
CREATE FUNCTION workflow_scheduled_candidates() RETURNS TABLE(workflow_id uuid,organization_id uuid,executor_user_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT w.id,w.organization_id,m.user_id FROM public.workflows w
 JOIN public.workflow_triggers t ON t.revision_id=w.current_revision_id AND t.organization_id=w.organization_id AND t.kind IN ('TASK_DUE_SOON','TASK_OVERDUE','REQUEST_WAITING','MEETING_WAITING','BUDGET_LOW')
 JOIN public.memberships m ON m.organization_id=w.organization_id AND m.id=w.activated_by_id AND m.active
 JOIN public.users u ON u.id=m.user_id AND u.disabled_at IS NULL AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL
 JOIN public.organizations o ON o.id=w.organization_id AND o.suspended_at IS NULL
 WHERE w.status='ACTIVE'
 ORDER BY w.updated_at,w.id LIMIT 100;
$$;
REVOKE ALL ON FUNCTION workflow_event_candidates(uuid,uuid),workflow_scheduled_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow_event_candidates(uuid,uuid),workflow_scheduled_candidates() TO work_app;
