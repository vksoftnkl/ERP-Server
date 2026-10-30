"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConfiguredSqlCandidates = resolveConfiguredSqlCandidates;
exports.normalizeConfiguredSql = normalizeConfiguredSql;
const master_lookup_constants_1 = require("../master-lookup.constants");
function resolveConfiguredSqlCandidates(config) {
    const candidates = [config.dropdownSqlRegional, config.dropdownSql]
        .map((value) => normalizeConfiguredSql(value))
        .filter((value) => Boolean(value));
    return Array.from(new Set(candidates));
}
function normalizeConfiguredSql(value) {
    if (!value)
        return undefined;
    const trimmed = value.trim().replace(/;+$/g, '').trim();
    if (!trimmed)
        return undefined;
    if (!/^(select|with)\b/i.test(trimmed))
        return undefined;
    if (trimmed.includes(';'))
        return undefined;
    const normalized = trimmed.replace(/,(\s*(from|where|group\s+by|order\s+by|having|union|limit|offset)\b)/gi, '$1');
    if (/\.\s*(from|where|group\s+by|order\s+by|having|union|limit|offset)\b/i.test(normalized)) {
        return undefined;
    }
    return normalizeConfiguredSqlTableReferences(normalized);
}
function normalizeConfiguredSqlTableReferences(sql) {
    return master_lookup_constants_1.CONFIGURED_SQL_TABLE_REPLACEMENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), sql);
}
//# sourceMappingURL=configured-sql.utils.js.map