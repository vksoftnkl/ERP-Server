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
exports.WidgetMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const widget_master_api_types_1 = require("./types/widget-master-api.types");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const FIELD_ORDER_BY = [
    { fieldPosition: 'asc' },
    { fieldId: 'asc' },
];
let WidgetMasterService = class WidgetMasterService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async save(saveWidgetDto) {
        const actor = this.getActor();
        return this.prisma.$transaction((tx) => this.saveSectionTx(tx, saveWidgetDto, actor));
    }
    async saveBulk(saveBulkWidgetDto) {
        const actor = this.getActor();
        return this.prisma.$transaction(async (tx) => {
            const results = [];
            for (const section of saveBulkWidgetDto.data) {
                results.push(await this.saveSectionTx(tx, section, actor));
            }
            return results;
        });
    }
    async list(queryDto) {
        const search = queryDto.search?.trim() ?? '';
        const where = {};
        if (queryDto.sectionId !== undefined) {
            where.sectionId = queryDto.sectionId;
        }
        if (queryDto.sectionMenuId !== undefined) {
            where.sectionMenuId = queryDto.sectionMenuId;
        }
        if (queryDto.sectionPlatform !== undefined) {
            where.sectionPlatform = queryDto.sectionPlatform;
        }
        if (search) {
            where.OR = this.buildSearchConditions(search);
        }
        const records = await this.prisma.formSection.findMany({
            where,
            orderBy: [{ sectionPosition: 'asc' }, { sectionId: 'asc' }],
            include: { fields: { orderBy: FIELD_ORDER_BY } },
        });
        return records.map((record) => this.toPayload(record));
    }
    async getConfig(queryDto) {
        const onlyHidden = queryDto.visibility === widget_master_api_types_1.WidgetVisibilityFilter.False;
        const records = await this.prisma.formSection.findMany({
            where: {
                sectionMenuId: queryDto.menu_id,
                ...(queryDto.platform !== undefined && { sectionPlatform: queryDto.platform }),
                ...(onlyHidden && { sectionVisibility: false }),
            },
            orderBy: [{ sectionPosition: 'asc' }, { sectionId: 'asc' }],
            include: {
                fields: {
                    where: onlyHidden
                        ? { OR: [{ fieldVisibility: false }, { fieldSecondaryText: { not: null } }] }
                        : undefined,
                    orderBy: FIELD_ORDER_BY,
                },
            },
        });
        return records.map((record) => this.toPayload(record));
    }
    async updateVisibility(dto) {
        const actor = this.getActor();
        const now = new Date();
        const sectionIds = dto.data.map((section) => this.normalizeSectionId(section.sectionId));
        return this.prisma.$transaction(async (tx) => {
            for (const section of dto.data) {
                const sectionId = this.normalizeSectionId(section.sectionId);
                const existing = await tx.formSection.findUnique({
                    where: { sectionId },
                    select: { sectionId: true },
                });
                if (!existing) {
                    this.throwNotFound(sectionId);
                }
                await tx.formSection.update({
                    where: { sectionId },
                    data: {
                        sectionGuiName: section.sectionGuiName.trim(),
                        sectionVisibility: section.sectionVisibility,
                        sectionUpdatedBy: actor,
                        sectionUpdatedOn: now,
                    },
                });
                for (const field of section.fields) {
                    const fieldId = this.normalizeFieldId(field.fieldId);
                    const existingField = await tx.formField.findUnique({
                        where: { fieldId },
                        select: { fieldSectionId: true },
                    });
                    if (!existingField || existingField.fieldSectionId !== sectionId) {
                        this.throwFieldNotFound(fieldId, sectionId);
                    }
                    await tx.formField.update({
                        where: { fieldId },
                        data: {
                            fieldSecondaryText: field.fieldSecondaryText.trim(),
                            fieldVisibility: field.fieldVisibility,
                            fieldUpdatedBy: actor,
                            fieldUpdatedOn: now,
                        },
                    });
                }
            }
            const updated = await tx.formSection.findMany({
                where: { sectionId: { in: sectionIds } },
                orderBy: [{ sectionPosition: 'asc' }, { sectionId: 'asc' }],
                include: { fields: { orderBy: FIELD_ORDER_BY } },
            });
            return updated.map((record) => this.toPayload(record));
        });
    }
    async delete(sectionId) {
        const normalizedSectionId = this.normalizeSectionId(sectionId);
        const deleted = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.formSection.findUnique({
                where: {
                    sectionId: normalizedSectionId,
                },
                select: {
                    sectionId: true,
                },
            });
            if (!existing) {
                return false;
            }
            await tx.formSection.delete({
                where: {
                    sectionId: normalizedSectionId,
                },
            });
            return true;
        });
        if (!deleted) {
            this.throwNotFound(normalizedSectionId);
        }
        return {
            sectionId: normalizedSectionId,
            deleted: true,
        };
    }
    async saveSectionTx(tx, saveWidgetDto, actor) {
        if (saveWidgetDto.sectionId !== undefined) {
            return this.updateSectionTx(tx, saveWidgetDto, actor);
        }
        return this.createSectionTx(tx, saveWidgetDto, actor);
    }
    async createSectionTx(tx, saveWidgetDto, actor) {
        const data = {
            sectionMenuId: saveWidgetDto.sectionMenuId,
            sectionName: saveWidgetDto.sectionName.trim(),
            sectionGuiName: saveWidgetDto.sectionGuiName.trim(),
            sectionPosition: saveWidgetDto.sectionPosition ?? 0,
            sectionVisibility: saveWidgetDto.sectionVisibility ?? true,
            sectionPlatform: saveWidgetDto.sectionPlatform,
            sectionCreatedOn: new Date(),
            sectionCreatedBy: actor,
        };
        if (saveWidgetDto.fields !== undefined) {
            data.fields = {
                create: saveWidgetDto.fields.map((field) => this.buildFieldCreateData(field, actor)),
            };
        }
        const created = await tx.formSection.create({
            data,
            include: { fields: { orderBy: FIELD_ORDER_BY } },
        });
        return this.toPayload(created);
    }
    async updateSectionTx(tx, saveWidgetDto, actor) {
        const sectionId = this.normalizeSectionId(saveWidgetDto.sectionId);
        const existing = await tx.formSection.findUnique({
            where: { sectionId },
        });
        if (!existing) {
            this.throwNotFound(sectionId);
        }
        const data = {
            sectionMenuId: saveWidgetDto.sectionMenuId,
            sectionName: saveWidgetDto.sectionName.trim(),
            sectionGuiName: saveWidgetDto.sectionGuiName.trim(),
            sectionPosition: saveWidgetDto.sectionPosition ?? existing.sectionPosition,
            sectionVisibility: saveWidgetDto.sectionVisibility ?? existing.sectionVisibility,
            sectionPlatform: saveWidgetDto.sectionPlatform,
            sectionUpdatedBy: actor,
            sectionUpdatedOn: new Date(),
        };
        await tx.formSection.update({
            where: { sectionId },
            data,
        });
        if (saveWidgetDto.fields !== undefined) {
            await this.syncFields(tx, sectionId, saveWidgetDto.fields, actor);
        }
        const updated = await tx.formSection.findUniqueOrThrow({
            where: { sectionId },
            include: { fields: { orderBy: FIELD_ORDER_BY } },
        });
        return this.toPayload(updated);
    }
    async syncFields(tx, sectionId, fields, actor) {
        const existing = await tx.formField.findMany({
            where: { fieldSectionId: sectionId },
            select: { fieldId: true },
        });
        const existingIds = new Set(existing.map((field) => field.fieldId));
        const keepIds = new Set();
        for (const field of fields) {
            if (field.fieldId !== undefined && existingIds.has(field.fieldId)) {
                keepIds.add(field.fieldId);
            }
        }
        const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
        if (toDelete.length > 0) {
            await tx.formField.deleteMany({ where: { fieldId: { in: toDelete } } });
        }
        for (const field of fields) {
            if (field.fieldId !== undefined && existingIds.has(field.fieldId)) {
                await tx.formField.update({
                    where: { fieldId: field.fieldId },
                    data: this.buildFieldUpdateData(field, actor),
                });
            }
            else {
                await tx.formField.create({
                    data: { ...this.buildFieldCreateData(field, actor), fieldSectionId: sectionId },
                });
            }
        }
    }
    buildFieldCreateData(field, actor) {
        return {
            fieldName: field.fieldName.trim(),
            fieldGuiName: field.fieldGuiName ?? null,
            fieldSecondaryText: field.fieldSecondaryText ?? null,
            fieldPosition: field.fieldPosition ?? 0,
            fieldVisibility: field.fieldVisibility ?? true,
            fieldCreatedBy: actor,
            fieldUpdatedBy: null,
        };
    }
    buildFieldUpdateData(field, actor) {
        const data = {
            fieldName: field.fieldName.trim(),
            fieldUpdatedBy: actor,
            fieldUpdatedOn: new Date(),
        };
        if ((0, module_service_utils_1.hasOwnProperty)(field, 'fieldGuiName')) {
            data.fieldGuiName = field.fieldGuiName ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(field, 'fieldSecondaryText')) {
            data.fieldSecondaryText = field.fieldSecondaryText ?? null;
        }
        if (field.fieldPosition !== undefined) {
            data.fieldPosition = field.fieldPosition;
        }
        if (field.fieldVisibility !== undefined) {
            data.fieldVisibility = field.fieldVisibility;
        }
        return data;
    }
    buildSearchConditions(search) {
        return [
            { sectionName: { contains: search, mode: 'insensitive' } },
            { sectionGuiName: { contains: search, mode: 'insensitive' } },
            { fields: { some: { fieldName: { contains: search, mode: 'insensitive' } } } },
            { fields: { some: { fieldGuiName: { contains: search, mode: 'insensitive' } } } },
            { fields: { some: { fieldSecondaryText: { contains: search, mode: 'insensitive' } } } },
        ];
    }
    toPayload(record) {
        return {
            sectionId: record.sectionId,
            sectionMenuId: record.sectionMenuId,
            sectionName: record.sectionName,
            sectionGuiName: record.sectionGuiName,
            sectionPosition: record.sectionPosition,
            sectionVisibility: record.sectionVisibility,
            sectionPlatform: record.sectionPlatform,
            sectionSyncDate: record.sectionSyncDate.toISOString(),
            sectionCreatedOn: record.sectionCreatedOn.toISOString(),
            sectionCreatedBy: record.sectionCreatedBy,
            sectionUpdatedOn: record.sectionUpdatedOn.toISOString(),
            sectionUpdatedBy: record.sectionUpdatedBy,
            fields: record.fields.map((field) => this.toFieldPayload(field)),
        };
    }
    toFieldPayload(field) {
        return {
            fieldId: field.fieldId,
            fieldSectionId: field.fieldSectionId,
            fieldName: field.fieldName,
            fieldGuiName: field.fieldGuiName,
            fieldSecondaryText: field.fieldSecondaryText,
            fieldPosition: field.fieldPosition,
            fieldVisibility: field.fieldVisibility,
            fieldSyncDate: field.fieldSyncDate.toISOString(),
            fieldCreatedOn: field.fieldCreatedOn.toISOString(),
            fieldCreatedBy: field.fieldCreatedBy,
            fieldUpdatedOn: field.fieldUpdatedOn.toISOString(),
            fieldUpdatedBy: field.fieldUpdatedBy,
        };
    }
    getActor() {
        return this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
    }
    normalizeSectionId(sectionId) {
        if (!Number.isInteger(sectionId) || sectionId <= 0) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'sectionId',
                    message: 'sectionId must be a positive integer',
                },
            ]);
        }
        return sectionId;
    }
    normalizeFieldId(fieldId) {
        if (!Number.isInteger(fieldId) || fieldId <= 0) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'fieldId',
                    message: 'fieldId must be a positive integer',
                },
            ]);
        }
        return fieldId;
    }
    throwNotFound(sectionId) {
        (0, module_service_utils_1.throwMasterNotFound)('Section not found', 'sectionId', `No section found with sectionId ${sectionId}`);
    }
    throwFieldNotFound(fieldId, sectionId) {
        (0, module_service_utils_1.throwMasterNotFound)('Field not found', 'fieldId', `No field found with fieldId ${fieldId} under sectionId ${sectionId}`);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwMasterBadRequest)(message, errors);
    }
};
exports.WidgetMasterService = WidgetMasterService;
exports.WidgetMasterService = WidgetMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], WidgetMasterService);
//# sourceMappingURL=widget-master.service.js.map