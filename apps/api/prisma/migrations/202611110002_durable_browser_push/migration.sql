BEGIN;
ALTER TABLE work_notifications ADD COLUMN in_app_visible boolean NOT NULL DEFAULT true;
ALTER TABLE work_notifications ADD CONSTRAINT work_notification_recipient_identity_key UNIQUE(organization_id,id,membership_id);
ALTER TABLE push_subscriptions ADD COLUMN updated_at timestamptz(3) NOT NULL DEFAULT now(),ADD COLUMN user_session_id uuid REFERENCES user_sessions(id) ON DELETE RESTRICT,ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0),ADD COLUMN endpoint_hash varchar(64),ADD COLUMN credential_fingerprint varchar(64),ADD COLUMN credentials_enc text,ADD COLUMN vapid_key_hash varchar(64),ADD COLUMN disabled_at timestamptz(3);
UPDATE push_subscriptions SET disabled_at=now() WHERE user_session_id IS NULL;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscription_endpoint_hash_key UNIQUE(organization_id,membership_id,endpoint_hash),ADD CONSTRAINT push_subscription_recipient_identity_key UNIQUE(organization_id,id,membership_id);
CREATE INDEX push_subscriptions_user_session_id_disabled_at_idx ON push_subscriptions(user_session_id,disabled_at);
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON push_subscriptions FROM work_app;
CREATE TABLE push_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,membership_id uuid NOT NULL,notification_id uuid NOT NULL,subscription_id uuid NOT NULL,subscription_revision integer NOT NULL CHECK(subscription_revision>0),user_session_id uuid NOT NULL REFERENCES user_sessions(id) ON DELETE RESTRICT,
 status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PROCESSING','ACCEPTED','FAILED','CANCELLED')),attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),available_at timestamptz(3) NOT NULL DEFAULT now(),expires_at timestamptz(3) NOT NULL DEFAULT now()+interval '1 day',lease_token uuid,lease_expires_at timestamptz(3),accepted_at timestamptz(3),display_claimed_at timestamptz(3),status_code integer CHECK(status_code BETWEEN 100 AND 599),last_error varchar(60),created_at timestamptz(3) NOT NULL DEFAULT now(),updated_at timestamptz(3) NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,notification_id,membership_id) REFERENCES work_notifications(organization_id,id,membership_id) ON DELETE RESTRICT,FOREIGN KEY(organization_id,subscription_id,membership_id) REFERENCES push_subscriptions(organization_id,id,membership_id) ON DELETE RESTRICT,UNIQUE(notification_id,subscription_id)
);
CREATE INDEX push_deliveries_status_available_at_created_at_idx ON push_deliveries(status,available_at,created_at);
CREATE INDEX push_deliveries_organization_id_membership_id_created_at_idx ON push_deliveries(organization_id,membership_id,created_at);
ALTER TABLE push_deliveries ENABLE ROW LEVEL SECURITY;ALTER TABLE push_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY push_delivery_read ON push_deliveries FOR SELECT TO work_app USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND public.work_is_member() AND public.ai_owns_member(membership_id));
GRANT SELECT ON push_deliveries TO work_app;REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON push_deliveries FROM work_app;

CREATE FUNCTION work_push_member(target_session uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;BEGIN
 SELECT m.id INTO member_id FROM public.memberships m JOIN public.users u ON u.id=m.user_id JOIN public.user_sessions s ON s.user_id=u.id AND s.id=target_session JOIN public.organizations o ON o.id=m.organization_id
 WHERE m.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.active AND u.email_verified_at IS NOT NULL AND u.disabled_at IS NULL AND u.deleted_at IS NULL AND o.suspended_at IS NULL AND o.deleted_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>now() FOR SHARE OF s;
 RETURN member_id;
END $$;REVOKE ALL ON FUNCTION work_push_member(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_push_member(uuid) TO work_app;

CREATE FUNCTION work_push_live(job public.push_deliveries) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
 SELECT job.expires_at>now() AND EXISTS(SELECT 1 FROM public.work_notifications n JOIN public.push_subscriptions p ON p.organization_id=n.organization_id AND p.membership_id=n.membership_id AND p.id=job.subscription_id JOIN public.memberships m ON m.organization_id=n.organization_id AND m.id=n.membership_id JOIN public.users u ON u.id=m.user_id JOIN public.user_sessions s ON s.id=p.user_session_id AND s.user_id=u.id JOIN public.organizations o ON o.id=m.organization_id JOIN public.notification_preferences f ON f.organization_id=m.organization_id AND f.membership_id=m.id
 WHERE n.organization_id=job.organization_id AND n.id=job.notification_id AND n.membership_id=job.membership_id AND n.archived_at IS NULL AND p.disabled_at IS NULL AND p.credentials_enc IS NOT NULL AND p.revision=job.subscription_revision AND p.user_session_id=job.user_session_id AND f.push_enabled AND m.active AND u.email_verified_at IS NOT NULL AND u.disabled_at IS NULL AND u.deleted_at IS NULL AND o.suspended_at IS NULL AND o.deleted_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>now())
$$;REVOKE ALL ON FUNCTION work_push_live(public.push_deliveries) FROM PUBLIC;

CREATE FUNCTION work_push_cancel_subscription_jobs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 IF NEW.disabled_at IS NOT NULL OR NEW.revision<>OLD.revision THEN UPDATE public.push_deliveries SET status='CANCELLED',last_error='PUSH_DEVICE_CHANGED',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE subscription_id=NEW.id AND status IN('PENDING','PROCESSING');END IF;RETURN NEW;
END $$;
CREATE TRIGGER work_push_cancel_subscription_jobs AFTER UPDATE ON push_subscriptions FOR EACH ROW EXECUTE FUNCTION work_push_cancel_subscription_jobs();REVOKE ALL ON FUNCTION work_push_cancel_subscription_jobs() FROM PUBLIC;

CREATE FUNCTION work_register_push_subscription(target_id uuid,target_session uuid,target_hash text,target_fingerprint text,target_enc text,target_key_hash text,target_revision integer,target_agent text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;org_id uuid;owner_id uuid;previous public.push_subscriptions%ROWTYPE;expected_revision integer;BEGIN
 member_id:=public.work_push_member(target_session);IF member_id IS NULL THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501';END IF;org_id:=NULLIF(current_setting('app.organization_id',true),'')::uuid;owner_id:=NULLIF(current_setting('app.user_id',true),'')::uuid;
 IF target_id IS NULL OR target_hash IS NULL OR target_fingerprint IS NULL OR target_enc IS NULL OR target_key_hash IS NULL OR target_revision IS NULL OR target_hash!~'^[a-f0-9]{64}$' OR target_fingerprint!~'^[a-f0-9]{64}$' OR target_key_hash!~'^[a-f0-9]{64}$' OR length(target_enc) NOT BETWEEN 50 AND 6000 OR length(target_agent)>500 THEN RAISE EXCEPTION 'Invalid subscription' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('push-user:'||owner_id::text));PERFORM pg_advisory_xact_lock(hashtext('push-endpoint:'||target_hash));
 SELECT * INTO previous FROM public.push_subscriptions WHERE organization_id=org_id AND membership_id=member_id AND endpoint_hash=target_hash FOR UPDATE;
 IF previous.id IS NOT NULL AND previous.id<>target_id THEN RAISE EXCEPTION 'Subscription changed' USING ERRCODE='40001';END IF;
 expected_revision:=CASE WHEN previous.id IS NULL THEN 1 WHEN previous.disabled_at IS NULL AND previous.user_session_id=target_session AND previous.credential_fingerprint=target_fingerprint AND previous.vapid_key_hash=target_key_hash THEN previous.revision ELSE previous.revision+1 END;
 IF target_revision<>expected_revision THEN RAISE EXCEPTION 'Subscription changed' USING ERRCODE='40001';END IF;
 UPDATE public.push_subscriptions p SET disabled_at=now(),credentials_enc=NULL,keys_json='{}',endpoint='disabled:'||p.id::text,revision=p.revision+1,updated_at=now() FROM public.memberships m WHERE m.organization_id=p.organization_id AND m.id=p.membership_id AND p.endpoint_hash=target_hash AND p.disabled_at IS NULL AND (m.user_id<>owner_id OR p.user_session_id IS DISTINCT FROM target_session);
 UPDATE public.push_subscriptions p SET disabled_at=now(),credentials_enc=NULL,keys_json='{}',endpoint='disabled:'||p.id::text,revision=p.revision+1,updated_at=now() WHERE p.organization_id=org_id AND p.membership_id=member_id AND p.disabled_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.user_sessions s WHERE s.id=p.user_session_id AND s.revoked_at IS NULL AND s.expires_at>now());
 IF (SELECT count(*) FROM public.push_subscriptions WHERE organization_id=org_id AND membership_id=member_id AND disabled_at IS NULL AND id<>target_id)>=5 THEN RAISE EXCEPTION 'Device limit reached' USING ERRCODE='23514';END IF;
 IF previous.id IS NULL THEN INSERT INTO public.push_subscriptions(id,organization_id,membership_id,endpoint,keys_json,user_agent,user_session_id,revision,endpoint_hash,credential_fingerprint,credentials_enc,vapid_key_hash,updated_at) VALUES(target_id,org_id,member_id,'push:'||target_hash,'{}',coalesce(target_agent,''),target_session,target_revision,target_hash,target_fingerprint,target_enc,target_key_hash,now());
 ELSE UPDATE public.push_subscriptions SET endpoint='push:'||target_hash,keys_json='{}',user_agent=coalesce(target_agent,''),user_session_id=target_session,revision=target_revision,credential_fingerprint=target_fingerprint,credentials_enc=target_enc,vapid_key_hash=target_key_hash,disabled_at=NULL,updated_at=now() WHERE id=target_id;END IF;
 INSERT INTO public.notification_preferences(organization_id,membership_id,push_enabled) VALUES(org_id,member_id,true) ON CONFLICT(organization_id,membership_id) DO UPDATE SET push_enabled=true;
 RETURN target_id;
END $$;REVOKE ALL ON FUNCTION work_register_push_subscription(uuid,uuid,text,text,text,text,integer,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_register_push_subscription(uuid,uuid,text,text,text,text,integer,text) TO work_app;

CREATE FUNCTION work_revoke_push_subscription(target uuid,target_session uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;org_id uuid;BEGIN
 member_id:=public.work_push_member(target_session);IF member_id IS NULL THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501';END IF;org_id:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 PERFORM pg_advisory_xact_lock(hashtext('push-user:'||NULLIF(current_setting('app.user_id',true),'')::text));
 IF NOT EXISTS(SELECT 1 FROM public.push_subscriptions WHERE id=target AND organization_id=org_id AND membership_id=member_id) THEN RETURN false;END IF;
 UPDATE public.push_subscriptions SET disabled_at=now(),credentials_enc=NULL,keys_json='{}',endpoint='disabled:'||id::text,revision=revision+1,updated_at=now() WHERE id=target AND organization_id=org_id AND membership_id=member_id AND disabled_at IS NULL;
 IF NOT EXISTS(SELECT 1 FROM public.push_subscriptions p JOIN public.user_sessions s ON s.id=p.user_session_id WHERE p.organization_id=org_id AND p.membership_id=member_id AND p.disabled_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>now()) THEN UPDATE public.notification_preferences SET push_enabled=false WHERE organization_id=org_id AND membership_id=member_id;END IF;RETURN true;
END $$;REVOKE ALL ON FUNCTION work_revoke_push_subscription(uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_revoke_push_subscription(uuid,uuid) TO work_app;

CREATE FUNCTION work_push_visibility() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 NEW.in_app_visible:=coalesce((SELECT in_app_enabled FROM public.notification_preferences WHERE organization_id=NEW.organization_id AND membership_id=NEW.membership_id),true);RETURN NEW;
END $$;CREATE TRIGGER work_push_visibility BEFORE INSERT ON work_notifications FOR EACH ROW EXECUTE FUNCTION work_push_visibility();REVOKE ALL ON FUNCTION work_push_visibility() FROM PUBLIC;
CREATE OR REPLACE FUNCTION work_notification_content_immutable() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF (NEW.id,NEW.organization_id,NEW.membership_id,NEW.kind,NEW.resource_type,NEW.resource_id,NEW.deduplication_key,NEW.created_at,NEW.in_app_visible) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.membership_id,OLD.kind,OLD.resource_type,OLD.resource_id,OLD.deduplication_key,OLD.created_at,OLD.in_app_visible) THEN RAISE EXCEPTION 'Notification content and identity are immutable';END IF;RETURN NEW;
END $$;
CREATE FUNCTION work_enqueue_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 INSERT INTO public.push_deliveries(organization_id,membership_id,notification_id,subscription_id,subscription_revision,user_session_id)
 SELECT NEW.organization_id,NEW.membership_id,NEW.id,p.id,p.revision,p.user_session_id FROM public.push_subscriptions p JOIN public.memberships m ON m.organization_id=p.organization_id AND m.id=p.membership_id JOIN public.users u ON u.id=m.user_id JOIN public.user_sessions s ON s.id=p.user_session_id AND s.user_id=u.id JOIN public.organizations o ON o.id=m.organization_id JOIN public.notification_preferences f ON f.organization_id=m.organization_id AND f.membership_id=m.id WHERE p.organization_id=NEW.organization_id AND p.membership_id=NEW.membership_id AND p.disabled_at IS NULL AND p.credentials_enc IS NOT NULL AND p.vapid_key_hash IS NOT NULL AND f.push_enabled AND m.active AND u.email_verified_at IS NOT NULL AND u.disabled_at IS NULL AND u.deleted_at IS NULL AND o.suspended_at IS NULL AND o.deleted_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>now() ON CONFLICT(notification_id,subscription_id) DO NOTHING;RETURN NEW;
END $$;CREATE TRIGGER work_enqueue_push AFTER INSERT ON work_notifications FOR EACH ROW EXECUTE FUNCTION work_enqueue_push();REVOKE ALL ON FUNCTION work_enqueue_push() FROM PUBLIC;
CREATE FUNCTION work_cancel_push_on_preference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 IF NOT NEW.push_enabled THEN UPDATE public.push_deliveries SET status='CANCELLED',last_error='PUSH_PREFERENCE_DISABLED',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE organization_id=NEW.organization_id AND membership_id=NEW.membership_id AND status IN('PENDING','PROCESSING');END IF;RETURN NEW;
END $$;CREATE TRIGGER work_cancel_push_on_preference AFTER UPDATE OF push_enabled ON notification_preferences FOR EACH ROW EXECUTE FUNCTION work_cancel_push_on_preference();REVOKE ALL ON FUNCTION work_cancel_push_on_preference() FROM PUBLIC;
CREATE FUNCTION work_cancel_push_on_archive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 IF NEW.archived_at IS NOT NULL THEN UPDATE public.push_deliveries SET status='CANCELLED',last_error='PUSH_NOTIFICATION_ARCHIVED',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE notification_id=NEW.id AND status IN('PENDING','PROCESSING');END IF;RETURN NEW;
END $$;CREATE TRIGGER work_cancel_push_on_archive AFTER UPDATE OF archived_at ON work_notifications FOR EACH ROW EXECUTE FUNCTION work_cancel_push_on_archive();REVOKE ALL ON FUNCTION work_cancel_push_on_archive() FROM PUBLIC;
CREATE FUNCTION work_cancel_push_on_session() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 IF NEW.revoked_at IS NOT NULL OR NEW.expires_at<=now() THEN UPDATE public.push_subscriptions SET disabled_at=now(),credentials_enc=NULL,keys_json='{}',endpoint='disabled:'||id::text,revision=revision+1,updated_at=now() WHERE user_session_id=NEW.id AND disabled_at IS NULL;END IF;RETURN NEW;
END $$;CREATE TRIGGER work_cancel_push_on_session AFTER UPDATE OF revoked_at,expires_at ON user_sessions FOR EACH ROW EXECUTE FUNCTION work_cancel_push_on_session();REVOKE ALL ON FUNCTION work_cancel_push_on_session() FROM PUBLIC;

CREATE FUNCTION work_claim_push_deliveries(batch_size integer) RETURNS TABLE(id uuid,organization_id uuid,membership_id uuid,user_id uuid,user_session_id uuid,notification_id uuid,subscription_id uuid,subscription_revision integer,lease_token uuid,credentials_enc text,vapid_key_hash text,locale text,resource_type text,resource_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 UPDATE public.push_deliveries d SET status='CANCELLED',last_error='PUSH_CONTEXT_EXPIRED',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE d.status IN('PENDING','PROCESSING') AND NOT public.work_push_live(d);
 UPDATE public.push_deliveries d SET status='FAILED',last_error='PUSH_ATTEMPTS_EXHAUSTED',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE d.attempts>=8 AND (d.status='PENDING' OR d.status='PROCESSING' AND d.lease_expires_at<=now());
 RETURN QUERY WITH chosen AS(SELECT d.id FROM public.push_deliveries d WHERE d.attempts<8 AND (d.status='PENDING' AND d.available_at<=now() OR d.status='PROCESSING' AND d.lease_expires_at<=now()) ORDER BY d.available_at,d.created_at,d.id LIMIT least(greatest(batch_size,1),2) FOR UPDATE SKIP LOCKED),claimed AS(UPDATE public.push_deliveries d SET status='PROCESSING',attempts=d.attempts+1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '60 seconds',updated_at=now() FROM chosen c WHERE d.id=c.id RETURNING d.*)
 SELECT c.id,c.organization_id,c.membership_id,m.user_id,c.user_session_id,c.notification_id,c.subscription_id,c.subscription_revision,c.lease_token,p.credentials_enc,p.vapid_key_hash::text,o.locale::text,n.resource_type::text,n.resource_id FROM claimed c JOIN public.push_subscriptions p ON p.id=c.subscription_id JOIN public.work_notifications n ON n.id=c.notification_id JOIN public.memberships m ON m.organization_id=c.organization_id AND m.id=c.membership_id JOIN public.organizations o ON o.id=c.organization_id;
END $$;REVOKE ALL ON FUNCTION work_claim_push_deliveries(integer) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_claim_push_deliveries(integer) TO work_app;
CREATE FUNCTION work_confirm_push_delivery(target uuid,token uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$SELECT EXISTS(SELECT 1 FROM public.push_deliveries d WHERE d.id=target AND d.lease_token=token AND d.status='PROCESSING' AND d.lease_expires_at>now() AND public.work_push_live(d))$$;REVOKE ALL ON FUNCTION work_confirm_push_delivery(uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_confirm_push_delivery(uuid,uuid) TO work_app;
CREATE FUNCTION work_finish_push_delivery(target uuid,token uuid,outcome text,http_status integer,delay_seconds integer,reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE job public.push_deliveries%ROWTYPE;sub_id uuid;BEGIN
 IF outcome IS NULL OR outcome NOT IN('ACCEPTED','RETRY','FAILED','CANCELLED','EXPIRED') OR http_status IS NOT NULL AND http_status NOT BETWEEN 100 AND 599 OR reason IS NOT NULL AND reason!~'^[A-Z][A-Z0-9_]{2,59}$' THEN RAISE EXCEPTION 'Invalid delivery outcome' USING ERRCODE='22023';END IF;
 SELECT subscription_id INTO sub_id FROM public.push_deliveries WHERE id=target;PERFORM 1 FROM public.push_subscriptions WHERE id=sub_id FOR UPDATE;
 SELECT * INTO job FROM public.push_deliveries WHERE id=target AND lease_token=token AND status='PROCESSING' FOR UPDATE;IF job.id IS NULL THEN RETURN false;END IF;
 UPDATE public.push_deliveries SET status=CASE WHEN outcome='ACCEPTED' THEN 'ACCEPTED' WHEN outcome='RETRY' AND attempts<8 AND expires_at>now() THEN 'PENDING' WHEN outcome='CANCELLED' THEN 'CANCELLED' ELSE 'FAILED' END,available_at=CASE WHEN outcome='RETRY' THEN now()+make_interval(secs=>least(greatest(coalesce(delay_seconds,1),1),3600)) ELSE available_at END,accepted_at=CASE WHEN outcome='ACCEPTED' THEN now() ELSE accepted_at END,status_code=http_status,last_error=reason,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=target;
 IF outcome='EXPIRED' THEN UPDATE public.push_subscriptions SET disabled_at=now(),credentials_enc=NULL,keys_json='{}',endpoint='disabled:'||id::text,revision=revision+1,updated_at=now() WHERE id=job.subscription_id AND revision=job.subscription_revision AND disabled_at IS NULL;END IF;RETURN true;
END $$;REVOKE ALL ON FUNCTION work_finish_push_delivery(uuid,uuid,text,integer,integer,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_finish_push_delivery(uuid,uuid,text,integer,integer,text) TO work_app;
CREATE FUNCTION work_claim_push_display(target uuid,target_session uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;changed uuid;BEGIN
 member_id:=public.work_push_member(target_session);IF member_id IS NULL THEN RETURN false;END IF;
 UPDATE public.push_deliveries d SET display_claimed_at=now(),updated_at=now() WHERE d.id=target AND d.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND d.membership_id=member_id AND d.user_session_id=target_session AND d.status IN('PROCESSING','ACCEPTED') AND d.display_claimed_at IS NULL AND public.work_push_live(d) RETURNING d.id INTO changed;RETURN changed IS NOT NULL;
END $$;REVOKE ALL ON FUNCTION work_claim_push_display(uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_claim_push_display(uuid,uuid) TO work_app;

CREATE OR REPLACE FUNCTION work_dispatch_reminders(web_origin text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; target record; delivery_stage text; sent_count integer:=0;
BEGIN
 IF web_origin !~ '^https?://[^/]+$' THEN RAISE EXCEPTION 'Invalid web origin'; END IF;
 FOR item IN SELECT t.id,t.organization_id,t.due_date,t.assigned_to_id,t.reviewer_id,t.approver_id,t.status FROM public.tasks t JOIN public.organizations o ON o.id=t.organization_id JOIN public.task_statuses s ON s.organization_id=t.organization_id AND s.key=t.status
 WHERE t.archived_at IS NULL AND t.completed_at IS NULL AND s.category<>'CANCELLED' AND t.due_date<=now()+interval '24 hours'
 AND o.suspended_at IS NULL AND o.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.reminder_deliveries d WHERE d.organization_id=t.organization_id AND d.resource_type='tasks' AND d.resource_id=t.id AND d.due_at=t.due_date AND d.stage=CASE WHEN t.due_date<now() THEN 'OVERDUE' ELSE 'UPCOMING' END)
 ORDER BY t.due_date LIMIT 100 FOR UPDATE OF t SKIP LOCKED LOOP
 delivery_stage:=CASE WHEN item.due_date<now() THEN 'OVERDUE' ELSE 'UPCOMING' END;
 INSERT INTO public.reminder_deliveries(organization_id,resource_type,resource_id,due_at,stage) VALUES(item.organization_id,'tasks',item.id,item.due_date,delivery_stage) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN CONTINUE; END IF;
 FOR target IN SELECT DISTINCT m.id,u.email,COALESCE(p.in_app_enabled,true) AS in_app,COALESCE(p.email_enabled,false) AS email_enabled FROM public.memberships m JOIN public.users u ON u.id=m.user_id LEFT JOIN public.notification_preferences p ON p.organization_id=m.organization_id AND p.membership_id=m.id
 WHERE m.organization_id=item.organization_id AND m.id IN(item.assigned_to_id,item.reviewer_id,item.approver_id) AND m.active AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND COALESCE(p.reminders_enabled,true) LOOP
 INSERT INTO public.work_notifications(id,organization_id,membership_id,kind,resource_type,resource_id,deduplication_key) VALUES(gen_random_uuid(),item.organization_id,target.id,'TASK_'||delivery_stage,'tasks',item.id,'reminder:'||item.id||':'||item.due_date||':'||delivery_stage) ON CONFLICT DO NOTHING;
 IF target.email_enabled THEN INSERT INTO public.email_outbox(id,recipient,subject,text_body) VALUES(gen_random_uuid(),target.email,'تذكير مهمة | Task reminder',web_origin||'/app/tasks/'||item.id); END IF;
 sent_count:=sent_count+1;
 END LOOP;
 END LOOP;
 RETURN sent_count;
END $$;
REVOKE ALL ON FUNCTION work_dispatch_reminders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_dispatch_reminders(text) TO work_app;

CREATE OR REPLACE FUNCTION support_notify_message(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 IF NOT public.platform_ops_can('support.manage') THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501';END IF;
 INSERT INTO public.work_notifications(id,organization_id,membership_id,kind,resource_type,resource_id,deduplication_key)
 SELECT gen_random_uuid(),c.organization_id,c.creator_id,'SUPPORT_REPLY','support',c.id,'support:'||m.id::text FROM public.support_messages m JOIN public.support_cases c ON c.id=m.case_id AND c.organization_id=m.organization_id JOIN public.memberships recipient ON recipient.organization_id=c.organization_id AND recipient.id=c.creator_id JOIN public.users u ON u.id=recipient.user_id LEFT JOIN public.notification_preferences p ON p.organization_id=c.organization_id AND p.membership_id=c.creator_id
 WHERE m.id=target AND m.platform_author_id=NULLIF(current_setting('app.platform_account_id',true),'')::uuid AND recipient.active AND u.disabled_at IS NULL AND u.deleted_at IS NULL  ON CONFLICT(organization_id,membership_id,deduplication_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION support_notify_message(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION support_notify_message(uuid) TO work_app;

COMMIT;
