ALTER TABLE workflows ADD COLUMN activated_by_id uuid;
UPDATE workflows SET activated_by_id=owner_id WHERE status='ACTIVE';
ALTER TABLE workflows ADD CONSTRAINT workflow_activation_actor FOREIGN KEY(organization_id,activated_by_id) REFERENCES memberships(organization_id,id),ADD CONSTRAINT workflow_active_actor CHECK(status<>'ACTIVE' OR activated_by_id IS NOT NULL);
ALTER TABLE workflow_runs ADD COLUMN executor_id uuid;
UPDATE workflow_runs r SET executor_id=COALESCE(w.activated_by_id,w.owner_id) FROM workflows w WHERE w.id=r.workflow_id AND w.organization_id=r.organization_id;
ALTER TABLE workflow_runs ALTER COLUMN executor_id SET NOT NULL;
ALTER TABLE workflow_runs ADD CONSTRAINT workflow_run_executor FOREIGN KEY(organization_id,executor_id) REFERENCES memberships(organization_id,id);
