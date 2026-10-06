# Local development

## Prerequisites

| Tool                | Version             | Notes                                         |
| ------------------- | ------------------- | --------------------------------------------- |
| Node.js             | 24.x (see `.nvmrc`) | LTS line                                      |
| pnpm                | 10.18.x             | Pinned in `package.json` `packageManager`     |
| Git                 | 2.40+               |                                               |
| Docker with Compose | recent              | Only for the local PostgreSQL and Redis stack |

If Corepack can write to your Node installation, `corepack enable` provides the pinned pnpm.
Otherwise install it at user scope with `npm install -g pnpm@10.18.2`.

## 1. Clone

```bash
git clone <repository-url> 3d-det-v2
cd 3d-det-v2
```

## 2. Install

```bash
pnpm install
```

## 3. Environment

```bash
cp .env.example .env
```

Each application also has its own `.env.example`. The defaults work for local development.
Never commit a `.env` file; see [`docs/SECURITY.md`](../SECURITY.md).

Optional local services (PostgreSQL and Redis):

```bash
docker compose -f docker-compose.dev.yml up -d
```

The local PostgreSQL bootstrap user is a superuser and **bypasses Row-Level Security**. It is
fine for exploring data and unsuitable for testing tenant isolation. Production RLS policies
will be introduced with the approved database DDL.

## 4. Build the shared packages

```bash
pnpm build
```

Applications consume the shared packages' built output, so build once after installing and
after changing a package.

## 5. Run the API

```bash
pnpm --filter @3ddet/api start
curl http://localhost:3000/health     # {"status":"ok"}
```

## 6. Run the web application

```bash
pnpm --filter @3ddet/web dev          # http://localhost:5173
```

The development server proxies `/api` to `http://localhost:3000`. The page shows the API
status and a rotating test object that confirms the Three.js renderer initialised.

## 7. Run the worker

```bash
pnpm --filter @3ddet/worker start
```

The worker needs Redis. With no handlers registered it starts and reports that no queues have
work.

## 8. Run the checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm check:boundaries
pnpm build
```

These are the same checks CI runs.
