"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildListMeta = buildListMeta;
exports.resolvePagination = resolvePagination;
exports.runModuleListQuery = runModuleListQuery;
exports.runAccountsListQuery = runModuleListQuery;
exports.runFixedListQuery = runModuleListQuery;
exports.runInventoryListQuery = runModuleListQuery;
exports.runMasterListQuery = runModuleListQuery;
exports.runPurchaseListQuery = runModuleListQuery;
exports.runSalesListQuery = runModuleListQuery;
exports.runSettingsListQuery = runModuleListQuery;
exports.runConfiguredGridQuery = runConfiguredGridQuery;
const module_shared_utils_1 = require("./module-shared.utils");
function buildListMeta(page, limit, total) {
    return { page, limit, total, total_pages: Math.ceil(total / limit) };
}
function resolvePagination(queryDto) {
    const page = queryDto.page ?? module_shared_utils_1.DEFAULT_PAGE;
    const limit = queryDto.limit ?? module_shared_utils_1.DEFAULT_LIMIT;
    return { page, limit, skip: (page - 1) * limit };
}
async function runModuleListQuery(pagination, options) {
    const { hasStructuredFilters = false, configuredGridFn, countFn, findManyFn, toItemFn, loadStylesFn } = options;
    const { page, limit } = pagination;
    if (!hasStructuredFilters && configuredGridFn) {
        const configuredList = await configuredGridFn();
        if (configuredList)
            return configuredList;
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
async function runConfiguredGridQuery(configuredGridSqlService, options) {
    const { tableName, alias, search, page, limit, skip, fixedGridId, primaryTableSchema, extraForbiddenPatterns } = options;
    const configuredGrids = await configuredGridSqlService.loadCandidates({
        tableName,
        ...(fixedGridId !== undefined && { fixedGridId, applyTableNameFilter: false }),
    });
    const primaryConfiguredGrids = fixedGridId !== undefined
        ? configuredGrids
        : configuredGridSqlService.filterPrimaryFromTable(configuredGrids, tableName);
    if (primaryConfiguredGrids.length === 0) {
        return null;
    }
    for (const configuredGrid of primaryConfiguredGrids) {
        const rawGridSql = configuredGrid.gridSql?.trim();
        if (!rawGridSql) {
            continue;
        }
        const validation = configuredGridSqlService.validateBaseSql({
            sql: rawGridSql,
            tableName,
            ...(primaryTableSchema ? { primaryTableSchema } : {}),
            ...(extraForbiddenPatterns ? { extraForbiddenPatterns } : {}),
        });
        if (!validation.isValid) {
            continue;
        }
        try {
            const result = await configuredGridSqlService.runPagedQuery({
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
            };
        }
        catch {
            continue;
        }
    }
    return null;
}
//# sourceMappingURL=module-list.utils.js.map