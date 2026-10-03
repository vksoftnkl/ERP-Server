import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../configured-grid-sql/configured-grid-sql.service';
import { GridColumnItem } from '../configured-grid-sql/types/configured-grid-sql.types';
import type { ModuleListMeta } from '../types/module-list.types';
export declare function buildListMeta(page: number, limit: number, total: number): ModuleListMeta;
export declare function resolvePagination(queryDto: {
    page?: number;
    limit?: number;
}): {
    page: number;
    limit: number;
    skip: number;
};
export interface ModuleListQueryOptions<TRecord, TItem> {
    hasStructuredFilters?: boolean;
    configuredGridFn?: () => Promise<ConfiguredGridListResult<TItem, ModuleListMeta> | null>;
    countFn: () => Promise<number>;
    findManyFn: () => Promise<TRecord[]>;
    toItemFn: (record: TRecord) => TItem;
    loadStylesFn?: () => Promise<GridColumnItem[] | undefined>;
}
export declare function runModuleListQuery<TRecord, TItem>(pagination: {
    page: number;
    limit: number;
}, options: ModuleListQueryOptions<TRecord, TItem>): Promise<ConfiguredGridListResult<TItem, ModuleListMeta>>;
export declare function runConfiguredGridQuery<TItem>(configuredGridSqlService: ConfiguredGridSqlService, options: {
    tableName: string;
    alias: string;
    search: string | undefined;
    page: number;
    limit: number;
    skip: number;
    fixedGridId?: bigint;
    primaryTableSchema?: string;
    extraForbiddenPatterns?: Array<{
        pattern: RegExp;
        message: string;
    }>;
}): Promise<ConfiguredGridListResult<TItem, ModuleListMeta> | null>;
export type { AccountsListMeta, FixedListMeta, InventoryListMeta, MasterListMeta, ModuleListMeta, PurchaseListMeta, SalesListMeta, SettingsListMeta, } from '../types/module-list.types';
export type AccountsListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type FixedListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type InventoryListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type MasterListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type PurchaseListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type SalesListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type SettingsListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export { runModuleListQuery as runAccountsListQuery, runModuleListQuery as runFixedListQuery, runModuleListQuery as runInventoryListQuery, runModuleListQuery as runMasterListQuery, runModuleListQuery as runPurchaseListQuery, runModuleListQuery as runSalesListQuery, runModuleListQuery as runSettingsListQuery, };
