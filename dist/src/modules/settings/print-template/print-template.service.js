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
exports.PrintTemplateService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const print_template_constants_1 = require("./print-template.constants");
const print_template_invariants_1 = require("./utils/print-template-invariants");
const print_template_utils_1 = require("./utils/print-template.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const TEMPLATE_TABLE_NAME = 'print template';
const VERSION_TABLE_NAME = 'print template version';
const DATASET_TABLE_NAME = 'print template dataset';
let PrintTemplateService = class PrintTemplateService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async getTemplateById(ptlId, includeDeletedVersions = false) {
        const template = await this.findTemplate(this.prisma, ptlId, includeDeletedVersions);
        if (!template) {
            this.throwNotFound('ptlId', ptlId, 'Print template not found');
        }
        return (0, print_template_utils_1.toTemplatePayload)(template);
    }
    async listTemplates(query) {
        const page = query.page ?? module_service_utils_1.DEFAULT_PAGE;
        const limit = query.limit ?? module_service_utils_1.DEFAULT_LIMIT;
        const includeVersions = query.includeVersions ?? true;
        const where = { ptlIsDeleted: false };
        if (query.ptlCompanyId) {
            if (query.onlyOwned) {
                where.ptlCompanyId = query.ptlCompanyId;
            }
            else {
                where.OR = [{ ptlCompanyId: query.ptlCompanyId }, { ptlCompanyId: null }];
            }
        }
        if (query.ptlPurposeId) {
            where.ptlPurposeId = query.ptlPurposeId;
        }
        if (query.ptlIsActive !== undefined) {
            where.ptlIsActive = query.ptlIsActive;
        }
        if (query.isPublished !== undefined) {
            where.ptlPublishedRevId = query.isPublished ? { not: null } : null;
        }
        if (query.engine) {
            where.publishedRev = { ptvEngine: query.engine };
        }
        if (query.search) {
            const search = query.search.trim();
            where.AND = [
                {
                    OR: [
                        { ptlCode: { contains: search, mode: 'insensitive' } },
                        { ptlName: { contains: search, mode: 'insensitive' } },
                    ],
                },
            ];
        }
        const [rows, total] = await Promise.all([
            this.prisma.printTemplate.findMany({
                where,
                orderBy: [{ ptlSortOrder: 'asc' }, { ptlCode: 'asc' }, { ptlId: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
                include: includeVersions
                    ? print_template_utils_1.TEMPLATE_INCLUDE
                    : {
                        company: print_template_utils_1.TEMPLATE_INCLUDE.company,
                        purpose: print_template_utils_1.TEMPLATE_INCLUDE.purpose,
                        forkedFrom: print_template_utils_1.TEMPLATE_INCLUDE.forkedFrom,
                        publishedRev: print_template_utils_1.TEMPLATE_INCLUDE.publishedRev,
                    },
            }),
            this.prisma.printTemplate.count({ where }),
        ]);
        return {
            items: rows.map((row) => (0, print_template_utils_1.toTemplatePayload)(row)),
            page,
            limit,
            total,
            total_pages: total === 0 ? 0 : Math.ceil(total / limit),
        };
    }
    async saveTemplate(dto) {
        return this.prisma
            .$transaction(async (tx) => {
            const existing = dto.ptlId ? await this.findTemplate(tx, dto.ptlId, true) : null;
            if (dto.ptlId && !existing) {
                this.throwNotFound('ptlId', dto.ptlId, 'Print template not found');
            }
            const errors = [];
            const header = this.planHeader(existing, dto, errors);
            const versionPlans = this.planVersions(existing, dto.versions, errors);
            const pointer = this.planPointer(existing, dto, versionPlans, errors);
            if (errors.length > 0) {
                this.throwBadRequest('Validation failed', errors);
            }
            await this.assertCodeIsFree(tx, header.effective.companyId, header.effective.ptlCode, existing?.ptlId ?? null);
            const template = existing
                ? await tx.printTemplate.update({
                    where: { ptlId: existing.ptlId },
                    data: header.update,
                })
                : await tx.printTemplate.create({ data: header.create });
            if (!existing) {
                await this.audit(tx, 'insert', TEMPLATE_TABLE_NAME, template.ptlId, template.ptlName, null, (0, print_template_utils_1.toTemplatePayload)(template), 'Print template created');
            }
            const publishedRevId = await this.applyVersionPlans(tx, template, versionPlans);
            await this.applyPointer(tx, template, pointer, publishedRevId, versionPlans);
            const after = await this.findTemplate(tx, template.ptlId, true);
            if (existing) {
                await this.audit(tx, 'update', TEMPLATE_TABLE_NAME, template.ptlId, template.ptlName, (0, print_template_utils_1.toTemplatePayload)(existing), after ? (0, print_template_utils_1.toTemplatePayload)(after) : null, 'Print template updated');
            }
            return after ? (0, print_template_utils_1.toTemplatePayload)(after) : (0, print_template_utils_1.toTemplatePayload)(template);
        })
            .catch((error) => {
            (0, print_template_utils_1.handlePrintTemplateWriteError)(error);
            throw error;
        });
    }
    async softDeleteTemplate(ptlId, modifiedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await this.findTemplate(tx, ptlId, true);
            if (!existing) {
                this.throwNotFound('ptlId', ptlId, 'Print template not found');
            }
            await this.assertNotAssigned(tx, ptlId);
            const modifiedOn = new Date();
            const actor = this.resolveWriteActor(modifiedBy);
            const versionIds = existing.versions.map((version) => version.ptvId);
            const updated = await tx.printTemplate.update({
                where: { ptlId },
                data: {
                    ptlIsDeleted: true,
                    ptlIsActive: false,
                    ptlModifiedOn: modifiedOn,
                    ptlModifiedBy: actor,
                },
            });
            if (versionIds.length > 0) {
                await tx.printTemplateDataset.updateMany({
                    where: { ptdVersionId: { in: versionIds }, ptdIsDeleted: false },
                    data: { ptdIsDeleted: true, ptdModifiedOn: modifiedOn, ptdModifiedBy: actor },
                });
                await tx.printTemplateVersion.updateMany({
                    where: { ptvTemplateId: ptlId, ptvIsDeleted: false },
                    data: { ptvIsDeleted: true, ptvModifiedOn: modifiedOn, ptvModifiedBy: actor },
                });
            }
            await this.audit(tx, 'cancel', TEMPLATE_TABLE_NAME, ptlId, existing.ptlName, (0, print_template_utils_1.toTemplatePayload)(existing), (0, print_template_utils_1.toTemplatePayload)(updated), 'Print template soft deleted with every revision and dataset');
            return { deleted: true, ptlId };
        });
    }
    planHeader(existing, dto, errors) {
        const companyId = (0, module_service_utils_1.hasOwnProperty)(dto, 'ptlCompanyId')
            ? (dto.ptlCompanyId ?? null)
            : (existing?.ptlCompanyId ?? null);
        const purposeId = dto.ptlPurposeId ?? existing?.ptlPurposeId ?? '';
        const code = dto.ptlCode ?? existing?.ptlCode ?? '';
        const name = dto.ptlName ?? existing?.ptlName ?? '';
        if (!existing) {
            if (!purposeId) {
                errors.push({ field: 'ptlPurposeId', message: 'ptlPurposeId is required' });
            }
            if (!code) {
                errors.push({ field: 'ptlCode', message: 'ptlCode is required' });
            }
            if (!name) {
                errors.push({ field: 'ptlName', message: 'ptlName is required' });
            }
        }
        const forkedFromId = (0, module_service_utils_1.hasOwnProperty)(dto, 'ptlForkedFromId')
            ? (dto.ptlForkedFromId ?? null)
            : (existing?.ptlForkedFromId ?? null);
        const forkedFromRev = (0, module_service_utils_1.hasOwnProperty)(dto, 'ptlForkedFromRev')
            ? (dto.ptlForkedFromRev ?? null)
            : (existing?.ptlForkedFromRev ?? null);
        const sortOrder = dto.ptlSortOrder ?? existing?.ptlSortOrder ?? 100;
        const effective = {
            ptlId: existing?.ptlId ?? null,
            ptlCode: code,
            ptlSortOrder: sortOrder,
            ptlForkedFromId: forkedFromId,
            ptlForkedFromRev: forkedFromRev,
            companyId,
        };
        errors.push(...(0, print_template_invariants_1.collectTemplateInvariantErrors)(effective));
        const create = {
            ptlCompanyId: companyId,
            ptlPurposeId: purposeId,
            ptlCode: code,
            ptlName: name,
            ptlDescription: (0, module_service_utils_1.normalizeNullableString)(dto.ptlDescription) ?? null,
            ptlForkedFromId: forkedFromId,
            ptlForkedFromRev: forkedFromRev,
            ptlSortOrder: sortOrder,
            ptlIsActive: dto.ptlIsActive ?? true,
            ptlCreatedBy: this.resolveWriteActor(dto.ptlCreatedBy),
        };
        const update = {
            ptlModifiedOn: new Date(),
            ptlModifiedBy: this.resolveWriteActor(dto.ptlModifiedBy),
        };
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlCompanyId'))
            update.ptlCompanyId = companyId;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlPurposeId'))
            update.ptlPurposeId = purposeId;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlCode'))
            update.ptlCode = code;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlName'))
            update.ptlName = name;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlDescription')) {
            update.ptlDescription = (0, module_service_utils_1.normalizeNullableString)(dto.ptlDescription) ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlForkedFromId'))
            update.ptlForkedFromId = forkedFromId;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlForkedFromRev'))
            update.ptlForkedFromRev = forkedFromRev;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlSortOrder'))
            update.ptlSortOrder = sortOrder;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ptlIsActive'))
            update.ptlIsActive = dto.ptlIsActive ?? true;
        return { create, update, effective };
    }
    async assertCodeIsFree(client, companyId, code, ignoreTemplateId) {
        if (!code) {
            return;
        }
        const clash = await client.printTemplate.findFirst({
            where: {
                ptlCompanyId: companyId,
                ptlIsDeleted: false,
                ptlCode: { equals: code, mode: 'insensitive' },
                ...(ignoreTemplateId ? { ptlId: { not: ignoreTemplateId } } : {}),
            },
            select: { ptlId: true },
        });
        if (clash) {
            this.throwConflict('Duplicate template code', [
                {
                    field: 'ptlCode',
                    message: companyId
                        ? `ptlCode ${code} already exists for this company`
                        : `ptlCode ${code} already exists among the shipped templates`,
                },
            ]);
        }
    }
    async assertNotAssigned(client, ptlId) {
        const assignment = await client.printTemplateAssignment.findFirst({
            where: { ptaTemplateId: ptlId, ptaIsDeleted: false },
            select: { ptaId: true },
        });
        if (assignment) {
            this.throwConflict('Print template is still assigned', [
                {
                    field: 'ptlId',
                    message: 'One or more print template assignments still point at this template. Remove them ' +
                        'first, or point them at another design.',
                },
            ]);
        }
    }
    planVersions(existing, rows, errors) {
        if (rows === undefined) {
            return [];
        }
        const byId = new Map();
        for (const version of existing?.versions ?? []) {
            byId.set(version.ptvId, version);
        }
        let nextRevNo = Math.max(0, ...(existing?.versions ?? []).map((v) => v.ptvRevNo)) + 1;
        const claimedRevNos = new Set((existing?.versions ?? []).map((v) => v.ptvRevNo));
        const plans = [];
        rows.forEach((row, index) => {
            const path = `versions[${index}]`;
            const current = row.ptvId ? byId.get(row.ptvId) : undefined;
            if (row.ptvId && !current) {
                errors.push({
                    field: `${path}.ptvId`,
                    message: `No revision ${row.ptvId} belongs to this template`,
                });
                return;
            }
            if (row.ptvIsDeleted === true) {
                const plan = this.planVersionDelete(existing, current ?? null, row, path, errors);
                if (plan) {
                    plans.push(plan);
                }
                return;
            }
            if (current && current.ptvStatus !== 'DRAFT') {
                const plan = this.planFrozenVersion(existing, current, row, path, errors);
                if (plan) {
                    plans.push(plan);
                }
                return;
            }
            const revNo = row.ptvRevNo ?? current?.ptvRevNo ?? nextRevNo;
            if (!current && row.ptvRevNo === undefined) {
                nextRevNo += 1;
            }
            if (!current && row.ptvRevNo !== undefined && claimedRevNos.has(row.ptvRevNo)) {
                errors.push({
                    field: `${path}.ptvRevNo`,
                    message: `Revision ${row.ptvRevNo} already exists on this template. Revision numbers are ` +
                        'never reused — omit ptvRevNo and the next one is assigned.',
                });
            }
            claimedRevNos.add(revNo);
            const effective = this.effectiveVersion(current ?? null, row, revNo);
            errors.push(...(0, print_template_invariants_1.collectVersionInvariantErrors)(effective, path));
            const publishes = effective.ptvStatus === 'PUBLISHED' && current?.ptvStatus !== 'PUBLISHED';
            const datasets = this.planDatasets(current ?? null, row.datasets, path, errors);
            plans.push({
                path,
                row,
                existing: current ?? null,
                effective,
                datasets,
                publishes,
                releasesPointer: false,
                deletes: false,
            });
        });
        return plans;
    }
    planFrozenVersion(existing, current, row, path, errors) {
        const design = this.designKeysPresent(row);
        if (design.length > 0) {
            errors.push({
                field: `${path}.${design[0]}`,
                message: `Revision ${current.ptvRevNo} is ${current.ptvStatus} and can no longer be edited — ` +
                    'print_log points at these exact bytes. Send a version row with NO ptvId instead and ' +
                    `it becomes the next revision. (Refused: ${design.join(', ')}.)`,
            });
            return null;
        }
        if (row.datasets !== undefined) {
            errors.push({
                field: `${path}.datasets`,
                message: `The datasets of ${current.ptvStatus} revision ${current.ptvRevNo} are frozen with its ` +
                    'design. Add a new revision to change what feeds it.',
            });
            return null;
        }
        const target = row.ptvStatus ?? current.ptvStatus;
        if (target === current.ptvStatus) {
            return null;
        }
        if (!(current.ptvStatus === 'PUBLISHED' && target === 'RETIRED')) {
            errors.push({
                field: `${path}.ptvStatus`,
                message: `A ${current.ptvStatus} revision cannot become ${target}. The only move left to a ` +
                    'published revision is RETIRED.',
            });
            return null;
        }
        return {
            path,
            row,
            existing: current,
            effective: this.effectiveVersion(current, row, current.ptvRevNo),
            datasets: null,
            publishes: false,
            releasesPointer: existing?.ptlPublishedRevId === current.ptvId,
            deletes: false,
        };
    }
    planVersionDelete(existing, current, row, path, errors) {
        if (!current) {
            errors.push({
                field: `${path}.ptvId`,
                message: 'ptvIsDeleted needs a ptvId — there is nothing to delete without one',
            });
            return null;
        }
        if (current.ptvIsDeleted) {
            return null;
        }
        if (current.ptvStatus === 'PUBLISHED') {
            errors.push({
                field: `${path}.ptvIsDeleted`,
                message: `Revision ${current.ptvRevNo} is PUBLISHED. Retire it first — a revision that has ` +
                    'printed cannot be deleted out from under print_log.',
            });
            return null;
        }
        if (existing?.ptlPublishedRevId === current.ptvId) {
            errors.push({
                field: `${path}.ptvIsDeleted`,
                message: `Revision ${current.ptvRevNo} is the one this template publishes. Point the template elsewhere first.`,
            });
            return null;
        }
        return {
            path,
            row,
            existing: current,
            effective: this.effectiveVersion(current, {}, current.ptvRevNo),
            datasets: null,
            publishes: false,
            releasesPointer: false,
            deletes: true,
        };
    }
    designKeysPresent(row) {
        const designKeys = [
            'ptvRevNo',
            'ptvEngine',
            'ptvBody',
            'ptvSchemaVer',
            'ptvPaperCode',
            'ptvOrientation',
            'ptvWidthMm',
            'ptvHeightMm',
            'ptvMarginTopMm',
            'ptvMarginBottomMm',
            'ptvMarginLeftMm',
            'ptvMarginRightMm',
            'ptvColumns',
            'ptvLang',
            'ptvFontFamily',
            'ptvParams',
            'ptvNote',
        ];
        return designKeys.filter((key) => (0, module_service_utils_1.hasOwnProperty)(row, key));
    }
    effectiveVersion(current, row, revNo) {
        const pick = (key, fallback) => {
            const value = row[key];
            return value === undefined ? fallback : value;
        };
        const status = pick('ptvStatus', current?.ptvStatus ?? print_template_constants_1.PTV_DEFAULT_STATUS);
        return {
            ptvRevNo: revNo,
            ptvStatus: status,
            ptvEngine: pick('ptvEngine', current?.ptvEngine ?? print_template_constants_1.PTV_DEFAULT_ENGINE),
            ptvBody: pick('ptvBody', current?.ptvBody ?? ''),
            ptvPaperCode: pick('ptvPaperCode', current?.ptvPaperCode ?? 'A4'),
            ptvOrientation: pick('ptvOrientation', current?.ptvOrientation ?? print_template_constants_1.PTV_DEFAULT_ORIENTATION),
            ptvWidthMm: pick('ptvWidthMm', numberOrNull(current?.ptvWidthMm)),
            ptvHeightMm: pick('ptvHeightMm', numberOrNull(current?.ptvHeightMm)),
            ptvMarginTopMm: pick('ptvMarginTopMm', numberOr(current?.ptvMarginTopMm, 0)),
            ptvMarginBottomMm: pick('ptvMarginBottomMm', numberOr(current?.ptvMarginBottomMm, 0)),
            ptvMarginLeftMm: pick('ptvMarginLeftMm', numberOr(current?.ptvMarginLeftMm, 0)),
            ptvMarginRightMm: pick('ptvMarginRightMm', numberOr(current?.ptvMarginRightMm, 0)),
            ptvColumns: pick('ptvColumns', current?.ptvColumns ?? null),
            ptvLang: pick('ptvLang', current?.ptvLang ?? print_template_constants_1.PTV_DEFAULT_LANG),
            ptvParams: (0, module_service_utils_1.hasOwnProperty)(row, 'ptvParams')
                ? (row.ptvParams ?? null)
                : (current?.ptvParams ?? null),
            ptvApprovedBy: pick('ptvApprovedBy', current?.ptvApprovedBy ?? null) ??
                (status === 'PUBLISHED' ? this.requestContextService.getUserId() : null),
        };
    }
    planDatasets(current, rows, versionPath, errors) {
        if (rows === undefined) {
            return null;
        }
        const byId = new Map();
        for (const dataset of current?.datasets ?? []) {
            byId.set(dataset.ptdId, dataset);
        }
        const plans = [];
        rows.forEach((row, index) => {
            const path = `${versionPath}.datasets[${index}]`;
            const existing = row.ptdId ? byId.get(row.ptdId) : undefined;
            if (row.ptdId && !existing) {
                errors.push({
                    field: `${path}.ptdId`,
                    message: `No dataset ${row.ptdId} belongs to this revision`,
                });
                return;
            }
            const effective = this.effectiveDataset(existing ?? null, row, path, errors);
            errors.push(...(0, print_template_invariants_1.collectDatasetInvariantErrors)(effective, path));
            plans.push({ path, existing: existing ?? null, effective, row });
        });
        errors.push(...(0, print_template_invariants_1.collectDatasetSetInvariantErrors)(plans.map((plan) => ({ dataset: plan.effective, path: plan.path }))));
        return { plans };
    }
    effectiveDataset(existing, row, path, errors) {
        const role = row.ptdRole ?? existing?.ptdRole ?? print_template_constants_1.PTD_DEFAULT_ROLE;
        const name = row.ptdName ?? existing?.ptdName ?? '';
        if (!existing && !name) {
            errors.push({ field: `${path}.ptdName`, message: 'ptdName is required' });
        }
        const datasetNo = row.ptdDatasetNo ?? existing?.ptdDatasetNo ?? (role === 'MASTER' ? 0 : Number.NaN);
        if (!existing && Number.isNaN(datasetNo)) {
            errors.push({
                field: `${path}.ptdDatasetNo`,
                message: 'ptdDatasetNo is required for a DETAIL dataset — it is what a band points at',
            });
        }
        return {
            ptdRole: role,
            ptdDatasetNo: Number.isNaN(datasetNo) ? -1 : datasetNo,
            ptdName: name,
            ptdSourceKind: row.ptdSourceKind ?? existing?.ptdSourceKind ?? print_template_constants_1.PTD_DEFAULT_SOURCE_KIND,
            ptdProviderCode: (0, module_service_utils_1.hasOwnProperty)(row, 'ptdProviderCode')
                ? (row.ptdProviderCode ?? null)
                : (existing?.ptdProviderCode ?? null),
            ptdSql: (0, module_service_utils_1.hasOwnProperty)(row, 'ptdSql') ? (row.ptdSql ?? null) : (existing?.ptdSql ?? null),
            ptdRequiresCompany: row.ptdRequiresCompany ?? existing?.ptdRequiresCompany ?? true,
            ptdParentNo: (0, module_service_utils_1.hasOwnProperty)(row, 'ptdParentNo')
                ? (row.ptdParentNo ?? null)
                : (existing?.ptdParentNo ?? null),
            ptdLinkFields: (0, module_service_utils_1.hasOwnProperty)(row, 'ptdLinkFields')
                ? (row.ptdLinkFields ?? null)
                : (existing?.ptdLinkFields ?? null),
            ptdRowLimit: row.ptdRowLimit ?? existing?.ptdRowLimit ?? print_template_constants_1.PTD_DEFAULT_ROW_LIMIT,
            ptdTimeoutMs: row.ptdTimeoutMs ?? existing?.ptdTimeoutMs ?? print_template_constants_1.PTD_DEFAULT_TIMEOUT_MS,
        };
    }
    planPointer(existing, dto, plans, errors) {
        const publishing = plans.filter((plan) => plan.publishes);
        if (publishing.length > 1) {
            errors.push({
                field: `${publishing[1].path}.ptvStatus`,
                message: 'Only one revision may be published per request — the template has one published ' +
                    'pointer, and two candidates leave no way to say which is live.',
            });
        }
        if (!(0, module_service_utils_1.hasOwnProperty)(dto, 'ptlPublishedRevId')) {
            return { explicit: false, value: null };
        }
        const requested = dto.ptlPublishedRevId ?? null;
        if (requested === null) {
            return { explicit: true, value: null };
        }
        if (publishing.length > 0) {
            errors.push({
                field: 'ptlPublishedRevId',
                message: 'Send either ptlPublishedRevId or a revision with ptvStatus PUBLISHED, not both — they ' +
                    'are two ways of moving the same pointer.',
            });
            return { explicit: true, value: requested };
        }
        const target = existing?.versions.find((version) => version.ptvId === requested);
        if (!target) {
            errors.push({
                field: 'ptlPublishedRevId',
                message: 'ptlPublishedRevId must name a revision of THIS template',
            });
        }
        else if (target.ptvIsDeleted) {
            errors.push({
                field: 'ptlPublishedRevId',
                message: `Revision ${target.ptvRevNo} is deleted and cannot be published`,
            });
        }
        else if (target.ptvStatus !== 'PUBLISHED') {
            errors.push({
                field: 'ptlPublishedRevId',
                message: `Revision ${target.ptvRevNo} is ${target.ptvStatus}. Only a PUBLISHED revision may be ` +
                    'the one a render uses — set its ptvStatus to PUBLISHED in the same call.',
            });
        }
        return { explicit: true, value: requested };
    }
    async applyVersionPlans(tx, template, plans) {
        let publishedRevId = null;
        for (const plan of plans) {
            if (plan.deletes) {
                await this.deleteVersion(tx, plan);
                continue;
            }
            const version = plan.existing
                ? await this.updateVersion(tx, plan)
                : await this.createVersion(tx, template, plan);
            if (plan.datasets) {
                await this.applyDatasetPlan(tx, version, plan);
            }
            if (plan.publishes) {
                publishedRevId = version.ptvId;
            }
        }
        return publishedRevId;
    }
    async createVersion(tx, template, plan) {
        const effective = plan.effective;
        const data = {
            ptvTemplateId: template.ptlId,
            ptvRevNo: effective.ptvRevNo,
            ptvStatus: effective.ptvStatus,
            ptvEngine: effective.ptvEngine,
            ptvBody: effective.ptvBody,
            ptvSchemaVer: plan.row.ptvSchemaVer ?? 1,
            ptvPaperCode: effective.ptvPaperCode,
            ptvOrientation: effective.ptvOrientation,
            ptvWidthMm: effective.ptvWidthMm,
            ptvHeightMm: effective.ptvHeightMm,
            ptvMarginTopMm: effective.ptvMarginTopMm,
            ptvMarginBottomMm: effective.ptvMarginBottomMm,
            ptvMarginLeftMm: effective.ptvMarginLeftMm,
            ptvMarginRightMm: effective.ptvMarginRightMm,
            ptvColumns: effective.ptvColumns,
            ptvLang: effective.ptvLang,
            ptvFontFamily: (0, module_service_utils_1.normalizeNullableString)(plan.row.ptvFontFamily) ?? null,
            ptvParams: toJsonInput(effective.ptvParams),
            ptvNote: (0, module_service_utils_1.normalizeNullableString)(plan.row.ptvNote) ?? null,
            ptvApprovedBy: effective.ptvApprovedBy,
            ptvApprovedOn: effective.ptvStatus === 'PUBLISHED' ? new Date() : null,
            ptvCreatedBy: this.resolveWriteActor(plan.row.ptvCreatedBy),
        };
        const version = await tx.printTemplateVersion.create({ data });
        await this.audit(tx, 'insert', VERSION_TABLE_NAME, version.ptvId, `${version.ptvTemplateId} rev ${version.ptvRevNo}`, null, (0, print_template_utils_1.toVersionPayload)(version, null), `Print template revision ${version.ptvRevNo} created as ${version.ptvStatus}`);
        return version;
    }
    async updateVersion(tx, plan) {
        const existing = plan.existing;
        const row = plan.row;
        const effective = plan.effective;
        const data = {
            ptvModifiedOn: new Date(),
            ptvModifiedBy: this.resolveWriteActor(row.ptvModifiedBy),
        };
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvRevNo'))
            data.ptvRevNo = effective.ptvRevNo;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvStatus'))
            data.ptvStatus = effective.ptvStatus;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvEngine'))
            data.ptvEngine = effective.ptvEngine;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvBody'))
            data.ptvBody = effective.ptvBody;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvSchemaVer'))
            data.ptvSchemaVer = row.ptvSchemaVer;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvPaperCode'))
            data.ptvPaperCode = effective.ptvPaperCode;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvOrientation'))
            data.ptvOrientation = effective.ptvOrientation;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvWidthMm'))
            data.ptvWidthMm = effective.ptvWidthMm;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvHeightMm'))
            data.ptvHeightMm = effective.ptvHeightMm;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvMarginTopMm'))
            data.ptvMarginTopMm = effective.ptvMarginTopMm;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvMarginBottomMm')) {
            data.ptvMarginBottomMm = effective.ptvMarginBottomMm;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvMarginLeftMm'))
            data.ptvMarginLeftMm = effective.ptvMarginLeftMm;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvMarginRightMm')) {
            data.ptvMarginRightMm = effective.ptvMarginRightMm;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvColumns'))
            data.ptvColumns = effective.ptvColumns;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvLang'))
            data.ptvLang = effective.ptvLang;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvFontFamily')) {
            data.ptvFontFamily = (0, module_service_utils_1.normalizeNullableString)(row.ptvFontFamily) ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvParams'))
            data.ptvParams = toJsonInput(effective.ptvParams);
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvNote')) {
            data.ptvNote = (0, module_service_utils_1.normalizeNullableString)(row.ptvNote) ?? null;
        }
        if (plan.publishes) {
            data.ptvApprovedBy = effective.ptvApprovedBy;
            data.ptvApprovedOn = new Date();
        }
        else if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptvApprovedBy')) {
            data.ptvApprovedBy = effective.ptvApprovedBy;
        }
        const updated = await tx.printTemplateVersion.update({
            where: { ptvId: existing.ptvId },
            data,
        });
        await this.audit(tx, plan.publishes ? 'approve' : 'update', VERSION_TABLE_NAME, updated.ptvId, `${updated.ptvTemplateId} rev ${updated.ptvRevNo}`, (0, print_template_utils_1.toVersionPayload)(existing, null), (0, print_template_utils_1.toVersionPayload)(updated, null), plan.publishes
            ? `Print template revision ${updated.ptvRevNo} published`
            : `Print template revision ${updated.ptvRevNo} updated`);
        return updated;
    }
    async deleteVersion(tx, plan) {
        const existing = plan.existing;
        const modifiedOn = new Date();
        const actor = this.resolveWriteActor(plan.row.ptvModifiedBy);
        await tx.printTemplateDataset.updateMany({
            where: { ptdVersionId: existing.ptvId, ptdIsDeleted: false },
            data: { ptdIsDeleted: true, ptdModifiedOn: modifiedOn, ptdModifiedBy: actor },
        });
        const updated = await tx.printTemplateVersion.update({
            where: { ptvId: existing.ptvId },
            data: { ptvIsDeleted: true, ptvModifiedOn: modifiedOn, ptvModifiedBy: actor },
        });
        await this.audit(tx, 'cancel', VERSION_TABLE_NAME, existing.ptvId, `${existing.ptvTemplateId} rev ${existing.ptvRevNo}`, (0, print_template_utils_1.toVersionPayload)(existing, null), (0, print_template_utils_1.toVersionPayload)(updated, null), `Print template revision ${existing.ptvRevNo} soft deleted with its datasets`);
    }
    async applyDatasetPlan(tx, version, plan) {
        const set = plan.datasets;
        const actor = this.resolveWriteActor(plan.row.ptvModifiedBy ?? plan.row.ptvCreatedBy);
        const modifiedOn = new Date();
        const before = await tx.printTemplateDataset.findMany({
            where: { ptdVersionId: version.ptvId, ptdIsDeleted: false },
        });
        const kept = new Set(set.plans
            .map((datasetPlan) => datasetPlan.existing?.ptdId)
            .filter((id) => id !== undefined));
        if (before.length > 0) {
            await tx.printTemplateDataset.updateMany({
                where: { ptdVersionId: version.ptvId, ptdIsDeleted: false },
                data: { ptdIsDeleted: true, ptdModifiedOn: modifiedOn, ptdModifiedBy: actor },
            });
        }
        for (const datasetPlan of set.plans) {
            if (datasetPlan.existing) {
                await this.updateDataset(tx, datasetPlan);
            }
            else {
                await this.createDataset(tx, version, datasetPlan);
            }
        }
        for (const row of before) {
            if (kept.has(row.ptdId)) {
                continue;
            }
            await this.audit(tx, 'cancel', DATASET_TABLE_NAME, row.ptdId, `${row.ptdName} (#${row.ptdDatasetNo})`, (0, print_template_utils_1.toDatasetPayload)(row), (0, print_template_utils_1.toDatasetPayload)({
                ...row,
                ptdIsDeleted: true,
                ptdModifiedOn: modifiedOn,
                ptdModifiedBy: actor,
            }), 'Print template dataset soft deleted — absent from the datasets array');
        }
    }
    async createDataset(tx, version, plan) {
        const effective = plan.effective;
        const created = await tx.printTemplateDataset.create({
            data: {
                ptdVersionId: version.ptvId,
                ptdRole: effective.ptdRole,
                ptdDatasetNo: effective.ptdDatasetNo,
                ptdSortOrder: plan.row.ptdSortOrder ?? 0,
                ptdName: effective.ptdName,
                ptdLabel: (0, module_service_utils_1.normalizeNullableString)(plan.row.ptdLabel) ?? null,
                ptdSourceKind: effective.ptdSourceKind,
                ptdProviderCode: effective.ptdProviderCode,
                ptdSql: effective.ptdSql,
                ptdRequiresCompany: effective.ptdRequiresCompany,
                ptdParentNo: effective.ptdParentNo,
                ptdLinkFields: effective.ptdLinkFields,
                ptdRowLimit: effective.ptdRowLimit,
                ptdTimeoutMs: effective.ptdTimeoutMs,
                ptdRemarks: (0, module_service_utils_1.normalizeNullableString)(plan.row.ptdRemarks) ?? null,
                ptdCreatedBy: this.resolveWriteActor(plan.row.ptdCreatedBy),
            },
        });
        await this.audit(tx, 'insert', DATASET_TABLE_NAME, created.ptdId, `${created.ptdName} (#${created.ptdDatasetNo})`, null, (0, print_template_utils_1.toDatasetPayload)(created), `Print template dataset ${created.ptdName} created`);
        return created;
    }
    async updateDataset(tx, plan) {
        const existing = plan.existing;
        const row = plan.row;
        const effective = plan.effective;
        const data = {
            ptdIsDeleted: false,
            ptdModifiedOn: new Date(),
            ptdModifiedBy: this.resolveWriteActor(row.ptdModifiedBy),
        };
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdRole'))
            data.ptdRole = effective.ptdRole;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdDatasetNo'))
            data.ptdDatasetNo = effective.ptdDatasetNo;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdSortOrder'))
            data.ptdSortOrder = row.ptdSortOrder;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdName'))
            data.ptdName = effective.ptdName;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdLabel')) {
            data.ptdLabel = (0, module_service_utils_1.normalizeNullableString)(row.ptdLabel) ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdSourceKind'))
            data.ptdSourceKind = effective.ptdSourceKind;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdProviderCode'))
            data.ptdProviderCode = effective.ptdProviderCode;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdSql'))
            data.ptdSql = effective.ptdSql;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdRequiresCompany')) {
            data.ptdRequiresCompany = effective.ptdRequiresCompany;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdParentNo'))
            data.ptdParentNo = effective.ptdParentNo;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdLinkFields'))
            data.ptdLinkFields = effective.ptdLinkFields;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdRowLimit'))
            data.ptdRowLimit = effective.ptdRowLimit;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdTimeoutMs'))
            data.ptdTimeoutMs = effective.ptdTimeoutMs;
        if ((0, module_service_utils_1.hasOwnProperty)(row, 'ptdRemarks')) {
            data.ptdRemarks = (0, module_service_utils_1.normalizeNullableString)(row.ptdRemarks) ?? null;
        }
        const updated = await tx.printTemplateDataset.update({
            where: { ptdId: existing.ptdId },
            data,
        });
        await this.audit(tx, 'update', DATASET_TABLE_NAME, updated.ptdId, `${updated.ptdName} (#${updated.ptdDatasetNo})`, (0, print_template_utils_1.toDatasetPayload)(existing), (0, print_template_utils_1.toDatasetPayload)(updated), `Print template dataset ${updated.ptdName} updated`);
        return updated;
    }
    async applyPointer(tx, template, pointer, publishedRevId, plans) {
        let target;
        if (publishedRevId) {
            target = publishedRevId;
        }
        else if (pointer.explicit) {
            target = pointer.value;
        }
        else if (plans.some((plan) => plan.releasesPointer)) {
            target = null;
        }
        if (target === undefined || target === template.ptlPublishedRevId) {
            return;
        }
        await tx.printTemplate.update({
            where: { ptlId: template.ptlId },
            data: {
                ptlPublishedRevId: target,
                ptlModifiedOn: new Date(),
                ptlModifiedBy: this.resolveWriteActor(null),
            },
        });
    }
    async findTemplate(client, ptlId, includeDeletedVersions) {
        return client.printTemplate.findFirst({
            where: { ptlId, ptlIsDeleted: false },
            include: {
                ...print_template_utils_1.TEMPLATE_INCLUDE,
                versions: {
                    ...(includeDeletedVersions ? {} : { where: { ptvIsDeleted: false } }),
                    orderBy: { ptvRevNo: 'desc' },
                    include: {
                        datasets: { where: { ptdIsDeleted: false }, orderBy: print_template_utils_1.DATASET_ORDER_BY },
                    },
                },
            },
        });
    }
    resolveWriteActor(explicit) {
        const value = explicit?.trim();
        if (value) {
            return value;
        }
        return this.requestContextService.getUserId() ?? null;
    }
    resolveAuditActor() {
        return this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_AUDIT_ACTOR;
    }
    async audit(tx, action, tableName, pk, displayName, originalRecord, modifiedRecord, notes) {
        await this.auditLogService.logEntityChange({
            action,
            tableName,
            screenName: print_template_constants_1.PRINT_TEMPLATE_SCREEN_NAME,
            screenType: 'settings',
            pk,
            displayName,
            originalRecord,
            modifiedRecord,
            userId: this.resolveAuditActor(),
            notes,
        }, tx);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSettingsBadRequest)(message, errors);
    }
    throwConflict(message, errors) {
        (0, module_service_utils_1.throwSettingsConflict)(message, errors);
    }
    throwNotFound(field, value, message) {
        (0, module_service_utils_1.throwSettingsNotFound)(message, field, `${field} ${value} was not found`);
    }
};
exports.PrintTemplateService = PrintTemplateService;
exports.PrintTemplateService = PrintTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], PrintTemplateService);
const numberOrNull = (value) => value === null || value === undefined ? null : Number(value.toString());
const numberOr = (value, fallback) => value === null || value === undefined ? fallback : Number(value.toString());
const toJsonInput = (value) => value === null || value === undefined ? client_1.Prisma.DbNull : value;
//# sourceMappingURL=print-template.service.js.map