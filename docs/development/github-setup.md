# GitHub repository settings

Settings that live in GitHub rather than in this repository. Keep this page in step with what
is configured.

The repository is `hafizhuzaifaahmed/3d-det-v2`, owned by the personal account
`@hafizhuzaifaahmed`. Team members join as individual collaborators.

## Code owners

Personal accounts have no teams, so `CODEOWNERS` names individual people, grouped by the three
delivery pods. Every area is owned by `@hafizhuzaifaahmed` until the pod members are
collaborators.

| Pod      | Lead                         | Members                          | Paths                                                                                                                  |
| -------- | ---------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CMS      | Muhammad Sharjeel            | Basit, Saad Ilyas                | `apps/web/`, `apps/api/`, `apps/worker/`, `packages/ui/`, `packages/db/`, `packages/domain/`, `database/`, `docs/api/` |
| 3D       | Abdullah AbdulKareem         | Salah ud din Sani, Huzaifa Ahmed | `packages/three/`                                                                                                      |
| AI       | Hafiz Huzaifa Ahmed          | Abdur Rafay, Faizan Ali          | `packages/ai/`                                                                                                         |
| Shared   | CMS lead + consuming pods    |                                  | `packages/contracts/`                                                                                                  |
| Platform | Repository owner + CMS lead  |                                  | `infrastructure/`, `.github/`, `docker-compose.dev.yml`, `packages/config/`, `scripts/`, `.gitleaks.toml`              |
| Docs     | Repository owner + pod leads |                                  | `docs/architecture/`, `docs/adr/`, `docs/SECURITY.md`, `docs/security/`                                                |

When a pod member joins:

1. Invite them under **Settings → Collaborators** with **Write** access. GitHub ignores a
   code owner who cannot write to the repository.
2. Add their handle to their pod's lines in `CODEOWNERS` (lead first), through a pull request.
3. Once at least one collaborator other than the owner can review, turn on **Require review
   from code owners** (below).

## Branch protection for `main`

Configured as a classic branch protection rule.

| Rule                                                | Setting                                                         |
| --------------------------------------------------- | --------------------------------------------------------------- |
| Require a pull request before merging               | On, with 1 approval                                             |
| Require review from code owners                     | Off until collaborators join, then on                           |
| Dismiss stale approvals when new commits are pushed | On                                                              |
| Require status checks to pass                       | On: `verify`, `secret-scan`, `dependency-audit` (workflow `CI`) |
| Require branches to be up to date before merging    | On                                                              |
| Require conversation resolution before merging      | On                                                              |
| Allow force pushes                                  | Off                                                             |
| Allow deletions                                     | Off                                                             |
| Do not allow bypassing the above settings           | Off until collaborators join, then on                           |

GitHub does not let anyone approve their own pull request. Until a second collaborator can
review, the owner merges by using the administrator bypass. Turn on **Do not allow bypassing
the above settings** as soon as that is no longer necessary.

## Repository settings

| Setting                                        | Target                                               | Status             |
| ---------------------------------------------- | ---------------------------------------------------- | ------------------ |
| Visibility                                     | Private                                              | Applied            |
| Default branch                                 | `main`                                               | Applied            |
| Merge strategy                                 | Squash merge only, pull request title as the message | Applied 2026-10-13 |
| Always suggest updating pull request branches  | On                                                   | Applied 2026-10-13 |
| Automatically delete head branches after merge | On                                                   | Applied 2026-10-13 |

## Code security settings

| Setting                           | Target                                                                                        | Status                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Dependency graph                  | On                                                                                            | Applied 2026-10-13                             |
| Dependabot alerts                 | On                                                                                            | Applied 2026-10-13                             |
| Malware alerts                    | On                                                                                            | Applied 2026-10-13                             |
| Dependabot security updates       | On                                                                                            | Applied 2026-10-13                             |
| Dependabot version updates        | `.github/dependabot.yml` (weekly, npm and GitHub Actions)                                     | In repository                                  |
| Secret scanning / push protection | Not available for private repositories on a personal account without GitHub Advanced Security | Covered by the `secret-scan` CI job (gitleaks) |

Each collaborator should also turn on **push protection for yourself** under their own GitHub
account settings (**Settings → Code security → Push protection for yourself**). It blocks
pushes containing supported secret types to any repository, before they reach CI.
