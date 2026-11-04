-- Fail / File: worker/migrations/0001_usage.sql
-- Pembangun / Developer: Zrain
-- Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
-- Dikemas kini / Last updated: 2026-11-04
-- BM: Mewujudkan jadual kuota D1; migrasi terdahulu mesti kekal untuk deploy sedia ada.
-- EN: Create D1 quota tables; historic migrations must remain for existing deployments.
-- No chat messages or raw IP addresses are stored.
CREATE TABLE IF NOT EXISTS usage_counters (
  day TEXT NOT NULL,
  scope TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (day, scope)
);
CREATE INDEX IF NOT EXISTS usage_counters_day_idx ON usage_counters (day);
