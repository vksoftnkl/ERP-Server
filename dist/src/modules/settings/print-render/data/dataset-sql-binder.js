"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetBindError = void 0;
exports.scanParams = scanParams;
exports.bindDatasetSql = bindDatasetSql;
exports.withRowLimit = withRowLimit;
class DatasetBindError extends Error {
    unknownParams;
    constructor(message, unknownParams = []) {
        super(message);
        this.unknownParams = unknownParams;
        this.name = 'DatasetBindError';
    }
}
exports.DatasetBindError = DatasetBindError;
function scanParams(sql) {
    const names = [];
    const seen = new Set();
    let index = 0;
    while (index < sql.length) {
        const char = sql[index];
        const next = sql[index + 1];
        if (char === "'") {
            index += 1;
            while (index < sql.length) {
                if (sql[index] === "'") {
                    if (sql[index + 1] === "'") {
                        index += 2;
                        continue;
                    }
                    index += 1;
                    break;
                }
                index += 1;
            }
            continue;
        }
        if (char === '"') {
            index += 1;
            while (index < sql.length) {
                if (sql[index] === '"') {
                    if (sql[index + 1] === '"') {
                        index += 2;
                        continue;
                    }
                    index += 1;
                    break;
                }
                index += 1;
            }
            continue;
        }
        if (char === '-' && next === '-') {
            while (index < sql.length && sql[index] !== '\n')
                index += 1;
            continue;
        }
        if (char === '/' && next === '*') {
            let depth = 1;
            index += 2;
            while (index < sql.length && depth > 0) {
                if (sql[index] === '/' && sql[index + 1] === '*') {
                    depth += 1;
                    index += 2;
                    continue;
                }
                if (sql[index] === '*' && sql[index + 1] === '/') {
                    depth -= 1;
                    index += 2;
                    continue;
                }
                index += 1;
            }
            continue;
        }
        if (char === ':' && next === ':') {
            index += 2;
            continue;
        }
        if (char === ':' && next !== undefined && /[a-zA-Z_]/.test(next)) {
            let end = index + 1;
            while (end < sql.length && /[a-zA-Z0-9_]/.test(sql[end]))
                end += 1;
            const name = sql.slice(index + 1, end);
            if (!seen.has(name)) {
                seen.add(name);
                names.push(name);
            }
            index = end;
            continue;
        }
        index += 1;
    }
    return names;
}
function bindDatasetSql(sql, values) {
    const names = scanParams(sql);
    const unknown = names.filter((name) => !Object.prototype.hasOwnProperty.call(values, name));
    if (unknown.length > 0) {
        throw new DatasetBindError(`The query binds ${unknown.map((name) => `:${name}`).join(', ')}, which nothing supplies. ` +
            `Bindable here: ${Object.keys(values)
                .sort()
                .map((name) => `:${name}`)
                .join(', ')}. ` +
            'Context parameters are a closed set; anything else must be declared as an operator ' +
            'prompt on the revision (ptvParams).', unknown);
    }
    const ordinal = new Map();
    names.forEach((name, position) => ordinal.set(name, position + 1));
    let out = '';
    let index = 0;
    while (index < sql.length) {
        const char = sql[index];
        const next = sql[index + 1];
        if (char === "'" || char === '"') {
            const quote = char;
            let end = index + 1;
            while (end < sql.length) {
                if (sql[end] === quote) {
                    if (sql[end + 1] === quote) {
                        end += 2;
                        continue;
                    }
                    end += 1;
                    break;
                }
                end += 1;
            }
            out += sql.slice(index, end);
            index = end;
            continue;
        }
        if (char === '-' && next === '-') {
            let end = index;
            while (end < sql.length && sql[end] !== '\n')
                end += 1;
            out += sql.slice(index, end);
            index = end;
            continue;
        }
        if (char === '/' && next === '*') {
            let depth = 1;
            let end = index + 2;
            while (end < sql.length && depth > 0) {
                if (sql[end] === '/' && sql[end + 1] === '*') {
                    depth += 1;
                    end += 2;
                    continue;
                }
                if (sql[end] === '*' && sql[end + 1] === '/') {
                    depth -= 1;
                    end += 2;
                    continue;
                }
                end += 1;
            }
            out += sql.slice(index, end);
            index = end;
            continue;
        }
        if (char === ':' && next === ':') {
            out += '::';
            index += 2;
            continue;
        }
        if (char === ':' && next !== undefined && /[a-zA-Z_]/.test(next)) {
            let end = index + 1;
            while (end < sql.length && /[a-zA-Z0-9_]/.test(sql[end]))
                end += 1;
            const name = sql.slice(index + 1, end);
            out += `$${ordinal.get(name)}`;
            index = end;
            continue;
        }
        out += char;
        index += 1;
    }
    return {
        sql: out,
        params: names.map((name) => values[name]),
        bound: names,
    };
}
function withRowLimit(bound, limit) {
    const ordinal = bound.params.length + 1;
    return {
        sql: `SELECT * FROM (${bound.sql}) AS ptd_rows LIMIT $${ordinal}`,
        params: [...bound.params, limit],
        bound: bound.bound,
    };
}
//# sourceMappingURL=dataset-sql-binder.js.map