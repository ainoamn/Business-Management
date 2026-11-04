DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['workflows','workflow_revisions','workflow_triggers','workflow_nodes','workflow_conditions','workflow_actions','workflow_events','workflow_runs','workflow_execution_logs','workflow_action_receipts','workflow_monthly_usage'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_boundary ON %I TO work_app USING (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member()) WITH CHECK (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member())',tab);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO work_app',tab);
 END LOOP;
END $$;
REVOKE UPDATE ON workflow_revisions,workflow_triggers,workflow_nodes,workflow_conditions,workflow_actions,workflow_events,workflow_execution_logs,workflow_action_receipts FROM work_app;
ALTER TABLE platform_plans ADD CONSTRAINT plan_automation_limits CHECK(automation_runs BETWEEN 0 AND 100000000 AND active_workflows BETWEEN 0 AND 10000);
ALTER TABLE workflows ADD CONSTRAINT workflow_owner_member FOREIGN KEY(organization_id,owner_id) REFERENCES memberships(organization_id,id),ADD CONSTRAINT workflow_status CHECK(status IN ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),ADD CONSTRAINT workflow_version CHECK(version>0),ADD CONSTRAINT workflow_active_revision CHECK(status<>'ACTIVE' OR current_revision_id IS NOT NULL),ADD CONSTRAINT workflow_archive_state CHECK((status='ARCHIVED')=(archived_at IS NOT NULL));
ALTER TABLE workflow_revisions ADD CONSTRAINT workflow_revision_author FOREIGN KEY(organization_id,created_by_id) REFERENCES memberships(organization_id,id),ADD CONSTRAINT workflow_revision_number CHECK(number>0),ADD CONSTRAINT workflow_graph_shape CHECK(jsonb_typeof(graph)='object' AND jsonb_typeof(graph->'nodes')='array' AND jsonb_array_length(graph->'nodes') BETWEEN 2 AND 40);
ALTER TABLE workflow_triggers ADD CONSTRAINT workflow_trigger_hours CHECK(hours BETWEEN 0 AND 8760),ADD CONSTRAINT workflow_trigger_percent CHECK(threshold_percent BETWEEN 0 AND 100);
ALTER TABLE workflow_nodes ADD CONSTRAINT workflow_node_shape CHECK(
 (kind='condition' AND yes_key IS NOT NULL AND no_key IS NOT NULL AND next_key IS NULL AND delay_seconds IS NULL) OR
 (kind='action' AND next_key IS NOT NULL AND yes_key IS NULL AND no_key IS NULL AND delay_seconds IS NULL) OR
 (kind='delay' AND next_key IS NOT NULL AND yes_key IS NULL AND no_key IS NULL AND delay_seconds BETWEEN 1 AND 2592000) OR
 (kind='end' AND next_key IS NULL AND yes_key IS NULL AND no_key IS NULL AND delay_seconds IS NULL)),
 ADD CONSTRAINT workflow_node_next FOREIGN KEY(organization_id,revision_id,next_key) REFERENCES workflow_nodes(organization_id,revision_id,node_key) DEFERRABLE INITIALLY DEFERRED,
 ADD CONSTRAINT workflow_node_yes FOREIGN KEY(organization_id,revision_id,yes_key) REFERENCES workflow_nodes(organization_id,revision_id,node_key) DEFERRABLE INITIALLY DEFERRED,
 ADD CONSTRAINT workflow_node_no FOREIGN KEY(organization_id,revision_id,no_key) REFERENCES workflow_nodes(organization_id,revision_id,node_key) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE workflow_conditions ADD CONSTRAINT workflow_predicate_object CHECK(jsonb_typeof(predicate)='object');
ALTER TABLE workflow_actions ADD CONSTRAINT workflow_action_type CHECK(type IN ('NOTIFY','TASK_TRANSITION','TASK_ASSIGN','TASK_PROGRESS','CREATE_TASK','REQUEST_SUBMIT','EXPENSE_SUBMIT')),ADD CONSTRAINT workflow_action_object CHECK(jsonb_typeof(parameters)='object');
ALTER TABLE workflow_events ADD CONSTRAINT workflow_event_depth CHECK(depth BETWEEN 0 AND 8),ADD CONSTRAINT workflow_event_status CHECK(status IN ('PENDING','PROCESSING','DONE','FAILED')),ADD CONSTRAINT workflow_event_attempts CHECK(attempts BETWEEN 0 AND 10),ADD CONSTRAINT workflow_event_resource CHECK(resource_type IN ('TASK','PROJECT','REQUEST','EXPENSE','MEETING','BUDGET')),ADD CONSTRAINT workflow_event_actor FOREIGN KEY(actor_user_id) REFERENCES users(id),ADD CONSTRAINT workflow_event_lease CHECK(status<>'PROCESSING' OR (lease_token IS NOT NULL AND lease_until IS NOT NULL));
ALTER TABLE workflow_runs ADD CONSTRAINT workflow_run_status CHECK(status IN ('PENDING','RUNNING','WAITING','COMPLETED','FAILED','CANCELLED','LIMITED')),ADD CONSTRAINT workflow_run_attempts CHECK(attempts BETWEEN 0 AND 20 AND steps BETWEEN 0 AND 200),ADD CONSTRAINT workflow_run_lease CHECK(status<>'RUNNING' OR (lease_token IS NOT NULL AND lease_until IS NOT NULL));
ALTER TABLE workflow_execution_logs ADD CONSTRAINT workflow_log_actor FOREIGN KEY(organization_id,actor_id) REFERENCES memberships(organization_id,id);
ALTER TABLE workflow_monthly_usage ADD CONSTRAINT workflow_usage_nonnegative CHECK(executions>=0);
CREATE FUNCTION workflow_owner_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF ROW(NEW.id,NEW.organization_id,NEW.owner_id) IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.owner_id) THEN RAISE EXCEPTION 'Workflow ownership is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER workflow_owner_fixed BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION workflow_owner_immutable();
REVOKE ALL ON FUNCTION workflow_owner_immutable() FROM PUBLIC;
