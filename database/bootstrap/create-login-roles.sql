-- Creates the login roles for ONE deployed environment. Run once, by the platform
-- administrator (Railway's `postgres` user, the RDS master user), before the first migration.
-- Never run by Flyway, because it carries passwords.
--
--   psql "<admin connection URL>" -v ON_ERROR_STOP=1 \
--        -v database=<database name> \
--        -v migrator_password="$DET_MIGRATOR_PASSWORD" \
--        -v app_password="$DET_APP_PASSWORD" \
--        -f database/bootstrap/create-login-roles.sql
--
-- Take the passwords from the secret store through environment variables, as above, so they
-- never appear in shell history. Store them back only in the secret store.

-- Group role the application's privileges are granted to (see ddl/V1.500__roles_and_grants.sql).
-- Roles belong to the whole server, so another database on it may have created this one already.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'det_application') THEN
    CREATE ROLE det_application NOLOGIN;
  END IF;
END
$$;

-- Runs Flyway and owns the schema. Owning the database makes it owner of its public schema.
-- The GRANT lets an administrator that is not a true superuser (the RDS master user) hand
-- the database over; it is harmless where the administrator is a superuser.
CREATE ROLE det_migrator LOGIN PASSWORD :'migrator_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT det_migrator TO CURRENT_USER;
ALTER DATABASE :"database" OWNER TO det_migrator;

-- What the API and worker connect as. Owns nothing and is subject to Row-Level Security.
CREATE ROLE det_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
  IN ROLE det_application;
