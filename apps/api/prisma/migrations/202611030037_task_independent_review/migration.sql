-- Enforce the same separation of duties for every writer, including background jobs.
ALTER TABLE tasks ADD CONSTRAINT tasks_independent_review CHECK (
 assigned_to_id IS NULL OR
 (reviewer_id IS DISTINCT FROM assigned_to_id AND approver_id IS DISTINCT FROM assigned_to_id)
);
