CREATE UNIQUE INDEX invitation_one_pending_email ON invitations(organization_id,email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE FUNCTION work_invitation_info(hashed_token text) RETURNS TABLE(email varchar,organization_name varchar) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT i.email,o.name FROM public.invitations i JOIN public.organizations o ON o.id=i.organization_id JOIN public.memberships m ON m.id=i.inviter_id AND m.organization_id=i.organization_id JOIN public.users u ON u.id=m.user_id
 WHERE i.token_hash=hashed_token AND i.expires_at>now() AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND o.suspended_at IS NULL AND o.deleted_at IS NULL AND m.active AND u.disabled_at IS NULL AND u.deleted_at IS NULL
$$;
REVOKE ALL ON FUNCTION work_invitation_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_invitation_info(text) TO work_app;
