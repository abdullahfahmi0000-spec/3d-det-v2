# Infrastructure

Infrastructure as code for 3D.DET.

The target platform is AWS-oriented: containers on ECS/Fargate, managed PostgreSQL, Redis and
S3-compatible object storage. Whether managed PostgreSQL is RDS or Aurora is finalised during
infrastructure implementation. These are recommendations, not client-confirmed decisions.

## Deployable units

Three: `web` (static assets on a CDN), `api` and `worker`. Heavy, infrequent work such as 3D
asset conversion runs as short-lived tasks launched per job rather than as a standing
service. No further services are introduced without a concrete requirement and an ADR.

## Regional cells

A tenant's data lives in exactly one regional deployment. The Terraform layout is written as
a parameterised cell so that a further region is an additional instantiation, not a redesign.
Initially a single cell is deployed.

## Not present yet

No deployment pipeline exists. One is added when there is enough infrastructure defined to
make it safe: remote state, environment separation, and credentials issued through OIDC
federation rather than long-lived keys.
