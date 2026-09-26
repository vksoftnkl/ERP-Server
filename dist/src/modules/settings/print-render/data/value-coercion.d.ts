import { QueryResult, QueryResultRow } from 'pg';
export declare function coerceResultRows<T extends QueryResultRow>(result: QueryResult<T>): Record<string, unknown>[];
export declare function duplicateColumns<T extends QueryResultRow>(result: QueryResult<T>): string[];
export declare function coerceProviderValue(value: unknown): unknown;
export declare function coerceProviderRow(row: Record<string, unknown>): Record<string, unknown>;
