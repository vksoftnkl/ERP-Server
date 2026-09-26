export interface BoundQuery {
    readonly sql: string;
    readonly params: readonly unknown[];
    readonly bound: readonly string[];
}
export declare class DatasetBindError extends Error {
    readonly unknownParams: readonly string[];
    constructor(message: string, unknownParams?: readonly string[]);
}
export declare function scanParams(sql: string): string[];
export declare function bindDatasetSql(sql: string, values: Readonly<Record<string, unknown>>): BoundQuery;
export declare function withRowLimit(bound: BoundQuery, limit: number): BoundQuery;
