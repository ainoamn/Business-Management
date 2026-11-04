ALTER TABLE request_approvals DROP CONSTRAINT approval_status;
ALTER TABLE request_approvals ADD CONSTRAINT approval_status CHECK(status IN ('WAITING','PENDING','APPROVED','REJECTED'));
ALTER TABLE internal_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_request_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_boundary ON internal_request_events TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member()) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member());
GRANT SELECT,INSERT ON internal_request_events TO work_app;
ALTER TABLE internal_request_events ADD CONSTRAINT request_event_actor FOREIGN KEY(organization_id,actor_id) REFERENCES memberships(organization_id,id);
