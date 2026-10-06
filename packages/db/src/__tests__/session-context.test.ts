import {
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryResult,
} from 'kysely';
import { describe, expect, it } from 'vitest';

import type { Database } from '../client/database';
import {
  SCENARIO_SETTING,
  TENANT_SETTING,
  applyTenantSessionContext,
} from '../rls/session-context';
import { withTenantTransaction } from '../transactions/with-tenant-transaction';

/**
 * A driver that records every compiled statement instead of sending it anywhere.
 *
 * It sits behind Kysely's real PostgreSQL compiler, so the assertions below check the exact
 * SQL and bound parameters PostgreSQL would receive, without needing a database.
 */
function createRecordingDb() {
  const statements: { sql: string; parameters: readonly unknown[] }[] = [];

  const connection: DatabaseConnection = {
    async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
      statements.push({ sql: compiled.sql, parameters: compiled.parameters });
      return { rows: [] };
    },
    // eslint-disable-next-line require-yield
    async *streamQuery() {
      throw new Error('streaming is not used in these tests');
    },
  };

  const driver: Driver = {
    init: async () => undefined,
    acquireConnection: async () => connection,
    beginTransaction: async () => {
      statements.push({ sql: 'begin', parameters: [] });
    },
    commitTransaction: async () => {
      statements.push({ sql: 'commit', parameters: [] });
    },
    rollbackTransaction: async () => {
      statements.push({ sql: 'rollback', parameters: [] });
    },
    releaseConnection: async () => undefined,
    destroy: async () => undefined,
  };

  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (instance) => new PostgresIntrospector(instance),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, statements };
}

describe('applyTenantSessionContext', () => {
  it('binds both settings as parameters, scoped to the transaction', async () => {
    const { db, statements } = createRecordingDb();

    await applyTenantSessionContext(db, { tenantId: 4711n, scenarioId: 0n });

    expect(statements).toHaveLength(2);
    const [tenant, scenario] = statements;

    expect(tenant?.sql).toBe('select set_config($1, $2, true)');
    expect(tenant?.parameters).toEqual([TENANT_SETTING, '4711']);
    expect(scenario?.sql).toBe('select set_config($1, $2, true)');
    expect(scenario?.parameters).toEqual([SCENARIO_SETTING, '0']);
  });

  it('never interpolates the setting name or its value into the statement text', async () => {
    const { db, statements } = createRecordingDb();

    await applyTenantSessionContext(db, { tenantId: 99n, scenarioId: 7n });

    for (const statement of statements) {
      expect(statement.sql).not.toContain('99');
      expect(statement.sql).not.toContain('app.tenant_id');
      expect(statement.sql).not.toContain('app.scenario_id');
    }
  });
});

describe('withTenantTransaction', () => {
  it('applies the tenant context inside the transaction, before the caller runs', async () => {
    const { db, statements } = createRecordingDb();

    await withTenantTransaction(db, { tenantId: 12n, scenarioId: 3n }, async () => {
      statements.push({ sql: 'caller-work', parameters: [] });
    });

    expect(statements.map((statement) => statement.sql)).toEqual([
      'begin',
      'select set_config($1, $2, true)',
      'select set_config($1, $2, true)',
      'caller-work',
      'commit',
    ]);
  });

  it('rolls back and propagates when the caller fails', async () => {
    const { db, statements } = createRecordingDb();

    await expect(
      withTenantTransaction(db, { tenantId: 12n, scenarioId: 0n }, async () => {
        throw new Error('caller failed');
      }),
    ).rejects.toThrow('caller failed');

    expect(statements.at(-1)?.sql).toBe('rollback');
  });
});
