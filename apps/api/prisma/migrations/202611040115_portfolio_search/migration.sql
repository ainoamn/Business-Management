CREATE INDEX project_portfolios_name_trgm ON project_portfolios USING gin(name gin_trgm_ops);
