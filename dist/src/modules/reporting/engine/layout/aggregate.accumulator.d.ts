import { AggregateFunction } from '../../templates/dto/template-definition.schema';
export interface AggregateSpec {
    readonly key: string;
    readonly fn: AggregateFunction;
    readonly dataset: string;
}
export declare class PrecomputedAggregates {
    private readonly report;
    private readonly groups;
    addReport(key: string, value: number | null): void;
    addGroup(groupPath: string, key: string, value: number | null): void;
    readReport(key: string, fn: AggregateFunction): number;
    readGroup(groupPath: string, key: string, fn: AggregateFunction): number;
}
export declare class PageAggregates {
    private accumulators;
    add(key: string, value: number | null): void;
    read(key: string, fn: AggregateFunction): number;
    reset(): void;
}
export declare const GROUP_PATH_SEPARATOR = "\u001F";
export declare const buildGroupPath: (keys: readonly string[]) => string;
