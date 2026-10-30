import { DropdownLookupColumnConfig, LookupRow } from '../types/master-lookup-internal.types';
export declare function normalizeLookupToken(value: string | null | undefined): string;
export declare function resolveRowLookupKeys(row: LookupRow): string[];
export declare function resolveConfiguredLookupKeys(columns: DropdownLookupColumnConfig[]): string[];
export declare function resolveLikelyIdKey(keys: string[]): string | undefined;
export declare function resolveLikelyNameKey(keys: string[], idKey?: string, fallbackToId?: boolean): string | undefined;
export declare function readLookupRowValue(row: LookupRow, normalizedKey: string): string | undefined;
export declare function toLookupValue(value: unknown): string | undefined;
