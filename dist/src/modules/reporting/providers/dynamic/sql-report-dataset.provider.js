"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlReportDatasetProvider = void 0;
const common_1 = require("@nestjs/common");
const provider_utils_1 = require("../provider.utils");
const dataset_field_introspector_1 = require("./dataset-field.introspector");
const report_dataset_types_1 = require("./report-dataset.types");
const SAMPLE_ROW_COUNT = 3;
class SqlReportDatasetProvider {
    definition;
    pg;
    configuredGridSql;
    logger = new common_1.Logger(SqlReportDatasetProvider.name);
    constructor(definition, pg, configuredGridSql) {
        this.definition = definition;
        this.pg = pg;
        this.configuredGridSql = configuredGridSql;
    }
    fields() {
        return this.definition.fields;
    }
    async resolve(context) {
        const rows = await this.runQuery(context);
        const coerced = rows.map((row) => this.coerceRow(row));
        if (this.definition.cardinality === 'one') {
            return coerced[0] ?? {};
        }
        return coerced;
    }
    sampleData() {
        const rows = this.definition.sampleRows && this.definition.sampleRows.length > 0
            ? this.definition.sampleRows.map((row) => ({ ...row }))
            : (0, dataset_field_introspector_1.synthesiseSampleRows)(this.definition.fields, SAMPLE_ROW_COUNT);
        return this.definition.cardinality === 'one' ? (rows[0] ?? {}) : rows;
    }
    async runQuery(context) {
        const { sql, params } = this.bind(context);
        try {
            const result = await this.pg.queryReadOnly(sql, params);
            return result.rows;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const unbound = this.configuredGridSql.findUnboundParamTokens(this.definition.sql);
            const hint = unbound.length > 0
                ? ` Unbound token(s) still in the SQL: ${unbound.join(', ')}.`
                : '';
            this.logger.error(`Dataset '${this.definition.token}' failed: ${message}${hint}`, error instanceof Error ? error.stack : undefined);
            throw new common_1.InternalServerErrorException(`Report dataset '${this.definition.token}' failed to execute: ${message}${hint}`);
        }
    }
    bind(context) {
        const values = {};
        for (const [token, contextKey] of Object.entries(report_dataset_types_1.RESERVED_DATASET_PARAMS)) {
            values[token] = context[contextKey] ?? null;
        }
        const supplied = context.params ?? {};
        for (const spec of this.definition.params) {
            values[spec.name] = this.resolveDeclaredParam(spec, supplied);
        }
        const bound = this.configuredGridSql.bindGridParams(this.definition.sql, values);
        const limit = this.definition.cardinality === 'one' ? 1 : this.definition.maxRows;
        const sql = `SELECT * FROM (${bound.sql}) AS rds_rows LIMIT $${bound.params.length + 1}`;
        return { sql, params: [...bound.params, limit] };
    }
    resolveDeclaredParam(spec, supplied) {
        const raw = supplied[spec.name] ?? spec.defaultValue ?? null;
        if (raw === null && spec.required) {
            throw new common_1.InternalServerErrorException(`Report dataset '${this.definition.token}' requires parameter '${spec.name}', ` +
                'which the template binding and the render request both omitted.');
        }
        return this.coerceParam(spec, raw);
    }
    coerceParam(spec, value) {
        if (value === null || value === undefined) {
            return null;
        }
        switch (spec.type) {
            case 'integer':
                return Math.trunc((0, provider_utils_1.toNumber)(value));
            case 'number':
                return (0, provider_utils_1.toNumber)(value);
            case 'boolean':
                return typeof value === 'boolean' ? value : /^(true|1|yes|y)$/i.test(String(value));
            case 'date':
                return (0, provider_utils_1.toDateOnly)(value);
            default:
                return String(value);
        }
    }
    coerceRow(row) {
        const out = {};
        const typed = new Set();
        for (const field of this.definition.fields) {
            typed.add(field.name);
            const value = row[field.name];
            switch (field.type) {
                case 'number':
                    out[field.name] = (0, provider_utils_1.toNumber)(value);
                    break;
                case 'integer':
                    out[field.name] = Math.trunc((0, provider_utils_1.toNumber)(value));
                    break;
                case 'boolean':
                    out[field.name] = value === null || value === undefined ? false : Boolean(value);
                    break;
                case 'date':
                    out[field.name] = (0, provider_utils_1.toDateOnly)(value);
                    break;
                case 'datetime':
                    out[field.name] = (0, provider_utils_1.toIsoDateTime)(value);
                    break;
                case 'object':
                    out[field.name] = value ?? null;
                    break;
                default:
                    out[field.name] = (0, provider_utils_1.toText)(value);
            }
        }
        for (const [key, value] of Object.entries(row)) {
            if (!typed.has(key)) {
                out[key] = typeof value === 'bigint' ? value.toString() : (0, provider_utils_1.toText)(value);
            }
        }
        return out;
    }
}
exports.SqlReportDatasetProvider = SqlReportDatasetProvider;
//# sourceMappingURL=sql-report-dataset.provider.js.map