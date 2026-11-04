BEGIN;
CREATE FUNCTION organization_holiday_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.organization_id,NEW.created_by_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.created_by_id,OLD.created_at) OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Holiday identity is immutable and version must advance';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_holiday_integrity BEFORE UPDATE ON organization_holidays FOR EACH ROW EXECUTE FUNCTION organization_holiday_integrity();
REVOKE ALL ON FUNCTION organization_holiday_integrity() FROM PUBLIC;
CREATE FUNCTION organization_branding_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.organization_id<>OLD.organization_id OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Branding organization is immutable and version must advance';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_branding_integrity BEFORE UPDATE ON organization_branding FOR EACH ROW EXECUTE FUNCTION organization_branding_integrity();
REVOKE ALL ON FUNCTION organization_branding_integrity() FROM PUBLIC;
COMMIT;
