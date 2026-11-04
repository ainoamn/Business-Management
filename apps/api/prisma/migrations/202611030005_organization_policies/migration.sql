ALTER TABLE users ADD CONSTRAINT user_username_normalized CHECK(username IS NULL OR username=lower(trim(username)));
ALTER TABLE invitations ADD CONSTRAINT invitation_role_safe CHECK(role IN ('ORGANIZATION_ADMIN','GENERAL_MANAGER','DEPARTMENT_MANAGER','PROJECT_MANAGER','TEAM_LEADER','EMPLOYEE','ACCOUNTANT','REQUESTER','EXTERNAL_CLIENT','AUDITOR','GUEST'));
ALTER TABLE membership_roles ADD CONSTRAINT membership_role_scope CHECK((scope IN ('ORGANIZATION','OWN') AND scope_id IS NULL) OR (scope IN ('BRANCH','DEPARTMENT','TEAM','PROJECT','TASK') AND scope_id IS NOT NULL));
ALTER TABLE user_action_tokens ADD CONSTRAINT user_token_purpose CHECK(purpose IN ('VERIFY_EMAIL','RESET_PASSWORD'));
ALTER TABLE organization_settings ADD CONSTRAINT organization_work_hours CHECK(day_start<day_end);

GRANT SELECT,INSERT,UPDATE,DELETE ON user_action_tokens,user_login_attempts,email_outbox TO work_app;
GRANT SELECT,INSERT,UPDATE ON memberships,organization_settings,organization_branches,departments,sections,teams,organization_roles,invitations TO work_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON team_members,organization_role_permissions,membership_roles TO work_app;
GRANT UPDATE ON organizations TO work_app;

CREATE FUNCTION work_is_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id JOIN public.organizations o ON o.id=m.organization_id
 WHERE m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid
 AND m.active AND u.disabled_at IS NULL AND u.deleted_at IS NULL AND o.deleted_at IS NULL AND o.suspended_at IS NULL)
$$;
CREATE FUNCTION work_is_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
 AND m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.role='ORGANIZATION_OWNER')
$$;
CREATE FUNCTION work_manages_members() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
 AND m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND (m.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN','GENERAL_MANAGER')
 OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id
 WHERE mr.membership_id=m.id AND mr.organization_id=m.organization_id AND mr.scope='ORGANIZATION' AND rp.permission='members.manage')))
$$;
REVOKE ALL ON FUNCTION work_is_member(),work_is_owner(),work_manages_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_is_member(),work_is_owner(),work_manages_members() TO work_app;

ALTER POLICY membership_self ON memberships USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member());
CREATE POLICY membership_manager_insert ON memberships FOR INSERT TO work_app WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_manages_members() AND role<>'ORGANIZATION_OWNER');
CREATE POLICY membership_manager_update ON memberships FOR UPDATE TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_manages_members() AND (role<>'ORGANIZATION_OWNER' OR user_id=NULLIF(current_setting('app.user_id',true),'')::uuid))
 WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_manages_members() AND (role<>'ORGANIZATION_OWNER' OR user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND public.work_is_owner()));
ALTER POLICY organization_member ON organizations USING(id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member());
CREATE POLICY organization_owner_update ON organizations FOR UPDATE TO work_app USING(id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_owner()) WITH CHECK(id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_owner());

DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['organization_settings','organization_branches','departments','sections','teams','team_members','organization_roles','organization_role_permissions','membership_roles','invitations'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_boundary ON %I FOR ALL TO work_app USING(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member()) WITH CHECK(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member())',tab);
 END LOOP;
END $$;

CREATE FUNCTION work_my_organizations() RETURNS TABLE(id uuid,name varchar,slug varchar,locale varchar,timezone varchar,role varchar,membership_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT o.id,o.name,o.slug,o.locale,o.timezone,m.role,m.id FROM public.memberships m JOIN public.organizations o ON o.id=m.organization_id JOIN public.users u ON u.id=m.user_id
 WHERE m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active AND o.suspended_at IS NULL AND o.deleted_at IS NULL AND u.disabled_at IS NULL AND u.deleted_at IS NULL ORDER BY o.created_at,o.id
$$;
CREATE FUNCTION work_create_organization(target uuid, title text, requested_slug text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; owner_membership uuid;
BEGIN
 actor:=NULLIF(current_setting('app.user_id',true),'')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor AND disabled_at IS NULL AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Identity required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('create-org:'||actor::text));
 IF (SELECT count(*) FROM public.memberships WHERE user_id=actor AND role='ORGANIZATION_OWNER' AND active)>=10 THEN RAISE EXCEPTION 'Organization limit' USING ERRCODE='23514'; END IF;
 INSERT INTO public.organizations(id,name,slug) VALUES(target,title,requested_slug);
 owner_membership:=gen_random_uuid();
 INSERT INTO public.memberships(id,organization_id,user_id,role) VALUES(owner_membership,target,actor,'ORGANIZATION_OWNER');
 INSERT INTO public.organization_settings(organization_id,updated_at) VALUES(target,now());
 RETURN owner_membership;
END $$;
CREATE FUNCTION work_accept_invitation(hashed_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; target public.invitations%ROWTYPE; member_id uuid; maximum int;
BEGIN
 actor:=NULLIF(current_setting('app.user_id',true),'')::uuid;
 SELECT * INTO target FROM public.invitations WHERE token_hash=hashed_token FOR UPDATE;
 IF target.id IS NULL OR target.revoked_at IS NOT NULL OR target.accepted_at IS NOT NULL OR target.expires_at<=now()
 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor AND email=target.email AND email_verified_at IS NOT NULL AND disabled_at IS NULL AND deleted_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=target.organization_id AND suspended_at IS NULL AND deleted_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.id=target.inviter_id AND m.organization_id=target.organization_id AND m.active AND u.disabled_at IS NULL AND u.deleted_at IS NULL)
 THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('seats:'||target.organization_id::text));
 SELECT seats INTO maximum FROM public.platform_subscriptions WHERE organization_id=target.organization_id AND status IN ('ACTIVE','TRIAL') AND ends_at>now() LIMIT 1;
 maximum:=coalesce(maximum,3);
 IF EXISTS(SELECT 1 FROM public.memberships WHERE organization_id=target.organization_id AND user_id=actor AND active) THEN RAISE EXCEPTION 'Already a member' USING ERRCODE='23505'; END IF;
 IF (SELECT count(*) FROM public.memberships WHERE organization_id=target.organization_id AND active)>=maximum THEN RAISE EXCEPTION 'Seat limit reached' USING ERRCODE='23514'; END IF;
 INSERT INTO public.memberships(id,organization_id,user_id,role) VALUES(gen_random_uuid(),target.organization_id,actor,target.role)
 ON CONFLICT(organization_id,user_id) DO UPDATE SET active=true,role=excluded.role RETURNING id INTO member_id;
 UPDATE public.invitations SET accepted_at=now() WHERE id=target.id;
 RETURN target.organization_id;
END $$;
REVOKE ALL ON FUNCTION work_my_organizations(),work_create_organization(uuid,text,text),work_accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_my_organizations(),work_create_organization(uuid,text,text),work_accept_invitation(text) TO work_app;
