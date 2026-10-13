# Contributing

## Workflow

Work is planned in Jira (space **DET**). Every change starts from a Jira **task** (a sub-task of a
story) in the current sprint; architectural changes start from a decision task (`DEC-…`) or an
ADR.

1. Move the Jira task to **In Progress** and assign it to yourself if it is not already.
2. Branch from an up-to-date `main`, with the task's Jira key in the name:
   `feat/DET-123-short-description`, `fix/DET-123-…`, `chore/DET-123-…` or `docs/DET-123-…`.
3. **One Jira task per pull request.** Tasks are sized at no more than one working day, so a pull
   request should be reviewable in under 30 minutes. Split it if not. See
   [Tasks, stories and pull requests](#tasks-stories-and-pull-requests).
4. Run the checks locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`.
5. Open a pull request using the template. The title is a Conventional Commit message ending
   with the Jira key, because the squash merge uses it as the commit on `main`:
   `feat(api): add organisation node endpoint (DET-123)`. Fill in every impact section, writing
   "None" where nothing changes.
6. Request review from the code owners GitHub suggests. Merge once all required checks pass and
   the reviews below are in. Pull requests are squash-merged and the branch is deleted.
7. Move the Jira task to **Done** after the merge, with a link to the pull request.

`main` is protected. Nothing is pushed to it directly, and history on `main` is never rewritten.

## Tasks, stories and pull requests

| Jira item                  | Pull request?                                                                  | Done when                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Task** (sub-task, ≤ 8 h) | Yes: one pull request per task, raised by the person assigned to it            | Its pull request is merged into `main`                                                                                         |
| **Task that is not code**  | No (decision briefs, reviews, meetings, UAT sessions, content written in Jira) | The outcome is recorded on the task (comment, document or link)                                                                |
| **Story**                  | No pull request of its own                                                     | Every task is Done **and** the story owner has checked each acceptance criterion on `main`, with evidence in a closing comment |

- **Coupled tasks.** Two tasks by the same person that cannot be merged separately may share one
  pull request if together they stay within about a day of work. Put both keys in the title:
  `feat(ai): snapshot reader with pattern tests (DET-708, DET-1387)`.
- **Several people on one story.** Each person raises pull requests for their own tasks; nobody
  waits for a story-sized branch.
- **Partly built stories on `main`.** Merged tasks of an unfinished story must not break or expose
  half a feature: keep it out of navigation or behind a configuration switch until the story is
  done, so `main` is always demo-ready.
- **Linking.** Jira picks up the `DET-…` key from the branch name, commit messages and pull
  request title (GitHub for Jira), so the task shows its branch, pull request and CI status.

## Dependency update pull requests

Dependabot opens grouped pull requests: at most two npm groups a week (minor/patch and major) and
one GitHub Actions group a month, plus security fixes whenever an advisory is published. The
repository owner and the CMS lead review them on Monday: merge when the three checks pass; for a
major group, read the release notes and check the build output before approving.

## Required checks

Every pull request must pass these CI jobs before it can merge:

| Check              | What it does                                                      |
| ------------------ | ----------------------------------------------------------------- |
| `verify`           | Boundaries, lint, type check, tests and build across the monorepo |
| `secret-scan`      | gitleaks over the full git history; any finding fails the build   |
| `dependency-audit` | `pnpm audit`; any high or critical advisory fails the build       |

A failing `secret-scan` means a secret was committed: rotate it first, then follow
[`docs/SECURITY.md`](docs/SECURITY.md). A failing `dependency-audit` is handled as described in
[`docs/security/dependency-audit.md`](docs/security/dependency-audit.md).

## Review rules

- **Who approves.** At least one approval from a code owner of every area the pull request
  touches. The code owners are the pod leads: CMS `@mxsharjeel` (`apps/`, `packages/db`,
  `packages/domain`, `packages/ui`, `database/`), 3D `@abdullahfahmi0000-spec`
  (`packages/three`), AI `@hafizhuzaifaahmed` (`packages/ai`). Pod members review each other's
  work too, but their approval does not replace the lead's. See
  [`.github/CODEOWNERS`](.github/CODEOWNERS).
- **Shared contracts need both sides.** A change to `packages/contracts` needs approval from the
  CMS pod and from every pod that consumes the changed contract.
- **Juniors' work is reviewed by a senior.** When someone works outside their own pod for a sprint,
  the senior of the pod that owns the code reviews it.
- **Turnaround.** Reviewers respond within one working day. The author resolves every
  conversation before merging; unresolved conversations block the merge.
- **New commits dismiss earlier approvals.** Re-request review after pushing changes.
- **What reviewers check:** the rules below, tests for the behaviour changed, the impact sections
  of the template, and that the change matches its Jira task and nothing more.
- **Security-sensitive changes** (authentication, permissions, RLS policies, secrets handling,
  CI configuration) also need the repository owner's approval.

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
