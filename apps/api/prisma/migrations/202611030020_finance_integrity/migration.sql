DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['budget_events','expense_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_boundary ON %I TO work_app USING (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member()) WITH CHECK (organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::uuid AND public.work_is_member())',tab);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO work_app',tab);
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(organization_id,actor_id) REFERENCES memberships(organization_id,id)',tab,tab||'_actor');
 END LOOP;
END $$;
ALTER TABLE operational_expenses DROP CONSTRAINT expense_status;
ALTER TABLE operational_expenses ADD CONSTRAINT expense_status CHECK(status IN ('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED','REVERSED'));
ALTER TABLE operational_expenses ADD CONSTRAINT expense_conversion_exact CHECK(base_amount=round(amount*exchange_rate,3)),ADD CONSTRAINT expense_identity_rate CHECK(currency<>base_currency OR exchange_rate=1);
