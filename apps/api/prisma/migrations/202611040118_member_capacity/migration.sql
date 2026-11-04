BEGIN;
CREATE TABLE membership_capacities (
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE NO ACTION,membership_id uuid NOT NULL,created_by_id uuid NOT NULL,
 starts_on date NOT NULL,ends_on date NOT NULL,minutes_per_day integer NOT NULL,reason varchar(500) NOT NULL,version integer NOT NULL DEFAULT 1,archived_at timestamptz(3),created_at timestamptz(3) NOT NULL DEFAULT now(),updated_at timestamptz(3) NOT NULL DEFAULT now(),
 CONSTRAINT membership_capacities_subject_fkey FOREIGN KEY(organization_id,membership_id) REFERENCES memberships(organization_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT membership_capacities_creator_fkey FOREIGN KEY(organization_id,created_by_id) REFERENCES memberships(organization_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT membership_capacity_values CHECK(ends_on>=starts_on AND ends_on-starts_on<=365 AND minutes_per_day BETWEEN 0 AND 1440 AND length(trim(reason)) BETWEEN 5 AND 500 AND version>0)
);
CREATE UNIQUE INDEX membership_capacities_organization_id_id_key ON membership_capacities(organization_id,id);
CREATE INDEX membership_capacities_organization_id_membership_id_starts_on_ends ON membership_capacities(organization_id,membership_id,starts_on,ends_on);
CREATE FUNCTION workload_can_read(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships actor JOIN public.memberships subject ON subject.organization_id=actor.organization_id AND subject.id=target WHERE actor.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND actor.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND actor.active AND (
 actor.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN','GENERAL_MANAGER','AUDITOR')
 OR actor.id=subject.id AND actor.role IN ('EMPLOYEE','ACCOUNTANT','DEPARTMENT_MANAGER','PROJECT_MANAGER','TEAM_LEADER')
 OR actor.role='DEPARTMENT_MANAGER' AND actor.department_id IS NOT NULL AND actor.department_id=subject.department_id
 OR actor.role='TEAM_LEADER' AND EXISTS(SELECT 1 FROM public.teams t JOIN public.team_members tm ON tm.organization_id=t.organization_id AND tm.team_id=t.id WHERE t.organization_id=actor.organization_id AND t.leader_id=actor.id AND tm.membership_id=subject.id AND t.archived_at IS NULL)
 OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=actor.organization_id AND mr.membership_id=actor.id AND rp.permission='workload.read' AND (
 mr.scope='ORGANIZATION' OR mr.scope='OWN' AND actor.id=subject.id OR mr.scope='DEPARTMENT' AND mr.scope_id=subject.department_id OR mr.scope='BRANCH' AND mr.scope_id=subject.branch_id
 OR mr.scope='TEAM' AND EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.organization_id=actor.organization_id AND tm.team_id=mr.scope_id AND tm.membership_id=subject.id)
 OR mr.scope='PROJECT' AND EXISTS(SELECT 1 FROM public.projects p WHERE p.organization_id=actor.organization_id AND p.id=mr.scope_id AND (p.manager_id=subject.id OR EXISTS(SELECT 1 FROM public.project_members pm WHERE pm.organization_id=actor.organization_id AND pm.project_id=p.id AND pm.membership_id=subject.id)))))))
$$;
CREATE FUNCTION workload_can_manage() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active AND (m.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN','GENERAL_MANAGER') OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND mr.scope='ORGANIZATION' AND rp.permission='members.manage')))
$$;
REVOKE ALL ON FUNCTION workload_can_read(uuid),workload_can_manage() FROM PUBLIC;GRANT EXECUTE ON FUNCTION workload_can_read(uuid),workload_can_manage() TO work_app;
ALTER TABLE membership_capacities ENABLE ROW LEVEL SECURITY;ALTER TABLE membership_capacities FORCE ROW LEVEL SECURITY;
CREATE POLICY capacity_read ON membership_capacities FOR SELECT USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND (workload_can_read(membership_id) OR workload_can_manage()));
CREATE POLICY capacity_insert ON membership_capacities FOR INSERT WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND workload_can_manage() AND EXISTS(SELECT 1 FROM memberships m WHERE m.organization_id=membership_capacities.organization_id AND m.id=membership_capacities.created_by_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active));
CREATE POLICY capacity_update ON membership_capacities FOR UPDATE USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND workload_can_manage()) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND workload_can_manage());
CREATE FUNCTION workload_capacity_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.id,NEW.organization_id,NEW.membership_id,NEW.created_by_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.membership_id,OLD.created_by_id,OLD.created_at) OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Capacity identity is fixed and version must advance once';END IF;RETURN NEW;
END $$;
CREATE TRIGGER workload_capacity_identity BEFORE UPDATE ON membership_capacities FOR EACH ROW EXECUTE FUNCTION workload_capacity_fixed();
GRANT SELECT,INSERT,UPDATE ON membership_capacities TO work_app;
COMMIT;
