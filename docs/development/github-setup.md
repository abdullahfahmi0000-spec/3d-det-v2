# GitHub repository settings

Settings that live in GitHub rather than in this repository. Apply them once when the
repository is created, and keep this page in step with what is configured.

## Teams referenced by CODEOWNERS

`CODEOWNERS` assigns review ownership to these teams. They must exist in the GitHub
organisation, with at least write access to the repository, before ownership takes effect.

| Team        | Owns                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `frontend`  | `apps/web`, `packages/ui`, shared ownership of `packages/contracts`                                                |
| `backend`   | `apps/api`, `apps/worker`, `packages/db`, `packages/domain`, `database/`, shared ownership of `packages/contracts` |
| `three-d`   | `packages/three`                                                                                                   |
| `ai`        | `packages/ai`                                                                                                      |
| `devops`    | `infrastructure/`, `.github/workflows/`, `docker-compose.dev.yml`                                                  |
| `architect` | `docs/architecture/`, `docs/adr/`                                                                                  |

## Branch protection for `main`

| Rule                                                | Setting                       |
| --------------------------------------------------- | ----------------------------- |
| Require a pull request before merging               | On, with 1 approval           |
| Require review from code owners                     | On once the teams above exist |
| Dismiss stale approvals when new commits are pushed | On                            |
| Require status checks to pass                       | On: `CI / verify`             |
| Require branches to be up to date before merging    | On                            |
| Require conversation resolution before merging      | On                            |
| Allow force pushes                                  | Off                           |
| Allow deletions                                     | Off                           |
| Include administrators                              | Off during bootstrap, then on |

Administrators are exempt only while the repository is being bootstrapped, so that settings
can be corrected without a pull request. Turn it on once the team starts working.

## Repository settings

- Visibility: **private**.
- Default branch: `main`.
- Merge strategy: squash merge, with the pull request title as the commit message.
- Automatically delete head branches after merge.
