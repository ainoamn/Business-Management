ALTER TABLE meeting_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_boundary ON meeting_revisions TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member()) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member());
GRANT SELECT,INSERT ON meeting_revisions TO work_app;
ALTER TABLE meeting_revisions ADD CONSTRAINT meeting_revision_actor FOREIGN KEY(organization_id,saved_by_id) REFERENCES memberships(organization_id,id);
