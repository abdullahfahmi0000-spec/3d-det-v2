# Dependency audit log and exceptions

The `dependency-audit` CI job runs `pnpm audit --audit-level high` on every pull request, on
every push to `main` and every Monday. It fails on **high** and **critical** advisories in any
dependency, development tools included, because a compromised build tool is a supply-chain risk
to every environment.

Dependabot proposes version updates weekly and security updates as soon as an advisory is
published.

## When the audit fails

1. Upgrade the affected package (or the parent that pulls it in) to a fixed version. This is the
   default and needs no record here.
2. If no fixed version exists, or the vulnerable code path is provably unreachable, record an
   exception below **before** merging. An exception needs the pod lead's approval in the pull
   request, an owner, and a review date no more than 30 days out.
3. Never silence the check by lowering the threshold or removing the job.

Moderate and low advisories do not fail the build. They are triaged at the next sprint review and
fixed through the normal Dependabot pull requests.

## Accepted exceptions

| Advisory | Package (path) | Severity | Why it is accepted | Mitigation | Owner | Review by |
| -------- | -------------- | -------- | ------------------ | ---------- | ----- | --------- |
| —        | —              | —        | No exceptions      | —          | —     | —         |

## Audit history

| Date       | Scope                                           | Result                                | Action                                |
| ---------- | ----------------------------------------------- | ------------------------------------- | ------------------------------------- |
| 2026-10-13 | 335 dependencies (`pnpm audit`, all severities) | 0 critical, 0 high, 0 moderate, 0 low | None required; no exceptions recorded |
