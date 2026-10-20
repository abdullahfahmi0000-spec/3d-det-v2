# Database

PostgreSQL is the system of record and Row-Level Security is the tenant isolation mechanism
(`docs/adr/ADR-001-postgresql-rls.md`). Flyway applies the schema and Squawk blocks destructive
changes (`docs/adr/ADR-006-schema-migrations.md`). The client-approved DDL is the authoritative
schema: `packages/db` generates its types from the database, and no ORM declares a schema.

## Layout

| Path              | Contents                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| `source/`         | The client DDL V62, verbatim. Reference only; Flyway never runs it.           |
| `ddl/`            | The baseline, Flyway version 1 (see below).                                   |
| `policies/`       | Row-Level Security policies.                                                  |
| `migrations/`     | Every change after the baseline: `V2__…sql`, `V3__…sql`, forward-only.        |
| `functions/`      | Database functions, including narrowly scoped, audited privileged operations. |
| `seeds/`          | Demo data only: never production data or personal data. Not run by Flyway.    |
| `bootstrap/`      | Login roles for one deployed environment. Run once by the administrator.      |
| `flyway.toml`     | Flyway settings for every environment. Credentials come from the environment. |
| `../.squawk.toml` | The destructive-change rules applied to `migrations/`.                        |

## The baseline (version 1)

Client DDL V62 ("01.5 DDL PostgreSQL V62 31.08.2026 EN"): 108 tables, 369 foreign keys, 195
indexes, 106 Row-Level Security policies.

| File                                      | Contents                                                           |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `ddl/V1.010__…sql` to `ddl/V1.140__…sql`  | The tables, one file per family of the client's 01.4 DB MODEL.     |
| `ddl/V1.200__foreign_keys.sql`            | All foreign keys.                                                  |
| `ddl/V1.300__indexes.sql`                 | All indexes.                                                       |
| `policies/V1.400__row_level_security.sql` | RLS on every organizational table (not the two global catalogues). |
| `ddl/V1.500__roles_and_grants.sql`        | The `det_application` role and its privileges.                     |

The client DDL lists tables in numbering order, and 28 of its foreign keys point at tables
defined further down, so it cannot run as written; the creation order in 01.1 A6.1 predates V62.
The baseline therefore creates every table first and adds the foreign keys afterwards, as
`pg_dump` does. Columns, checks, constraint names and indexes are the client's, unchanged.

Once applied to a shared environment the baseline never changes (Flyway checksums every file).
A new client DDL version becomes a forward migration of the difference, and `source/` is updated.

## Rules

- **Forward-only.** An applied migration is never edited, renamed or removed; Flyway refuses
  to run if one is. A mistake is corrected by a new migration.
- **Additive by default.** CI lints `migrations/` with Squawk and fails on destructive
  statements. Exceptions are explicit and reviewed (see below).
- **No resets.** `flyway clean` is disabled in every environment.
- **A separate, approved step.** Migrations never run at application start-up.
- **Three roles.** `det_migrator` runs Flyway and owns the tables. The API and worker connect as
  `det_app` (member of `det_application`), which owns nothing and cannot bypass Row-Level
  Security. Cross-tenant operations are narrow, audited database functions, never a wider role.

## Writing a migration

Name it `V<next version>__<what_it_does>.sql` (run `flyway info` for the latest version), one
logical change per file, and start it with time limits so it gives up rather than blocking the
application:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '5min';

ALTER TABLE NODE_MASTER ADD COLUMN COST_CENTER_CODE VARCHAR(50);
```

- A **new table** comes with its foreign keys, indexes, `ENABLE ROW LEVEL SECURITY` and its
  `tenant_scenario_isolation` policy in the same migration. Privileges are granted automatically.
- If the migration changes the number of tables, foreign keys, indexes or policies, update the
  expected numbers in `tests/integration/schema/schema-baseline.sql`.
- Database functions are repeatable migrations, `R__<name>.sql` with `CREATE OR REPLACE`, in
  `functions/`. Add `filesystem:functions` to `locations` in `flyway.toml` with the first one.

Check it locally before pushing:

```bash
pipx run --spec squawk-cli==2.68.0 squawk database/migrations/*.sql
docker compose -f docker-compose.dev.yml run --rm flyway migrate
```

## Destructive changes

Squawk fails CI on dropping a table, column, schema, index, constraint, policy or other object;
changing a column's type; renaming; dropping `NOT NULL`; disabling RLS; `TRUNCATE … CASCADE`; and
revoking privileges. Widening a `CHECK (… IN (…))` list counts too, because the constraint is
dropped and re-added. When such a change is genuinely needed:

1. Put a `squawk-ignore` comment naming the rule above the statement, with the reason:

   ```sql
   -- Replaced by NODE_MASTER.PROVIDER_REF in V7; unused since release 2026.11 (DET-1234).
   -- squawk-ignore ban-drop-column
   ALTER TABLE NODE_MASTER DROP COLUMN PROVIDER_NAME;
   ```

2. State the affected data and the **rollback plan** in the pull request (normally a backup or
   point-in-time restore point taken before deployment).
3. The `database/` code owners approve. The comment stays in the file as the record.

Data changes (`DELETE`, `UPDATE`, plain `TRUNCATE`) are not inspected by Squawk; review catches them.

## Local development

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml run --rm flyway migrate
docker compose -f docker-compose.dev.yml exec -T postgres psql -v ON_ERROR_STOP=1 -f /checks/schema-baseline.sql
```

The last command checks the object counts. `docker compose -f docker-compose.dev.yml down -v`
discards the local database so it can be rebuilt from scratch.

Browse it with pgAdmin 4 or DBeaver: `localhost:5432`, database and user `threeddet_dev`, password
from `.env.example`. If pgAdmin fails with "access violation writing 0x0000000000000000", set
**Parameters → GSS encryption mode** to `disable` (a bug in pgAdmin's Windows build). The local
user is a superuser, so it bypasses Row-Level Security; isolation tests connect as `det_app`.

## Tests

```bash
bash tests/integration/schema/run-tests.sh
```

Needs only Docker and bash (Git Bash on Windows); CI runs the same script in job `schema`. It
starts a throwaway PostgreSQL and checks that two empty databases build identically with the
expected counts, that a second run changes nothing, that migrations apply in version order and
an out-of-order or edited one is refused, and that the guard refuses a destructive migration
(`tests/integration/schema/fixtures/`).

## Deployed environments

1. **Once per environment**, the administrator runs `bootstrap/create-login-roles.sql` as the
   database's admin user, with two new passwords saved in the secret store (Railway: Shared
   Variables `DET_MIGRATOR_PASSWORD`, `DET_APP_PASSWORD`).
2. **Once per environment**, a repository admin creates a GitHub Environment of the same name
   (Settings → Environments) with variables `DB_HOST`, `DB_PORT`, `DB_NAME` (Railway: the public
   TCP proxy host and port, database `railway`), secret `DET_MIGRATOR_PASSWORD`, and required
   reviewers for every shared environment.
3. **Every deployment** runs the **Migrate database** workflow (Actions → Migrate database → Run
   workflow, from `main`, choosing the environment). It refuses destructive migrations before
   connecting, waits for approval, runs Flyway as `det_migrator` and checks the schema. Railway's
   public access must be on while it runs.
4. The API and worker connect as `det_app`.
