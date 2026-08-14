import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryResult, QueryResultRow } from 'pg';
export declare class PgService implements OnModuleDestroy {
    private readonly logger;
    private readonly pool;
    private readonly readOnlyPool;
    constructor(configService: ConfigService);
    query<T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
    queryReadOnly<T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
    onModuleDestroy(): Promise<void>;
}
