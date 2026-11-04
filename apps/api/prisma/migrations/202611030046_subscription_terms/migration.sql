BEGIN;
ALTER TABLE platform_plans
 ADD COLUMN code varchar(80),
 ADD COLUMN annual_price numeric(12,3),
 ADD COLUMN max_projects integer,
 ADD COLUMN features text[] NOT NULL DEFAULT ARRAY['TASKS','PROJECTS','CALENDAR','DOCUMENTS','NOTIFICATIONS','AI_BASIC','AUTOMATION','TEAMS','TIME','BUDGETS','ADVANCED_REPORTS','AI_ADVANCED','ADVANCED_PERMISSIONS','PORTFOLIOS','API','INTEGRATIONS','SSO','PRIVATE_HOSTING'],
 ADD COLUMN trial_days integer NOT NULL DEFAULT 0,
 ADD COLUMN grace_days integer NOT NULL DEFAULT 7,
 ADD COLUMN custom_pricing boolean NOT NULL DEFAULT false,
 ADD COLUMN public boolean NOT NULL DEFAULT false,
 ADD COLUMN version integer NOT NULL DEFAULT 1;
UPDATE platform_plans SET code=gen_random_uuid()::text;
ALTER TABLE platform_plans ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX platform_plans_code_key ON platform_plans(code);
ALTER TABLE platform_plans ADD CONSTRAINT platform_plan_terms CHECK(
 code ~ '^[a-z0-9][a-z0-9-]{1,79}$'
 AND (annual_price IS NULL OR annual_price>=0)
 AND (max_projects IS NULL OR max_projects BETWEEN 0 AND 1000000)
 AND trial_days BETWEEN 0 AND 90 AND grace_days BETWEEN 0 AND 30 AND version>0
 AND features <@ ARRAY['TASKS','PROJECTS','CALENDAR','DOCUMENTS','NOTIFICATIONS','AI_BASIC','AUTOMATION','TEAMS','TIME','BUDGETS','ADVANCED_REPORTS','AI_ADVANCED','ADVANCED_PERMISSIONS','PORTFOLIOS','API','INTEGRATIONS','SSO','PRIVATE_HOSTING']::text[]
);
ALTER TABLE platform_subscriptions
 ADD COLUMN cycle varchar(10) NOT NULL DEFAULT 'MONTHLY',
 ADD COLUMN managed boolean NOT NULL DEFAULT false,
 ADD COLUMN period_start timestamptz(3) NOT NULL DEFAULT now(),
 ADD COLUMN anchor_day integer NOT NULL DEFAULT 1,
 ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false,
 ADD COLUMN automatic_invoices boolean NOT NULL DEFAULT false,
 ADD COLUMN cancellation_reason varchar(500) NOT NULL DEFAULT '',
 ADD COLUMN canceled_at timestamptz(3),
 ADD COLUMN grace_ends_at timestamptz(3),
 ADD COLUMN version integer NOT NULL DEFAULT 1;
UPDATE platform_subscriptions SET period_start=created_at,anchor_day=extract(day FROM created_at AT TIME ZONE 'UTC')::integer;
ALTER TABLE platform_subscriptions ADD CONSTRAINT subscription_terms CHECK(cycle IN ('MONTHLY','ANNUAL') AND anchor_day BETWEEN 1 AND 31 AND version>0 AND period_start<ends_at AND (grace_ends_at IS NULL OR grace_ends_at>=ends_at));
COMMIT;
