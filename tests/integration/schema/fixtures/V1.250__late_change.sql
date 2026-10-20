-- A migration whose version (1.250) is older than one already applied (1.500). Flyway must refuse
-- to slip it in out of order.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

ALTER TABLE TENANT ADD COLUMN LATE_NOTE TEXT;
