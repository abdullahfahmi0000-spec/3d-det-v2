-- Fails, so psql exits non-zero, unless the schema holds exactly the expected objects.
-- Run after `flyway migrate` by CI (job `schema`) and locally by `pnpm db:check:local`.
--
-- The numbers are those of client DDL V62. A migration that adds or removes tables, foreign
-- keys, indexes or policies updates them in the same pull request, so every change to the
-- shape of the schema is visible in review.

DO $$
DECLARE
  expected CONSTANT jsonb := jsonb_build_object(
    'tables', 108,
    'foreign_keys', 369,
    'indexes', 195,
    'rls_enabled_tables', 106,
    'policies', 106
  );
  actual jsonb;
BEGIN
  SELECT jsonb_build_object(
    'tables', (SELECT count(*) FROM pg_tables
                WHERE schemaname = 'public' AND tablename <> '_migrations'),
    'foreign_keys', (SELECT count(*) FROM pg_constraint
                      WHERE contype = 'f' AND connamespace = 'public'::regnamespace),
    -- Indexes created explicitly, not those PostgreSQL creates for primary keys and
    -- unique constraints, and not Flyway's own.
    'indexes', (SELECT count(*) FROM pg_index i
                  JOIN pg_class t ON t.oid = i.indrelid
                 WHERE t.relnamespace = 'public'::regnamespace
                   AND t.relname <> '_migrations'
                   AND NOT EXISTS (SELECT FROM pg_constraint c
                                    WHERE c.conindid = i.indexrelid AND c.contype IN ('p', 'u', 'x'))),
    'rls_enabled_tables', (SELECT count(*) FROM pg_class
                            WHERE relnamespace = 'public'::regnamespace
                              AND relkind = 'r' AND relrowsecurity),
    'policies', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')
  ) INTO actual;

  IF actual <> expected THEN
    RAISE EXCEPTION 'Schema does not match. Expected %, found %', expected, actual;
  END IF;
  RAISE NOTICE 'Schema matches: %', actual;
END
$$;
