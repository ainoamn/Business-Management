DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['time_entries','active_timers','meetings','meeting_attendees','meeting_decisions','work_notifications','notification_preferences','reminder_deliveries','internal_request_types','request_type_approval_steps','internal_requests','request_approvals','operational_budgets','operational_expenses'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_boundary ON %I TO work_app USING (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member()) WITH CHECK (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member())',tab);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO work_app',tab);
 END LOOP;
END $$;
ALTER TABLE time_entries ADD CONSTRAINT time_interval CHECK(ended_at>started_at AND duration_seconds=FLOOR(EXTRACT(EPOCH FROM ended_at-started_at)) AND duration_seconds<=86400),ADD CONSTRAINT time_source CHECK(source IN ('MANUAL','TIMER'));
ALTER TABLE meetings ADD CONSTRAINT meeting_dates CHECK(ends_at>starts_at),ADD CONSTRAINT minutes_separation CHECK(approver_id IS NULL OR chair_id<>approver_id);
ALTER TABLE operational_budgets ADD CONSTRAINT budget_positive CHECK(amount>=0),ADD CONSTRAINT budget_dates CHECK(ends_at>=starts_at);
ALTER TABLE operational_expenses ADD CONSTRAINT expense_positive CHECK(amount>0 AND exchange_rate>0 AND base_amount>0),ADD CONSTRAINT expense_separation CHECK(requester_id<>approver_id),ADD CONSTRAINT expense_status CHECK(status IN ('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED'));
DO $$ DECLARE item text[]; BEGIN
 FOREACH item SLICE 1 IN ARRAY ARRAY[
 ['time_entries','membership_id'],['time_entries','created_by_id'],['active_timers','membership_id'],['meetings','chair_id'],['meetings','created_by_id'],['meetings','approver_id'],['meeting_attendees','membership_id'],['meeting_decisions','responsible_id'],['work_notifications','membership_id'],['notification_preferences','membership_id'],['request_type_approval_steps','approver_id'],['internal_requests','requester_id'],['internal_requests','responsible_id'],['request_approvals','approver_id'],['operational_expenses','requester_id'],['operational_expenses','approver_id']
 ] LOOP EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(organization_id,%I) REFERENCES memberships(organization_id,id)',item[1],item[1]||'_'||item[2],item[2]); END LOOP;
 FOREACH item SLICE 1 IN ARRAY ARRAY[
 ['time_entries','task_id','tasks'],['active_timers','task_id','tasks'],['meeting_decisions','task_id','tasks'],['operational_expenses','task_id','tasks'],['time_entries','project_id','projects'],['meetings','project_id','projects'],['operational_budgets','project_id','projects'],['operational_expenses','project_id','projects'],['meetings','department_id','departments'],['internal_requests','department_id','departments'],['meetings','team_id','teams'],['operational_expenses','budget_id','operational_budgets']
 ] LOOP EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(organization_id,%I) REFERENCES %I(organization_id,id)',item[1],item[1]||'_'||item[2],item[2],item[3]); END LOOP;
END $$;
CREATE FUNCTION work_dispatch_reminders(web_origin text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; target record; delivery_stage text; sent_count integer:=0;
BEGIN
 IF web_origin !~ '^https?://[^/]+$' THEN RAISE EXCEPTION 'Invalid web origin'; END IF;
 FOR item IN SELECT t.id,t.organization_id,t.due_date,t.assigned_to_id,t.reviewer_id,t.approver_id,t.status FROM public.tasks t JOIN public.organizations o ON o.id=t.organization_id JOIN public.task_statuses s ON s.organization_id=t.organization_id AND s.key=t.status
 WHERE t.archived_at IS NULL AND t.completed_at IS NULL AND s.category<>'CANCELLED' AND t.due_date<=now()+interval '24 hours'
 AND o.suspended_at IS NULL AND o.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.reminder_deliveries d WHERE d.organization_id=t.organization_id AND d.resource_type='tasks' AND d.resource_id=t.id AND d.due_at=t.due_date AND d.stage=CASE WHEN t.due_date<now() THEN 'OVERDUE' ELSE 'UPCOMING' END)
 ORDER BY t.due_date LIMIT 100 FOR UPDATE OF t SKIP LOCKED LOOP
 delivery_stage:=CASE WHEN item.due_date<now() THEN 'OVERDUE' ELSE 'UPCOMING' END;
 INSERT INTO public.reminder_deliveries(organization_id,resource_type,resource_id,due_at,stage) VALUES(item.organization_id,'tasks',item.id,item.due_date,delivery_stage) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN CONTINUE; END IF;
 FOR target IN SELECT DISTINCT m.id,u.email,COALESCE(p.in_app_enabled,true) AS in_app,COALESCE(p.email_enabled,false) AS email_enabled FROM public.memberships m JOIN public.users u ON u.id=m.user_id LEFT JOIN public.notification_preferences p ON p.organization_id=m.organization_id AND p.membership_id=m.id
 WHERE m.organization_id=item.organization_id AND m.id IN(item.assigned_to_id,item.reviewer_id,item.approver_id) AND m.active AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND COALESCE(p.reminders_enabled,true) LOOP
 IF target.in_app THEN INSERT INTO public.work_notifications(id,organization_id,membership_id,kind,resource_type,resource_id,deduplication_key) VALUES(gen_random_uuid(),item.organization_id,target.id,'TASK_'||delivery_stage,'tasks',item.id,'reminder:'||item.id||':'||item.due_date||':'||delivery_stage) ON CONFLICT DO NOTHING; END IF;
 IF target.email_enabled THEN INSERT INTO public.email_outbox(id,recipient,subject,text_body) VALUES(gen_random_uuid(),target.email,'تذكير مهمة | Task reminder',web_origin||'/app/tasks/'||item.id); END IF;
 sent_count:=sent_count+1;
 END LOOP;
 END LOOP;
 RETURN sent_count;
END $$;
REVOKE ALL ON FUNCTION work_dispatch_reminders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_dispatch_reminders(text) TO work_app;
