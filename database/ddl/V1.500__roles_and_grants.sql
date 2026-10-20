-- 3D.DET baseline: the application's database privileges (Flyway version 1).
--
-- Three roles keep ownership, migration and query serving apart (ADR-001, ADR-006):
--
--   the migration role  LOGIN. Runs Flyway and therefore owns every table it creates.
--   det_application     NOLOGIN group. Read and write on the tables, nothing else. Created here.
--   det_app             LOGIN, member of det_application. What the API and worker connect as.
--                       Not an owner and never BYPASSRLS, so Row-Level Security applies to it.
--
-- Login roles carry passwords, so they are created per environment by
-- database/bootstrap/create-login-roles.sql, never by a migration.

-- Roles belong to the whole server, not to one database, so this must succeed when another
-- database on the same server has already created it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'det_application') THEN
    CREATE ROLE det_application NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO det_application;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO det_application;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO det_application;

-- The migration history is not application data.
REVOKE ALL ON _migrations FROM det_application;

-- Tables and sequences created by later migrations get the same privileges automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO det_application;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO det_application;
