import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomTypesConfig, Pool, QueryResult, QueryResultRow, types as pgTypes } from 'pg';

/**
 * Hand `date` columns back exactly as PostgreSQL wrote them — `'2026-08-15'`.
 *
 * node-pg's default parser turns a `date` into a JS Date at LOCAL midnight, and every one of these
 * rows is then JSON-serialized for an API response, which stamps it as UTC: on an IST server
 * `sq_quote_date = 2026-08-15` leaves as `2026-08-14T18:30:00.000Z` and every client reading the
 * first ten characters shows the day before. A calendar date names no instant, so there is nothing
 * for a timezone to do to it — the text form is the whole value.
 *
 * Scoped to the pools below rather than set globally (`pgTypes.setTypeParser`) so it stays visible
 * to whoever reads this service. `timestamptz` is untouched: that one IS an instant, and its
 * round-trip through UTC is correct.
 */
type PgValueParser = (value: string) => unknown;
const DATE_AS_TEXT: CustomTypesConfig = {
  getTypeParser: (oid, format): PgValueParser =>
    oid === pgTypes.builtins.DATE
      ? (value: string) => value
      : (pgTypes.getTypeParser(oid, format) as PgValueParser),
};

@Injectable()
export class PgService implements OnModuleDestroy {
  private readonly logger = new Logger(PgService.name);
  private readonly pool: Pool;
  private readonly readOnlyPool: Pool;
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('database.url');
    this.pool = new Pool({
      ...(connectionString ? { connectionString } : {}),
      types: DATE_AS_TEXT,
    });
    // Executor for user-configured SQL (grid/dropdown "run"). Prefer a dedicated
    // read-only DB role via DATABASE_READONLY_URL; in every case force sessions to
    // read-only so a statement that slips past validation still cannot write.
    const readOnlyConnectionString =
      configService.get<string>('database.readOnlyUrl') || connectionString;
    this.readOnlyPool = new Pool({
      ...(readOnlyConnectionString ? { connectionString: readOnlyConnectionString } : {}),
      options: '-c default_transaction_read_only=on',
      types: DATE_AS_TEXT,
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
