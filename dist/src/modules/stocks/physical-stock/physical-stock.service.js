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
exports.PhysicalStockService = void 0;
const common_1 = require("@nestjs/common");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const transaction_enums_1 = require("../../utils/transaction.enums");
const PHYSICAL_STOCK_TABLE_NAME = 'physical_stock_header';
const PHYSICAL_STOCK_AUDIT_SCREEN_NAME = 'Physical Stock';
const PHYSICAL_STOCK_DOCUMENT_INCLUDE = {
    details: {
        where: {
            psdIsDeleted: false,
        },
        include: {
            item: {
                select: {
                    itemId: true,
                    itemCode: true,
                    itemNameEn: true,
                },
            },
            unit: {
                select: {
                    unit_id: true,
                    unit_name: true,
                },
            },
            baseUnit: {
                select: {
                    unit_id: true,
                    unit_name: true,
                },
            },
            godown: {
                select: {
                    gdlId: true,
                    gdlName: true,
                },
            },
            batchDetails: {
                where: {
                    psbIsDeleted: false,
                },
                orderBy: {
                    psbRowNo: 'asc',
                },
            },
        },
        orderBy: {
            psdRowNo: 'asc',
        },
    },
};
const PHYSICAL_STOCK_HEADER_INCLUDE = {
    godown: {
        select: {
            gdlId: true,
            gdlName: true,
        },
    },
};
let PhysicalStockService = class PhysicalStockService {
    prisma;
    auditLogService;
    constructor(prisma, auditLogService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
    }
    async save(savePhysicalStockDto) {
        if (savePhysicalStockDto.psId) {
            return this.update(savePhysicalStockDto.psId, savePhysicalStockDto);
        }
        return this.create(savePhysicalStockDto);
    }
    async getList(queryDto) {
        return this.list(queryDto);
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = this.buildListWhere(queryDto);
        const [total, records] = await Promise.all([
            this.prisma.physicalStockHeader.count({ where }),
            this.prisma.physicalStockHeader.findMany({
                where,
                include: PHYSICAL_STOCK_HEADER_INCLUDE,
                orderBy: [{ psDocDate: 'desc' }, { psDocNo: 'desc' }, { psId: 'desc' }],
                skip,
                take: limit,
            }),
        ]);
        return {
            items: records.map((record) => this.toHeaderResponse(record)),
            meta: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
            },
        };
    }
    async getById(psId) {
        return this.buildDocumentPayload(this.prisma, psId);
    }
    async getByRefNo(queryDto) {
        const header = await this.getActiveHeaderByRefNoOrThrow(this.prisma, queryDto);
        return this.buildDocumentPayload(this.prisma, header.psId);
    }
    async create(createPhysicalStockDto) {
        this.validateDocumentScopes(createPhysicalStockDto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.validateHeaderReferences(tx, createPhysicalStockDto);
                const header = await tx.physicalStockHeader.create({
                    data: this.buildHeaderCreateInput(createPhysicalStockDto),
                });
                for (const [detailIndex, detailDto] of (createPhysicalStockDto.details ?? []).entries()) {
                    const detail = await tx.physicalStockDetail.create({
                        data: this.buildDetailCreateInput(detailDto, header.psId, detailIndex + 1, createPhysicalStockDto),
                    });
                    for (const [batchIndex, batchDto] of (detailDto.batchDetails ?? []).entries()) {
                        const batchInput = this.buildBatchDetailCreateInput(batchDto, detail.psdId, header.psId, batchIndex + 1, detailDto, createPhysicalStockDto);
                        await tx.physicalStockBatchDetail.create({ data: batchInput });
                        if (detailDto.psdTrackingType === transaction_enums_1.StockTrackingType.BATCH ||
                            detailDto.psdTrackingType === transaction_enums_1.StockTrackingType.SERIAL) {
                            await this.adjustItemBatchStockForBatch(tx, {
                                accYear: batchInput.psbAccYear,
                                companyId: batchInput.psbCompanyId,
                                branchId: batchInput.psbBranchId,
                                godownId: batchInput.psbGodownId,
                                itemId: batchInput.psbItemId,
                                unitId: batchInput.psbBaseUnitId,
                                batchId: batchInput.psbBatchId ?? null,
                                newDiffBaseQty: Number(batchInput.psbDiffBaseQty ?? 0),
                                prevDiffBaseQty: 0,
                            });
                        }
                    }
                }
                const document = await this.buildDocumentPayload(tx, header.psId);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: PHYSICAL_STOCK_TABLE_NAME,
                    screenName: PHYSICAL_STOCK_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: header.psId,
                    displayName: document.header.psc_refno,
                    originalRecord: null,
                    modifiedRecord: document.header,
                    userId: createPhysicalStockDto.psCreatedBy,
                    branchId: createPhysicalStockDto.psBranchId,
                }, tx);
                return document;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async validateHeaderReferences(tx, dto) {
        const [company, branch, godown] = await Promise.all([
            tx.company.findFirst({
                where: {
                    compId: dto.psCompanyId,
                    compIsActive: true,
                    compIsDeleted: false,
                },
                select: {
                    compId: true,
                },
            }),
            tx.branchMaster.findFirst({
                where: {
                    brId: dto.psBranchId,
                    brCompId: dto.psCompanyId,
                    brIsActive: true,
                    brIsDeleted: false,
                },
                select: {
                    brId: true,
                },
            }),
            tx.godownLocation.findFirst({
                where: {
                    gdlId: dto.psGodownId,
                    gdlBranchId: dto.psBranchId,
                    gdlIsActive: true,
                    gdlIsDeleted: false,
                },
                select: {
                    gdlId: true,
                },
            }),
        ]);
        const errors = [];
        if (!company) {
            errors.push({
                field: 'psCompanyId',
                message: `No active company found with id ${dto.psCompanyId}`,
            });
        }
        if (!branch) {
            errors.push({
                field: 'psBranchId',
                message: `No active branch found with id ${dto.psBranchId} for company ${dto.psCompanyId}`,
            });
        }
        if (!godown) {
            errors.push({
                field: 'psGodownId',
                message: `No active godown location found with id ${dto.psGodownId} for branch ${dto.psBranchId}`,
            });
        }
        if (errors.length > 0) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', errors);
        }
    }
    validateDocumentScopes(dto) {
        const errors = [];
        for (const [detailIndex, detail] of (dto.details ?? []).entries()) {
            const detailPath = `details[${detailIndex}]`;
            this.pushMismatchError(errors, `${detailPath}.psdAccYear`, detail.psdAccYear, dto.psAccYear);
            this.pushMismatchError(errors, `${detailPath}.psdCompanyId`, detail.psdCompanyId, dto.psCompanyId);
            this.pushMismatchError(errors, `${detailPath}.psdBranchId`, detail.psdBranchId, dto.psBranchId);
            this.pushMismatchError(errors, `${detailPath}.psdGodownId`, detail.psdGodownId, dto.psGodownId);
            for (const [batchIndex, batch] of (detail.batchDetails ?? []).entries()) {
                const batchPath = `${detailPath}.batchDetails[${batchIndex}]`;
                this.pushMismatchError(errors, `${batchPath}.psbAccYear`, batch.psbAccYear, detail.psdAccYear);
                this.pushMismatchError(errors, `${batchPath}.psbCompanyId`, batch.psbCompanyId, detail.psdCompanyId);
                this.pushMismatchError(errors, `${batchPath}.psbBranchId`, batch.psbBranchId, detail.psdBranchId);
                this.pushMismatchError(errors, `${batchPath}.psbGodownId`, batch.psbGodownId, detail.psdGodownId);
                this.pushMismatchError(errors, `${batchPath}.psbItemId`, batch.psbItemId, detail.psdItemId);
                this.pushMismatchError(errors, `${batchPath}.psbUnitId`, batch.psbUnitId, detail.psdUnitId);
                this.pushMismatchError(errors, `${batchPath}.psbBaseUnitId`, batch.psbBaseUnitId, detail.psdBaseUnitId);
                if ((detail.psdTrackingType === transaction_enums_1.StockTrackingType.BATCH ||
                    detail.psdTrackingType === transaction_enums_1.StockTrackingType.SERIAL) &&
                    !batch.psbBatchId) {
                    errors.push({
                        field: `${batchPath}.psbBatchId`,
                        message: `psbBatchId is required for ${detail.psdTrackingType}-tracked items`,
                    });
                }
            }
        }
        if (errors.length > 0) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', errors);
        }
    }
    pushMismatchError(errors, field, value, expected) {
        if (value === undefined || expected === undefined || value === expected) {
            return;
        }
        errors.push({
            field,
            message: `${field} must match ${expected}`,
        });
    }
    findAll() {
        return `This action returns all physicalStock`;
    }
    findOne(id) {
        return this.getById(String(id));
    }
    async update(id, updatePhysicalStockDto) {
        const psId = String(id);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existingHeader = await this.getActiveHeaderByIdOrThrow(tx, psId);
                const mergedHeader = this.mergeHeaderForUpdate(existingHeader, updatePhysicalStockDto);
                await this.validateHeaderReferences(tx, mergedHeader);
                if (updatePhysicalStockDto.details !== undefined) {
                    this.validateDocumentScopes({
                        ...mergedHeader,
                        details: updatePhysicalStockDto.details,
                    });
                }
                await tx.physicalStockHeader.update({
                    where: {
                        psId,
                    },
                    data: this.buildHeaderUpdateInput(updatePhysicalStockDto, existingHeader),
                });
                if (updatePhysicalStockDto.details !== undefined) {
                    await this.replaceDocumentDetails(tx, psId, updatePhysicalStockDto.details, mergedHeader);
                }
                return this.buildDocumentPayload(tx, psId);
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async remove(id) {
        const psId = String(id);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existingHeader = await this.getActiveHeaderByIdOrThrow(tx, psId);
                const now = new Date();
                const actorId = existingHeader.psModifiedBy ?? existingHeader.psCreatedBy;
                const details = await tx.physicalStockDetail.findMany({
                    where: {
                        psdPscId: psId,
                    },
                    select: {
                        psdId: true,
                    },
                });
                const detailIds = details.map((detail) => detail.psdId);
                if (detailIds.length > 0) {
                    await tx.physicalStockBatchDetail.updateMany({
                        where: {
                            psbPsdId: {
                                in: detailIds,
                            },
                            psbIsDeleted: false,
                        },
                        data: {
                            psbIsActive: false,
                            psbIsDeleted: true,
                            psbModifiedOn: now,
                            psbModifiedBy: actorId,
                        },
                    });
                }
                await tx.physicalStockDetail.updateMany({
                    where: {
                        psdPscId: psId,
                        psdIsDeleted: false,
                    },
                    data: {
                        psdIsActive: false,
                        psdIsDeleted: true,
                        psdModifiedOn: now,
                        psdModifiedBy: actorId,
                    },
                });
                await tx.physicalStockHeader.update({
                    where: {
                        psId,
                    },
                    data: {
                        psStatus: 'CANCELLED',
                        psIsActive: false,
                        psIsDeleted: true,
                        psCancelledOn: now,
                        psCancelledBy: actorId,
                        psModifiedOn: now,
                        psModifiedBy: actorId,
                    },
                });
                return {
                    ps_id: psId,
                    deleted: true,
                };
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Physical stock already exists', [
            {
                field: 'psDocNo',
                message: 'Duplicate physical stock document number is not allowed for the same accounting year, company, and branch',
            },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field: this.resolveForeignKeyField(error),
                    message: 'Referenced master record was not found or is inactive',
                },
            ]);
        }
    }
    resolveForeignKeyField(error) {
        const constraintName = this.getPrismaErrorMetaText(error).toLowerCase();
        const constraintFieldMap = [
            ['physical_stock_header_company', 'psCompanyId'],
            ['physical_stock_header_branch', 'psBranchId'],
            ['physical_stock_header_godown', 'psGodownId'],
            ['physical_stock_detail_company', 'details[].psdCompanyId'],
            ['physical_stock_detail_branch', 'details[].psdBranchId'],
            ['physical_stock_detail_godown', 'details[].psdGodownId'],
            ['physical_stock_detail_item', 'details[].psdItemId'],
            ['physical_stock_detail_base_unit', 'details[].psdBaseUnitId'],
            ['physical_stock_detail_unit', 'details[].psdUnitId'],
            ['physical_stock_detail_reason', 'details[].psdReasonId'],
            ['physical_stock_batch_detail_company', 'details[].batchDetails[].psbCompanyId'],
            ['physical_stock_batch_detail_branch', 'details[].batchDetails[].psbBranchId'],
            ['physical_stock_batch_detail_godown', 'details[].batchDetails[].psbGodownId'],
            ['physical_stock_batch_detail_item', 'details[].batchDetails[].psbItemId'],
            ['physical_stock_batch_detail_base_unit', 'details[].batchDetails[].psbBaseUnitId'],
            ['physical_stock_batch_detail_unit', 'details[].batchDetails[].psbUnitId'],
            ['physical_stock_batch_detail_reason', 'details[].batchDetails[].psbReasonId'],
            ['physical_stock_batch_detail_batch', 'details[].batchDetails[].psbBatchId'],
        ];
        return (constraintFieldMap.find(([constraint]) => constraintName.includes(constraint))?.[1] ??
            'request');
    }
    getPrismaErrorMetaText(error) {
        if (typeof error !== 'object' || error === null || !('meta' in error)) {
            return '';
        }
        const meta = error.meta;
        if (!meta) {
            return '';
        }
        return [meta.field_name, meta.constraint, meta.target]
            .filter((value) => typeof value === 'string')
            .join(' ');
    }
    buildScopedListWhere(queryDto) {
        const where = {
            psIsDeleted: false,
        };
        if (queryDto.ps_acc_year) {
            where.psAccYear = queryDto.ps_acc_year;
        }
        if (queryDto.ps_company_id) {
            where.psCompanyId = queryDto.ps_company_id;
        }
        if (queryDto.ps_branch_id) {
            where.psBranchId = queryDto.ps_branch_id;
        }
        if (queryDto.ps_status) {
            where.psStatus = queryDto.ps_status;
        }
        if (queryDto.date_from || queryDto.date_to) {
            where.psDocDate = {
                ...(queryDto.date_from ? { gte: new Date(queryDto.date_from) } : {}),
                ...(queryDto.date_to ? { lte: new Date(queryDto.date_to) } : {}),
            };
        }
        return where;
    }
    buildListWhere(queryDto) {
        const where = this.buildScopedListWhere(queryDto);
        const search = queryDto.search?.trim();
        if (!search) {
            return where;
        }
        const numericSearch = Number.parseInt(search.replace(/\D/g, ''), 10);
        where.OR = [
            {
                psDocRefNo: {
                    contains: search,
                    mode: 'insensitive',
                },
            },
            ...(Number.isInteger(numericSearch) && numericSearch > 0
                ? [
                    {
                        psDocNo: BigInt(numericSearch),
                    },
                ]
                : []),
        ];
        return where;
    }
    async getActiveHeaderByRefNoOrThrow(client, queryDto) {
        const refNo = queryDto.ps_doc_refno?.trim() ?? '';
        if (!refNo) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field: 'ps_doc_refno',
                    message: 'ps_doc_refno is required',
                },
            ]);
        }
        const where = this.buildScopedListWhere(queryDto);
        where.psDocRefNo = {
            equals: refNo,
            mode: 'insensitive',
        };
        const header = await client.physicalStockHeader.findFirst({
            where,
            orderBy: [{ psDocDate: 'desc' }, { psDocNo: 'desc' }, { psId: 'desc' }],
        });
        if (!header) {
            (0, module_service_utils_1.throwNotFound)('Physical stock document not found', 'ps_doc_refno', `No active physical stock document found with ref no ${refNo}`);
        }
        return header;
    }
    buildHeaderCreateInput(dto) {
        return {
            psId: dto.psId,
            psAccYear: dto.psAccYear,
            psCompanyId: dto.psCompanyId,
            psBranchId: dto.psBranchId,
            psGodownId: dto.psGodownId,
            psDocNo: this.toRequiredBigInt(dto.psDocNo, 'psDocNo'),
            psDocRefNo: dto.psDocRefNo ?? null,
            psDocDate: dto.psDocDate,
            psCountType: dto.psCountType,
            psCountedBy: dto.psCountedBy ?? null,
            psCountStartedOn: dto.psCountStartedOn,
            psCountCompletedOn: dto.psCountCompletedOn,
            psStockCutoffAt: dto.psStockCutoffAt,
            psFreezeStock: dto.psFreezeStock,
            psFreezeFrom: dto.psFreezeFrom,
            psFreezeTo: dto.psFreezeTo,
            psPostingMode: dto.psPostingMode,
            psRateSource: dto.psRateSource,
            psAdjustmentVoucherId: dto.psAdjustmentVoucherId ?? null,
            psTotalLines: dto.psTotalLines ?? dto.details?.length ?? 0,
            psTotalBookValue: dto.psTotalBookValue,
            psTotalCountedValue: dto.psTotalCountedValue,
            psNetVarianceValue: dto.psNetVarianceValue,
            psStatus: dto.psStatus,
            psApprovalRequired: dto.psApprovalRequired,
            psApprovedOn: dto.psApprovedOn,
            psApprovedBy: dto.psApprovedBy ?? null,
            psPostedOn: dto.psPostedOn,
            psPostedBy: dto.psPostedBy ?? null,
            psCancelledOn: dto.psCancelledOn,
            psCancelledBy: dto.psCancelledBy ?? null,
            psCancelReason: dto.psCancelReason ?? null,
            psDeviceType: dto.psDeviceType,
            psDeviceId: dto.psDeviceId ?? null,
            psCounterId: dto.psCounterId ?? null,
            psSessionId: dto.psSessionId ?? null,
            psRemarks: dto.psRemarks ?? null,
            psIsActive: dto.psIsActive,
            psIsDeleted: dto.psIsDeleted,
            psSyncDate: dto.psSyncDate,
            psCreatedOn: dto.psCreatedOn,
            psCreatedBy: dto.psCreatedBy,
            psModifiedOn: dto.psModifiedOn,
            psModifiedBy: dto.psModifiedBy ?? null,
        };
    }
    buildHeaderUpdateInput(dto, existingHeader) {
        const data = {
            psModifiedOn: dto.psModifiedOn ?? new Date(),
            psModifiedBy: dto.psModifiedBy ?? existingHeader.psModifiedBy ?? existingHeader.psCreatedBy,
        };
        if (dto.psAccYear !== undefined)
            data.psAccYear = dto.psAccYear;
        if (dto.psCompanyId !== undefined)
            data.psCompanyId = dto.psCompanyId;
        if (dto.psBranchId !== undefined)
            data.psBranchId = dto.psBranchId;
        if (dto.psGodownId !== undefined)
            data.psGodownId = dto.psGodownId;
        if (dto.psDocNo !== undefined)
            data.psDocNo = this.toRequiredBigInt(dto.psDocNo, 'psDocNo');
        if (dto.psDocRefNo !== undefined)
            data.psDocRefNo = dto.psDocRefNo;
        if (dto.psDocDate !== undefined)
            data.psDocDate = dto.psDocDate;
        if (dto.psCountType !== undefined)
            data.psCountType = dto.psCountType;
        if (dto.psCountedBy !== undefined)
            data.psCountedBy = dto.psCountedBy;
        if (dto.psCountStartedOn !== undefined)
            data.psCountStartedOn = dto.psCountStartedOn;
        if (dto.psCountCompletedOn !== undefined)
            data.psCountCompletedOn = dto.psCountCompletedOn;
        if (dto.psStockCutoffAt !== undefined)
            data.psStockCutoffAt = dto.psStockCutoffAt;
        if (dto.psFreezeStock !== undefined)
            data.psFreezeStock = dto.psFreezeStock;
        if (dto.psFreezeFrom !== undefined)
            data.psFreezeFrom = dto.psFreezeFrom;
        if (dto.psFreezeTo !== undefined)
            data.psFreezeTo = dto.psFreezeTo;
        if (dto.psPostingMode !== undefined)
            data.psPostingMode = dto.psPostingMode;
        if (dto.psRateSource !== undefined)
            data.psRateSource = dto.psRateSource;
        if (dto.psAdjustmentVoucherId !== undefined) {
            data.psAdjustmentVoucherId = dto.psAdjustmentVoucherId;
        }
        if (dto.psTotalLines !== undefined)
            data.psTotalLines = dto.psTotalLines;
        if (dto.psTotalLines === undefined && dto.details !== undefined) {
            data.psTotalLines = dto.details.length;
        }
        if (dto.psTotalBookValue !== undefined)
            data.psTotalBookValue = dto.psTotalBookValue;
        if (dto.psTotalCountedValue !== undefined) {
            data.psTotalCountedValue = dto.psTotalCountedValue;
        }
        if (dto.psNetVarianceValue !== undefined)
            data.psNetVarianceValue = dto.psNetVarianceValue;
        if (dto.psStatus !== undefined)
            data.psStatus = dto.psStatus;
        if (dto.psApprovalRequired !== undefined)
            data.psApprovalRequired = dto.psApprovalRequired;
        if (dto.psApprovedOn !== undefined)
            data.psApprovedOn = dto.psApprovedOn;
        if (dto.psApprovedBy !== undefined)
            data.psApprovedBy = dto.psApprovedBy;
        if (dto.psPostedOn !== undefined)
            data.psPostedOn = dto.psPostedOn;
        if (dto.psPostedBy !== undefined)
            data.psPostedBy = dto.psPostedBy;
        if (dto.psCancelledOn !== undefined)
            data.psCancelledOn = dto.psCancelledOn;
        if (dto.psCancelledBy !== undefined)
            data.psCancelledBy = dto.psCancelledBy;
        if (dto.psCancelReason !== undefined)
            data.psCancelReason = dto.psCancelReason;
        if (dto.psDeviceType !== undefined)
            data.psDeviceType = dto.psDeviceType;
        if (dto.psDeviceId !== undefined)
            data.psDeviceId = dto.psDeviceId;
        if (dto.psCounterId !== undefined)
            data.psCounterId = dto.psCounterId;
        if (dto.psSessionId !== undefined)
            data.psSessionId = dto.psSessionId;
        if (dto.psRemarks !== undefined)
            data.psRemarks = dto.psRemarks;
        if (dto.psIsActive !== undefined)
            data.psIsActive = dto.psIsActive;
        if (dto.psSyncDate !== undefined)
            data.psSyncDate = dto.psSyncDate;
        return data;
    }
    buildDetailCreateInput(detail, headerId, rowNo, header) {
        const variance = this.calculateVarianceValues({
            bookQty: detail.psdBookQty,
            bookBaseQty: detail.psdBookBaseQty,
            physicalQty: detail.psdPhysicalQty,
            physicalBaseQty: detail.psdPhysicalBaseQty,
            stockRateWot: detail.psdStockRateWot,
            stockRateWithTax: detail.psdStockRateWithTax,
            diffQty: detail.psdDiffQty,
            diffBaseQty: detail.psdDiffBaseQty,
            bookValueWot: detail.psdBookValueWot,
            physicalValueWot: detail.psdPhysicalValueWot,
            diffValueWot: detail.psdDiffValueWot,
            diffValueWithTax: detail.psdDiffValueWithTax,
        });
        return {
            psdId: detail.psdId,
            psdPscId: headerId,
            psdRowNo: detail.psdRowNo ?? rowNo,
            psdAccYear: detail.psdAccYear,
            psdCompanyId: detail.psdCompanyId,
            psdBranchId: detail.psdBranchId,
            psdGodownId: detail.psdGodownId,
            psdItemId: detail.psdItemId,
            psdUnitId: detail.psdUnitId,
            psdBaseUnitId: detail.psdBaseUnitId,
            psdToBaseFactor: detail.psdToBaseFactor,
            psdBarcode: detail.psdBarcode ?? null,
            psdMrp: detail.psdMrp,
            psdTrackingType: detail.psdTrackingType,
            psdBookQty: detail.psdBookQty,
            psdBookBaseQty: detail.psdBookBaseQty,
            psdPhysicalQty: detail.psdPhysicalQty,
            psdPhysicalBaseQty: detail.psdPhysicalBaseQty,
            psdDiffQty: variance.diffQty,
            psdDiffBaseQty: variance.diffBaseQty,
            psdStockRateWot: detail.psdStockRateWot,
            psdStockRateWithTax: detail.psdStockRateWithTax,
            psdBookValueWot: variance.bookValueWot,
            psdPhysicalValueWot: variance.physicalValueWot,
            psdDiffValueWot: variance.diffValueWot,
            psdDiffValueWithTax: variance.diffValueWithTax,
            psdReasonId: detail.psdReasonId ?? null,
            psdResolution: detail.psdResolution,
            psdNotes: detail.psdNotes ?? null,
            psdIsPosted: detail.psdIsPosted,
            psdIsActive: detail.psdIsActive,
            psdIsDeleted: detail.psdIsDeleted,
            psdSyncDate: detail.psdSyncDate,
            psdCreatedOn: detail.psdCreatedOn,
            psdCreatedBy: detail.psdCreatedBy ?? header.psCreatedBy,
            psdModifiedOn: detail.psdModifiedOn,
            psdModifiedBy: detail.psdModifiedBy ?? header.psModifiedBy ?? null,
        };
    }
    buildBatchDetailCreateInput(batch, detailId, headerId, rowNo, detail, header) {
        const variance = this.calculateVarianceValues({
            bookQty: batch.psbBookQty,
            bookBaseQty: batch.psbBookBaseQty,
            physicalQty: batch.psbPhysicalQty,
            physicalBaseQty: batch.psbPhysicalBaseQty,
            stockRateWot: batch.psbStockRateWot,
            stockRateWithTax: batch.psbStockRateWithTax,
            diffQty: batch.psbDiffQty,
            diffBaseQty: batch.psbDiffBaseQty,
            bookValueWot: batch.psbBookValueWot,
            physicalValueWot: batch.psbPhysicalValueWot,
            diffValueWot: batch.psbDiffValueWot,
            diffValueWithTax: batch.psbDiffValueWithTax,
        });
        return {
            psbId: batch.psbId,
            psbPsdId: detailId,
            psbPshId: headerId,
            psbRowNo: batch.psbRowNo ?? rowNo,
            psbAccYear: batch.psbAccYear ?? detail.psdAccYear,
            psbCompanyId: batch.psbCompanyId ?? detail.psdCompanyId,
            psbBranchId: batch.psbBranchId ?? detail.psdBranchId,
            psbGodownId: batch.psbGodownId ?? detail.psdGodownId,
            psbItemId: batch.psbItemId ?? detail.psdItemId,
            psbUnitId: batch.psbUnitId ?? detail.psdUnitId,
            psbBaseUnitId: batch.psbBaseUnitId ?? detail.psdBaseUnitId,
            psbToBaseFactor: batch.psbToBaseFactor ?? detail.psdToBaseFactor,
            psbBatchId: batch.psbBatchId ?? null,
            psbBatchNo: batch.psbBatchNo ?? null,
            psbMfgBatchNo: batch.psbMfgBatchNo ?? null,
            psbBatchDate: batch.psbBatchDate,
            psbMfgDate: batch.psbMfgDate,
            psbExpiryDate: batch.psbExpiryDate,
            psbMrp: batch.psbMrp ?? detail.psdMrp,
            psbBarcode: batch.psbBarcode ?? detail.psdBarcode ?? null,
            psbSerialNo: batch.psbSerialNo ?? null,
            psbBookQty: batch.psbBookQty,
            psbBookBaseQty: batch.psbBookBaseQty,
            psbPhysicalQty: batch.psbPhysicalQty,
            psbPhysicalBaseQty: batch.psbPhysicalBaseQty,
            psbDiffQty: variance.diffQty,
            psbDiffBaseQty: variance.diffBaseQty,
            psbStockRateWot: batch.psbStockRateWot,
            psbStockRateWithTax: batch.psbStockRateWithTax,
            psbBookValueWot: variance.bookValueWot,
            psbPhysicalValueWot: variance.physicalValueWot,
            psbDiffValueWot: variance.diffValueWot,
            psbDiffValueWithTax: variance.diffValueWithTax,
            psbReasonId: batch.psbReasonId ?? detail.psdReasonId ?? null,
            psbResolution: batch.psbResolution ?? detail.psdResolution,
            psbNotes: batch.psbNotes ?? null,
            psbIsPosted: batch.psbIsPosted,
            psbIsActive: batch.psbIsActive,
            psbIsDeleted: batch.psbIsDeleted,
            psbSyncDate: batch.psbSyncDate,
            psbCreatedOn: batch.psbCreatedOn,
            psbCreatedBy: batch.psbCreatedBy ?? detail.psdCreatedBy ?? header.psCreatedBy,
            psbModifiedOn: batch.psbModifiedOn,
            psbModifiedBy: batch.psbModifiedBy ?? detail.psdModifiedBy ?? header.psModifiedBy ?? null,
        };
    }
    calculateVarianceValues(input) {
        const bookQty = input.bookQty ?? 0;
        const bookBaseQty = input.bookBaseQty ?? bookQty;
        const physicalQty = input.physicalQty ?? 0;
        const physicalBaseQty = input.physicalBaseQty ?? physicalQty;
        const stockRateWot = input.stockRateWot ?? 0;
        const stockRateWithTax = input.stockRateWithTax ?? stockRateWot;
        const diffQty = input.diffQty ?? this.roundQuantity(physicalQty - bookQty);
        const diffBaseQty = input.diffBaseQty ?? this.roundQuantity(physicalBaseQty - bookBaseQty);
        return {
            diffQty,
            diffBaseQty,
            bookValueWot: input.bookValueWot ?? this.roundAmount(bookBaseQty * stockRateWot),
            physicalValueWot: input.physicalValueWot ?? this.roundAmount(physicalBaseQty * stockRateWot),
            diffValueWot: input.diffValueWot ?? this.roundAmount(diffBaseQty * stockRateWot),
            diffValueWithTax: input.diffValueWithTax ?? this.roundAmount(diffBaseQty * stockRateWithTax),
        };
    }
    async buildDocumentPayload(client, headerId) {
        const document = await client.physicalStockHeader.findFirst({
            where: {
                psId: headerId,
                psIsDeleted: false,
            },
            include: PHYSICAL_STOCK_DOCUMENT_INCLUDE,
        });
        if (!document) {
            (0, module_service_utils_1.throwNotFound)('Physical stock document not found', 'ps_id', `Physical stock header ${headerId} not found`);
        }
        return this.toDocumentResponse(document);
    }
    async getActiveHeaderByIdOrThrow(client, psId) {
        const header = await client.physicalStockHeader.findFirst({
            where: {
                psId,
                psIsDeleted: false,
            },
        });
        if (!header) {
            (0, module_service_utils_1.throwNotFound)('Physical stock document not found', 'psId', `No active physical stock document found with psId ${psId}`);
        }
        return header;
    }
    mergeHeaderForUpdate(existingHeader, dto) {
        return {
            psId: existingHeader.psId,
            psAccYear: dto.psAccYear ?? existingHeader.psAccYear,
            psCompanyId: dto.psCompanyId ?? existingHeader.psCompanyId,
            psBranchId: dto.psBranchId ?? existingHeader.psBranchId,
            psGodownId: dto.psGodownId ?? existingHeader.psGodownId,
            psCreatedBy: dto.psCreatedBy ?? existingHeader.psCreatedBy,
            psModifiedBy: dto.psModifiedBy ?? existingHeader.psModifiedBy ?? existingHeader.psCreatedBy,
        };
    }
    async replaceDocumentDetails(tx, psId, details, header) {
        const existingBatchDetails = await tx.physicalStockBatchDetail.findMany({
            where: { psbPshId: psId },
            select: { psbId: true, psbDiffBaseQty: true },
        });
        const prevDiffBaseQtyByPsbId = new Map(existingBatchDetails.map((b) => [b.psbId, Number(b.psbDiffBaseQty ?? 0)]));
        const existingDetails = await tx.physicalStockDetail.findMany({
            where: {
                psdPscId: psId,
            },
            select: {
                psdId: true,
            },
        });
        const detailIds = existingDetails.map((detail) => detail.psdId);
        if (detailIds.length > 0) {
            await tx.physicalStockBatchDetail.deleteMany({
                where: {
                    psbPsdId: {
                        in: detailIds,
                    },
                },
            });
        }
        await tx.physicalStockDetail.deleteMany({
            where: {
                psdPscId: psId,
            },
        });
        for (const [detailIndex, detailDto] of details.entries()) {
            const detail = await tx.physicalStockDetail.create({
                data: this.buildDetailCreateInput(detailDto, psId, detailIndex + 1, header),
            });
            for (const [batchIndex, batchDto] of (detailDto.batchDetails ?? []).entries()) {
                const batchInput = this.buildBatchDetailCreateInput(batchDto, detail.psdId, psId, batchIndex + 1, detailDto, header);
                await tx.physicalStockBatchDetail.create({ data: batchInput });
                if (detailDto.psdTrackingType === transaction_enums_1.StockTrackingType.BATCH ||
                    detailDto.psdTrackingType === transaction_enums_1.StockTrackingType.SERIAL) {
                    const prevDiffBaseQty = batchDto.psbId !== undefined && prevDiffBaseQtyByPsbId.has(batchDto.psbId)
                        ? prevDiffBaseQtyByPsbId.get(batchDto.psbId)
                        : 0;
                    await this.adjustItemBatchStockForBatch(tx, {
                        accYear: batchInput.psbAccYear,
                        companyId: batchInput.psbCompanyId,
                        branchId: batchInput.psbBranchId,
                        godownId: batchInput.psbGodownId,
                        itemId: batchInput.psbItemId,
                        unitId: batchInput.psbBaseUnitId,
                        batchId: batchInput.psbBatchId ?? null,
                        newDiffBaseQty: Number(batchInput.psbDiffBaseQty ?? 0),
                        prevDiffBaseQty,
                    });
                }
            }
        }
    }
    toDocumentResponse(document) {
        return {
            header: this.toHeaderResponse(document),
            details: document.details.map((detail) => ({
                psd_id: detail.psdId,
                psd_psc_id: detail.psdPscId,
                psd_row_no: detail.psdRowNo,
                psd_acc_year: detail.psdAccYear,
                psd_company_id: detail.psdCompanyId,
                psd_branch_id: detail.psdBranchId,
                psd_godown_id: detail.psdGodownId,
                psd_godown_name: detail.godown?.gdlName ?? null,
                psd_item_id: detail.psdItemId,
                psd_item_code: detail.item?.itemCode ?? null,
                psd_item_name: detail.item?.itemNameEn ?? null,
                psd_unit_id: detail.psdUnitId,
                psd_unit_name: detail.unit?.unit_name ?? null,
                psd_base_unit_id: detail.psdBaseUnitId,
                psd_base_unit_name: detail.baseUnit?.unit_name ?? null,
                psd_to_base_factor: this.toNumber(detail.psdToBaseFactor),
                psd_barcode: detail.psdBarcode,
                psd_mrp: this.toNumber(detail.psdMrp),
                psd_tracking_type: detail.psdTrackingType,
                psd_book_qty: this.toNumber(detail.psdBookQty),
                psd_book_base_qty: this.toNumber(detail.psdBookBaseQty),
                psd_physical_qty: this.toNumber(detail.psdPhysicalQty),
                psd_physical_base_qty: this.toNumber(detail.psdPhysicalBaseQty),
                psd_diff_qty: this.toNumber(detail.psdDiffQty),
                psd_diff_base_qty: this.toNumber(detail.psdDiffBaseQty),
                psd_stock_rate_wot: this.toNumber(detail.psdStockRateWot),
                psd_stock_rate_with_tax: this.toNumber(detail.psdStockRateWithTax),
                psd_reason_id: detail.psdReasonId,
                psd_resolution: detail.psdResolution,
                psd_notes: detail.psdNotes,
                batch_details: detail.batchDetails.map((batch) => ({
                    psb_id: batch.psbId,
                    psb_psd_id: batch.psbPsdId,
                    psb_row_no: batch.psbRowNo,
                    psb_psh_id: batch.psbPshId,
                    psb_acc_year: batch.psbAccYear,
                    psb_company_id: batch.psbCompanyId,
                    psb_branch_id: batch.psbBranchId,
                    psb_godown_id: batch.psbGodownId,
                    psb_item_id: batch.psbItemId,
                    psb_unit_id: batch.psbUnitId,
                    psb_base_unit_id: batch.psbBaseUnitId,
                    psb_to_base_factor: this.toNumber(batch.psbToBaseFactor),
                    psb_batch_id: batch.psbBatchId,
                    psb_batch_no: batch.psbBatchNo,
                    psb_mfg_batch_no: batch.psbMfgBatchNo,
                    psb_batch_date: this.toNullableIsoString(batch.psbBatchDate),
                    psb_mfg_date: this.toNullableIsoString(batch.psbMfgDate),
                    psb_expiry_date: this.toNullableIsoString(batch.psbExpiryDate),
                    psb_mrp: this.toNumber(batch.psbMrp),
                    psb_barcode: batch.psbBarcode,
                    psb_serial_no: batch.psbSerialNo,
                    psb_book_qty: this.toNumber(batch.psbBookQty),
                    psb_book_base_qty: this.toNumber(batch.psbBookBaseQty),
                    psb_physical_qty: this.toNumber(batch.psbPhysicalQty),
                    psb_physical_base_qty: this.toNumber(batch.psbPhysicalBaseQty),
                    psb_diff_qty: this.toNumber(batch.psbDiffQty),
                    psb_diff_base_qty: this.toNumber(batch.psbDiffBaseQty),
                    psb_stock_rate_wot: this.toNumber(batch.psbStockRateWot),
                    psb_stock_rate_with_tax: this.toNumber(batch.psbStockRateWithTax),
                    psb_reason_id: batch.psbReasonId,
                    psb_resolution: batch.psbResolution,
                    psb_notes: batch.psbNotes,
                })),
            })),
        };
    }
    toHeaderResponse(record) {
        const godown = 'godown' in record ? record.godown : null;
        return {
            psc_id: record.psId,
            psc_refno: record.psDocRefNo ?? record.psDocNo.toString(),
            psc_date: this.formatDate(record.psDocDate),
            psc_acc_year: record.psAccYear,
            psc_company_id: record.psCompanyId,
            psc_branch_id: record.psBranchId,
            psc_godown_id: record.psGodownId,
            psc_godown_name: godown?.gdlName ?? null,
            psc_doc_no: record.psDocNo.toString(),
            psc_status: record.psStatus,
            psc_total_lines: record.psTotalLines,
            psc_total_book_value: this.toNumber(record.psTotalBookValue),
            psc_total_counted_value: this.toNumber(record.psTotalCountedValue),
            psc_net_variance_value: this.toNumber(record.psNetVarianceValue),
            psc_device_type: record.psDeviceType,
            psc_device_id: record.psDeviceId,
            psc_counter_id: record.psCounterId,
            psc_session_id: record.psSessionId,
            psc_remarks: record.psRemarks,
            psc_is_active: record.psIsActive,
            psc_is_deleted: record.psIsDeleted,
            psc_created_on: record.psCreatedOn.toISOString(),
            psc_created_by: record.psCreatedBy,
            psc_modified_on: this.toNullableIsoString(record.psModifiedOn),
            psc_modified_by: record.psModifiedBy,
        };
    }
    toRequiredBigInt(value, field) {
        if (value === undefined || value === null) {
            throw new common_1.BadRequestException(`${field} is required`);
        }
        if (!Number.isInteger(value) || value <= 0) {
            throw new common_1.BadRequestException(`${field} must be a positive integer`);
        }
        return BigInt(value);
    }
    roundQuantity(value) {
        return Number(value.toFixed(6));
    }
    roundAmount(value) {
        return Number(value.toFixed(2));
    }
    formatDate(value) {
        return value.toISOString().slice(0, 10);
    }
    toNullableIsoString(value) {
        return value ? value.toISOString() : null;
    }
    toNumber(value) {
        if (value === null || value === undefined) {
            return 0;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    async adjustItemBatchStockForBatch(tx, params) {
        if (!params.batchId)
            return;
        const delta = this.roundQuantity(params.newDiffBaseQty - params.prevDiffBaseQty);
        if (delta === 0)
            return;
        const scopeKey = {
            ibsAccYear: params.accYear,
            ibsCompanyId: params.companyId,
            ibsBranchId: params.branchId,
            ibsGodownId: params.godownId,
            ibsItemId: params.itemId,
            ibsBatchId: params.batchId,
            ibsStockBucket: 'SALEABLE',
        };
        const incrData = delta > 0
            ? { ibsInQty: { increment: delta } }
            : { ibsOutQty: { increment: -delta } };
        const createQty = delta > 0
            ? { ibsInQty: delta, ibsOutQty: 0 }
            : { ibsInQty: 0, ibsOutQty: -delta };
        await tx.itemBatchStock.upsert({
            where: {
                ibsAccYear_ibsCompanyId_ibsBranchId_ibsGodownId_ibsItemId_ibsBatchId_ibsStockBucket: scopeKey,
            },
            create: {
                ...scopeKey,
                ibsUnitId: params.unitId,
                ...createQty,
                ibsIsActive: true,
                ibsIsDeleted: false,
            },
            update: incrData,
        });
    }
};
exports.PhysicalStockService = PhysicalStockService;
exports.PhysicalStockService = PhysicalStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], PhysicalStockService);
//# sourceMappingURL=physical-stock.service.js.map