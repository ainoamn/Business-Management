ALTER TABLE meetings ADD COLUMN minutes_author_id uuid;
ALTER TABLE meetings ADD CONSTRAINT meeting_minutes_author FOREIGN KEY(organization_id,minutes_author_id) REFERENCES memberships(organization_id,id);
