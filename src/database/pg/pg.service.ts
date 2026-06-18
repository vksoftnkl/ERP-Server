import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class PgService implements OnModuleDestroy {
  private readonly pool: Pool;
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('database.url');
    this.pool = new Pool(connectionString ? { connectionString } : {});
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
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
