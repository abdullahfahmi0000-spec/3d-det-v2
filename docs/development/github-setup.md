# GitHub repository settings

Settings that live in GitHub rather than in this repository. Keep this page in step with what
is configured.

The repository is `hafizhuzaifaahmed/3d-det-v2`, owned by the personal account
`@hafizhuzaifaahmed`. Team members join as individual collaborators.

## Code owners

Personal accounts have no teams, so `CODEOWNERS` names individual people. Every area is owned
by `@hafizhuzaifaahmed` until collaborators join.

When a collaborator joins:

1. Invite them under **Settings → Collaborators** with **Write** access. GitHub ignores a
   code owner who cannot write to the repository.
2. Add their handle to the `CODEOWNERS` lines for the areas they own, through a pull request.
3. Once at least one collaborator other than the owner can review, turn on **Require review
   from code owners** (below).

| Area         | Paths                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Frontend     | `apps/web/`, `packages/ui/`, `packages/contracts/` (shared with backend)                            |
| Backend      | `apps/api/`, `apps/worker/`, `packages/db/`, `packages/domain/`, `database/`, `packages/contracts/` |
| 3D           | `packages/three/`                                                                                   |
| AI           | `packages/ai/`                                                                                      |
| DevOps       | `infrastructure/`, `.github/workflows/`, `docker-compose.dev.yml`, `packages/config/`               |
| Architecture | `docs/architecture/`, `docs/adr/`, `docs/SECURITY.md`                                               |

## Branch protection for `main`

Configured as a classic branch protection rule.

| Rule                                                | Setting                               |
| --------------------------------------------------- | ------------------------------------- |
| Require a pull request before merging               | On, with 1 approval                   |
| Require review from code owners                     | Off until collaborators join, then on |
| Dismiss stale approvals when new commits are pushed | On                                    |
| Require status checks to pass                       | On: `verify` (workflow `CI`)          |
| Require branches to be up to date before merging    | On                                    |
| Require conversation resolution before merging      | On                                    |
| Allow force pushes                                  | Off                                   |
| Allow deletions                                     | Off                                   |
| Do not allow bypassing the above settings           | Off until collaborators join, then on |

GitHub does not let anyone approve their own pull request. Until a second collaborator can
review, the owner merges by using the administrator bypass. Turn on **Do not allow bypassing
the above settings** as soon as that is no longer necessary.

## Repository settings

| Setting                                        | Target                                          | Status          |
| ---------------------------------------------- | ----------------------------------------------- | --------------- |
| Visibility                                     | Private                                         | Applied         |
| Default branch                                 | `main`                                          | Applied         |
| Merge strategy                                 | Squash merge, pull request title as the message | Not yet applied |
| Automatically delete head branches after merge | On                                              | Not yet applied |
