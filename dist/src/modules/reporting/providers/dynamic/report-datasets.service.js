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
var ReportDatasetsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportDatasetsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const configured_grid_sql_service_1 = require("../../../../common/configured-grid-sql/configured-grid-sql.service");
const request_context_service_1 = require("../../../../common/request-context/request-context.service");
const pg_service_1 = require("../../../../database/pg/pg.service");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const dynamic_dataset_source_1 = require("./dynamic-dataset.source");
const dataset_field_introspector_1 = require("./dataset-field.introspector");
const report_dataset_sql_validator_1 = require("./report-dataset-sql.validator");
const sql_report_dataset_provider_1 = require("./sql-report-dataset.provider");
const report_dataset_types_1 = require("./report-dataset.types");
let ReportDatasetsService = ReportDatasetsService_1 = class ReportDatasetsService {
    prisma;
    pg;
    requestContext;
    validator;
    configuredGridSql;
    source;
    logger = new common_1.Logger(ReportDatasetsService_1.name);
    constructor(prisma, pg, requestContext, validator, configuredGridSql, source) {
        this.prisma = prisma;
        this.pg = pg;
        this.requestContext = requestContext;
        this.validator = validator;
        this.configuredGridSql = configuredGridSql;
        this.source = source;
    }
    async findAll(includeInactive = false) {
        return this.prisma.reportDataset.findMany({
            where: {
                rdsIsDeleted: false,
                ...(includeInactive ? {} : { rdsIsActive: true }),
            },
            orderBy: { rdsToken: 'asc' },
        });
    }
    async findOne(id) {
        const row = await this.prisma.reportDataset.findFirst({
            where: { rdsId: id, rdsIsDeleted: false },
        });
        if (!row) {
            throw new common_1.NotFoundException(`Report dataset ${id} not found`);
        }
        return row;
    }
    async probe(dto) {
        const params = this.normaliseParams(dto.rdsParams);
        return this.validateAndIntrospect(dto.rdsSql, params, []);
    }
    async create(dto) {
        const token = dto.rdsToken.trim();
        this.validator.assertValidToken(token);
        await this.assertTokenAvailable(token, null);
        const params = this.normaliseParams(dto.rdsParams);
        const probe = await this.validateAndIntrospect(dto.rdsSql, params, this.normaliseFieldOverrides(dto.rdsFieldOverrides));
        const userId = this.requestContext.getUserId();
        const created = await this.prisma.reportDataset.create({
            data: {
                rdsToken: token,
                rdsLabel: dto.rdsLabel,
                rdsCardinality: dto.rdsCardinality,
                rdsDocTypes: dto.rdsDocTypes ?? [],
                rdsSql: probe.normalizedSql,
                rdsParams: params,
                rdsFields: probe.fields,
                rdsSampleRows: this.normaliseSampleRows(dto.rdsSampleRows, probe.fields),
                rdsMaxRows: dto.rdsMaxRows ?? 5000,
                rdsNotes: dto.rdsNotes ?? null,
                rdsIsActive: dto.rdsIsActive ?? true,
                rdsCreatedBy: userId,
            },
        });
        await this.source.invalidate();
        this.logger.log(`Report dataset '${token}' created with ${probe.fields.length} field(s)`);
        return created;
    }
    async update(id, dto) {
        const existing = await this.findOne(id);
        const params = dto.rdsParams === undefined
            ? (existing.rdsParams ?? [])
            : this.normaliseParams(dto.rdsParams);
        const sql = dto.rdsSql ?? existing.rdsSql;
        const overrides = dto.rdsFieldOverrides === undefined
            ? (existing.rdsFields ?? [])
            : this.normaliseFieldOverrides(dto.rdsFieldOverrides);
        const probe = await this.validateAndIntrospect(sql, params, overrides);
        const updated = await this.prisma.reportDataset.update({
            where: { rdsId: id },
            data: {
                ...(dto.rdsLabel !== undefined ? { rdsLabel: dto.rdsLabel } : {}),
                ...(dto.rdsCardinality !== undefined ? { rdsCardinality: dto.rdsCardinality } : {}),
                ...(dto.rdsDocTypes !== undefined ? { rdsDocTypes: dto.rdsDocTypes } : {}),
                ...(dto.rdsMaxRows !== undefined ? { rdsMaxRows: dto.rdsMaxRows } : {}),
                ...(dto.rdsNotes !== undefined ? { rdsNotes: dto.rdsNotes } : {}),
                ...(dto.rdsIsActive !== undefined ? { rdsIsActive: dto.rdsIsActive } : {}),
                ...(dto.rdsSampleRows !== undefined
                    ? { rdsSampleRows: this.normaliseSampleRows(dto.rdsSampleRows, probe.fields) }
                    : {}),
                rdsSql: probe.normalizedSql,
                rdsParams: params,
                rdsFields: probe.fields,
                rdsVersion: { increment: 1 },
                rdsModifiedOn: new Date(),
                rdsModifiedBy: this.requestContext.getUserId(),
            },
        });
        await this.source.invalidate();
        return updated;
    }
    async remove(id, force = false) {
        const existing = await this.findOne(id);
        const users = await this.findTemplatesUsing(existing.rdsToken);
        if (users.length > 0 && !force) {
            throw new common_1.ConflictException(`Report dataset '${existing.rdsToken}' is still bound by ${users.length} template(s): ` +
                `${users.map((template) => template.pt_name).join(', ')}. ` +
                'Rebind or delete those templates first, or repeat with force=true to delete anyway ' +
                '— they will then fail at print time.');
        }
        await this.prisma.reportDataset.update({
            where: { rdsId: id },
            data: {
                rdsIsDeleted: true,
                rdsIsActive: false,
                rdsModifiedOn: new Date(),
                rdsModifiedBy: this.requestContext.getUserId(),
            },
        });
        await this.source.invalidate();
        return { rdsId: id, rdsToken: existing.rdsToken };
    }
    async findTemplatesUsing(token) {
        return this.prisma.$queryRaw `
      SELECT pt_id, pt_name
      FROM reports.print_template
      WHERE NOT pt_is_deleted
        AND pt_definition -> 'datasets' @> ${JSON.stringify([{ provider: token }])}::jsonb
      ORDER BY pt_name
    `;
    }
    async preview(id, dto) {
        const row = await this.findOne(id);
        const companyId = this.requireCompanyId();
        const definition = this.toDefinition(row);
        const provider = new sql_report_dataset_provider_1.SqlReportDatasetProvider({ ...definition, maxRows: Math.min(dto.limit ?? 20, 100), cardinality: 'many' }, this.pg, this.configuredGridSql);
        const context = {
            companyId,
            branchId: dto.branchId ?? null,
            accYear: dto.accYear,
            docId: dto.docId ?? '',
            userId: this.requestContext.getUserId(),
            params: dto.params ?? {},
        };
        const rows = (await provider.resolve(context));
        return { rows, rowCount: rows.length, fields: definition.fields };
    }
    async validateAndIntrospect(sql, params, overrides) {
        this.validator.assertValidParamSpecs(params);
        const validated = this.validator.validate({ sql, params });
        const values = {
            p_company_id: this.requireCompanyId(),
            p_branch_id: null,
            p_acc_year: null,
            p_doc_id: null,
            p_user_id: this.requestContext.getUserId(),
        };
        for (const param of params) {
            values[param.name] = param.defaultValue ?? null;
        }
        const bound = this.configuredGridSql.bindGridParams(validated.normalizedSql, values);
        const probeSql = `SELECT * FROM (${bound.sql}) AS rds_probe WHERE false`;
        let descriptors;
        try {
            const result = await this.pg.queryReadOnly(probeSql, bound.params);
            descriptors = result.fields;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const unbound = this.configuredGridSql.findUnboundParamTokens(validated.normalizedSql);
            throw new common_1.BadRequestException(`Dataset query failed to execute: ${message}` +
                (unbound.length > 0 ? ` Unbound token(s): ${unbound.join(', ')}.` : ''));
        }
        const duplicates = (0, dataset_field_introspector_1.findDuplicateColumns)(descriptors);
        if (duplicates.length > 0) {
            throw new common_1.BadRequestException(`Query returns duplicate column name(s): ${duplicates.join(', ')}. ` +
                'A template referencing one of these would silently get whichever column the ' +
                'driver wrote last — alias them apart.');
        }
        const fields = (0, dataset_field_introspector_1.introspectFields)(descriptors, overrides);
        if (fields.length === 0) {
            throw new common_1.BadRequestException('Query returns no columns — there is nothing to bind.');
        }
        return {
            normalizedSql: validated.normalizedSql,
            fields,
            reservedParamsUsed: validated.reservedParamsUsed,
        };
    }
    async assertTokenAvailable(token, excludeId) {
        const clash = await this.prisma.reportDataset.findFirst({
            where: {
                rdsIsDeleted: false,
                rdsToken: { equals: token, mode: 'insensitive' },
                ...(excludeId ? { NOT: { rdsId: excludeId } } : {}),
            },
            select: { rdsId: true, rdsToken: true },
        });
        if (clash) {
            throw new common_1.ConflictException(`Report dataset token '${clash.rdsToken}' already exists`);
        }
    }
    normaliseParams(params = []) {
        return params.map((param) => ({
            name: param.name.trim().toLowerCase(),
            type: param.type,
            required: param.required === true,
            ...(param.label ? { label: param.label } : {}),
            ...(param.defaultValue !== undefined ? { defaultValue: param.defaultValue } : {}),
        }));
    }
    normaliseFieldOverrides(overrides = []) {
        return overrides
            .filter((entry) => typeof entry.name === 'string' && entry.name !== '')
            .map((entry) => ({
            name: String(entry.name),
            type: 'string',
            label: typeof entry.label === 'string' ? entry.label : String(entry.name),
            ...(typeof entry.format === 'string' ? { format: entry.format } : {}),
            ...(entry.complexScript === true ? { complexScript: true } : {}),
            ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
        }));
    }
    normaliseSampleRows(rows, fields) {
        if (rows === undefined || rows.length === 0) {
            return client_1.Prisma.JsonNull;
        }
        const known = new Set(fields.map((field) => field.name));
        const trimmed = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => known.has(key))));
        return trimmed;
    }
    toDefinition(row) {
        return {
            id: row.rdsId,
            token: row.rdsToken,
            label: row.rdsLabel,
            cardinality: row.rdsCardinality === 'one' ? 'one' : 'many',
            docTypes: row.rdsDocTypes,
            sql: row.rdsSql,
            params: row.rdsParams ?? [],
            fields: row.rdsFields ?? [],
            sampleRows: row.rdsSampleRows ?? null,
            maxRows: row.rdsMaxRows,
            version: row.rdsVersion,
        };
    }
    requireCompanyId() {
        const companyId = this.requestContext.getCompanyId();
        if (!companyId) {
            throw new common_1.BadRequestException('No company in the request context. A dataset is validated and previewed against a ' +
                `real company because ${Object.keys(report_dataset_types_1.RESERVED_DATASET_PARAMS)[0]} must bind to something.`);
        }
        return companyId;
    }
};
exports.ReportDatasetsService = ReportDatasetsService;
exports.ReportDatasetsService = ReportDatasetsService = ReportDatasetsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pg_service_1.PgService,
        request_context_service_1.RequestContextService,
        report_dataset_sql_validator_1.ReportDatasetSqlValidator,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        dynamic_dataset_source_1.DynamicDatasetSource])
], ReportDatasetsService);
//# sourceMappingURL=report-datasets.service.js.map