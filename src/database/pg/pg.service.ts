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
  /**
   * Run one stored query inside an explicit `READ ONLY` transaction with its own statement timeout.
   *
   * `queryReadOnly` above already forces `default_transaction_read_only=on` at session level, which
   * makes each statement its own implicit read-only transaction. This adds the two things a stored
   * report query needs and an implicit transaction cannot give it:
   *
   *   * `BEGIN ... READ ONLY` explicitly, so the read-only property is a property of THIS
   *     transaction rather than of a session setting that a future `SET` could move. The printing
   *     engine's §4 names "the query run in a READ ONLY transaction" as one of its three runtime
   *     boundaries, and this is the statement that makes that literally true rather than nearly so.
   *   * `SET LOCAL statement_timeout`, which is per-transaction and reverts on COMMIT. A template
   *     author sets `ptd_timeout_ms` per dataset, and a timeout applied to the pool would apply to
   *     every other caller sharing it.
   *
   * A dedicated client is checked out for the transaction and always released, including when the
   * statement is cancelled by the timeout — that path throws, and an unreleased client would leak a
   * pool slot per bad query until the counter queue stalled.
   */
  async queryReadOnlyTx<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] | undefined,
    timeoutMs: number,
  ): Promise<QueryResult<T>> {
    const client = await this.readOnlyPool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      // Bound as a literal because SET does not take parameters. The value is an
      // integer this service computed, never caller text.
      await client.query(`SET LOCAL statement_timeout = ${Math.trunc(timeoutMs)}`);
      const result = await client.query<T>(text, params as unknown[] | undefined);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      // Best-effort: the transaction may already be aborted, and a rollback that
      // throws must not replace the error that actually explains the failure.
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignored on purpose — see above
      }
      throw error;
    } finally {
      client.release();
    }
  }
  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pool.end(), this.readOnlyPool.end()]);
  }
}
