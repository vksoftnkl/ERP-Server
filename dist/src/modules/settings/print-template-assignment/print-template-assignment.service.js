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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintTemplateAssignmentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const print_template_assignment_constants_1 = require("./print-template-assignment.constants");
const PTA_RELATIONS = {
    company: { select: { compName: true } },
    branch: { select: { brName: true } },
    device: { select: { devDeviceName: true } },
    purpose: { select: { ppoCode: true, ppoName: true, ppoCopyCount: true, ppoCopyLabels: true } },
    template: { select: { ptlCode: true, ptlName: true, ptlPublishedRevId: true } },
    printer: { select: { prfName: true } },
};
const PTA_TABLE_NAME = 'print template assignments';
const PTA_AUDIT_SCREEN_NAME = 'Print Template Assignments';
const PTA_OPTIONAL_FIELDS = [
    'ptaCompanyId',
    'ptaBranchId',
    'ptaDeviceId',
    'ptaPurposeId',
    'ptaTemplateId',
    'ptaOutputMode',
    'ptaPrinterId',
    'ptaPrinterName',
    'ptaCopies',
    'ptaRemarks',
    'ptaIsActive',
];
function toUserRef(actor) {
    if (!actor || actor === module_service_utils_1.DEFAULT_ACTOR)
        return null;
    return actor;
}
function checkConstraintName(error) {
    if (typeof error !== 'object' || error === null || !('message' in error))
        return null;
    const { message } = error;
    if (typeof message !== 'string' || !message.includes('23514'))
        return null;
    const named = /ck_pta_[a-z_]+/.exec(message);
    return named ? named[0] : 'ck_pta_unknown';
}
let PrintTemplateAssignmentService = class PrintTemplateAssignmentService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(dto) {
        if (dto.ptaId) {
            return this.updateAssignment(dto);
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.createAssignment(dto, userId);
    }
    async createAssignment(dto, userId) {
        if (!(0, module_service_utils_1.hasOwnProperty)(dto, 'ptaCompanyId')) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid assignment scope', [
                {
                    field: 'ptaCompanyId',
                    message: 'State the company this assignment is for. Send null explicitly to make it the default for EVERY company — which only a shipped design may be.',
                },
            ]);
        }
        const companyId = dto.ptaCompanyId ?? null;
        const branchId = dto.ptaBranchId ?? null;
        const deviceId = dto.ptaDeviceId ?? null;
        const printerId = dto.ptaPrinterId ?? null;
        const printerName = dto.ptaPrinterName ?? null;
        this.assertScopeLadder(companyId, branchId, deviceId);
        this.assertPrinterOneOf(printerId, printerName);
        const actor = (0, module_service_utils_1.resolveActor)(dto.ptaCreatedBy, userId);
        const now = new Date();
        const isDeleted = dto.ptaIsActive === false;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const templateCompanyKey = await this.resolveTemplateCompanyKey(tx, dto.ptaTemplateId, companyId);
                const data = {
                    ptaCompanyId: companyId,
                    ptaBranchId: branchId,
                    ptaDeviceId: deviceId,
                    ptaPurposeId: dto.ptaPurposeId,
                    ptaTemplateId: dto.ptaTemplateId,
                    ptaTemplateCompanyKey: templateCompanyKey,
                    ptaOutputMode: dto.ptaOutputMode ?? print_template_assignment_constants_1.PTA_DEFAULT_OUTPUT_MODE,
                    ptaPrinterId: printerId,
                    ptaPrinterName: printerName,
                    ptaCopies: dto.ptaCopies ?? null,
                    ptaRemarks: dto.ptaRemarks ?? null,
                    ptaIsActive: !isDeleted,
                    ptaIsDeleted: isDeleted,
                    ptaCreatedOn: now,
                    ptaCreatedBy: toUserRef(actor),
                    ptaModifiedOn: now,
                    ptaModifiedBy: toUserRef(actor),
                };
                const created = await tx.printTemplateAssignment.create({
                    data,
                    include: PTA_RELATIONS,
                });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: PTA_TABLE_NAME,
                    screenName: PTA_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.ptaId,
                    displayName: this.displayName(payload),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'Print template assignment created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async getById(ptaId) {
        const record = await this.prisma.printTemplateAssignment.findFirst({
            where: { ptaId, ptaIsDeleted: false },
            include: PTA_RELATIONS,
        });
        if (!record) {
            (0, module_service_utils_1.throwSettingsNotFound)('Print template assignment not found', 'ptaId', `No active print template assignment found with id ${ptaId}`);
        }
        return this.toPayload(record);
    }
    async list(queryDto) {
        const page = queryDto.page ?? module_service_utils_1.DEFAULT_PAGE;
        const limit = queryDto.limit ?? module_service_utils_1.DEFAULT_LIMIT;
        const skip = (page - 1) * limit;
        const where = { ptaIsDeleted: false };
        if (queryDto.globalOnly) {
            where.ptaCompanyId = null;
        }
        else if (queryDto.ptaCompanyId && queryDto.includeGlobal) {
            where.OR = [{ ptaCompanyId: queryDto.ptaCompanyId }, { ptaCompanyId: null }];
        }
        else if (queryDto.ptaCompanyId) {
            where.ptaCompanyId = queryDto.ptaCompanyId;
        }
        if (queryDto.ptaBranchId)
            where.ptaBranchId = queryDto.ptaBranchId;
        if (queryDto.ptaDeviceId)
            where.ptaDeviceId = queryDto.ptaDeviceId;
        if (queryDto.ptaPurposeId)
            where.ptaPurposeId = queryDto.ptaPurposeId;
        if (queryDto.ptaTemplateId)
            where.ptaTemplateId = queryDto.ptaTemplateId;
        if (queryDto.ptaOutputMode)
            where.ptaOutputMode = queryDto.ptaOutputMode;
        if (queryDto.ptaIsActive !== undefined)
            where.ptaIsActive = queryDto.ptaIsActive;
        if (queryDto.search) {
            const search = queryDto.search;
            const searchOr = [
                { template: { ptlCode: { contains: search, mode: 'insensitive' } } },
                { template: { ptlName: { contains: search, mode: 'insensitive' } } },
                { purpose: { ppoCode: { contains: search, mode: 'insensitive' } } },
                { purpose: { ppoName: { contains: search, mode: 'insensitive' } } },
                { ptaPrinterName: { contains: search, mode: 'insensitive' } },
                { ptaRemarks: { contains: search, mode: 'insensitive' } },
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: searchOr }];
                delete where.OR;
            }
            else {
                where.OR = searchOr;
            }
        }
        const [items, total] = await this.prisma.$transaction([
            this.prisma.printTemplateAssignment.findMany({
                where,
                include: PTA_RELATIONS,
                orderBy: [{ ptaSpecificity: 'desc' }, { ptaCreatedOn: 'desc' }],
                skip,
                take: limit,
            }),
            this.prisma.printTemplateAssignment.count({ where }),
        ]);
        return { items: items.map((item) => this.toPayload(item)), page, limit, total };
    }
    async resolve(queryDto) {
        const outputMode = queryDto.outputMode ?? print_template_assignment_constants_1.PTA_DEFAULT_OUTPUT_MODE;
        const branchId = queryDto.branchId ?? null;
        const deviceId = queryDto.deviceId ?? null;
        const winner = await this.prisma.printTemplateAssignment.findFirst({
            where: {
                ptaPurposeId: queryDto.purposeId,
                ptaOutputMode: outputMode,
                ptaIsActive: true,
                ptaIsDeleted: false,
                AND: [
                    { OR: [{ ptaCompanyId: null }, { ptaCompanyId: queryDto.companyId }] },
                    { OR: [{ ptaBranchId: null }, ...(branchId ? [{ ptaBranchId: branchId }] : [])] },
                    { OR: [{ ptaDeviceId: null }, ...(deviceId ? [{ ptaDeviceId: deviceId }] : [])] },
                ],
            },
            include: PTA_RELATIONS,
            orderBy: [{ ptaSpecificity: 'desc' }, { ptaCreatedOn: 'desc' }],
        });
        if (!winner) {
            (0, module_service_utils_1.throwSettingsNotFound)('No print template assigned for this scope', 'purposeId', `No active assignment resolves for company ${queryDto.companyId}, purpose ${queryDto.purposeId}, output mode ${outputMode} — not at the counter, the branch, the company, nor as an every-company default`);
        }
        const copies = winner.ptaCopies ?? winner.purpose?.ppoCopyCount ?? 1;
        const copyLabels = (winner.purpose?.ppoCopyLabels ?? '')
            .split(',')
            .map((label) => label.trim())
            .filter((label) => label.length > 0);
        const printerSource = winner.ptaPrinterId
            ? 'PROFILE'
            : winner.ptaPrinterName
                ? 'NAME'
                : 'DEFAULT';
        return {
            ptaId: winner.ptaId,
            ptaSpecificity: winner.ptaSpecificity,
            scope: this.toScope(winner.ptaSpecificity),
            ptaTemplateId: winner.ptaTemplateId,
            ptaTemplateCode: winner.template?.ptlCode ?? null,
            ptaTemplateName: winner.template?.ptlName ?? null,
            ptaTemplateIsShipped: winner.ptaTemplateCompanyKey === print_template_assignment_constants_1.PTA_SHIPPED_TEMPLATE_KEY,
            publishedRevId: winner.template?.ptlPublishedRevId ?? null,
            ptaPrinterId: winner.ptaPrinterId,
            ptaPrinterName: printerSource === 'PROFILE' ? (winner.printer?.prfName ?? null) : winner.ptaPrinterName,
            printerSource,
            ptaOutputMode: winner.ptaOutputMode,
            copies,
            copyLabels,
        };
    }
    async softDelete(ptaId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.printTemplateAssignment.findFirst({
                where: { ptaId, ptaIsDeleted: false },
                include: PTA_RELATIONS,
            });
            if (!existing) {
                (0, module_service_utils_1.throwSettingsNotFound)('Print template assignment not found', 'ptaId', `No active print template assignment found with id ${ptaId}`);
            }
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const modifiedOn = new Date();
            const result = await tx.printTemplateAssignment.updateMany({
                where: { ptaId, ptaIsDeleted: false },
                data: {
                    ptaIsDeleted: true,
                    ptaIsActive: false,
                    ptaModifiedOn: modifiedOn,
                    ptaModifiedBy: toUserRef(actor),
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSettingsNotFound)('Print template assignment not found', 'ptaId', `No active print template assignment found with id ${ptaId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                ptaIsDeleted: true,
                ptaIsActive: false,
                ptaModifiedOn: modifiedOn,
                ptaModifiedBy: toUserRef(actor),
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: PTA_TABLE_NAME,
                screenName: PTA_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: ptaId,
                displayName: this.displayName(originalRecord),
                originalRecord,
                modifiedRecord,
                userId: actor,
                notes: 'Print template assignment soft deleted',
            }, tx);
            return { ptaId, deleted: true };
        });
    }
    async updateAssignment(dto) {
        const ptaId = dto.ptaId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.printTemplateAssignment.findFirst({
                    where: { ptaId, ptaIsDeleted: false },
                    include: PTA_RELATIONS,
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSettingsNotFound)('Print template assignment not found', 'ptaId', `No active print template assignment found with id ${ptaId}`);
                }
                const merged = {
                    companyId: (0, module_service_utils_1.hasOwnProperty)(dto, 'ptaCompanyId')
                        ? (dto.ptaCompanyId ?? null)
                        : existing.ptaCompanyId,
                    branchId: (0, module_service_utils_1.hasOwnProperty)(dto, 'ptaBranchId')
                        ? (dto.ptaBranchId ?? null)
                        : existing.ptaBranchId,
                    deviceId: (0, module_service_utils_1.hasOwnProperty)(dto, 'ptaDeviceId')
                        ? (dto.ptaDeviceId ?? null)
                        : existing.ptaDeviceId,
                    printerId: (0, module_service_utils_1.hasOwnProperty)(dto, 'ptaPrinterId')
                        ? (dto.ptaPrinterId ?? null)
                        : existing.ptaPrinterId,
                    printerName: (0, module_service_utils_1.hasOwnProperty)(dto, 'ptaPrinterName')
                        ? (dto.ptaPrinterName ?? null)
                        : existing.ptaPrinterName,
                    templateId: dto.ptaTemplateId ?? existing.ptaTemplateId,
                };
                this.assertScopeLadder(merged.companyId, merged.branchId, merged.deviceId);
                this.assertPrinterOneOf(merged.printerId, merged.printerName);
                const data = {
                    ptaModifiedOn: new Date(),
                    ptaModifiedBy: toUserRef((0, module_service_utils_1.resolveActor)(dto.ptaModifiedBy, this.requestContextService.getUserId())),
                };
                (0, module_service_utils_1.applyPresentFields)(data, dto, PTA_OPTIONAL_FIELDS);
                data.ptaTemplateCompanyKey = await this.resolveTemplateCompanyKey(tx, merged.templateId, merged.companyId);
                const updated = await tx.printTemplateAssignment.update({
                    where: { ptaId },
                    data,
                    include: PTA_RELATIONS,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: PTA_TABLE_NAME,
                    screenName: PTA_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: ptaId,
                    displayName: this.displayName(payload),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.ptaModifiedBy ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Print template assignment updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async resolveTemplateCompanyKey(tx, templateId, companyId) {
        const template = await tx.printTemplate.findFirst({
            where: { ptlId: templateId, ptlIsDeleted: false },
            select: { ptlCode: true, ptlCompanyId: true, ptlCompanyKey: true },
        });
        if (!template) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid relation reference', [
                {
                    field: 'ptaTemplateId',
                    message: `No active print template found with id ${templateId}`,
                },
            ]);
        }
        const templateKey = template.ptlCompanyKey ?? template.ptlCompanyId ?? print_template_assignment_constants_1.PTA_SHIPPED_TEMPLATE_KEY;
        const scopeKey = companyId ?? print_template_assignment_constants_1.PTA_SHIPPED_TEMPLATE_KEY;
        if (templateKey !== print_template_assignment_constants_1.PTA_SHIPPED_TEMPLATE_KEY && templateKey !== scopeKey) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid assignment scope', [
                {
                    field: 'ptaTemplateId',
                    message: companyId === null
                        ? `An assignment for EVERY company may only name a design that ships with the product. Template ${template.ptlCode} is private to company ${templateKey} — every other company's till would otherwise render it.`
                        : `Template ${template.ptlCode} is private to company ${templateKey} and cannot be assigned by company ${companyId}. Fork it first, then assign the fork.`,
                },
            ]);
        }
        return templateKey;
    }
    assertScopeLadder(companyId, branchId, deviceId) {
        if (deviceId && !branchId) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid assignment scope', [
                {
                    field: 'ptaBranchId',
                    message: 'A counter-scoped assignment must also name its branch: a counter belongs to a branch, so a device row with no branch is a rung of the ladder nobody can reach.',
                },
            ]);
        }
        if (branchId && !companyId) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid assignment scope', [
                {
                    field: 'ptaCompanyId',
                    message: 'A branch-scoped assignment must also name its company: a branch belongs to a company, so an every-company row that names a branch is a rung of the ladder nobody can reach.',
                },
            ]);
        }
    }
    assertPrinterOneOf(printerId, printerName) {
        if (printerId && printerName) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid printer selection', [
                {
                    field: 'ptaPrinterName',
                    message: 'Give the registered profile OR the bare queue name, not both. The bare name is a fallback for a printer nobody has registered — it is never a copy of a profile name, because it goes stale the day the profile is renamed.',
                },
            ]);
        }
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'An assignment already exists for this scope', [
            {
                field: 'ptaPurposeId',
                message: "One choice per (company, branch, counter, purpose, output mode) — and the every-company row counts as its own scope. Update the existing assignment instead of adding a second: default-ness is the row's existence, so there is no flag to clear.",
            },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid relation reference', [
                {
                    field: 'request',
                    message: 'Referenced company, branch, counter, purpose, template or printer profile does not exist',
                },
            ]);
        }
        const constraint = checkConstraintName(error);
        if (constraint) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid assignment', [
                {
                    field: 'request',
                    message: `The database refused this row: ${constraint}`,
                },
            ]);
        }
    }
    displayName(payload) {
        const purpose = payload.ptaPurposeCode ?? payload.ptaPurposeId;
        const template = payload.ptaTemplateCode ?? payload.ptaTemplateId;
        return `${payload.ptaScope}: ${purpose} -> ${template} (${payload.ptaOutputMode})`;
    }
    toScope(specificity) {
        return (print_template_assignment_constants_1.PTA_SCOPE_BY_SPECIFICITY[specificity] ?? 'GLOBAL');
    }
    toPayload(record) {
        return {
            ptaId: record.ptaId,
            ptaCompanyId: record.ptaCompanyId,
            ptaCompanyName: 'company' in record ? (record.company?.compName ?? null) : null,
            ptaBranchId: record.ptaBranchId,
            ptaBranchName: 'branch' in record ? (record.branch?.brName ?? null) : null,
            ptaDeviceId: record.ptaDeviceId,
            ptaDeviceName: 'device' in record ? (record.device?.devDeviceName ?? null) : null,
            ptaPurposeId: record.ptaPurposeId,
            ptaPurposeCode: 'purpose' in record ? (record.purpose?.ppoCode ?? null) : null,
            ptaPurposeName: 'purpose' in record ? (record.purpose?.ppoName ?? null) : null,
            ptaTemplateId: record.ptaTemplateId,
            ptaTemplateCode: 'template' in record ? (record.template?.ptlCode ?? null) : null,
            ptaTemplateName: 'template' in record ? (record.template?.ptlName ?? null) : null,
            ptaTemplateCompanyKey: record.ptaTemplateCompanyKey,
            ptaTemplateIsShipped: record.ptaTemplateCompanyKey === print_template_assignment_constants_1.PTA_SHIPPED_TEMPLATE_KEY,
            ptaOutputMode: record.ptaOutputMode,
            ptaPrinterId: record.ptaPrinterId,
            ptaPrinterName: record.ptaPrinterName,
            ptaPrinterProfileName: 'printer' in record ? (record.printer?.prfName ?? null) : null,
            ptaCopies: record.ptaCopies,
            ptaSpecificity: record.ptaSpecificity,
            ptaScope: this.toScope(record.ptaSpecificity),
            ptaRemarks: record.ptaRemarks,
            ptaIsActive: record.ptaIsActive,
            ptaIsDeleted: record.ptaIsDeleted,
            ptaSyncDate: record.ptaSyncDate ? record.ptaSyncDate.toISOString() : null,
            ptaCreatedOn: record.ptaCreatedOn.toISOString(),
            ptaCreatedBy: record.ptaCreatedBy,
            ptaModifiedOn: record.ptaModifiedOn ? record.ptaModifiedOn.toISOString() : null,
            ptaModifiedBy: record.ptaModifiedBy,
        };
    }
};
exports.PrintTemplateAssignmentService = PrintTemplateAssignmentService;
exports.PrintTemplateAssignmentService = PrintTemplateAssignmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], PrintTemplateAssignmentService);
//# sourceMappingURL=print-template-assignment.service.js.map