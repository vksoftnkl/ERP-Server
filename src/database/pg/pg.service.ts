import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class PgService implements OnModuleDestroy {
  private readonly logger = new Logger(PgService.name);
  private readonly pool: Pool;
  private readonly readOnlyPool: Pool;
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('database.url');
    this.pool = new Pool(connectionString ? { connectionString } : {});
    // Executor for user-configured SQL (grid/dropdown "run"). Prefer a dedicated
    // read-only DB role via DATABASE_READONLY_URL; in every case force sessions to
    // read-only so a statement that slips past validation still cannot write.
    const readOnlyConnectionString =
      configService.get<string>('database.readOnlyUrl') || connectionString;
    this.readOnlyPool = new Pool({
      ...(readOnlyConnectionString ? { connectionString: readOnlyConnectionString } : {}),
      options: '-c default_transaction_read_only=on',
    });
    if (!configService.get<string>('database.readOnlyUrl')) {
      this.logger.warn(
        'DATABASE_READONLY_URL is not set — configured grid/dropdown SQL runs under the primary DB role with session-level read-only enforcement only. Configure a dedicated read-only role for defense in depth.',
      );
    }
  }
  /**
   * Run a parameterized query against the shared connection pool. Values are always passed as bound
   * parameters ($N) — never string-concatenated into the SQL.
   */
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params as unknown[] | undefined);
  }
  /**
   * Run a parameterized query on the read-only pool. Use this for any SQL that originates from
   * user-configurable storage (grid_details.grid_sql, dropdown_details.dropdown_sql): the pool
   * connects with DATABASE_READONLY_URL when configured and forces
   * default_transaction_read_only=on, so write/DDL statements are rejected by PostgreSQL itself.
   */
  queryReadOnly<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<T>> {
    return this.readOnlyPool.query<T>(text, params as unknown[] | undefined);
  }
  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pool.end(), this.readOnlyPool.end()]);
  }
}
