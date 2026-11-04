# Security Isolation Checklist

## Organization Data Isolation

### Database-level Isolation
- [x] All org-scoped tables include `organization_id` column
- [x] All queries include org filter in WHERE clause
- [x] Composite unique indexes enforce org boundaries
- [x] Foreign keys respect org boundaries (composite keys)
- [x] RLS (Row Level Security) policies per table OR app-level enforcement via `set_config`

### API-level Isolation
- [ ] Every request authenticates user and resolves membership
- [ ] Middleware extracts organization context from URL path or token
- [ ] Services reject requests without valid org context
- [ ] No direct database queries bypass org checks
- [ ] Audit logs record actor + organization for all mutations

### Expected Negative Cases
- [ ] User A cannot read User B's organization data via crafted request
- [ ] Changing `organizationId` in request body/params is rejected
- [ ] Membership in Org X does not grant access to Org Y
- [ ] Archived/suspended organizations block all non-admin operations
- [ ] Deleted users' sessions are invalidated immediately

---

## Platform Admin Isolation

### Separation from Work Data
- [ ] Platform accounts (admin panel) use separate auth cookie
- [ ] Platform sessions in `platform_sessions` table (not `user_sessions`)
- [ ] Platform API routes under `/api/v1/platform/*`
- [ ] Work API routes under `/api/v1/work/*`
- [ ] Platform guards reject work sessions; work guards reject platform sessions

### Expected Negative Cases
- [ ] Work user session cannot access platform admin routes
- [ ] Platform admin session cannot impersonate work user without explicit audit trail
- [ ] Platform admin cannot read encrypted AI credentials without re-auth

---

## User Identity Isolation

### Email/Username Uniqueness
- [ ] Email addresses are globally unique across all users
- [ ] Usernames are globally unique (if used)
- [ ] No PII leakage in error messages ("User not found" vs "Invalid credentials")

### Password/MFA Secrets
- [ ] Password hashes use bcrypt with cost 12+
- [ ] MFA secrets encrypted at rest with per-account AAD
- [ ] Recovery codes hashed with HMAC before storage
- [ ] No plaintext secrets in logs or responses

### Expected Negative Cases
- [ ] Timing attacks on login fail (use constant-time comparison for passwords)
- [ ] MFA setup requires re-auth before displaying QR code
- [ ] Recovery codes shown only once, not retrievable later

---

## Document & File Isolation

### Storage Backend
- [ ] Files stored with UUID object keys (no guessable paths)
- [ ] Pre-signed URLs expire within 5 minutes
- [ ] Download requires ACL check before generating URL
- [ ] Malware scans via ClamAV before marking file as clean

### Access Control
- [ ] Document ownership checked on every read/write
- [ ] Folder permissions inherited and checked recursively
- [ ] Shared documents track `membershipId` grants explicitly

### Expected Negative Cases
- [ ] User cannot download document from another org by guessing object key
- [ ] Expired pre-signed URL returns 403
- [ ] Malware upload rejected during scan (status=INFECTED)

---

## AI Request Isolation

### Quota & Billing
- [ ] AI credits scoped per organization
- [ ] Usage tracked in `ai_monthly_usage` per org + period
- [ ] Requests fail if org exhausted plan credits + wallet
- [ ] No cross-org credit transfers without admin approval

### Prompt & Context
- [ ] AI prompts cannot access other orgs' data
- [ ] Context manifest logged for audit
- [ ] Prompt versions managed centrally (platform-wide)

### Expected Negative Cases
- [ ] Crafted AI input cannot exfiltrate data from another org's context
- [ ] AI request rejected if membership inactive or org suspended

---

## Session & Token Management

### Lifecycle
- [ ] Sessions expire after configurable timeout (default 8h for work, 1h for platform)
- [ ] Logout revokes session server-side (not just cookie deletion)
- [ ] Password reset invalidates all existing sessions
- [ ] Concurrent session limit enforced per user (optional)

### CSRF Protection
- [ ] All mutating requests check CSRF token
- [ ] CSRF token derived from session secret + request metadata
- [ ] Token mismatch returns 403

### Expected Negative Cases
- [ ] Replaying revoked session token returns 401
- [ ] Mutating POST with missing CSRF token returns 403
- [ ] Session cookie from different domain rejected (SameSite=Strict)

---

## Rate Limiting & Abuse Prevention

### Login Attempts
- [ ] Max 5 failed logins per email within 15 minutes
- [ ] Max 30 failed logins per IP within 15 minutes
- [ ] Account lockout after repeated failures (optional)
- [ ] Advisory locks prevent race conditions in attempt tracking

### API Rate Limits
- [ ] Work API: 60 req/min per user per org (global IP: 300 req/min)
- [ ] Platform API: 30 req/min per admin account
- [ ] AI requests: subject to org monthly quota
- [ ] Workflow automation: max runs per org per month

### Expected Negative Cases
- [ ] Brute-force login blocked after threshold
- [ ] Concurrent requests from same IP hit rate limit
- [ ] Automation workflow paused if org exceeds monthly run quota

---

## Encryption & Key Management

### Encryption at Rest
- [ ] Database encrypted via filesystem/block-level encryption (operator responsibility)
- [ ] AI provider credentials encrypted with `AI_CREDENTIAL_KEY`
- [ ] MFA secrets encrypted with `MFA_CREDENTIAL_KEY` or `AI_CREDENTIAL_KEY`
- [ ] S3/SeaweedFS uses encryption for stored files

### Key Rotation
- [ ] Credential keys stored in environment variables (never in repo)
- [ ] Key rotation procedure documented
- [ ] Old keys retained for grace period to decrypt legacy data

### Expected Negative Cases
- [ ] Database dump does not expose plaintext credentials
- [ ] Missing encryption key returns startup error (not degraded mode)

---

## Audit & Compliance

### Audit Logging
- [ ] All admin actions logged to `platform_audit`
- [ ] All org-level mutations logged to `audit_logs`
- [ ] Logs include request ID, actor, timestamp, resource
- [ ] No PII in logs (hash/redact sensitive fields)

### GDPR/Data Deletion
- [ ] User deletion soft-deletes account (`deletedAt` timestamp)
- [ ] Organization deletion cascades to all related data
- [ ] Data retention policy enforced (configurable)

### Expected Negative Cases
- [ ] Deleted user cannot log in (even if session cookie remains)
- [ ] Deleted organization's data inaccessible to former members

---

## Testing Strategy

### Automated Tests
```typescript
describe('Organization Isolation', () => {
  it('rejects cross-org data access', async () => {
    const userA = await createUser();
    const orgX = await createOrg(userA);
    const orgY = await createOrg(userA);
    const taskY = await createTask(orgY, userA);
    
    // User A tries to access Org Y's task while authenticated to Org X
    await expect(
      getTask(userA, orgX.id, taskY.id)
    ).rejects.toThrow('Task not found');
  });

  it('enforces membership requirement', async () => {
    const userA = await createUser();
    const userB = await createUser();
    const orgX = await createOrg(userA);
    const taskX = await createTask(orgX, userA);
    
    // User B (not a member) tries to access Org X's task
    await expect(
      getTask(userB, orgX.id, taskX.id)
    ).rejects.toThrow('Not a member');
  });
});
```

### Manual Penetration Testing
1. **Cookie tampering:** Modify session cookie and attempt cross-org access
2. **Parameter injection:** Change `organizationId` in URL path
3. **SQL injection:** Test input sanitization in search/filter fields
4. **XSS:** Inject scripts in user-generated content (task titles, comments)
5. **IDOR:** Enumerate UUIDs to access other orgs' resources

### Security Regression Suite
- Run after every schema migration
- Validate no accidental permission bypass introduced
- Check audit logs for completeness

---

## Incident Response

### Breach Detection
- [ ] Monitor audit logs for anomalies (bulk data access, off-hours activity)
- [ ] Alert on repeated 403 errors (potential attack)
- [ ] Track failed login spikes

### Response Procedure
1. Isolate affected accounts/organizations
2. Revoke all sessions for compromised accounts
3. Rotate encryption keys if leaked
4. Notify affected users within 72 hours (GDPR)
5. Conduct post-mortem and apply fixes

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineer | | | |
| Security Lead | | | |
| CTO/Tech Lead | | | |

**Last reviewed:** <!-- Update on each review -->  
**Next review due:** <!-- Set 6-month cadence -->
