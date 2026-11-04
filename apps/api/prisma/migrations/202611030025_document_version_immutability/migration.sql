CREATE FUNCTION protect_document_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.status<>'PENDING' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Finalized document versions are immutable'; END IF;
 IF ROW(NEW.id,NEW.organization_id,NEW.document_id,NEW.number,NEW.filename,NEW.mime,NEW.bytes,NEW.sha256,NEW.object_key,NEW.uploaded_by_id,NEW.upload_request_id)
 IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.document_id,OLD.number,OLD.filename,OLD.mime,OLD.bytes,OLD.sha256,OLD.object_key,OLD.uploaded_by_id,OLD.upload_request_id)
 THEN RAISE EXCEPTION 'Upload identity and content metadata are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_version_immutable BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION protect_document_version();
CREATE FUNCTION require_ready_document_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM public.document_versions WHERE organization_id=NEW.organization_id AND document_id=NEW.id AND id=NEW.current_version_id AND status='READY')
 THEN RAISE EXCEPTION 'Active document must reference a ready version'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_current_version_ready BEFORE INSERT OR UPDATE OF status,current_version_id ON work_documents FOR EACH ROW EXECUTE FUNCTION require_ready_document_version();
REVOKE ALL ON FUNCTION protect_document_version(),require_ready_document_version() FROM PUBLIC;
