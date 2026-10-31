import type { PriceChangeAction, PriceChangeScope, PriceRowSnapshot, PriceTable } from './types/price-change-log.types';
export declare const IGNORED_COLUMNS: Readonly<Record<PriceTable, readonly string[]>>;
export declare const DELETED_COLUMN: Readonly<Record<PriceTable, string>>;
export declare function changedColumns(table: PriceTable, before: PriceRowSnapshot | null, after: PriceRowSnapshot | null): string[];
export declare function actionOf(table: PriceTable, before: PriceRowSnapshot | null, after: PriceRowSnapshot | null): Exclude<PriceChangeAction, 'REKEY'>;
export declare function scopeOf(table: PriceTable, row: PriceRowSnapshot | null): PriceChangeScope;
