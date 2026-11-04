CREATE FUNCTION platform_support_message_author(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
 SELECT u.display_name::text FROM public.support_messages msg JOIN public.memberships m ON m.organization_id=msg.organization_id AND m.id=msg.member_author_id JOIN public.users u ON u.id=m.user_id
 WHERE msg.id=target AND (public.platform_ops_can('support.read') OR public.platform_ops_can('support.manage'))
$$;
REVOKE ALL ON FUNCTION platform_support_message_author(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION platform_support_message_author(uuid) TO work_app;
