"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DatasetRunnerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetRunnerService = exports.DatasetRunError = void 0;
const common_1 = require("@nestjs/common");
const pg_service_1 = require("../../../../database/pg/pg.service");
const print_template_constants_1 = require("../../print-template/print-template.constants");
const dataset_sql_binder_1 = require("./dataset-sql-binder");
const render_params_1 = require("./render-params");
const print_data_provider_registry_1 = require("./print-data-provider.registry");
const scalar_text_1 = require("./scalar-text");
const value_coercion_1 = require("./value-coercion");
class DatasetRunError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.details = details;
        this.name = 'DatasetRunError';
    }
}
exports.DatasetRunError = DatasetRunError;
let DatasetRunnerService = DatasetRunnerService_1 = class DatasetRunnerService {
    pg;
    providers;
    logger = new common_1.Logger(DatasetRunnerService_1.name);
    constructor(pg, providers) {
        this.pg = pg;
        this.providers = providers;
    }
    async run(request) {
        const warnings = [];
        const settled = await Promise.all(request.datasets.map(async (dataset) => this.runOne(dataset, request, warnings)));
        const data = {};
        for (const entry of settled) {
            data[entry.name] = entry.value;
        }
        this.attachChildren(request.datasets, data, warnings);
        return { data, resolved: settled, warnings };
    }
    async runOne(dataset, request, warnings) {
        const startedAt = Date.now();
        const isMaster = dataset.ptdRole === 'MASTER';
        const limit = isMaster ? 1 : dataset.ptdRowLimit;
        const rows = dataset.ptdSourceKind === 'SQL'
            ? await this.runSql(dataset, request, limit, warnings)
            : await this.runProvider(dataset, request, limit);
        const truncated = !isMaster && rows.length >= limit;
        if (truncated) {
            warnings.push({
                kind: 'row-limit',
                message: `Dataset '${dataset.ptdName}' returned its full row limit of ${limit} rows — ` +
                    'there may be more. Raise ptdRowLimit on the revision if the document is incomplete.',
            });
        }
        return {
            name: dataset.ptdName,
            datasetNo: dataset.ptdDatasetNo,
            role: isMaster ? 'MASTER' : 'DETAIL',
            sourceKind: dataset.ptdSourceKind === 'SQL' ? 'SQL' : 'PROVIDER',
            value: isMaster ? (rows[0] ?? {}) : rows,
            rowCount: rows.length,
            durationMs: Date.now() - startedAt,
            truncated,
        };
    }
    async runSql(dataset, request, limit, warnings) {
        const sql = dataset.ptdSql;
        if (!sql) {
            throw new DatasetRunError(`Dataset '${dataset.ptdName}' is SQL-sourced but has no query`, [
                {
                    field: `datasets.${dataset.ptdName}.ptdSql`,
                    message: 'ptdSourceKind is SQL and ptdSql is empty. One of the two is wrong — ' +
                        'ck_ptd_source_biconditional normally prevents this pairing.',
                },
            ]);
        }
        const values = this.bindableValues(dataset, request);
        let bound;
        try {
            bound = (0, dataset_sql_binder_1.withRowLimit)((0, dataset_sql_binder_1.bindDatasetSql)(sql, values), limit);
        }
        catch (error) {
            if (error instanceof dataset_sql_binder_1.DatasetBindError) {
                throw new DatasetRunError(`Dataset '${dataset.ptdName}' cannot be bound`, [
                    { field: `datasets.${dataset.ptdName}.ptdSql`, message: error.message },
                ]);
            }
            throw error;
        }
        try {
            const result = await this.pg.queryReadOnlyTx(bound.sql, bound.params, dataset.ptdTimeoutMs);
            const duplicated = (0, value_coercion_1.duplicateColumns)(result);
            if (duplicated.length > 0) {
                warnings.push({
                    kind: 'duplicate-column',
                    message: `Dataset '${dataset.ptdName}' returns ${duplicated.join(', ')} more than once. ` +
                        'Only the last of each is reachable from an expression — alias them apart.',
                });
            }
            return (0, value_coercion_1.coerceResultRows)(result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const timedOut = /statement timeout/i.test(message);
            this.logger.error(`Dataset '${dataset.ptdName}' (${dataset.ptdId}) failed after binding ` +
                `${bound.bound.map((name) => `:${name}`).join(', ') || 'no parameters'}: ${message}`);
            throw new DatasetRunError(timedOut
                ? `Dataset '${dataset.ptdName}' took longer than its ${dataset.ptdTimeoutMs}ms limit`
                : `Dataset '${dataset.ptdName}' failed to execute`, [
                {
                    field: `datasets.${dataset.ptdName}.ptdSql`,
                    message: timedOut
                        ? `The query was cancelled at ${dataset.ptdTimeoutMs}ms (ptdTimeoutMs). ` +
                            'Either the query needs an index for this filter, or the limit is too low.'
                        : message,
                },
            ]);
        }
    }
    async runProvider(dataset, request, limit) {
        const code = dataset.ptdProviderCode ?? '';
        const provider = this.providers.get(code);
        if (!provider) {
            throw new DatasetRunError(`Dataset '${dataset.ptdName}' names a provider this server does not have`, [
                {
                    field: `datasets.${dataset.ptdName}.ptdProviderCode`,
                    message: `No provider is registered as '${code}'. Registered: ${this.providers.codes().join(', ') || 'none'}. ` +
                        'A provider is code, so a template that names one this build does not carry cannot ' +
                        'be made to work by editing data — either the template is ahead of the server or ' +
                        'the code is a typo.',
                },
            ]);
        }
        try {
            const produced = await provider.resolve({
                context: request.context,
                params: request.params,
                lang: request.lang,
                rowLimit: limit,
            });
            const rows = Array.isArray(produced) ? produced : [produced];
            return rows.slice(0, limit).map((row) => (0, value_coercion_1.coerceProviderRow)(row));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Provider '${code}' failed for dataset '${dataset.ptdName}': ${message}`);
            throw new DatasetRunError(`Dataset '${dataset.ptdName}' failed to load`, [
                { field: `datasets.${dataset.ptdName}.ptdProviderCode`, message },
            ]);
        }
    }
    bindableValues(dataset, request) {
        const context = {
            company_id: request.context.companyId,
            branch_id: request.context.branchId,
            acc_year: request.context.accYear,
            doc_id: request.context.docId,
            user_id: request.context.userId,
            device_id: request.context.deviceId,
        };
        const values = {};
        for (const name of print_template_constants_1.PTV_CONTEXT_PARAMS) {
            values[name] = context[name] ?? null;
        }
        for (const [name, value] of Object.entries(request.params)) {
            if ((0, render_params_1.isServerOwnedParam)(name))
                continue;
            if (value === null || value === undefined) {
                if ((0, render_params_1.hasContextDefault)(name))
                    continue;
            }
            values[name] = value ?? null;
        }
        void dataset;
        return values;
    }
    attachChildren(datasets, data, warnings) {
        const byNumber = new Map(datasets.map((dataset) => [dataset.ptdDatasetNo, dataset]));
        for (const child of datasets) {
            if (child.ptdParentNo === null || child.ptdParentNo === undefined)
                continue;
            const parent = byNumber.get(child.ptdParentNo);
            if (!parent) {
                warnings.push({
                    kind: 'missing-dataset',
                    message: `Dataset '${child.ptdName}' is nested under dataset number ${child.ptdParentNo}, ` +
                        'which this revision does not have. Its rows are still available at the top level.',
                });
                continue;
            }
            const pairs = (child.ptdLinkFields ?? '')
                .split(',')
                .map((pair) => pair.trim())
                .filter(Boolean)
                .map((pair) => {
                const [parentColumn, childColumn] = pair.split('=');
                return { parentColumn, childColumn };
            });
            if (pairs.length === 0) {
                warnings.push({
                    kind: 'missing-dataset',
                    message: `Dataset '${child.ptdName}' names a parent but no link fields, so its rows cannot ` +
                        'be matched to parent rows.',
                });
                continue;
            }
            const childRows = data[child.ptdName];
            if (!Array.isArray(childRows))
                continue;
            const index = new Map();
            for (const row of childRows) {
                const key = pairs.map((pair) => (0, scalar_text_1.toScalarText)(row[pair.childColumn])).join(' ');
                const bucket = index.get(key);
                if (bucket)
                    bucket.push(row);
                else
                    index.set(key, [row]);
            }
            const attachTo = (parentRow) => {
                const key = pairs.map((pair) => (0, scalar_text_1.toScalarText)(parentRow[pair.parentColumn])).join(' ');
                parentRow[child.ptdName] = index.get(key) ?? [];
            };
            const parentValue = data[parent.ptdName];
            if (Array.isArray(parentValue)) {
                for (const row of parentValue)
                    attachTo(row);
            }
            else if (typeof parentValue === 'object' && parentValue !== null) {
                attachTo(parentValue);
            }
        }
    }
};
exports.DatasetRunnerService = DatasetRunnerService;
exports.DatasetRunnerService = DatasetRunnerService = DatasetRunnerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService,
        print_data_provider_registry_1.PrintDataProviderRegistry])
], DatasetRunnerService);
//# sourceMappingURL=dataset-runner.service.js.map