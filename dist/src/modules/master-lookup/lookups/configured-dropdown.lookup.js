"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfiguredDropdownLookup = void 0;
const master_lookup_constants_1 = require("../master-lookup.constants");
const master_lookup_api_types_1 = require("../types/master-lookup-api.types");
const configured_sql_utils_1 = require("../utils/configured-sql.utils");
const lookup_key_utils_1 = require("../utils/lookup-key.utils");
const lookup_option_utils_1 = require("../utils/lookup-option.utils");
class ConfiguredDropdownLookup {
    prisma;
    pg;
    constructor(prisma, pg) {
        this.prisma = prisma;
        this.pg = pg;
    }
    async loadConfigsByModule() {
        const records = await this.prisma.dropdownDetails.findMany({
            include: {
                dropdownColumns: { orderBy: [{ dropdownColumnsNo: 'asc' }] },
            },
        });
        const configs = new Map();
        for (const moduleKey of master_lookup_api_types_1.LOOKUP_MODULE_KEYS) {
            const record = this.findRecordForModule(moduleKey, records);
            if (record)
                configs.set(moduleKey, this.toConfig(record));
        }
        return configs;
    }
    async loadConfigById(dropdownId) {
        const record = await this.prisma.dropdownDetails.findUnique({
            where: { dropdownId },
            include: { dropdownColumns: { orderBy: [{ dropdownColumnsNo: 'asc' }] } },
        });
        return record ? this.toConfig(record) : null;
    }
    async fetchItems(config) {
        for (const sql of (0, configured_sql_utils_1.resolveConfiguredSqlCandidates)(config)) {
            try {
                const result = await this.pg.queryReadOnly(sql);
                return this.mapRowsToOptions(result.rows, config);
            }
            catch {
                continue;
            }
        }
        return null;
    }
    findRecordForModule(module, records) {
        const aliases = new Set([
            module,
            ...master_lookup_constants_1.MODULE_DROPDOWN_NAME_ALIASES[module],
            ...master_lookup_api_types_1.LOOKUP_MODULE_ALIASES[module],
        ]);
        const exactMatch = records.find((record) => aliases.has(record.dropdownName.trim()));
        if (exactMatch)
            return exactMatch;
        const normalizedAliases = Array.from(aliases).map((alias) => (0, lookup_key_utils_1.normalizeLookupToken)(alias));
        return records.find((record) => normalizedAliases.includes((0, lookup_key_utils_1.normalizeLookupToken)(record.dropdownName)));
    }
    toConfig(record) {
        return {
            dropdownId: record.dropdownId,
            dropdownName: record.dropdownName,
            dropdownSql: record.dropdownSql,
            dropdownSqlRegional: record.dropdownSqlRegional,
            dropdownSortColumn: record.dropdownSortColumn,
            dropdownSortOrder: record.dropdownSortOrder,
            dropdownColumns: record.dropdownColumns
                .filter((col) => col.dropdownColumnsVisiblity)
                .map((col) => ({
                name: col.dropdownColumnsName,
                alias: col.dropdownColumnsAlias,
                filter: col.dropdownColumnsFilter,
                visible: true,
            })),
        };
    }
    mapRowsToOptions(rows, config) {
        return rows
            .map((row) => ({ row, option: this.mapRowToOption(row, config.dropdownColumns) }))
            .filter((item) => item.option !== null)
            .sort((left, right) => this.compareRows(left, right, config))
            .map((item) => item.option);
    }
    mapRowToOption(row, columns) {
        const rowKeys = (0, lookup_key_utils_1.resolveRowLookupKeys)(row);
        const configuredKeys = (0, lookup_key_utils_1.resolveConfiguredLookupKeys)(columns);
        const idKey = (0, lookup_key_utils_1.resolveLikelyIdKey)(rowKeys) ?? (0, lookup_key_utils_1.resolveLikelyIdKey)(configuredKeys);
        const idValue = idKey ? (0, lookup_key_utils_1.readLookupRowValue)(row, idKey) : undefined;
        if (!idValue)
            return null;
        const nameKey = (0, lookup_key_utils_1.resolveLikelyNameKey)(rowKeys, idKey, false) ??
            (0, lookup_key_utils_1.resolveLikelyNameKey)(configuredKeys, idKey, false);
        const nameValue = nameKey ? (0, lookup_key_utils_1.readLookupRowValue)(row, nameKey) : undefined;
        return {
            ...(0, lookup_option_utils_1.serializeLookupRow)(row),
            ...(0, lookup_option_utils_1.toOption)(idValue, nameValue, { fallbackNameToId: false }),
        };
    }
    compareRows(left, right, config) {
        const sortOrder = config.dropdownSortOrder?.trim().toUpperCase() === 'DESC' ? -1 : 1;
        const sortColumnKey = (0, lookup_key_utils_1.normalizeLookupToken)(config.dropdownSortColumn ?? '');
        const useSortColumn = sortColumnKey !== '' &&
            ((0, lookup_key_utils_1.readLookupRowValue)(left.row, sortColumnKey) !== undefined ||
                (0, lookup_key_utils_1.readLookupRowValue)(right.row, sortColumnKey) !== undefined);
        const leftValue = useSortColumn
            ? (0, lookup_key_utils_1.readLookupRowValue)(left.row, sortColumnKey)
            : left.option.name;
        const rightValue = useSortColumn
            ? (0, lookup_key_utils_1.readLookupRowValue)(right.row, sortColumnKey)
            : right.option.name;
        const primary = (leftValue ?? '').localeCompare(rightValue ?? '', undefined, {
            sensitivity: 'base',
            numeric: true,
        });
        if (primary !== 0)
            return primary * sortOrder;
        return left.option.id.localeCompare(right.option.id, undefined, {
            sensitivity: 'base',
            numeric: true,
        });
    }
}
exports.ConfiguredDropdownLookup = ConfiguredDropdownLookup;
//# sourceMappingURL=configured-dropdown.lookup.js.map