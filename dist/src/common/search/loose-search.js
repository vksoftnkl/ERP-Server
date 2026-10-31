"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SEARCH_TOKENS = exports.SEARCH_NORM_SQL_FUNCTION = void 0;
exports.normalizeSearchText = normalizeSearchText;
exports.splitSearchTokens = splitSearchTokens;
exports.looseSearchPredicateSql = looseSearchPredicateSql;
exports.looseSearchSql = looseSearchSql;
const client_1 = require("@prisma/client");
exports.SEARCH_NORM_SQL_FUNCTION = 'fixed.fn_search_norm';
exports.MAX_SEARCH_TOKENS = 8;
function normalizeSearchText(text) {
    return (text ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}
function splitSearchTokens(text) {
    const seen = new Set();
    const tokens = [];
    for (const word of (text ?? '').trim().split(/\s+/)) {
        const key = normalizeSearchText(word);
        if (!key || seen.has(key)) {
            continue;
        }
        seen.add(key);
        tokens.push(word);
        if (tokens.length === exports.MAX_SEARCH_TOKENS) {
            break;
        }
    }
    return tokens;
}
function looseSearchPredicateSql(columnExpr, paramPlaceholder) {
    return (`${exports.SEARCH_NORM_SQL_FUNCTION}(${columnExpr}) LIKE ` +
        `'%' || ${exports.SEARCH_NORM_SQL_FUNCTION}(${paramPlaceholder}::text) || '%'`);
}
const COLUMN_EXPR_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
function looseSearchSql(columnExprs, search) {
    for (const expr of columnExprs) {
        if (!COLUMN_EXPR_PATTERN.test(expr)) {
            throw new Error(`looseSearchSql: "${expr}" is not a column identifier`);
        }
    }
    const tokens = splitSearchTokens(search);
    if (tokens.length === 0 || columnExprs.length === 0) {
        return client_1.Prisma.sql `TRUE`;
    }
    const groups = tokens.map((token) => {
        const perColumn = columnExprs.map((expr) => client_1.Prisma.sql `${client_1.Prisma.raw(`${exports.SEARCH_NORM_SQL_FUNCTION}(${expr})`)} LIKE '%' || ${client_1.Prisma.raw(exports.SEARCH_NORM_SQL_FUNCTION)}(${token}::text) || '%'`);
        return client_1.Prisma.sql `(${client_1.Prisma.join(perColumn, ' OR ')})`;
    });
    return client_1.Prisma.sql `(${client_1.Prisma.join(groups, ' AND ')})`;
}
//# sourceMappingURL=loose-search.js.map