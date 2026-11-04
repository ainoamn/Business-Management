CREATE INDEX project_decisions_search_title ON project_decisions USING gin (title gin_trgm_ops);
CREATE INDEX meeting_decisions_search_title ON meeting_decisions USING gin (title gin_trgm_ops);
