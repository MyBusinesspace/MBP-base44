-- Base schema: counters + legacy backup table (data lives in per-entity tables)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- Legacy store (backup / migration source); new writes use dedicated tables
CREATE TABLE IF NOT EXISTS entity_records (
  id VARCHAR(36) PRIMARY KEY,
  entity_name VARCHAR(128) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  created_by_id VARCHAR(36)
);

CREATE INDEX IF NOT EXISTS idx_entity_records_name ON entity_records (entity_name);
