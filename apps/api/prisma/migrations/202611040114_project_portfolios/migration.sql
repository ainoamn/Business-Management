BEGIN;
CREATE TABLE project_portfolios (
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 owner_id uuid NOT NULL,name varchar(180) NOT NULL,kind varchar(16) NOT NULL DEFAULT 'PORTFOLIO',description text NOT NULL DEFAULT '',objective text NOT NULL DEFAULT '',status varchar(16) NOT NULL DEFAULT 'PLANNED',starts_at timestamptz(3),ends_at timestamptz(3),archived_at timestamptz(3),version integer NOT NULL DEFAULT 1,created_at timestamptz(3) NOT NULL DEFAULT now(),updated_at timestamptz(3) NOT NULL DEFAULT now(),
 CONSTRAINT project_portfolios_organization_id_owner_id_fkey FOREIGN KEY(organization_id,owner_id) REFERENCES memberships(organization_id,id) ON DELETE RESTRICT,
 CONSTRAINT project_portfolio_values CHECK(kind IN ('PORTFOLIO','PROGRAM') AND status IN ('PLANNED','ACTIVE','ON_HOLD','COMPLETED') AND length(trim(name)) BETWEEN 2 AND 180 AND length(description)<=20000 AND length(objective)<=5000 AND version>0 AND (starts_at IS NULL OR ends_at IS NULL OR starts_at<=ends_at))
);
CREATE UNIQUE INDEX project_portfolios_organization_id_id_key ON project_portfolios(organization_id,id);
CREATE INDEX project_portfolios_organization_id_archived_at_created_at_idx ON project_portfolios(organization_id,archived_at,created_at);
CREATE TABLE portfolio_projects(
 organization_id uuid NOT NULL,portfolio_id uuid NOT NULL,project_id uuid NOT NULL,created_at timestamptz(3) NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,portfolio_id,project_id),
 CONSTRAINT portfolio_projects_organization_id_portfolio_id_fkey FOREIGN KEY(organization_id,portfolio_id) REFERENCES project_portfolios(organization_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT portfolio_projects_organization_id_project_id_fkey FOREIGN KEY(organization_id,project_id) REFERENCES projects(organization_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX portfolio_projects_organization_id_project_id_idx ON portfolio_projects(organization_id,project_id);
CREATE FUNCTION portfolio_can(requested text,target_owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT requested IN ('portfolios.read','portfolios.manage') AND public.work_is_member() AND EXISTS(
 SELECT 1 FROM public.memberships m WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active
 AND (m.role IN ('ORGANIZATION_OWNER','ORGANIZATION_ADMIN','GENERAL_MANAGER') OR requested='portfolios.read' AND m.role='AUDITOR' OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND rp.permission=requested AND (mr.scope='ORGANIZATION' OR mr.scope='OWN' AND m.id=target_owner))))
$$;
REVOKE ALL ON FUNCTION portfolio_can(text,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION portfolio_can(text,uuid) TO work_app;
ALTER TABLE project_portfolios ENABLE ROW LEVEL SECURITY;ALTER TABLE project_portfolios FORCE ROW LEVEL SECURITY;
CREATE POLICY portfolio_read ON project_portfolios FOR SELECT USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND portfolio_can('portfolios.read',owner_id));
CREATE POLICY portfolio_insert ON project_portfolios FOR INSERT WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND portfolio_can('portfolios.manage',owner_id));
CREATE POLICY portfolio_update ON project_portfolios FOR UPDATE USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND portfolio_can('portfolios.manage',owner_id)) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND portfolio_can('portfolios.manage',owner_id));
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;ALTER TABLE portfolio_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY portfolio_project_read ON portfolio_projects FOR SELECT USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND EXISTS(SELECT 1 FROM project_portfolios p WHERE p.organization_id=portfolio_projects.organization_id AND p.id=portfolio_projects.portfolio_id));
CREATE POLICY portfolio_project_insert ON portfolio_projects FOR INSERT WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND EXISTS(SELECT 1 FROM project_portfolios p WHERE p.organization_id=portfolio_projects.organization_id AND p.id=portfolio_projects.portfolio_id AND portfolio_can('portfolios.manage',p.owner_id)));
CREATE POLICY portfolio_project_delete ON portfolio_projects FOR DELETE USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND EXISTS(SELECT 1 FROM project_portfolios p WHERE p.organization_id=portfolio_projects.organization_id AND p.id=portfolio_projects.portfolio_id AND portfolio_can('portfolios.manage',p.owner_id)));
GRANT SELECT,INSERT,UPDATE ON project_portfolios TO work_app;GRANT SELECT,INSERT,DELETE ON portfolio_projects TO work_app;
COMMIT;
