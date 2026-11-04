BEGIN;
CREATE FUNCTION ai_platform_can(permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT permission IN ('ai.read','ai.manage') AND EXISTS(
  SELECT 1 FROM public.platform_accounts a JOIN public.platform_sessions s ON s.account_id=a.id LEFT JOIN public.platform_roles r ON r.id=a.role_id
  WHERE a.id=NULLIF(current_setting('app.platform_account_id',true),'')::uuid AND s.id=NULLIF(current_setting('app.platform_session_id',true),'')::uuid
   AND a.disabled_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>now() AND (a.is_owner OR permission=ANY(r.permissions)))
$$;
CREATE FUNCTION ai_owns_member(member_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.id=member_id AND m.active AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid)
$$;
CREATE FUNCTION ai_member_global(permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT permission IN ('ai.read','ai.manage') AND public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active
 AND (m.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN') OR permission='ai.read' AND m.role IN ('GENERAL_MANAGER','AUDITOR')
 OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND mr.scope='ORGANIZATION' AND rp.permission=permission)))
$$;
CREATE FUNCTION ai_member_can_use() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active AND u.email_verified_at IS NOT NULL
 AND (m.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN','GENERAL_MANAGER','DEPARTMENT_MANAGER','PROJECT_MANAGER','TEAM_LEADER','EMPLOYEE','ACCOUNTANT') OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND rp.permission='ai.use')))
$$;
REVOKE ALL ON FUNCTION ai_platform_can(text),ai_owns_member(uuid),ai_member_global(text),ai_member_can_use() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_platform_can(text),ai_owns_member(uuid),ai_member_global(text),ai_member_can_use() TO work_app;

DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['ai_organization_settings','ai_monthly_usage','ai_wallets','ai_credit_entries','ai_conversations','ai_requests','ai_messages','ai_drafts','ai_audit'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  IF tab IN ('ai_conversations','ai_requests','ai_messages','ai_drafts') THEN
   EXECUTE format('CREATE POLICY ai_private_owner ON %I TO work_app USING(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.ai_owns_member(membership_id)) WITH CHECK(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.ai_owns_member(membership_id))',tab);
  ELSE
   EXECUTE format('CREATE POLICY ai_tenant_boundary ON %I TO work_app USING(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member()) WITH CHECK(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member())',tab);
  END IF;
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO work_app',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['ai_providers','ai_models','ai_prompts','ai_prompt_versions'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY ai_runtime_read ON %I FOR SELECT TO work_app USING(true)',tab);
  EXECUTE format('CREATE POLICY ai_platform_insert ON %I FOR INSERT TO work_app WITH CHECK(public.ai_platform_can(''ai.manage''))',tab);
  EXECUTE format('CREATE POLICY ai_platform_update ON %I FOR UPDATE TO work_app USING(public.ai_platform_can(''ai.manage'')) WITH CHECK(public.ai_platform_can(''ai.manage''))',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO work_app',tab);
 END LOOP;
END $$;
ALTER TABLE ai_provider_monthly_usage ENABLE ROW LEVEL SECURITY;ALTER TABLE ai_provider_monthly_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_provider_usage_read ON ai_provider_monthly_usage FOR SELECT TO work_app USING(public.ai_platform_can('ai.read') OR public.ai_platform_can('ai.manage') OR public.ai_member_can_use());
CREATE POLICY ai_provider_usage_insert ON ai_provider_monthly_usage FOR INSERT TO work_app WITH CHECK(public.ai_member_can_use());
CREATE POLICY ai_provider_usage_update ON ai_provider_monthly_usage FOR UPDATE TO work_app USING(public.ai_member_can_use()) WITH CHECK(public.ai_member_can_use());
GRANT SELECT,INSERT,UPDATE ON ai_provider_monthly_usage TO work_app;
REVOKE INSERT,UPDATE ON ai_credit_entries FROM work_app;
REVOKE UPDATE ON ai_prompt_versions,ai_messages,ai_audit FROM work_app;

DROP POLICY ai_tenant_boundary ON ai_organization_settings;
CREATE POLICY ai_settings_read ON ai_organization_settings FOR SELECT TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member());
CREATE POLICY ai_settings_insert ON ai_organization_settings FOR INSERT TO work_app WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.ai_member_global('ai.manage'));
CREATE POLICY ai_settings_update ON ai_organization_settings FOR UPDATE TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.ai_member_global('ai.manage')) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.ai_member_global('ai.manage'));

ALTER TABLE ai_providers ADD CONSTRAINT ai_provider_kind CHECK(kind IN ('OPENAI_RESPONSES','OPENAI_COMPATIBLE')),ADD CONSTRAINT ai_provider_limits CHECK(monthly_budget_usd>=0 AND max_concurrent BETWEEN 1 AND 20 AND version>0),ADD CONSTRAINT ai_provider_cipher CHECK(length(encrypted_key)>30 AND encrypted_key LIKE 'v1:%'),ADD CONSTRAINT ai_provider_endpoint_hash CHECK(endpoint_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE ai_models ADD CONSTRAINT ai_model_limits CHECK(input_price_usd>=0 AND cached_input_price_usd>=0 AND output_price_usd>=0 AND credits_per_thousand_tokens BETWEEN 1 AND 1000 AND max_output_tokens BETWEEN 256 AND 8192 AND max_input_bytes BETWEEN 4096 AND 65536 AND version>0);
ALTER TABLE ai_organization_settings ADD CONSTRAINT ai_settings_limits CHECK((monthly_spend_limit_usd IS NULL OR monthly_spend_limit_usd>=0) AND (member_daily_credits IS NULL OR member_daily_credits BETWEEN 1 AND 1000000) AND version>0),ADD CONSTRAINT ai_settings_consent CHECK(NOT enabled OR consent_by_id IS NOT NULL AND consented_at IS NOT NULL AND cardinality(allowed_model_ids) BETWEEN 1 AND 20 AND cardinality(consented_provider_hashes)>0);
ALTER TABLE ai_monthly_usage ADD CONSTRAINT ai_monthly_nonnegative CHECK(plan_used>=0 AND reserved_plan>=0 AND used_credits>=plan_used AND input_tokens>=0 AND cached_input_tokens BETWEEN 0 AND input_tokens AND output_tokens>=0 AND cost_usd>=0 AND reserved_usd>=0);
ALTER TABLE ai_wallets ADD CONSTRAINT ai_wallet_nonnegative CHECK(available_extra>=0 AND reserved_extra>=0 AND available_extra::bigint+reserved_extra::bigint<=1000000000 AND version>0);
ALTER TABLE ai_provider_monthly_usage ADD CONSTRAINT ai_provider_usage_nonnegative CHECK(cost_usd>=0 AND reserved_usd>=0 AND input_tokens>=0 AND output_tokens>=0);
ALTER TABLE ai_credit_entries ADD CONSTRAINT ai_credit_kind CHECK((kind='GRANT' AND credits>0 AND platform_actor_id IS NOT NULL AND request_id IS NULL) OR (kind='CONSUME' AND credits<0 AND request_id IS NOT NULL AND platform_actor_id IS NULL));
ALTER TABLE ai_requests ADD CONSTRAINT ai_request_status CHECK(status IN ('RESERVED','RUNNING','COMPLETED','FAILED','UNCERTAIN')),ADD CONSTRAINT ai_request_limits CHECK(reserved_plan>=0 AND reserved_extra>=0 AND reserved_plan::bigint+reserved_extra::bigint BETWEEN 1 AND 1000000 AND reserved_usd>=0 AND max_input_tokens BETWEEN 1 AND 100000 AND max_output_tokens BETWEEN 256 AND 8192 AND credit_multiplier BETWEEN 1 AND 1000),ADD CONSTRAINT ai_request_price_nonnegative CHECK(input_price_usd>=0 AND cached_input_price_usd>=0 AND output_price_usd>=0),ADD CONSTRAINT ai_request_tokens CHECK((input_tokens IS NULL AND cached_input_tokens IS NULL AND output_tokens IS NULL AND charged_credits IS NULL AND cost_usd IS NULL) OR (input_tokens BETWEEN 0 AND max_input_tokens AND cached_input_tokens BETWEEN 0 AND input_tokens AND output_tokens BETWEEN 0 AND max_output_tokens AND charged_credits BETWEEN 0 AND reserved_plan+reserved_extra AND cost_usd>=0)),ADD CONSTRAINT ai_request_lease CHECK(status NOT IN ('RESERVED','RUNNING') OR lease_token IS NOT NULL AND lease_until IS NOT NULL),ADD CONSTRAINT ai_request_terminal CHECK((status IN ('COMPLETED','FAILED'))=(finished_at IS NOT NULL)),ADD CONSTRAINT ai_request_context CHECK(jsonb_typeof(context_manifest)='array' AND jsonb_array_length(context_manifest)<=200 AND jsonb_typeof(context_spec)='object');
ALTER TABLE ai_messages ADD CONSTRAINT ai_message_role CHECK(role IN ('USER','ASSISTANT')),ADD CONSTRAINT ai_message_size CHECK(octet_length(body)<=150000 AND (result IS NULL OR jsonb_typeof(result)='object'));
ALTER TABLE ai_drafts ADD CONSTRAINT ai_draft_kind CHECK(kind IN ('CREATE_TASK','CREATE_PROJECT')),ADD CONSTRAINT ai_draft_status CHECK(status IN ('PENDING','CONFIRMED','DISCARDED')),ADD CONSTRAINT ai_draft_shape CHECK(jsonb_typeof(proposal)='object' AND position BETWEEN 0 AND 4 AND version>0 AND (status<>'CONFIRMED' OR confirmed_at IS NOT NULL AND (kind='CREATE_TASK' AND task_id IS NOT NULL AND project_id IS NULL OR kind='CREATE_PROJECT' AND project_id IS NOT NULL AND task_id IS NULL)));

CREATE FUNCTION ai_immutable_record() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'AI history is append-only'; END $$;
CREATE TRIGGER ai_prompt_version_immutable BEFORE UPDATE OR DELETE ON ai_prompt_versions FOR EACH ROW EXECUTE FUNCTION ai_immutable_record();
CREATE TRIGGER ai_credit_immutable BEFORE UPDATE OR DELETE ON ai_credit_entries FOR EACH ROW EXECUTE FUNCTION ai_immutable_record();
CREATE TRIGGER ai_audit_immutable BEFORE UPDATE OR DELETE ON ai_audit FOR EACH ROW EXECUTE FUNCTION ai_immutable_record();
CREATE FUNCTION ai_identity_fixed() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.membership_id IS DISTINCT FROM OLD.membership_id THEN RAISE EXCEPTION 'AI ownership is immutable'; END IF;
 IF TG_TABLE_NAME='ai_requests' AND (to_jsonb(NEW)-ARRAY['status','charged_credits','input_tokens','cached_input_tokens','output_tokens','cost_usd','provider_response_id','error_code','lease_token','lease_until','finished_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','charged_credits','input_tokens','cached_input_tokens','output_tokens','cost_usd','provider_response_id','error_code','lease_token','lease_until','finished_at']) THEN RAISE EXCEPTION 'AI request snapshot is immutable'; END IF;
 IF TG_TABLE_NAME='ai_drafts' THEN IF OLD.status<>'PENDING' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'A final AI draft is immutable'; END IF;END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ai_conversation_owner_fixed BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION ai_identity_fixed();
CREATE TRIGGER ai_request_snapshot_fixed BEFORE UPDATE ON ai_requests FOR EACH ROW EXECUTE FUNCTION ai_identity_fixed();
CREATE TRIGGER ai_draft_owner_fixed BEFORE UPDATE ON ai_drafts FOR EACH ROW EXECUTE FUNCTION ai_identity_fixed();
REVOKE ALL ON FUNCTION ai_immutable_record(),ai_identity_fixed() FROM PUBLIC;
COMMIT;
