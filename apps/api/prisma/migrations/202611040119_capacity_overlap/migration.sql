BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE membership_capacities ADD CONSTRAINT capacity_no_overlap EXCLUDE USING gist (organization_id WITH =,membership_id WITH =,daterange(starts_on,ends_on,'[]') WITH &&) WHERE(archived_at IS NULL);
COMMIT;
