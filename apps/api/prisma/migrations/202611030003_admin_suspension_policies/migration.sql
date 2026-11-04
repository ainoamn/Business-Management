-- Administrative suspension also fails closed at the database policy layer.
ALTER POLICY membership_self ON memberships USING (
  user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  AND active
  AND EXISTS(SELECT 1 FROM users u WHERE u.id=memberships.user_id AND u.deleted_at IS NULL AND u.disabled_at IS NULL)
);
ALTER POLICY organization_member ON organizations USING (
  id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  AND deleted_at IS NULL AND suspended_at IS NULL
  AND EXISTS(SELECT 1 FROM memberships m WHERE m.organization_id=organizations.id)
);
