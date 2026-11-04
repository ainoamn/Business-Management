CREATE INDEX tasks_pending_review ON tasks(organization_id,reviewer_id,status,created_at);
CREATE INDEX tasks_pending_approval ON tasks(organization_id,approver_id,status,created_at);
CREATE INDEX meetings_pending_approval ON meetings(organization_id,approver_id,status,created_at);
CREATE INDEX expenses_pending_approval ON operational_expenses(organization_id,approver_id,status,created_at);
