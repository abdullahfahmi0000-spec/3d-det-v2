# Contributing

## Workflow

1. Open or pick up an issue. Architectural changes start with an _Architecture decision_ issue.
2. Branch from `main`: `feat/<short-description>`, `fix/<short-description>`,
   `chore/<short-description>` or `docs/<short-description>`.
3. Keep the branch focused: one change per pull request.
4. Run the checks locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`.
5. Open a pull request using the template. Fill in every impact section, writing "None"
   where nothing changes.
6. Merge after CI passes and a code owner approves. Pull requests are squash-merged.

`main` is protected. Nothing is pushed to it directly.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add organisation node endpoint
fix(three): dispose instanced geometry on unmount
chore(deps): update kysely
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

## Rules that reviews will hold you to

- **Tenant isolation is enforced by the database.** Tenant-scoped data is reached only through
  `withTenantTransaction`. Never add `BYPASSRLS`, never connect as a superuser from
  application code, and never treat an application filter as the security boundary.
- **The database owns the schema.** Schema changes are SQL migrations in `database/`. No
  TypeScript schema declarations.
- **`packages/domain` stays framework-free.**
- **No business logic in the viewer.** `packages/three` renders values it is given.
- **AI never writes authoritative state directly.** It proposes; a person approves.
- **Confirmed decisions are not reopened in a pull request.** Recommended ones may be
  challenged through an ADR.
- **No secrets, ever.** See [`docs/SECURITY.md`](docs/SECURITY.md).
