ALTER TABLE users ADD COLUMN mfa_version integer NOT NULL DEFAULT 0, ADD COLUMN mfa_last_counter bigint;
ALTER TABLE platform_accounts ADD COLUMN mfa_version integer NOT NULL DEFAULT 0, ADD COLUMN mfa_last_counter bigint;
ALTER TABLE pending_mfa_challenges
 ADD COLUMN purpose varchar(10) NOT NULL DEFAULT 'LOGIN' CHECK (purpose IN ('LOGIN','ENROLL')),
 ADD COLUMN secret_enc text, ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 ADD COLUMN credential_version integer NOT NULL DEFAULT 0,
 ADD COLUMN primary_credential_hash varchar(64), ADD COLUMN session_id uuid, ADD COLUMN consumed_at timestamptz(3);
CREATE TABLE mfa_attempts(id uuid PRIMARY KEY, key varchar(64) NOT NULL, purpose varchar(12) NOT NULL, created_at timestamptz(3) NOT NULL DEFAULT now());
CREATE INDEX mfa_attempts_key_purpose_created_at_idx ON mfa_attempts(key,purpose,created_at);
CREATE TABLE mfa_security_events(id uuid PRIMARY KEY, account_type varchar(10) NOT NULL CHECK(account_type IN ('USER','PLATFORM')), account_id uuid NOT NULL, action varchar(40) NOT NULL, created_at timestamptz(3) NOT NULL DEFAULT now());
CREATE INDEX mfa_security_events_account_type_account_id_created_at_idx ON mfa_security_events(account_type,account_id,created_at);
GRANT SELECT,INSERT ON mfa_attempts,mfa_security_events TO work_app;
REVOKE UPDATE,DELETE,TRUNCATE ON mfa_security_events FROM work_app;
