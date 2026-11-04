CREATE FUNCTION work_next_recurrence(value timestamptz,kind text,zone text,anchor timestamptz) RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE local_value timestamp;local_anchor timestamp;month_start timestamp;last_day integer;BEGIN
 IF value IS NULL THEN RETURN NULL;END IF;
 IF kind IS NULL OR kind NOT IN ('DAILY','WEEKLY','MONTHLY') OR NOT isfinite(value) OR NOT isfinite(coalesce(anchor,value)) THEN RAISE EXCEPTION 'Invalid recurrence';END IF;
 local_value:=value AT TIME ZONE zone;local_anchor:=coalesce(anchor,value) AT TIME ZONE zone;
 IF kind='MONTHLY' THEN
  month_start:=date_trunc('month',local_value)+interval '1 month';last_day:=extract(day FROM month_start+interval '1 month - 1 day')::integer;
  RETURN (month_start+(least(extract(day FROM local_anchor)::integer,last_day)-1)*interval '1 day'+(local_value-date_trunc('day',local_value))) AT TIME ZONE zone;
 END IF;
 RETURN (local_value+CASE kind WHEN 'DAILY' THEN interval '1 day' ELSE interval '7 days' END) AT TIME ZONE zone;
END $$;
REVOKE ALL ON FUNCTION work_next_recurrence(timestamptz,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION work_next_recurrence(timestamptz,text,text,timestamptz) TO work_app;
