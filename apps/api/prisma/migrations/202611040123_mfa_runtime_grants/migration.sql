-- Authentication tables are accessed by trusted identity services, like users and sessions.
GRANT SELECT,INSERT,UPDATE,DELETE ON pending_mfa_challenges,mfa_recovery_codes TO work_app;
