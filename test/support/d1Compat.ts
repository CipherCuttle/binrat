import Database from 'better-sqlite3';
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1ResultLike
} from '../../src/cloudflare/d1Types.js';

export class D1CompatDatabase implements D1DatabaseLike {
  private readonly db: Database.Database;

  constructor(path = ':memory:') {
    this.db = new Database(path);
    this.db.pragma('foreign_keys = ON');
  }

  prepare(sql: string): D1PreparedStatementLike {
    return new D1CompatPreparedStatement(this.db, sql, []);
  }

  async exec(sql: string): Promise<unknown> {
    this.db.exec(sql);
    return {};
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<D1ResultLike[]> {
    const run = this.db.transaction(() =>
      statements.map((statement) => {
        if (!(statement instanceof D1CompatPreparedStatement)) {
          throw new Error('D1_COMPAT_STATEMENT_REQUIRED');
        }
        return statement.runSync();
      })
    );
    return run();
  }

  close(): void {
    this.db.close();
  }
}

class D1CompatPreparedStatement implements D1PreparedStatementLike {
  constructor(
    private readonly db: Database.Database,
    private readonly sql: string,
    private readonly values: unknown[]
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new D1CompatPreparedStatement(this.db, this.sql, values);
  }

  async run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    return this.runSync() as D1ResultLike<T>;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...asSqliteValues(this.values)) as T | undefined;
    return row ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    const rows = this.db.prepare(this.sql).all(...asSqliteValues(this.values)) as T[];
    return { success: true, results: rows, meta: { changes: 0 } };
  }

  runSync(): D1ResultLike {
    const info = this.db.prepare(this.sql).run(...asSqliteValues(this.values));
    return { success: true, results: [], meta: { changes: Number(info.changes) } };
  }
}

function asSqliteValues(values: unknown[]): Array<string | number | bigint | Buffer | null> {
  return values.map((value) => {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint' ||
      Buffer.isBuffer(value)
    ) return value;
    throw new Error(`D1_COMPAT_UNSUPPORTED_BIND:${typeof value}`);
  });
}
