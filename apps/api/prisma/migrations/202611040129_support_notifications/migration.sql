CREATE FUNCTION support_notify_message(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 IF NOT public.platform_ops_can('support.manage') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501';END IF;
 INSERT INTO public.work_notifications(id,organization_id,membership_id,kind,resource_type,resource_id,deduplication_key)
 SELECT gen_random_uuid(),c.organization_id,c.creator_id,'SUPPORT_REPLY','support',c.id,'support:'||m.id::text FROM public.support_messages m JOIN public.support_cases c ON c.id=m.case_id AND c.organization_id=m.organization_id JOIN public.memberships recipient ON recipient.organization_id=c.organization_id AND recipient.id=c.creator_id JOIN public.users u ON u.id=recipient.user_id LEFT JOIN public.notification_preferences p ON p.organization_id=c.organization_id AND p.membership_id=c.creator_id
 WHERE m.id=target AND m.platform_author_id=NULLIF(current_setting('app.platform_account_id',true),'')::uuid AND recipient.active AND u.disabled_at IS NULL AND u.deleted_at IS NULL AND coalesce(p.in_app_enabled,true) ON CONFLICT(organization_id,membership_id,deduplication_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION support_notify_message(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION support_notify_message(uuid) TO work_app;
