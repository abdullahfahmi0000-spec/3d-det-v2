# Queries

Query modules are organised by the domain module that owns them, mirroring
`apps/api/src/modules`. A query module receives a `Transaction<Database>` from
`withTenantTransaction` and never creates its own connection.

Recursive structures such as bill-of-material ancestry are expressed as SQL (recursive
CTEs or a maintained closure table). The choice between them is an open decision recorded
in `docs/adr/README.md` and is settled by measurement, not preference.
