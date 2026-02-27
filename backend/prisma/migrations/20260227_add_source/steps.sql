-- Migration: add_source_to_lead_group (2026-02-27)
-- Safe ALTERs for Postgres (idempotent)

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS source VARCHAR(255) DEFAULT 'unknown';

ALTER TABLE "Group"
  ADD COLUMN IF NOT EXISTS source VARCHAR(255) DEFAULT 'unknown';

-- After running this migration, run `npx prisma generate` to refresh the client.
