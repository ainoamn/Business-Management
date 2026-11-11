BEGIN;
-- CreateTable
CREATE TABLE "notification_phones" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "phone_enc" TEXT,
    "phone_hash" VARCHAR(64),
    "credential_key_hash" VARCHAR(64),
    "last_four" VARCHAR(4),
    "verified_at" TIMESTAMPTZ(3),
    "verification_expires_at" TIMESTAMPTZ(3),
    "sms_consented_at" TIMESTAMPTZ(3),
    "whatsapp_consented_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_verifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "user_session_id" UUID NOT NULL,
    "proposed_revision" INTEGER NOT NULL,
    "phone_enc" TEXT NOT NULL,
    "phone_hash" VARCHAR(64) NOT NULL,
    "last_four" VARCHAR(4) NOT NULL,
    "credential_key_hash" VARCHAR(64) NOT NULL,
    "provider_key_hash" VARCHAR(64) NOT NULL,
    "provider_verification_id" VARCHAR(34),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PREPARING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consented_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "lease_token" UUID,
    "lease_expires_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(60),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "contact_revision" INTEGER NOT NULL,
    "channel" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "lease_token" UUID,
    "lease_expires_at" TIMESTAMPTZ(3),
    "provider_id" VARCHAR(34),
    "accepted_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(60),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "channel_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_phones_phone_hash_idx" ON "notification_phones"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "notification_phones_organization_id_membership_id_key" ON "notification_phones"("organization_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_phones_organization_id_id_membership_id_key" ON "notification_phones"("organization_id", "id", "membership_id");

-- CreateIndex
CREATE INDEX "phone_verifications_organization_id_membership_id_created_a_idx" ON "phone_verifications"("organization_id", "membership_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "phone_verifications_status_expires_at_idx" ON "phone_verifications"("status", "expires_at");

-- CreateIndex
CREATE INDEX "channel_deliveries_status_available_at_idx" ON "channel_deliveries"("status", "available_at");

-- CreateIndex
CREATE INDEX "channel_deliveries_status_lease_expires_at_idx" ON "channel_deliveries"("status", "lease_expires_at");

-- CreateIndex
CREATE INDEX "channel_deliveries_contact_id_status_idx" ON "channel_deliveries"("contact_id", "status");

-- CreateIndex
CREATE INDEX "channel_deliveries_organization_id_membership_id_created_at_idx" ON "channel_deliveries"("organization_id", "membership_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "channel_deliveries_notification_id_channel_key" ON "channel_deliveries"("notification_id", "channel");

-- AddForeignKey
ALTER TABLE "notification_phones" ADD CONSTRAINT "notification_phones_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_phones" ADD CONSTRAINT "notification_phones_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_organization_id_contact_id_membership__fkey" FOREIGN KEY ("organization_id", "contact_id", "membership_id") REFERENCES "notification_phones"("organization_id", "id", "membership_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_session_id_fkey" FOREIGN KEY ("user_session_id") REFERENCES "user_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_deliveries" ADD CONSTRAINT "channel_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_deliveries" ADD CONSTRAINT "channel_deliveries_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_deliveries" ADD CONSTRAINT "channel_deliveries_organization_id_notification_id_members_fkey" FOREIGN KEY ("organization_id", "notification_id", "membership_id") REFERENCES "work_notifications"("organization_id", "id", "membership_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_deliveries" ADD CONSTRAINT "channel_deliveries_organization_id_contact_id_membership_i_fkey" FOREIGN KEY ("organization_id", "contact_id", "membership_id") REFERENCES "notification_phones"("organization_id", "id", "membership_id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE notification_phones ADD CONSTRAINT notification_phone_revision CHECK(revision>=0),ADD CONSTRAINT notification_phone_last_four CHECK(last_four IS NULL OR last_four~'^[0-9]{4}$'),ADD CONSTRAINT notification_phone_key_hash CHECK(credential_key_hash IS NULL OR credential_key_hash~'^[a-f0-9]{64}$'),ADD CONSTRAINT notification_phone_identity_hash CHECK(phone_hash IS NULL OR phone_hash~'^[a-f0-9]{64}$'),ADD CONSTRAINT notification_phone_cipher_limit CHECK(phone_enc IS NULL OR length(phone_enc)<=6000);
ALTER TABLE phone_verifications ADD CONSTRAINT phone_verification_state CHECK(status IN('PREPARING','PENDING','CHECKING','UNCERTAIN','APPROVED','FAILED','CANCELLED')),ADD CONSTRAINT phone_verification_attempts CHECK(attempts BETWEEN 0 AND 5),ADD CONSTRAINT phone_verification_revision CHECK(proposed_revision>0),ADD CONSTRAINT phone_verification_last_four CHECK(last_four~'^[0-9]{4}$'),ADD CONSTRAINT phone_verification_cipher_limit CHECK(length(phone_enc)<=6000),ADD CONSTRAINT phone_verification_hashes CHECK(phone_hash~'^[a-f0-9]{64}$' AND credential_key_hash~'^[a-f0-9]{64}$' AND provider_key_hash~'^[a-f0-9]{64}$'),ADD CONSTRAINT phone_verification_provider_id CHECK(provider_verification_id IS NULL OR provider_verification_id~'^VE[a-fA-F0-9]{32}$');
ALTER TABLE channel_deliveries ADD CONSTRAINT channel_delivery_state CHECK(status IN('PENDING','PROCESSING','ACCEPTED','FAILED','CANCELLED','UNCERTAIN')),ADD CONSTRAINT channel_delivery_channel CHECK(channel IN('SMS','WHATSAPP')),ADD CONSTRAINT channel_delivery_attempts CHECK(attempts BETWEEN 0 AND 5),ADD CONSTRAINT channel_delivery_revision CHECK(contact_revision>0),ADD CONSTRAINT channel_delivery_provider CHECK(provider_id IS NULL OR provider_id~'^(SM|MM)[a-fA-F0-9]{32}$');
CREATE INDEX channel_delivery_budget ON channel_deliveries(created_at,status);
CREATE INDEX channel_delivery_recent_attempts ON channel_deliveries((coalesce(accepted_at,updated_at))) WHERE attempts>0;
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['notification_phones','phone_verifications','channel_deliveries'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY channel_own_read ON %I FOR SELECT TO work_app USING(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member() AND public.ai_owns_member(membership_id))',tab);
 EXECUTE format('GRANT SELECT ON %I TO work_app',tab);EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON %I FROM work_app',tab);
END LOOP;END $$;
CREATE FUNCTION work_channel_member(target_session uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$SELECT public.work_push_member(target_session)$$;
REVOKE ALL ON FUNCTION work_channel_member(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_channel_member(uuid) TO work_app;
CREATE FUNCTION work_start_phone_challenge(target uuid,target_session uuid,target_contact uuid,next_revision integer,phone_digest text,sealed_phone text,key_digest text,provider_digest text,last_digits text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;org_id uuid;current_revision integer;BEGIN
 member_id:=public.work_channel_member(target_session);IF member_id IS NULL THEN RAISE EXCEPTION 'Session expired' USING ERRCODE='42501';END IF;org_id:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 IF target IS NULL OR target_contact IS NULL OR next_revision IS NULL OR next_revision<=0 OR phone_digest IS NULL OR phone_digest!~'^[a-f0-9]{64}$' OR key_digest IS NULL OR key_digest!~'^[a-f0-9]{64}$' OR provider_digest IS NULL OR provider_digest!~'^[a-f0-9]{64}$' OR sealed_phone IS NULL OR length(sealed_phone)>6000 OR last_digits IS NULL OR last_digits!~'^[0-9]{4}$' THEN RAISE EXCEPTION 'Invalid phone challenge' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('channel-contact:'||org_id::text||':'||member_id::text));
 IF EXISTS(SELECT 1 FROM public.phone_verifications WHERE organization_id=org_id AND membership_id=member_id AND created_at>now()-interval '60 seconds') THEN RAISE EXCEPTION 'Wait before requesting another code' USING ERRCODE='23514';END IF;
 INSERT INTO public.notification_phones(id,organization_id,membership_id,updated_at) VALUES(target_contact,org_id,member_id,now()) ON CONFLICT(organization_id,membership_id) DO NOTHING;
 SELECT revision INTO current_revision FROM public.notification_phones WHERE id=target_contact AND organization_id=org_id AND membership_id=member_id FOR UPDATE;
 IF current_revision IS NULL OR current_revision+1<>next_revision THEN RAISE EXCEPTION 'Contact changed' USING ERRCODE='40001';END IF;
 UPDATE public.phone_verifications SET status='CANCELLED',phone_enc='',provider_verification_id=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE organization_id=org_id AND membership_id=member_id AND status IN('PREPARING','PENDING','CHECKING','UNCERTAIN');
 INSERT INTO public.phone_verifications(id,organization_id,membership_id,contact_id,user_session_id,proposed_revision,phone_enc,phone_hash,last_four,credential_key_hash,provider_key_hash,expires_at,updated_at) VALUES(target,org_id,member_id,target_contact,target_session,next_revision,sealed_phone,phone_digest,last_digits,key_digest,provider_digest,now()+interval '10 minutes',now());RETURN target;
END $$;
REVOKE ALL ON FUNCTION work_start_phone_challenge(uuid,uuid,uuid,integer,text,text,text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_start_phone_challenge(uuid,uuid,uuid,integer,text,text,text,text,text) TO work_app;
CREATE FUNCTION work_finish_phone_start(target uuid,target_session uuid,provider_verification text,outcome text,reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;changed uuid;BEGIN member_id:=public.work_channel_member(target_session);IF member_id IS NULL THEN RETURN false;END IF;
 IF outcome IS NULL OR outcome NOT IN('PENDING','FAILED','UNCERTAIN') OR outcome='PENDING' AND (provider_verification IS NULL OR provider_verification!~'^VE[a-fA-F0-9]{32}$') OR reason IS NOT NULL AND reason!~'^[A-Z][A-Z0-9_]{2,59}$' THEN RAISE EXCEPTION 'Invalid phone result' USING ERRCODE='22023';END IF;
 UPDATE public.phone_verifications SET provider_verification_id=CASE WHEN outcome='PENDING' THEN provider_verification ELSE NULL END,phone_enc=CASE WHEN outcome='PENDING' THEN phone_enc ELSE '' END,status=outcome,last_error=reason,updated_at=now() WHERE id=target AND organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND membership_id=member_id AND user_session_id=target_session AND status='PREPARING' AND expires_at>now() RETURNING id INTO changed;RETURN changed IS NOT NULL;END $$;
REVOKE ALL ON FUNCTION work_finish_phone_start(uuid,uuid,text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_finish_phone_start(uuid,uuid,text,text,text) TO work_app;
CREATE FUNCTION work_claim_phone_check(target uuid,target_session uuid,token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;changed uuid;BEGIN member_id:=public.work_channel_member(target_session);IF member_id IS NULL THEN RETURN false;END IF;
 UPDATE public.phone_verifications SET status='CHECKING',attempts=attempts+1,lease_token=token,lease_expires_at=now()+interval '60 seconds',updated_at=now() WHERE id=target AND organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND membership_id=member_id AND user_session_id=target_session AND (status='PENDING' OR status='CHECKING' AND lease_expires_at<=now()) AND attempts<5 AND expires_at>now() AND provider_verification_id IS NOT NULL RETURNING id INTO changed;RETURN changed IS NOT NULL;END $$;
REVOKE ALL ON FUNCTION work_claim_phone_check(uuid,uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_claim_phone_check(uuid,uuid,uuid) TO work_app;
CREATE FUNCTION work_finish_phone_check(target uuid,target_session uuid,token uuid,approved boolean,reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;challenge public.phone_verifications%ROWTYPE;changed uuid;BEGIN
 member_id:=public.work_channel_member(target_session);IF member_id IS NULL THEN RETURN false;END IF;
 IF reason IS NOT NULL AND reason!~'^[A-Z][A-Z0-9_]{2,59}$' THEN RAISE EXCEPTION 'Invalid result' USING ERRCODE='22023';END IF;
 SELECT * INTO challenge FROM public.phone_verifications WHERE id=target AND organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND membership_id=member_id AND user_session_id=target_session;
 IF challenge.id IS NULL THEN RETURN false;END IF;
 -- Consistent contact-before-challenge ordering prevents a replacement challenge deadlock.
 PERFORM 1 FROM public.notification_phones WHERE id=challenge.contact_id FOR UPDATE;
 SELECT * INTO challenge FROM public.phone_verifications WHERE id=target AND lease_token=token AND status='CHECKING' AND expires_at>now() AND lease_expires_at>now() FOR UPDATE;IF challenge.id IS NULL THEN RETURN false;END IF;
 IF approved IS TRUE THEN
  UPDATE public.notification_phones SET revision=challenge.proposed_revision,phone_enc=challenge.phone_enc,phone_hash=challenge.phone_hash,credential_key_hash=challenge.credential_key_hash,last_four=challenge.last_four,verified_at=now(),verification_expires_at=now()+interval '90 days',revoked_at=NULL,sms_consented_at=NULL,whatsapp_consented_at=NULL,updated_at=now() WHERE id=challenge.contact_id AND organization_id=challenge.organization_id AND membership_id=member_id AND revision+1=challenge.proposed_revision RETURNING id INTO changed;
  IF changed IS NULL THEN UPDATE public.phone_verifications SET status='CANCELLED',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=target;RETURN false;END IF;
  UPDATE public.notification_preferences SET sms_enabled=false,whatsapp_enabled=false WHERE organization_id=challenge.organization_id AND membership_id=member_id;
  UPDATE public.phone_verifications SET status='APPROVED',phone_enc='',provider_verification_id=NULL,lease_token=NULL,lease_expires_at=NULL,last_error=NULL,updated_at=now() WHERE id=target;RETURN true;
 END IF;
 UPDATE public.phone_verifications SET status=CASE WHEN attempts>=5 THEN 'FAILED' ELSE 'PENDING' END,phone_enc=CASE WHEN attempts>=5 THEN '' ELSE phone_enc END,provider_verification_id=CASE WHEN attempts>=5 THEN NULL ELSE provider_verification_id END,lease_token=NULL,lease_expires_at=NULL,last_error=reason,updated_at=now() WHERE id=target;RETURN false;
END $$;REVOKE ALL ON FUNCTION work_finish_phone_check(uuid,uuid,uuid,boolean,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_finish_phone_check(uuid,uuid,uuid,boolean,text) TO work_app;
CREATE FUNCTION work_consent_phone_channels(target_session uuid,expected_revision integer,wants_sms boolean,wants_whatsapp boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;org_id uuid;changed uuid;BEGIN member_id:=public.work_channel_member(target_session);IF member_id IS NULL THEN RETURN false;END IF;org_id:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 IF wants_sms IS NULL OR wants_whatsapp IS NULL THEN RETURN false;END IF;
 UPDATE public.notification_phones SET sms_consented_at=CASE WHEN wants_sms THEN coalesce(sms_consented_at,now()) ELSE NULL END,whatsapp_consented_at=CASE WHEN wants_whatsapp THEN coalesce(whatsapp_consented_at,now()) ELSE NULL END,updated_at=now() WHERE organization_id=org_id AND membership_id=member_id AND revision=expected_revision AND (NOT wants_sms AND NOT wants_whatsapp OR verified_at IS NOT NULL AND verification_expires_at>now() AND revoked_at IS NULL AND phone_enc IS NOT NULL) RETURNING id INTO changed;
 IF changed IS NULL THEN RETURN false;END IF;
 INSERT INTO public.notification_preferences(organization_id,membership_id,sms_enabled,whatsapp_enabled) VALUES(org_id,member_id,wants_sms,wants_whatsapp) ON CONFLICT(organization_id,membership_id) DO UPDATE SET sms_enabled=wants_sms,whatsapp_enabled=wants_whatsapp;RETURN true;END $$;
REVOKE ALL ON FUNCTION work_consent_phone_channels(uuid,integer,boolean,boolean) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_consent_phone_channels(uuid,integer,boolean,boolean) TO work_app;
CREATE FUNCTION work_revoke_notification_phone(target_session uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE member_id uuid;org_id uuid;BEGIN member_id:=public.work_channel_member(target_session);IF member_id IS NULL THEN RETURN false;END IF;org_id:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 UPDATE public.notification_phones SET revision=revision+1,phone_enc=NULL,phone_hash=NULL,credential_key_hash=NULL,last_four=NULL,verified_at=NULL,verification_expires_at=NULL,sms_consented_at=NULL,whatsapp_consented_at=NULL,revoked_at=now(),updated_at=now() WHERE organization_id=org_id AND membership_id=member_id AND (phone_enc IS NOT NULL OR revoked_at IS NULL);
 UPDATE public.phone_verifications SET status=CASE WHEN status IN('PREPARING','PENDING','CHECKING','UNCERTAIN') THEN 'CANCELLED' ELSE status END,phone_enc='',provider_verification_id=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE organization_id=org_id AND membership_id=member_id AND (phone_enc<>'' OR status IN('PREPARING','PENDING','CHECKING','UNCERTAIN'));
 UPDATE public.notification_preferences SET sms_enabled=false,whatsapp_enabled=false WHERE organization_id=org_id AND membership_id=member_id;RETURN true;END $$;
REVOKE ALL ON FUNCTION work_revoke_notification_phone(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_revoke_notification_phone(uuid) TO work_app;
CREATE FUNCTION work_channel_live(job public.channel_deliveries) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
 SELECT EXISTS(SELECT 1 FROM public.notification_phones p JOIN public.memberships m ON m.organization_id=p.organization_id AND m.id=p.membership_id JOIN public.users u ON u.id=m.user_id JOIN public.organizations o ON o.id=p.organization_id JOIN public.work_notifications n ON n.organization_id=job.organization_id AND n.id=job.notification_id AND n.membership_id=p.membership_id JOIN public.notification_preferences pref ON pref.organization_id=p.organization_id AND pref.membership_id=p.membership_id
 WHERE p.organization_id=job.organization_id AND p.id=job.contact_id AND p.membership_id=job.membership_id AND p.revision=job.contact_revision AND p.verified_at IS NOT NULL AND p.verification_expires_at>now() AND p.revoked_at IS NULL AND p.phone_enc IS NOT NULL AND n.archived_at IS NULL AND m.active AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND o.deleted_at IS NULL AND o.suspended_at IS NULL AND job.expires_at>now() AND (job.channel='SMS' AND p.sms_consented_at IS NOT NULL AND pref.sms_enabled OR job.channel='WHATSAPP' AND p.whatsapp_consented_at IS NOT NULL AND pref.whatsapp_enabled))
$$;REVOKE ALL ON FUNCTION work_channel_live(public.channel_deliveries) FROM PUBLIC;
CREATE FUNCTION work_queue_channel_notifications() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 INSERT INTO public.channel_deliveries(id,organization_id,membership_id,notification_id,contact_id,contact_revision,channel,expires_at,updated_at)
 SELECT gen_random_uuid(),NEW.organization_id,NEW.membership_id,NEW.id,p.id,p.revision,channels.kind,now()+interval '1 day',now() FROM public.notification_phones p JOIN public.notification_preferences pref ON pref.organization_id=p.organization_id AND pref.membership_id=p.membership_id CROSS JOIN(VALUES('SMS'),('WHATSAPP')) channels(kind)
 WHERE p.organization_id=NEW.organization_id AND p.membership_id=NEW.membership_id AND p.verified_at IS NOT NULL AND p.verification_expires_at>now() AND p.revoked_at IS NULL AND p.phone_enc IS NOT NULL AND NEW.archived_at IS NULL AND (channels.kind='SMS' AND p.sms_consented_at IS NOT NULL AND pref.sms_enabled OR channels.kind='WHATSAPP' AND p.whatsapp_consented_at IS NOT NULL AND pref.whatsapp_enabled) ON CONFLICT(notification_id,channel) DO NOTHING;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION work_queue_channel_notifications() FROM PUBLIC;CREATE TRIGGER queue_channel_notifications AFTER INSERT ON work_notifications FOR EACH ROW EXECUTE FUNCTION work_queue_channel_notifications();
CREATE FUNCTION work_cancel_phone_deliveries() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 UPDATE public.channel_deliveries d SET status='CANCELLED',lease_token=NULL,lease_expires_at=NULL,last_error='CHANNEL_CONTACT_REVOKED',updated_at=now() WHERE d.contact_id=NEW.id AND d.status IN('PENDING','PROCESSING') AND (d.contact_revision<>NEW.revision OR NEW.revoked_at IS NOT NULL OR NEW.verified_at IS NULL OR NEW.phone_enc IS NULL OR d.channel='SMS' AND NEW.sms_consented_at IS NULL OR d.channel='WHATSAPP' AND NEW.whatsapp_consented_at IS NULL);RETURN NEW;END $$;
REVOKE ALL ON FUNCTION work_cancel_phone_deliveries() FROM PUBLIC;CREATE TRIGGER cancel_phone_deliveries AFTER UPDATE ON notification_phones FOR EACH ROW EXECUTE FUNCTION work_cancel_phone_deliveries();
CREATE FUNCTION work_cancel_channel_preferences() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 UPDATE public.channel_deliveries SET status='CANCELLED',lease_token=NULL,lease_expires_at=NULL,last_error='CHANNEL_PREFERENCE_DISABLED',updated_at=now() WHERE organization_id=NEW.organization_id AND membership_id=NEW.membership_id AND status IN('PENDING','PROCESSING') AND (channel='SMS' AND NOT NEW.sms_enabled OR channel='WHATSAPP' AND NOT NEW.whatsapp_enabled);RETURN NEW;END $$;
REVOKE ALL ON FUNCTION work_cancel_channel_preferences() FROM PUBLIC;CREATE TRIGGER cancel_channel_preferences AFTER UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION work_cancel_channel_preferences();
CREATE FUNCTION work_cancel_archived_channel_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$BEGIN
 IF NEW.archived_at IS NOT NULL THEN UPDATE public.channel_deliveries SET status='CANCELLED',lease_token=NULL,lease_expires_at=NULL,last_error='CHANNEL_NOTIFICATION_ARCHIVED',updated_at=now() WHERE notification_id=NEW.id AND status IN('PENDING','PROCESSING');END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION work_cancel_archived_channel_delivery() FROM PUBLIC;CREATE TRIGGER cancel_archived_channel_delivery AFTER UPDATE OF archived_at ON work_notifications FOR EACH ROW EXECUTE FUNCTION work_cancel_archived_channel_delivery();
CREATE FUNCTION work_claim_channel_delivery(user_limit integer,global_limit integer) RETURNS TABLE(id uuid,organization_id uuid,membership_id uuid,user_id uuid,contact_id uuid,contact_revision integer,channel text,lease_token uuid,phone_enc text,credential_key_hash text,locale text,resource_type text,resource_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE candidate public.channel_deliveries%ROWTYPE;recipient uuid;token uuid;BEGIN
 -- A crashed paid request can have reached the provider. It must never be retried automatically.
 WITH expired AS(SELECT d.id FROM public.channel_deliveries d WHERE d.status='PROCESSING' AND d.lease_expires_at<=now() ORDER BY d.lease_expires_at LIMIT 100 FOR UPDATE SKIP LOCKED) UPDATE public.channel_deliveries d SET status='UNCERTAIN',lease_token=NULL,lease_expires_at=NULL,last_error='CHANNEL_LEASE_EXPIRED',updated_at=now() FROM expired e WHERE d.id=e.id;
 WITH stale AS(SELECT d.id FROM public.channel_deliveries d WHERE d.status='PENDING' AND d.available_at<=now() ORDER BY d.available_at,d.created_at LIMIT 100 FOR UPDATE SKIP LOCKED) UPDATE public.channel_deliveries d SET status='CANCELLED',last_error='CHANNEL_CONTEXT_EXPIRED',updated_at=now() FROM stale s WHERE d.id=s.id AND NOT public.work_channel_live(d);
 UPDATE public.phone_verifications SET status=CASE WHEN status IN('PREPARING','PENDING','CHECKING','UNCERTAIN') THEN 'FAILED' ELSE status END,phone_enc='',provider_verification_id=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE phone_verifications.id IN(SELECT v.id FROM public.phone_verifications v WHERE v.expires_at<=now() AND (v.phone_enc<>'' OR v.status IN('PREPARING','PENDING','CHECKING','UNCERTAIN')) ORDER BY v.expires_at LIMIT 100 FOR UPDATE SKIP LOCKED);
 FOR candidate IN SELECT d.* FROM public.channel_deliveries d WHERE d.status='PENDING' AND d.available_at<=now() ORDER BY d.available_at,d.created_at,d.id LIMIT 10 FOR UPDATE SKIP LOCKED LOOP
  IF candidate.attempts>=5 THEN UPDATE public.channel_deliveries SET status='FAILED',last_error='CHANNEL_ATTEMPTS_EXHAUSTED',updated_at=now() WHERE channel_deliveries.id=candidate.id;CONTINUE;END IF;
  IF NOT public.work_channel_live(candidate) THEN UPDATE public.channel_deliveries SET status='CANCELLED',last_error='CHANNEL_CONTEXT_EXPIRED',updated_at=now() WHERE channel_deliveries.id=candidate.id;CONTINUE;END IF;
  SELECT m.user_id INTO recipient FROM public.memberships m WHERE m.organization_id=candidate.organization_id AND m.id=candidate.membership_id;
  PERFORM pg_advisory_xact_lock(hashtext('channel-daily-budget'));
  IF (SELECT count(*) FROM public.channel_deliveries d JOIN public.memberships m ON m.organization_id=d.organization_id AND m.id=d.membership_id WHERE m.user_id=recipient AND d.id<>candidate.id AND d.attempts>0 AND coalesce(d.accepted_at,d.updated_at)>now()-interval '1 day')>=least(greatest(coalesce(user_limit,20),1),100) THEN UPDATE public.channel_deliveries SET status='FAILED',last_error='CHANNEL_DAILY_USER_LIMIT',updated_at=now() WHERE channel_deliveries.id=candidate.id;CONTINUE;END IF;
  IF (SELECT count(*) FROM public.channel_deliveries d WHERE d.id<>candidate.id AND d.attempts>0 AND coalesce(d.accepted_at,d.updated_at)>now()-interval '1 day')>=least(greatest(coalesce(global_limit,200),1),10000) THEN UPDATE public.channel_deliveries SET status='FAILED',last_error='CHANNEL_DAILY_GLOBAL_LIMIT',updated_at=now() WHERE channel_deliveries.id=candidate.id;CONTINUE;END IF;
  token:=gen_random_uuid();UPDATE public.channel_deliveries SET status='PROCESSING',attempts=attempts+1,lease_token=token,lease_expires_at=now()+interval '60 seconds',updated_at=now() WHERE channel_deliveries.id=candidate.id;
  RETURN QUERY SELECT candidate.id,candidate.organization_id,candidate.membership_id,recipient,candidate.contact_id,candidate.contact_revision,candidate.channel::text,token,p.phone_enc,p.credential_key_hash::text,o.locale::text,n.resource_type::text,n.resource_id FROM public.notification_phones p JOIN public.organizations o ON o.id=candidate.organization_id JOIN public.work_notifications n ON n.id=candidate.notification_id WHERE p.id=candidate.contact_id;RETURN;
 END LOOP;
END $$;REVOKE ALL ON FUNCTION work_claim_channel_delivery(integer,integer) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_claim_channel_delivery(integer,integer) TO work_app;
CREATE FUNCTION work_confirm_channel_delivery(target uuid,token uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$SELECT EXISTS(SELECT 1 FROM public.channel_deliveries d WHERE d.id=target AND d.status='PROCESSING' AND d.lease_token=token AND d.lease_expires_at>now() AND public.work_channel_live(d))$$;
REVOKE ALL ON FUNCTION work_confirm_channel_delivery(uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_confirm_channel_delivery(uuid,uuid) TO work_app;
CREATE FUNCTION work_finish_channel_delivery(target uuid,token uuid,outcome text,provider_reference text,reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off AS $$
DECLARE job public.channel_deliveries%ROWTYPE;phone_id uuid;BEGIN
 IF outcome IS NULL OR outcome NOT IN('ACCEPTED','FAILED','CANCELLED','UNCERTAIN','RETRY') OR outcome='ACCEPTED' AND (provider_reference IS NULL OR provider_reference!~'^(SM|MM)[a-fA-F0-9]{32}$') OR reason IS NOT NULL AND reason!~'^[A-Z][A-Z0-9_]{2,59}$' THEN RAISE EXCEPTION 'Invalid channel outcome' USING ERRCODE='22023';END IF;
 SELECT contact_id INTO phone_id FROM public.channel_deliveries WHERE id=target;PERFORM 1 FROM public.notification_phones WHERE notification_phones.id=phone_id FOR UPDATE;
 SELECT * INTO job FROM public.channel_deliveries WHERE id=target AND lease_token=token AND status='PROCESSING' FOR UPDATE;IF job.id IS NULL THEN RETURN false;END IF;
 UPDATE public.channel_deliveries SET status=CASE WHEN outcome='RETRY' AND attempts<5 AND expires_at>now() THEN 'PENDING' WHEN outcome='RETRY' THEN 'FAILED' ELSE outcome END,provider_id=provider_reference,accepted_at=CASE WHEN outcome='ACCEPTED' THEN now() ELSE NULL END,last_error=reason,available_at=CASE WHEN outcome='RETRY' THEN now()+make_interval(secs=>least(3600,60*power(2,attempts-1)::integer)) ELSE available_at END,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=target;RETURN true;
END $$;REVOKE ALL ON FUNCTION work_finish_channel_delivery(uuid,uuid,text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION work_finish_channel_delivery(uuid,uuid,text,text,text) TO work_app;
COMMIT;
