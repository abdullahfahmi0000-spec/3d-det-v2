# Security policy

## Never commit secrets

No password, API key, token, private key, certificate, connection string with credentials,
or cloud credential is ever committed to this repository, including in history, test
fixtures, examples or documentation.

`.gitignore` excludes `.env`, `.env.*`, key and certificate files, cloud credential files and
Terraform state. Those exclusions are a safety net, not the policy.

If a secret is committed, treat it as compromised: **rotate it first**, then remove it from
history. Removing it from the latest commit does not remove it from history, forks or clones.

## Environment variables

Configuration is supplied through environment variables. Each application documents the
variables it reads in a committed `.env.example` file containing **placeholders only**.

Applications validate their configuration at start-up and fail fast when a required value is
missing. Secrets never have default values in code.

## Local development secrets

- Copy `.env.example` to `.env` and fill in local values. `.env` is ignored.
- Local databases and caches use disposable credentials that are never reused elsewhere.
- Do not copy credentials from a shared or deployed environment into a local `.env`.
- Do not paste secrets into issues, pull requests, chat, screenshots or logs.

## Production secret management

- Secrets for deployed environments live in the cloud provider's secret manager and are
  injected into the runtime at start-up. They are not baked into images.
- Each environment has its own secrets. Nothing is shared between environments.
- Secrets are rotated on a schedule and immediately on suspected exposure.
- Access to production secrets is limited to the roles that need it and is audited.

## AWS credentials

- No long-lived AWS access keys in this repository, in CI configuration, or on shared
  machines.
- CI authenticates to AWS through OIDC federation and assumes a narrowly scoped role with
  short-lived credentials.
- Developers use their own identity through SSO; credentials are never shared between people.

## GitHub secrets

- CI secrets are stored as GitHub Actions secrets, scoped to an environment where possible.
- Workflows request the minimum `permissions` they need.
- Production deployment, when it exists, uses a protected environment with required
  reviewers.
- Pull requests from forks do not receive secrets.

## Reporting a vulnerability

Report suspected vulnerabilities privately to the repository maintainers rather than in a
public issue. Include the affected component, steps to reproduce, and the potential impact.
