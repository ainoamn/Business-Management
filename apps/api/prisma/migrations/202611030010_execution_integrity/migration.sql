DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['work_counters','projects','project_members','project_phases','project_milestones','project_risks','project_decisions','task_statuses','task_transitions','tasks','task_participants','task_checklist_items','task_comments','task_dependencies','task_changes'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_boundary ON %I TO work_app USING (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member()) WITH CHECK (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member())',tab);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO work_app',tab);
 END LOOP;
END $$;
REVOKE UPDATE,DELETE ON task_changes,project_decisions,task_comments FROM work_app;
ALTER TABLE projects ADD CONSTRAINT project_dates CHECK(start_date IS NULL OR end_date IS NULL OR start_date<=end_date), ADD CONSTRAINT project_budget CHECK(budget>=0), ADD CONSTRAINT project_version CHECK(version>0);
ALTER TABLE tasks ADD CONSTRAINT task_dates CHECK(start_date IS NULL OR due_date IS NULL OR start_date<=due_date), ADD CONSTRAINT task_progress CHECK(progress BETWEEN 0 AND 100), ADD CONSTRAINT task_cost CHECK(estimated_hours>=0 AND cost_estimate>=0),ADD CONSTRAINT task_not_parent CHECK(parent_task_id IS NULL OR parent_task_id<>id),ADD CONSTRAINT task_version CHECK(version>0);
ALTER TABLE task_dependencies ADD CONSTRAINT dependency_not_self CHECK(task_id<>predecessor_id);
ALTER TABLE project_risks ADD CONSTRAINT risk_score CHECK(likelihood BETWEEN 1 AND 5 AND impact BETWEEN 1 AND 5);
ALTER TABLE task_statuses ADD CONSTRAINT task_status_category CHECK(category IN ('OPEN','ACTIVE','HOLD','REVIEW','APPROVAL','DONE','CANCELLED','REJECTED'));
ALTER TABLE tasks ADD CONSTRAINT task_status_reference FOREIGN KEY(organization_id,status) REFERENCES task_statuses(organization_id,key);
ALTER TABLE task_transitions ADD CONSTRAINT transition_from FOREIGN KEY(organization_id,from_status) REFERENCES task_statuses(organization_id,key), ADD CONSTRAINT transition_to FOREIGN KEY(organization_id,to_status) REFERENCES task_statuses(organization_id,key);
ALTER TABLE tasks ADD CONSTRAINT task_phase FOREIGN KEY(organization_id,phase_id) REFERENCES project_phases(organization_id,id), ADD CONSTRAINT task_parent FOREIGN KEY(organization_id,parent_task_id) REFERENCES tasks(organization_id,id);
DO $$ DECLARE tab text; col text; BEGIN
 FOREACH tab IN ARRAY ARRAY['projects','tasks'] LOOP
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(organization_id,department_id) REFERENCES departments(organization_id,id)',tab,tab||'_department');
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(organization_id,team_id) REFERENCES teams(organization_id,id)',tab,tab||'_team');
 END LOOP;
 FOREACH col IN ARRAY ARRAY['manager_id','created_by_id'] LOOP
  EXECUTE format('ALTER TABLE projects ADD CONSTRAINT %I FOREIGN KEY(organization_id,%I) REFERENCES memberships(organization_id,id)','projects_'||col,col);
 END LOOP;
 FOREACH col IN ARRAY ARRAY['created_by_id','assigned_to_id','reviewer_id','approver_id'] LOOP
  EXECUTE format('ALTER TABLE tasks ADD CONSTRAINT %I FOREIGN KEY(organization_id,%I) REFERENCES memberships(organization_id,id)','tasks_'||col,col);
 END LOOP;
END $$;
ALTER TABLE projects ADD CONSTRAINT project_branch FOREIGN KEY(organization_id,branch_id) REFERENCES organization_branches(organization_id,id);
ALTER TABLE project_members ADD CONSTRAINT project_member FOREIGN KEY(organization_id,membership_id) REFERENCES memberships(organization_id,id);
ALTER TABLE task_participants ADD CONSTRAINT task_participant FOREIGN KEY(organization_id,membership_id) REFERENCES memberships(organization_id,id);
ALTER TABLE task_comments ADD CONSTRAINT task_comment_author FOREIGN KEY(organization_id,author_id) REFERENCES memberships(organization_id,id);
ALTER TABLE task_changes ADD CONSTRAINT task_change_actor FOREIGN KEY(organization_id,actor_id) REFERENCES memberships(organization_id,id);
ALTER TABLE project_decisions ADD CONSTRAINT project_decision_actor FOREIGN KEY(organization_id,created_by_id) REFERENCES memberships(organization_id,id);
ALTER TABLE project_risks ADD CONSTRAINT project_risk_owner FOREIGN KEY(organization_id,owner_id) REFERENCES memberships(organization_id,id);
