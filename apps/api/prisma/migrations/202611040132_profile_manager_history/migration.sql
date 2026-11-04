DO $patch$ DECLARE definition text;needle text;BEGIN
 definition:=pg_get_functiondef('public.member_profile_integrity()'::regprocedure);
 needle:='IF NEW.manager_id IS NOT NULL AND NOT EXISTS';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Expected manager active clause missing';END IF;
 EXECUTE replace(definition,needle,'IF NEW.manager_id IS NOT NULL AND (TG_OP=''INSERT'' OR NEW.manager_id IS DISTINCT FROM OLD.manager_id) AND NOT EXISTS');
END $patch$;
