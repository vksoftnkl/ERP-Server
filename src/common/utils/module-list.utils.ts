import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../configured-grid-sql/configured-grid-sql.service';
import { GridColumnItem } from '../configured-grid-sql/types/configured-grid-sql.types';
import type { ModuleListMeta } from '../types/module-list.types';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from './module-shared.utils';

export function buildListMeta(page: number, limit: number, total: number): ModuleListMeta {
  return { page, limit, total, total_pages: Math.ceil(total / limit) };
}

export function resolvePagination(queryDto: { page?: number; limit?: number }): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = queryDto.page ?? DEFAULT_PAGE;
  const limit = queryDto.limit ?? DEFAULT_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

export interface ModuleListQueryOptions<TRecord, TItem> {
  hasStructuredFilters?: boolean;
  configuredGridFn?: () => Promise<ConfiguredGridListResult<TItem, ModuleListMeta> | null>;
  countFn: () => Promise<number>;
  findManyFn: () => Promise<TRecord[]>;
  toItemFn: (record: TRecord) => TItem;
  loadStylesFn?: () => Promise<GridColumnItem[] | undefined>;
}

export async function runModuleListQuery<TRecord, TItem>(
  pagination: { page: number; limit: number },
  options: ModuleListQueryOptions<TRecord, TItem>,
): Promise<ConfiguredGridListResult<TItem, ModuleListMeta>> {
  const { hasStructuredFilters = false, configuredGridFn, countFn, findManyFn, toItemFn, loadStylesFn } =
    options;
  const { page, limit } = pagination;
  if (!hasStructuredFilters && configuredGridFn) {
    const configuredList = await configuredGridFn();
    if (configuredList) return configuredList;
  }
  const [total, records, styles] = await Promise.all([
    countFn(),
    findManyFn(),
    loadStylesFn ? loadStylesFn() : Promise.resolve(undefined),
  ]);
  return {
    items: records.map(toItemFn),
    meta: buildListMeta(page, limit, total),
    ...(styles !== undefined && { styles }),
  };
}
export async function runConfiguredGridQuery<TItem>(
  configuredGridSqlService: ConfiguredGridSqlService,
  options: {
    tableName: string;
    alias: string;
    search: string | undefined;
    page: number;
    limit: number;
    skip: number;
  },
): Promise<ConfiguredGridListResult<TItem, ModuleListMeta> | null> {
  const { tableName, alias, search, page, limit, skip } = options;
  const configuredGrids = await configuredGridSqlService.loadCandidates({ tableName });
  const primaryConfiguredGrids = configuredGridSqlService.filterPrimaryFromTable(
    configuredGrids,
    tableName,
  );
  if (primaryConfiguredGrids.length === 0) {
    return null;
  }
  for (const configuredGrid of primaryConfiguredGrids) {
    const rawGridSql = configuredGrid.gridSql?.trim();
    if (!rawGridSql) {
      continue;
    }
    const validation = configuredGridSqlService.validateBaseSql({ sql: rawGridSql, tableName });
    if (!validation.isValid) {
      continue;
    }
    try {
      const result = await configuredGridSqlService.runPagedQuery<TItem>({
        baseSql: validation.normalizedSql,
        alias,
        search,
        limit,
        skip,
        gridId: configuredGrid.gridId,
      });
      return {
        items: result.items,
        meta: buildListMeta(page, limit, result.total),
        styles: result.styles,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export type {
  AccountsListMeta,
  FixedListMeta,
  InventoryListMeta,
  ModuleListMeta,
  PurchaseListMeta,
  SalesListMeta,
  SettingsListMeta,
} from '../types/module-list.types';

export type AccountsListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type FixedListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type InventoryListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type PurchaseListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;
export type SalesListQueryOptions<TRecord, TItem> = ModuleListQueryOptions<TRecord, TItem>;

export {
  runModuleListQuery as runAccountsListQuery,
  runModuleListQuery as runFixedListQuery,
  runModuleListQuery as runInventoryListQuery,
  runModuleListQuery as runPurchaseListQuery,
  runModuleListQuery as runSalesListQuery,
};
