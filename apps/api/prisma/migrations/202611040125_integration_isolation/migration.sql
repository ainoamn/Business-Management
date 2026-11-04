BEGIN;
CREATE FUNCTION work_integration_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active
 AND (m.role='ORGANIZATION_OWNER' OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND mr.scope='ORGANIZATION' AND rp.permission='organization.manage')))
$$;
REVOKE ALL ON FUNCTION work_integration_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_integration_manager() TO work_app;
ALTER TABLE organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_integrations FORCE ROW LEVEL SECURITY;
CREATE POLICY integration_manager ON organization_integrations TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_integration_manager()) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_integration_manager());
GRANT SELECT,INSERT,UPDATE,DELETE ON organization_integrations TO work_app;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_member_fkey FOREIGN KEY(organization_id,membership_id) REFERENCES memberships(organization_id,id) ON DELETE RESTRICT;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY push_subscription_owner ON push_subscriptions TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.ai_owns_member(membership_id)) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.ai_owns_member(membership_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON push_subscriptions TO work_app;
COMMIT;
