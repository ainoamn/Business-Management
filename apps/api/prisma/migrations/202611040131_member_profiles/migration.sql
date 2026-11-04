BEGIN;
CREATE FUNCTION work_profile_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active AND (m.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN','GENERAL_MANAGER') OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND mr.scope='ORGANIZATION' AND rp.permission='members.manage')))
$$;
CREATE FUNCTION work_profile_can(subject uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active AND (m.id=subject OR m.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN','GENERAL_MANAGER','DEPARTMENT_MANAGER','PROJECT_MANAGER','TEAM_LEADER','EMPLOYEE','ACCOUNTANT','AUDITOR') OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND mr.scope='ORGANIZATION' AND rp.permission='members.read')))
$$;
REVOKE ALL ON FUNCTION work_profile_manager(),work_profile_can(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_profile_manager(),work_profile_can(uuid) TO work_app;
CREATE TABLE member_profiles(organization_id uuid NOT NULL,membership_id uuid NOT NULL,manager_id uuid,phone varchar(40) NOT NULL DEFAULT '',avatar_version_id uuid,version integer NOT NULL DEFAULT 1 CHECK(version>0),updated_by_id uuid NOT NULL,updated_at timestamptz(3) NOT NULL,PRIMARY KEY(organization_id,membership_id),FOREIGN KEY(organization_id,membership_id) REFERENCES memberships(organization_id,id) ON DELETE RESTRICT,FOREIGN KEY(organization_id,manager_id) REFERENCES memberships(organization_id,id) ON DELETE RESTRICT,FOREIGN KEY(organization_id,updated_by_id) REFERENCES memberships(organization_id,id) ON DELETE RESTRICT,FOREIGN KEY(organization_id,avatar_version_id) REFERENCES document_versions(organization_id,id) ON DELETE RESTRICT,CHECK(manager_id IS DISTINCT FROM membership_id));
CREATE INDEX member_profiles_organization_id_manager_id_idx ON member_profiles(organization_id,manager_id);
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;ALTER TABLE member_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY profile_read ON member_profiles FOR SELECT TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_profile_can(membership_id));
CREATE POLICY profile_insert ON member_profiles FOR INSERT TO work_app WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND (public.ai_owns_member(membership_id) OR public.work_profile_manager()) AND public.ai_owns_member(updated_by_id));
CREATE POLICY profile_update ON member_profiles FOR UPDATE TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND (public.ai_owns_member(membership_id) OR public.work_profile_manager())) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND (public.ai_owns_member(membership_id) OR public.work_profile_manager()) AND public.ai_owns_member(updated_by_id));
GRANT SELECT,INSERT,UPDATE ON member_profiles TO work_app;REVOKE DELETE,TRUNCATE ON member_profiles FROM work_app;
CREATE FUNCTION member_profile_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE cursor_id uuid;visited uuid[]:=ARRAY[]::uuid[];BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('member_profile_graph:'||NEW.organization_id::text));
 IF TG_OP='UPDATE' AND ((NEW.organization_id,NEW.membership_id) IS DISTINCT FROM (OLD.organization_id,OLD.membership_id) OR NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'Member profile identity is immutable and version must advance';END IF;
 IF (TG_OP='INSERT' AND NEW.manager_id IS NOT NULL OR TG_OP='UPDATE' AND NEW.manager_id IS DISTINCT FROM OLD.manager_id) AND NOT public.work_profile_manager() THEN RAISE EXCEPTION 'Manager assignment requires organization member management' USING ERRCODE='42501';END IF;
 IF NEW.manager_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.organization_id=NEW.organization_id AND m.id=NEW.manager_id AND m.active AND u.disabled_at IS NULL AND u.deleted_at IS NULL) THEN RAISE EXCEPTION 'Manager must be active in this organization';END IF;
 cursor_id:=NEW.manager_id;WHILE cursor_id IS NOT NULL LOOP
  IF cursor_id=NEW.membership_id OR cursor_id=ANY(visited) THEN RAISE EXCEPTION 'Manager reporting cycle is not allowed';END IF;
  visited:=array_append(visited,cursor_id);IF cardinality(visited)>1000 THEN RAISE EXCEPTION 'Manager reporting chain is too deep';END IF;
  SELECT manager_id INTO cursor_id FROM public.member_profiles WHERE organization_id=NEW.organization_id AND membership_id=cursor_id;
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER member_profile_integrity BEFORE INSERT OR UPDATE ON member_profiles FOR EACH ROW EXECUTE FUNCTION member_profile_integrity();REVOKE ALL ON FUNCTION member_profile_integrity() FROM PUBLIC;
COMMIT;
