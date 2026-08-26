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
var TemplatesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplatesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const expression_validator_1 = require("../engine/expression/expression.validator");
const report_data_provider_registry_1 = require("../providers/report-data-provider.registry");
const template_definition_schema_1 = require("./dto/template-definition.schema");
const template_migration_service_1 = require("./template-migration.service");
let TemplatesService = TemplatesService_1 = class TemplatesService {
    prisma;
    requestContext;
    migration;
    providers;
    logger = new common_1.Logger(TemplatesService_1.name);
    expressionValidator = new expression_validator_1.ExpressionValidator();
    constructor(prisma, requestContext, migration, providers) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.migration = migration;
        this.providers = providers;
    }
    async list(query) {
        const includeSystem = query.includeSystem ?? true;
        const activeOnly = query.activeOnly ?? true;
        const companyId = query.ptCompanyId ?? this.contextCompanyId();
        const scope = [];
        if (companyId) {
            scope.push({ ptCompanyId: companyId });
        }
        if (includeSystem) {
            scope.push({ ptCompanyId: null });
        }
        const where = {
            ptIsDeleted: false,
            ...(activeOnly ? { ptIsActive: true } : {}),
            ...(query.ptDocType ? { ptDocType: query.ptDocType } : {}),
            ...(query.ptOutputMode ? { ptOutputMode: query.ptOutputMode } : {}),
            ...(query.ptPaperCode ? { ptPaperCode: query.ptPaperCode } : {}),
            ...(query.ptBranchId ? { ptBranchId: query.ptBranchId } : {}),
            ...(scope.length > 0 ? { OR: scope } : { ptId: '00000000-0000-0000-0000-000000000000' }),
        };
        const records = await this.prisma.printTemplate.findMany({
            where,
            orderBy: [
                { ptCompanyId: 'desc' },
                { ptDocType: 'asc' },
                { ptOutputMode: 'asc' },
                { ptPaperCode: 'asc' },
                { ptName: 'asc' },
            ],
            select: SUMMARY_SELECT,
        });
        return { items: records.map(toSummaryPayload), includeSystem };
    }
    async findOne(ptId) {
        const record = await this.prisma.printTemplate.findFirst({
            where: { ptId, ptIsDeleted: false },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Print template ${ptId} not found`);
        }
        this.assertReadable(record);
        const outcome = this.migration.migrateDefinition(record.ptDefinition);
        return {
            ...toSummaryPayload(record),
            definition: outcome.definition,
            definitionMigrated: outcome.migrated,
        };
    }
    async listRevisions(ptId) {
        await this.findOne(ptId);
        const records = await this.prisma.printTemplateRevision.findMany({
            where: { ptrTemplateId: ptId },
            orderBy: { ptrVersion: 'desc' },
            select: {
                ptrId: true,
                ptrTemplateId: true,
                ptrVersion: true,
                ptrSchemaVer: true,
                ptrNote: true,
                ptrCreatedOn: true,
                ptrCreatedBy: true,
            },
        });
        return records.map((record) => ({
            ptrId: record.ptrId,
            ptrTemplateId: record.ptrTemplateId,
            ptrVersion: record.ptrVersion,
            ptrSchemaVer: record.ptrSchemaVer,
            ptrNote: record.ptrNote,
            ptrCreatedOn: record.ptrCreatedOn.toISOString(),
            ptrCreatedBy: record.ptrCreatedBy,
        }));
    }
    async create(dto) {
        const definition = this.validateDefinition(dto.definition, {
            outputMode: dto.ptOutputMode,
        });
        const companyId = dto.ptCompanyId ?? this.contextCompanyId();
        const actor = this.actor();
        const record = await this.prisma
            .$transaction(async (transaction) => {
            if (dto.ptIsDefault) {
                await this.clearDefault(transaction, {
                    companyId,
                    branchId: dto.ptBranchId ?? null,
                    docType: dto.ptDocType,
                    outputMode: dto.ptOutputMode,
                    paperCode: dto.ptPaperCode,
                });
            }
            return transaction.printTemplate.create({
                data: {
                    ptCompanyId: companyId,
                    ptBranchId: dto.ptBranchId ?? null,
                    ptDocType: dto.ptDocType,
                    ptOutputMode: dto.ptOutputMode,
                    ptPaperCode: dto.ptPaperCode,
                    ptName: dto.ptName,
                    ptVersion: 1,
                    ptSchemaVer: definition.schemaVersion,
                    ptDefinition: definition,
                    ptIsDefault: dto.ptIsDefault ?? false,
                    ptIsActive: dto.ptIsActive ?? true,
                    ptCreatedBy: actor,
                },
            });
        })
            .catch((error) => this.rethrowWriteError(error, dto.ptName));
        this.logger.log(`Created print template ${record.ptId} (${record.ptName})`);
        return {
            ...toSummaryPayload(record),
            definition,
            definitionMigrated: false,
        };
    }
    async update(ptId, dto) {
        const existing = await this.prisma.printTemplate.findFirst({
            where: { ptId, ptIsDeleted: false },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Print template ${ptId} not found`);
        }
        this.assertWritable(existing);
        const actor = this.actor();
        const definitionSupplied = dto.definition !== undefined;
        const definition = definitionSupplied
            ? this.validateDefinition(dto.definition, {
                outputMode: existing.ptOutputMode,
            })
            : this.migration.migrateDefinition(existing.ptDefinition).definition;
        const record = await this.prisma
            .$transaction(async (transaction) => {
            if (definitionSupplied) {
                await transaction.printTemplateRevision.create({
                    data: {
                        ptrTemplateId: ptId,
                        ptrVersion: existing.ptVersion,
                        ptrSchemaVer: existing.ptSchemaVer,
                        ptrDefinition: existing.ptDefinition,
                        ptrNote: dto.note ?? null,
                        ptrCreatedBy: actor,
                    },
                });
            }
            return transaction.printTemplate.update({
                where: { ptId },
                data: {
                    ...(dto.ptName !== undefined ? { ptName: dto.ptName } : {}),
                    ...(dto.ptIsActive !== undefined ? { ptIsActive: dto.ptIsActive } : {}),
                    ...(definitionSupplied
                        ? {
                            ptDefinition: definition,
                            ptSchemaVer: definition.schemaVersion,
                            ptVersion: existing.ptVersion + 1,
                        }
                        : {}),
                    ptModifiedOn: new Date(),
                    ptModifiedBy: actor,
                },
            });
        })
            .catch((error) => this.rethrowWriteError(error, dto.ptName ?? existing.ptName));
        this.logger.log(`Updated print template ${ptId}${definitionSupplied ? ` to version ${record.ptVersion}` : ''}`);
        return { ...toSummaryPayload(record), definition, definitionMigrated: false };
    }
    async softDelete(ptId) {
        const existing = await this.prisma.printTemplate.findFirst({
            where: { ptId, ptIsDeleted: false },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Print template ${ptId} not found`);
        }
        this.assertWritable(existing);
        if (existing.ptIsDefault) {
            throw new common_1.ConflictException(`Print template ${ptId} is the default for ${existing.ptDocType}/` +
                `${existing.ptOutputMode}/${existing.ptPaperCode}. Promote another template first.`);
        }
        const cloneCount = await this.prisma.printTemplate.count({
            where: { ptParentId: ptId, ptIsDeleted: false },
        });
        if (cloneCount > 0) {
            throw new common_1.ConflictException(`Print template ${ptId} has ${cloneCount} clone(s) descended from it and cannot be deleted.`);
        }
        await this.prisma.printTemplate.update({
            where: { ptId },
            data: { ptIsDeleted: true, ptModifiedOn: new Date(), ptModifiedBy: this.actor() },
        });
        this.logger.log(`Soft-deleted print template ${ptId}`);
        return { ptId, deleted: true };
    }
    async clone(ptId, dto) {
        const source = await this.prisma.printTemplate.findFirst({
            where: { ptId, ptIsDeleted: false },
        });
        if (!source) {
            throw new common_1.NotFoundException(`Print template ${ptId} not found`);
        }
        this.assertReadable(source);
        const definition = this.migration.migrateDefinition(source.ptDefinition).definition;
        const companyId = dto.ptCompanyId ?? this.contextCompanyId();
        if (!companyId) {
            throw new common_1.BadRequestException('A clone needs an owning company. Supply ptCompanyId, or call with a company request context.');
        }
        const actor = this.actor();
        const name = dto.ptName ?? `${source.ptName} (copy)`;
        const record = await this.prisma
            .$transaction(async (transaction) => {
            if (dto.ptIsDefault) {
                await this.clearDefault(transaction, {
                    companyId,
                    branchId: dto.ptBranchId ?? null,
                    docType: source.ptDocType,
                    outputMode: source.ptOutputMode,
                    paperCode: source.ptPaperCode,
                });
            }
            return transaction.printTemplate.create({
                data: {
                    ptCompanyId: companyId,
                    ptBranchId: dto.ptBranchId ?? null,
                    ptDocType: source.ptDocType,
                    ptOutputMode: source.ptOutputMode,
                    ptPaperCode: source.ptPaperCode,
                    ptName: name,
                    ptVersion: 1,
                    ptParentId: source.ptId,
                    ptSchemaVer: definition.schemaVersion,
                    ptDefinition: definition,
                    ptIsDefault: dto.ptIsDefault ?? false,
                    ptIsActive: true,
                    ptCreatedBy: actor,
                },
            });
        })
            .catch((error) => this.rethrowWriteError(error, name));
        this.logger.log(`Cloned print template ${ptId} -> ${record.ptId}`);
        return { ...toSummaryPayload(record), definition, definitionMigrated: false };
    }
    async setDefault(ptId) {
        const existing = await this.prisma.printTemplate.findFirst({
            where: { ptId, ptIsDeleted: false },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Print template ${ptId} not found`);
        }
        this.assertReadable(existing);
        if (!existing.ptIsActive) {
            throw new common_1.ConflictException(`Print template ${ptId} is inactive and cannot be made the default.`);
        }
        const record = await this.prisma.$transaction(async (transaction) => {
            await this.clearDefault(transaction, {
                companyId: existing.ptCompanyId,
                branchId: existing.ptBranchId,
                docType: existing.ptDocType,
                outputMode: existing.ptOutputMode,
                paperCode: existing.ptPaperCode,
                exceptId: ptId,
            });
            return transaction.printTemplate.update({
                where: { ptId },
                data: { ptIsDefault: true, ptModifiedOn: new Date(), ptModifiedBy: this.actor() },
            });
        });
        return toSummaryPayload(record);
    }
    async rollback(ptId, version) {
        const existing = await this.prisma.printTemplate.findFirst({
            where: { ptId, ptIsDeleted: false },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Print template ${ptId} not found`);
        }
        this.assertWritable(existing);
        const revision = await this.prisma.printTemplateRevision.findFirst({
            where: { ptrTemplateId: ptId, ptrVersion: version },
        });
        if (!revision) {
            throw new common_1.NotFoundException(`Print template ${ptId} has no version ${version}`);
        }
        const outcome = this.migration.migrateDefinition(revision.ptrDefinition);
        const actor = this.actor();
        const record = await this.prisma.$transaction(async (transaction) => {
            await transaction.printTemplateRevision.create({
                data: {
                    ptrTemplateId: ptId,
                    ptrVersion: existing.ptVersion,
                    ptrSchemaVer: existing.ptSchemaVer,
                    ptrDefinition: existing.ptDefinition,
                    ptrNote: `superseded by rollback to v${version}`,
                    ptrCreatedBy: actor,
                },
            });
            return transaction.printTemplate.update({
                where: { ptId },
                data: {
                    ptDefinition: outcome.definition,
                    ptSchemaVer: outcome.definition.schemaVersion,
                    ptVersion: existing.ptVersion + 1,
                    ptModifiedOn: new Date(),
                    ptModifiedBy: actor,
                },
            });
        });
        this.logger.log(`Rolled print template ${ptId} back to v${version}, stored as v${record.ptVersion}`);
        return {
            ...toSummaryPayload(record),
            definition: outcome.definition,
            definitionMigrated: outcome.migrated,
        };
    }
    async export(ptId) {
        const template = await this.findOne(ptId);
        return {
            kind: 'vknex.print-template',
            exportVersion: 1,
            exportedAt: new Date().toISOString(),
            name: template.ptName,
            docType: template.ptDocType,
            outputMode: template.ptOutputMode,
            paperCode: template.ptPaperCode,
            schemaVersion: template.definition.schemaVersion,
            definition: template.definition,
        };
    }
    async import(dto) {
        const payload = dto.payload;
        if (payload.kind !== 'vknex.print-template') {
            throw new common_1.BadRequestException("This is not a VK Nex print template export (expected kind 'vknex.print-template').");
        }
        const docType = asNonEmptyString(payload.docType, 'docType');
        const outputMode = asNonEmptyString(payload.outputMode, 'outputMode');
        const paperCode = asNonEmptyString(payload.paperCode, 'paperCode');
        const name = dto.ptName ?? asNonEmptyString(payload.name, 'name');
        if (payload.definition === null || typeof payload.definition !== 'object') {
            throw new common_1.BadRequestException('The export carries no definition object.');
        }
        const migrated = this.migration.migrateDefinition(payload.definition);
        const definition = this.validateDefinition(migrated.definition, { outputMode });
        return this.create({
            ptDocType: docType.toUpperCase(),
            ptOutputMode: outputMode.toUpperCase(),
            ptPaperCode: paperCode.toUpperCase(),
            ptName: name,
            ptCompanyId: dto.ptCompanyId,
            ptBranchId: dto.ptBranchId,
            ptIsDefault: false,
            ptIsActive: true,
            definition: definition,
        });
    }
    async resolveForPrint(request) {
        const { docType, outputMode, paperCode, companyId, branchId, templateId } = request;
        if (templateId) {
            const explicit = await this.prisma.printTemplate.findFirst({
                where: { ptId: templateId, ptIsDeleted: false, ptIsActive: true },
            });
            if (!explicit) {
                throw new common_1.NotFoundException(`Print template ${templateId} not found or inactive`);
            }
            if (explicit.ptCompanyId !== null && explicit.ptCompanyId !== companyId) {
                throw new common_1.ForbiddenException(`Print template ${templateId} belongs to another company`);
            }
            return this.toResolved(explicit, 'EXPLICIT');
        }
        const candidates = [];
        if (branchId) {
            candidates.push({
                where: { ptCompanyId: companyId, ptBranchId: branchId },
                source: 'BRANCH_DEFAULT',
            });
        }
        candidates.push({
            where: { ptCompanyId: companyId, ptBranchId: null },
            source: 'COMPANY_DEFAULT',
        });
        candidates.push({ where: { ptCompanyId: null }, source: 'SYSTEM_DEFAULT' });
        for (const candidate of candidates) {
            const found = await this.prisma.printTemplate.findFirst({
                where: {
                    ...candidate.where,
                    ptDocType: docType,
                    ptOutputMode: outputMode,
                    ptPaperCode: paperCode,
                    ptIsDefault: true,
                    ptIsActive: true,
                    ptIsDeleted: false,
                },
            });
            if (found) {
                return this.toResolved(found, candidate.source);
            }
        }
        throw new common_1.NotFoundException(`No template configured for ${docType} / ${outputMode} / ${paperCode}. ` +
            'Seed the template gallery, or create a template and mark it default.');
    }
    validateDefinition(raw, context = {}) {
        let definition;
        try {
            definition = this.migration.validate(raw);
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : String(error));
        }
        const problems = [];
        if (context.outputMode) {
            if (!template_definition_schema_1.OUTPUT_MODES.includes(context.outputMode)) {
                problems.push(`unknown output mode '${context.outputMode}' (expected ${template_definition_schema_1.OUTPUT_MODES.join(', ')})`);
            }
            const expectedLayout = context.outputMode === 'ESCPOS' || context.outputMode === 'ESCP_DOTMATRIX'
                ? 'GRID'
                : 'GRAPHIC';
            if (definition.layoutMode !== expectedLayout) {
                problems.push(`output mode ${context.outputMode} requires layoutMode ${expectedLayout}, ` +
                    `but the definition declares ${definition.layoutMode} ` +
                    `(valid modes: ${template_definition_schema_1.LAYOUT_MODES.join(', ')})`);
            }
        }
        for (const dataset of definition.datasets) {
            if (!this.providers.has(dataset.provider)) {
                problems.push(`dataset '${dataset.name}' names unknown provider '${dataset.provider}'. ` +
                    `Registered: ${this.providers.listTokens().join(', ')}`);
            }
        }
        const allowedRoots = (0, expression_validator_1.buildAllowedRoots)(definition.datasets.map((dataset) => dataset.name));
        for (const [bandIndex, band] of definition.bands.entries()) {
            const bandPath = `bands[${bandIndex}]`;
            for (const issue of this.expressionValidator.validateTemplateString(band.visible, `${bandPath}.visible`, allowedRoots)) {
                problems.push(`${issue.path}: ${issue.message}`);
            }
            for (const issue of this.expressionValidator.validateTemplateString(band.groupBy, `${bandPath}.groupBy`, allowedRoots)) {
                problems.push(`${issue.path}: ${issue.message}`);
            }
            for (const [elementIndex, element] of band.elements.entries()) {
                const path = `${bandPath}.elements[${elementIndex}]`;
                const strings = [
                    ['visible', element.visible],
                    ['style.color', element.style?.color],
                    ['style.fill', element.style?.fill],
                    ['style.stroke', element.style?.stroke],
                ];
                if ((0, template_definition_schema_1.isTextLike)(element)) {
                    strings.push(['value', element.value]);
                    if (element.kind === 'FIELD' && element.aggregate?.over) {
                        strings.push(['aggregate.over', element.aggregate.over]);
                    }
                }
                else if (element.kind === 'IMAGE') {
                    strings.push(['source', element.source]);
                }
                else if (element.kind === 'BARCODE' || element.kind === 'QRCODE') {
                    strings.push(['value', element.value]);
                }
                else if (element.kind === 'PAGEBREAK') {
                    strings.push(['when', element.when]);
                }
                for (const [field, template] of strings) {
                    for (const issue of this.expressionValidator.validateTemplateString(template, `${path}.${field}`, allowedRoots)) {
                        problems.push(`${issue.path}: ${issue.message}`);
                    }
                }
            }
        }
        if (problems.length > 0) {
            throw new common_1.BadRequestException({
                message: 'Template definition is not valid',
                errors: problems.slice(0, 40),
                errorCount: problems.length,
            });
        }
        return definition;
    }
    toResolved(record, source) {
        const outcome = this.migration.migrateDefinition(record.ptDefinition);
        return {
            ptId: record.ptId,
            name: record.ptName,
            version: record.ptVersion,
            outputMode: record.ptOutputMode,
            paperCode: record.ptPaperCode,
            definition: outcome.definition,
            source,
        };
    }
    async clearDefault(transaction, scope) {
        await transaction.printTemplate.updateMany({
            where: {
                ptCompanyId: scope.companyId,
                ptBranchId: scope.branchId,
                ptDocType: scope.docType,
                ptOutputMode: scope.outputMode,
                ptPaperCode: scope.paperCode,
                ptIsDefault: true,
                ptIsDeleted: false,
                ...(scope.exceptId ? { ptId: { not: scope.exceptId } } : {}),
            },
            data: { ptIsDefault: false },
        });
    }
    assertReadable(record) {
        const companyId = this.contextCompanyId();
        if (!companyId || record.ptCompanyId === null || record.ptCompanyId === companyId) {
            return;
        }
        throw new common_1.ForbiddenException(`Print template ${record.ptId} belongs to another company`);
    }
    assertWritable(record) {
        if (record.ptCompanyId === null) {
            throw new common_1.ForbiddenException(`Print template ${record.ptId} is a system template and cannot be edited. ` +
                'Clone it first, then edit the clone.');
        }
        this.assertReadable(record);
    }
    contextCompanyId() {
        return this.requestContext.getCompanyId();
    }
    actor() {
        const userId = this.requestContext.getUserId();
        return userId && UUID_PATTERN.test(userId) ? userId : null;
    }
    rethrowWriteError(error, name) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const rawTarget = error.meta?.target;
            const target = Array.isArray(rawTarget)
                ? rawTarget.join(',')
                : typeof rawTarget === 'string'
                    ? rawTarget
                    : '';
            if (target.includes('ux_pt_default')) {
                throw new common_1.ConflictException('Another template is already the default for this document type, output mode and paper.');
            }
            if (target.includes('ux_pt_name')) {
                throw new common_1.ConflictException(`A template named '${name}' already exists in this scope.`);
            }
            throw new common_1.ConflictException(`Template '${name}' conflicts with an existing record.`);
        }
        throw error;
    }
};
exports.TemplatesService = TemplatesService;
exports.TemplatesService = TemplatesService = TemplatesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        template_migration_service_1.TemplateMigrationService,
        report_data_provider_registry_1.ReportDataProviderRegistry])
], TemplatesService);
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const SUMMARY_SELECT = {
    ptId: true,
    ptCompanyId: true,
    ptBranchId: true,
    ptDocType: true,
    ptOutputMode: true,
    ptPaperCode: true,
    ptName: true,
    ptVersion: true,
    ptParentId: true,
    ptSchemaVer: true,
    ptIsDefault: true,
    ptIsActive: true,
    ptCreatedOn: true,
    ptCreatedBy: true,
    ptModifiedOn: true,
    ptModifiedBy: true,
};
const toSummaryPayload = (record) => ({
    ptId: record.ptId,
    ptCompanyId: record.ptCompanyId,
    ptBranchId: record.ptBranchId,
    ptDocType: record.ptDocType,
    ptOutputMode: record.ptOutputMode,
    ptPaperCode: record.ptPaperCode,
    ptName: record.ptName,
    ptVersion: record.ptVersion,
    ptParentId: record.ptParentId,
    ptSchemaVer: record.ptSchemaVer,
    ptIsDefault: record.ptIsDefault,
    ptIsActive: record.ptIsActive,
    isSystemTemplate: record.ptCompanyId === null,
    ptCreatedOn: record.ptCreatedOn.toISOString(),
    ptCreatedBy: record.ptCreatedBy,
    ptModifiedOn: record.ptModifiedOn?.toISOString() ?? null,
    ptModifiedBy: record.ptModifiedBy,
});
const asNonEmptyString = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new common_1.BadRequestException(`The export is missing '${field}'.`);
    }
    return value.trim();
};
//# sourceMappingURL=templates.service.js.map