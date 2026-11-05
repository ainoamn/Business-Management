BEGIN;
CREATE FUNCTION platform_create_organization(target uuid,title text,requested_slug text,owner_email text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE owner_id uuid;previous_actor text;
BEGIN
 IF NOT public.platform_ops_can('organizations.manage') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501';END IF;
 IF target IS NULL OR length(btrim(title)) NOT BETWEEN 2 AND 160 OR length(requested_slug) NOT BETWEEN 3 AND 80 OR requested_slug!~'^[a-z0-9]+(-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Invalid organization details' USING ERRCODE='22023';END IF;
 SELECT id INTO owner_id FROM public.users WHERE email=lower(btrim(owner_email)) AND email_verified_at IS NOT NULL AND disabled_at IS NULL AND deleted_at IS NULL FOR SHARE;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Choose an existing verified active organization owner' USING ERRCODE='22023';END IF;
 previous_actor:=current_setting('app.user_id',true);
 PERFORM set_config('app.user_id',owner_id::text,true);
 PERFORM public.work_create_organization(target,btrim(title),requested_slug);
 PERFORM set_config('app.user_id',coalesce(previous_actor,''),true);
 RETURN target;
END $$;
REVOKE ALL ON FUNCTION platform_create_organization(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_create_organization(uuid,text,text,text) TO work_app;
COMMIT;
