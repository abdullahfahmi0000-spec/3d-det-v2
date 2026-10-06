# @3ddet/config

Shared build and tooling configuration for the monorepo.

| File                 | Used by                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `tsconfig.base.json` | Common compiler options. Not used directly.                                                     |
| `tsconfig.lib.json`  | Node-consumable packages (`contracts`, `domain`, `db`, `ai`) and `apps/worker`. Emits CommonJS. |
| `tsconfig.web.json`  | Browser packages (`three`, `ui`) and `apps/web`. Emits ESM with JSX.                            |
| `tsconfig.nest.json` | `apps/api`. Adds decorator metadata support.                                                    |
| `prettier.json`      | Formatting, re-exported from the repository root.                                               |

ESLint is configured once at the repository root in `eslint.config.mjs` using the flat
config format. Packages do not define their own ESLint configuration.
