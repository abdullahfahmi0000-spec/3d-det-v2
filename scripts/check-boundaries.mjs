#!/usr/bin/env node
/**
 * Enforces the architectural import boundaries described in docs/architecture/overview.md.
 *
 * 1. packages/domain stays framework-independent: no NestJS, HTTP framework, database
 *    driver, React or Three.js.
 * 2. Only packages/db may import the database driver or query builder.
 * 3. Only packages/three and apps/web may import three.
 *
 * Run with: pnpm check:boundaries
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const RULES = [
  {
    name: 'packages/domain must not depend on a framework or on I/O',
    scope: 'packages/domain',
    forbidden: [/^@nestjs\//, /^express$/, /^kysely$/, /^pg$/, /^react(-dom)?$/, /^three(\/|$)/],
  },
  {
    name: 'only packages/db may import the database driver or query builder',
    scope: '.',
    exempt: ['packages/db/'],
    forbidden: [/^pg$/, /^kysely$/],
  },
  {
    name: 'only packages/three and apps/web may import three',
    scope: '.',
    exempt: ['packages/three/', 'apps/web/'],
    forbidden: [/^three(\/|$)/],
  },
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', '.git', 'coverage', 'generated']);
const IMPORT_RE = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|mts|cts)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const violations = [];

for (const rule of RULES) {
  for (const file of walk(join(repoRoot, rule.scope))) {
    const rel = relative(repoRoot, file).split(sep).join('/');
    if (rule.exempt?.some((prefix) => rel.startsWith(prefix))) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
      const spec = match[1];
      if (rule.forbidden.some((pattern) => pattern.test(spec))) {
        violations.push(`${rel}: imports '${spec}' (${rule.name})`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Architectural boundary violations:\n');
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(`\n${violations.length} violation(s).`);
  process.exit(1);
}

console.info('Architectural boundaries: OK');
