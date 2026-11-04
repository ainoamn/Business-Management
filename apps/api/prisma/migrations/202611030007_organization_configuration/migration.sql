GRANT DELETE ON organization_roles TO work_app;
CREATE FUNCTION work_has_global_permission(requested text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.work_is_member() AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid
 AND (m.role='ORGANIZATION_OWNER' OR EXISTS(SELECT 1 FROM public.membership_roles mr JOIN public.organization_role_permissions rp ON rp.organization_id=mr.organization_id AND rp.role_id=mr.role_id WHERE mr.membership_id=m.id AND mr.organization_id=m.organization_id AND mr.scope='ORGANIZATION' AND rp.permission=requested)))
$$;
REVOKE ALL ON FUNCTION work_has_global_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_has_global_permission(text) TO work_app;
ALTER POLICY organization_owner_update ON organizations USING(id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_has_global_permission('organization.manage')) WITH CHECK(id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_has_global_permission('organization.manage'));
