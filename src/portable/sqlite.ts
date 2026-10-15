import Database from 'better-sqlite3';
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1ResultLike
} from '../cloudflare/d1Types.js';

export class PortableDatabase implements D1DatabaseLike {
  readonly sql: Database.Database;

  constructor(path: string, readonly = false) {
    this.sql = new Database(path, { readonly, fileMustExist: true, timeout: 0 });
    this.sql.pragma('foreign_keys = ON');
    this.sql.pragma('trusted_schema = OFF');
    this.sql.pragma('synchronous = FULL');
    if (!readonly) {
      this.sql.pragma('journal_mode = WAL');
      const pageSize = this.sql.pragma('page_size', { simple: true }) as number;
      this.sql.pragma(`max_page_count = ${Math.floor(2 * 1024 * 1024 * 1024 / pageSize)}`);
    }
    this.sql.pragma('cache_size = -8192');
    this.sql.pragma('mmap_size = 0');
  }

  prepare(sql: string): D1PreparedStatementLike {
    return new PortableStatement(this.sql, sql, []);
  }

  async exec(sql: string): Promise<unknown> {
    this.sql.exec(sql);
    return {};
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<D1ResultLike[]> {
    const run = this.sql.transaction(() =>
      statements.map((statement) => {
        if (!(statement instanceof PortableStatement) || statement.connection !== this.sql) {
          throw new Error('D1_COMPAT_STATEMENT_REQUIRED');
        }
        return statement.runSync();
      })
    );
    return run();
  }

  close(): void {
    this.sql.close();
  }
}

class PortableStatement implements D1PreparedStatementLike {
  constructor(
    readonly connection: Database.Database,
    private readonly sql: string,
    private readonly values: unknown[]
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new PortableStatement(this.connection, this.sql, values);
  }

  async run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    return this.runSync() as D1ResultLike<T>;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.connection.prepare(this.sql).get(...asSqliteValues(this.values)) as T | undefined;
    return row ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    const rows = this.connection.prepare(this.sql).all(...asSqliteValues(this.values)) as T[];
    return { success: true, results: rows, meta: { changes: 0 } };
  }

  runSync(): D1ResultLike {
    const info = this.connection.prepare(this.sql).run(...asSqliteValues(this.values));
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
