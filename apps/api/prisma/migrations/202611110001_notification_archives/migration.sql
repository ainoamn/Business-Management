BEGIN;
ALTER TABLE work_notifications ADD COLUMN archived_at timestamptz(3);
CREATE INDEX work_notification_archive_list_idx ON work_notifications(organization_id,membership_id,archived_at,created_at DESC,id);
CREATE FUNCTION work_notification_content_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.organization_id,NEW.membership_id,NEW.kind,NEW.resource_type,NEW.resource_id,NEW.deduplication_key,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.membership_id,OLD.kind,OLD.resource_type,OLD.resource_id,OLD.deduplication_key,OLD.created_at) THEN
  RAISE EXCEPTION 'Notification content and identity are immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER work_notification_content_immutable BEFORE UPDATE ON work_notifications FOR EACH ROW EXECUTE FUNCTION work_notification_content_immutable();
REVOKE ALL ON FUNCTION work_notification_content_immutable() FROM PUBLIC;
REVOKE DELETE,TRUNCATE ON work_notifications FROM work_app;
COMMIT;
