# Generated database types

Files in this directory are **generated from the live database schema** and are excluded
from version control (see the repository `.gitignore`).

The database is the authoritative source of the schema. This package never declares a
schema of its own, because a second declaration becomes a second source of truth that
drifts (`docs/adr/ADR-001-postgresql-rls.md`).

Generation command and tool selection are finalised during database implementation, once
the approved DDL is in `database/ddl/`. Until then `src/client/database.ts` carries an
empty `Database` interface so the package compiles.
