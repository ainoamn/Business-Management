DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['document_folders','folder_closure','folder_shares','work_documents','document_versions','document_shares','document_links','organization_storage_usage','document_comments','document_events','folder_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_boundary ON %I TO work_app USING (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member()) WITH CHECK (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member())',tab);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO work_app',tab);
 END LOOP;
END $$;
REVOKE UPDATE,DELETE ON document_comments,document_events,folder_events FROM work_app;
REVOKE DELETE ON document_versions,work_documents,document_folders,organization_storage_usage FROM work_app;
ALTER TABLE folder_closure ADD CONSTRAINT folder_closure_depth CHECK(depth BETWEEN 0 AND 12 AND ((ancestor_id=descendant_id AND depth=0) OR (ancestor_id<>descendant_id AND depth>0)));
ALTER TABLE document_folders ADD CONSTRAINT folder_no_self_parent CHECK(parent_id IS NULL OR id<>parent_id),ADD CONSTRAINT folder_visibility CHECK(visibility IN ('PRIVATE','ORGANIZATION'));
ALTER TABLE folder_shares ADD CONSTRAINT folder_share_permission CHECK(permission IN ('READ','WRITE'));
ALTER TABLE document_shares ADD CONSTRAINT document_share_permission CHECK(permission IN ('READ','COMMENT','WRITE'));
ALTER TABLE work_documents ADD CONSTRAINT document_visibility CHECK(visibility IN ('PRIVATE','ORGANIZATION','FOLDER','LINKED')),ADD CONSTRAINT document_folder_visibility CHECK(visibility<>'FOLDER' OR folder_id IS NOT NULL),ADD CONSTRAINT document_confidentiality CHECK(confidentiality IN ('INTERNAL','CONFIDENTIAL','RESTRICTED')),ADD CONSTRAINT document_status CHECK(status IN ('PENDING','ACTIVE','FAILED')),ADD CONSTRAINT active_document_version CHECK(status<>'ACTIVE' OR current_version_id IS NOT NULL);
ALTER TABLE document_versions ADD CONSTRAINT document_version_bytes CHECK(bytes>0 AND bytes<=104857600),ADD CONSTRAINT document_version_number CHECK(number>0),ADD CONSTRAINT document_version_hash CHECK(sha256 ~ '^[a-f0-9]{64}$'),ADD CONSTRAINT document_version_status CHECK(status IN ('PENDING','READY','FAILED','REJECTED')),ADD CONSTRAINT document_scan_status CHECK(scan_status IN ('NOT_SCANNED','CLEAN','INFECTED','ERROR'));
ALTER TABLE organization_storage_usage ADD CONSTRAINT storage_nonnegative CHECK(used_bytes>=0 AND reserved_bytes>=0);
ALTER TABLE document_links ADD CONSTRAINT document_link_one_target CHECK(num_nonnulls(project_id,task_id,meeting_id,request_id,expense_id)=1);
DO $$ DECLARE item text[]; BEGIN
 FOREACH item SLICE 1 IN ARRAY ARRAY[['document_folders','owner_id'],['work_documents','owner_id'],['document_versions','uploaded_by_id'],['folder_shares','membership_id'],['document_shares','membership_id'],['document_comments','actor_id'],['document_events','actor_id'],['folder_events','actor_id']] LOOP
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(organization_id,%I) REFERENCES memberships(organization_id,id)',item[1],item[1]||'_'||item[2],item[2]); END LOOP;
END $$;
CREATE FUNCTION work_expire_uploads() RETURNS TABLE(object_key text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; BEGIN
 FOR item IN SELECT v.id,v.organization_id,v.document_id,v.bytes,v.object_key FROM public.document_versions v WHERE v.status='PENDING' AND v.created_at<now()-interval '15 minutes' ORDER BY v.created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.document_versions SET status='FAILED' WHERE id=item.id AND status='PENDING';
 IF NOT FOUND THEN CONTINUE; END IF;
 UPDATE public.organization_storage_usage SET reserved_bytes=reserved_bytes-item.bytes,updated_at=now() WHERE organization_id=item.organization_id AND reserved_bytes>=item.bytes;
 IF NOT FOUND THEN RAISE EXCEPTION 'Upload reservation is inconsistent'; END IF;
 UPDATE public.work_documents SET status='FAILED' WHERE id=item.document_id AND current_version_id IS NULL AND status='PENDING';
 object_key:=item.object_key; RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION work_expire_uploads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_expire_uploads() TO work_app;
CREATE INDEX operational_expenses_budget_status ON operational_expenses(organization_id,budget_id,status);
