import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';

export interface SalesListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export function buildListMeta(page: number, limit: number, total: number): SalesListMeta {
  return { page, limit, total, total_pages: Math.ceil(total / limit) };
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
): Promise<ConfiguredGridListResult<TItem, SalesListMeta> | null> {
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
