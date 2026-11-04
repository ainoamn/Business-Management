ALTER TABLE blob_cleanup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blob_cleanup_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_boundary ON blob_cleanup_jobs TO work_app
USING (organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member())
WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member());
GRANT SELECT,INSERT ON blob_cleanup_jobs TO work_app;
ALTER TABLE blob_cleanup_jobs ADD CONSTRAINT cleanup_status CHECK(status IN ('PENDING','PROCESSING','DONE','FAILED')),ADD CONSTRAINT cleanup_attempts CHECK(attempts>=0),ADD CONSTRAINT cleanup_released CHECK(NOT released OR status='DONE');
CREATE OR REPLACE FUNCTION work_expire_uploads() RETURNS TABLE(object_key text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; BEGIN
 FOR item IN SELECT v.* FROM public.document_versions v WHERE v.status='PENDING' AND v.created_at<now()-interval '15 minutes' ORDER BY v.created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.document_versions SET status='FAILED' WHERE id=item.id;
 INSERT INTO public.blob_cleanup_jobs(id,organization_id,version_id) VALUES(gen_random_uuid(),item.organization_id,item.id) ON CONFLICT(version_id) DO NOTHING;
 UPDATE public.work_documents SET status='FAILED' WHERE id=item.document_id AND current_version_id IS NULL AND status='PENDING';
 object_key:=item.object_key; RETURN NEXT;
 END LOOP;
END $$;
CREATE FUNCTION work_claim_blob_cleanup() RETURNS TABLE(job_id uuid,object_key text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; BEGIN
 FOR item IN SELECT j.id,v.object_key FROM public.blob_cleanup_jobs j JOIN public.document_versions v ON v.id=j.version_id
 WHERE v.status IN ('FAILED','REJECTED') AND ((j.status='PENDING' AND j.next_attempt_at<=now()) OR (j.status='PROCESSING' AND j.locked_at<now()-interval '5 minutes'))
 ORDER BY j.next_attempt_at LIMIT 10 FOR UPDATE OF j SKIP LOCKED LOOP
 UPDATE public.blob_cleanup_jobs SET status='PROCESSING',locked_at=now(),attempts=attempts+1 WHERE id=item.id;
 job_id:=item.id;object_key:=item.object_key;RETURN NEXT;
 END LOOP;
END $$;
CREATE FUNCTION work_complete_blob_cleanup(job uuid,success boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; BEGIN
 SELECT j.*,v.bytes INTO item FROM public.blob_cleanup_jobs j JOIN public.document_versions v ON v.id=j.version_id WHERE j.id=job AND j.status='PROCESSING' FOR UPDATE OF j;
 IF NOT FOUND THEN RETURN;END IF;
 IF success THEN
 IF NOT item.released THEN
 UPDATE public.organization_storage_usage SET reserved_bytes=reserved_bytes-item.bytes,updated_at=now() WHERE organization_id=item.organization_id AND reserved_bytes>=item.bytes;
 IF NOT FOUND THEN RAISE EXCEPTION 'Upload reservation is inconsistent';END IF;
 END IF;
 UPDATE public.blob_cleanup_jobs SET status='DONE',released=true,locked_at=NULL WHERE id=job;
 ELSE
 UPDATE public.blob_cleanup_jobs SET status=CASE WHEN attempts>=7 THEN 'FAILED' ELSE 'PENDING' END,next_attempt_at=now()+interval '1 minute'*LEAST(60,power(2,attempts)::integer),locked_at=NULL WHERE id=job;
 END IF;
END $$;
REVOKE ALL ON FUNCTION work_claim_blob_cleanup(),work_complete_blob_cleanup(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_claim_blob_cleanup(),work_complete_blob_cleanup(uuid,boolean) TO work_app;
