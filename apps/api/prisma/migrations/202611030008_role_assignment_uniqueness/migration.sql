CREATE UNIQUE INDEX membership_role_scope_unique ON membership_roles
  (organization_id, membership_id, role_id, scope, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));
