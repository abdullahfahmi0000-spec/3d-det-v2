-- Destructive but explicitly approved: the reviewed squawk-ignore comment lets it through.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

-- Replaced by NODE_MASTER.PROVIDER_REF; unused since release 2026.11 (example).
-- squawk-ignore ban-drop-column
ALTER TABLE NODE_MASTER DROP COLUMN PROVIDER_NAME;
