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
exports.PromotionLoyaltyPointsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const loyalty_utils_1 = require("./utils/loyalty.utils");
const LOYALTY_SCREEN_NAME = 'Promotion Loyalty Points';
const LOYALTY_SCHEME_TABLE_NAME = 'loyalty scheme list';
const LOYALTY_POINTS_TABLE_NAME = 'loyalty scheme points';
const LOYALTY_GIFT_TABLE_NAME = 'loyalty scheme gift';
const LOYALTY_PARTY_TABLE_NAME = 'loyalty scheme party scope';
let PromotionLoyaltyPointsService = class PromotionLoyaltyPointsService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async saveScheme(dto) {
        if (dto.ls_id) {
            return this.updateScheme(dto);
        }
        return this.createScheme(dto);
    }
    async getSchemeById(lsId) {
        const scheme = await this.findActiveSchemeWithChildren(this.prisma, lsId);
        if (!scheme) {
            this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
        }
        return (0, loyalty_utils_1.toSchemePayload)(scheme);
    }
    async softDeleteScheme(lsId, lsUpdatedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await this.findActiveSchemeWithChildren(tx, lsId);
            if (!existing) {
                this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
            }
            const updatedOn = new Date();
            const updatedBy = (0, loyalty_utils_1.resolveActorUuid)(lsUpdatedBy, this.requestContextService.getUserId());
            const updatedScheme = await tx.loyaltyScheme.update({
                where: { lsId },
                data: {
                    lsIsDeleted: true,
                    lsIsActive: false,
                    lsUpdatedOn: updatedOn,
                    lsUpdatedBy: updatedBy,
                },
            });
            await Promise.all([
                tx.loyaltySchemeParty.updateMany({
                    where: { lpsLsId: lsId, lpsIsDeleted: false },
                    data: {
                        lpsIsDeleted: true,
                        lpsIsActive: false,
                        lpsUpdatedOn: updatedOn,
                        lpsUpdatedBy: updatedBy,
                    },
                }),
                tx.loyaltySchemePoint.updateMany({
                    where: { lsptLsId: lsId, lsptIsDeleted: false },
                    data: {
                        lsptIsDeleted: true,
                        lsptIsActive: false,
                        lsptUpdatedOn: updatedOn,
                        lsptUpdatedBy: updatedBy,
                    },
                }),
                tx.loyaltySchemeGift.updateMany({
                    where: { lsgLsId: lsId, lsgIsDeleted: false },
                    data: {
                        lsgIsDeleted: true,
                        lsgIsActive: false,
                        lsgUpdatedOn: updatedOn,
                        lsgUpdatedBy: updatedBy,
                    },
                }),
            ]);
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: LOYALTY_SCHEME_TABLE_NAME,
                screenName: LOYALTY_SCREEN_NAME,
                screenType: 'master',
                pk: lsId,
                displayName: existing.lsName,
                originalRecord: (0, loyalty_utils_1.toSchemePayload)(existing),
                modifiedRecord: (0, loyalty_utils_1.toSchemePayload)({
                    ...updatedScheme,
                    parties: existing.parties.map((party) => ({
                        ...party,
                        lpsIsDeleted: true,
                        lpsIsActive: false,
                        lpsUpdatedOn: updatedOn,
                        lpsUpdatedBy: updatedBy,
                    })),
                    points: existing.points.map((point) => ({
                        ...point,
                        lsptIsDeleted: true,
                        lsptIsActive: false,
                        lsptUpdatedOn: updatedOn,
                        lsptUpdatedBy: updatedBy,
                    })),
                    gifts: existing.gifts.map((gift) => ({
                        ...gift,
                        lsgIsDeleted: true,
                        lsgIsActive: false,
                        lsgUpdatedOn: updatedOn,
                        lsgUpdatedBy: updatedBy,
                    })),
                }),
                userId: this.resolveAuditActor(),
                notes: 'Loyalty scheme soft deleted',
            }, tx);
            return { ls_id: lsId, deleted: true };
        });
    }
    async savePoint(dto) {
        if (dto.lspt_id) {
            return this.updatePoint(dto);
        }
        return this.createPoint(dto);
    }
    async getPointById(lsptId) {
        const point = await this.prisma.loyaltySchemePoint.findFirst({
            where: { lsptId, lsptIsDeleted: false },
        });
        if (!point) {
            this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
        }
        return (0, loyalty_utils_1.toPointPayload)(point);
    }
    async softDeletePoint(lsptId, lsptUpdatedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.loyaltySchemePoint.findFirst({
                where: { lsptId, lsptIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
            }
            const updatedOn = new Date();
            const updatedBy = (0, loyalty_utils_1.resolveActorUuid)(lsptUpdatedBy, this.requestContextService.getUserId());
            const updated = await tx.loyaltySchemePoint.update({
                where: { lsptId },
                data: {
                    lsptIsDeleted: true,
                    lsptIsActive: false,
                    lsptUpdatedOn: updatedOn,
                    lsptUpdatedBy: updatedBy,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: LOYALTY_POINTS_TABLE_NAME,
                screenName: LOYALTY_SCREEN_NAME,
                screenType: 'master',
                pk: lsptId,
                displayName: (0, loyalty_utils_1.buildPointDisplayName)(existing.lsptLsId, existing.lsptSlno),
                originalRecord: (0, loyalty_utils_1.toPointPayload)(existing),
                modifiedRecord: (0, loyalty_utils_1.toPointPayload)(updated),
                userId: this.resolveAuditActor(),
                notes: 'Loyalty point soft deleted',
            }, tx);
            return { lspt_id: lsptId, deleted: true };
        });
    }
    async saveGift(dto) {
        if (dto.lsg_id) {
            return this.updateGift(dto);
        }
        return this.createGift(dto);
    }
    async getGiftById(lsgId) {
        const gift = await this.prisma.loyaltySchemeGift.findFirst({
            where: { lsgId, lsgIsDeleted: false },
        });
        if (!gift) {
            this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
        }
        return (0, loyalty_utils_1.toGiftPayload)(gift);
    }
    async softDeleteGift(lsgId, lsgUpdatedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.loyaltySchemeGift.findFirst({
                where: { lsgId, lsgIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
            }
            const updatedOn = new Date();
            const updatedBy = (0, loyalty_utils_1.resolveActorUuid)(lsgUpdatedBy, this.requestContextService.getUserId());
            const updated = await tx.loyaltySchemeGift.update({
                where: { lsgId },
                data: {
                    lsgIsDeleted: true,
                    lsgIsActive: false,
                    lsgUpdatedOn: updatedOn,
                    lsgUpdatedBy: updatedBy,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: LOYALTY_GIFT_TABLE_NAME,
                screenName: LOYALTY_SCREEN_NAME,
                screenType: 'master',
                pk: lsgId,
                displayName: (0, loyalty_utils_1.buildGiftDisplayName)(existing.lsgLsId, existing.lsgSlno),
                originalRecord: (0, loyalty_utils_1.toGiftPayload)(existing),
                modifiedRecord: (0, loyalty_utils_1.toGiftPayload)(updated),
                userId: this.resolveAuditActor(),
                notes: 'Loyalty gift soft deleted',
            }, tx);
            return { lsg_id: lsgId, deleted: true };
        });
    }
    async createScheme(dto) {
        const now = new Date();
        const actorId = (0, loyalty_utils_1.resolveActorUuid)(this.requestContextService.getUserId());
        const lsCode = (0, loyalty_utils_1.normalizeNullableString)(dto.ls_code);
        const lsCompId = (0, loyalty_utils_1.requireUuid)(dto.ls_comp_id, 'ls_comp_id');
        const lsStartDate = (0, loyalty_utils_1.requireDate)(dto.ls_start_date, 'ls_start_date');
        const lsEndDate = (0, loyalty_utils_1.requireDate)(dto.ls_end_date, 'ls_end_date');
        const lsCreatedBy = (0, loyalty_utils_1.resolveActorUuid)(dto.ls_created_by, actorId);
        const lsUpdatedBy = (0, loyalty_utils_1.resolveActorUuid)(dto.ls_updated_by, lsCreatedBy, actorId);
        const data = {
            lsName: (0, loyalty_utils_1.requireString)(dto.ls_name, 'ls_name'),
            lsType: (0, loyalty_utils_1.requireString)(dto.ls_type, 'ls_type'),
            lsStartDate,
            lsEndDate,
            lsCompId,
            lsCode,
            lsCreatedOn: now,
            lsCreatedBy,
        };
        (0, loyalty_utils_1.ensureDateRange)(lsStartDate, lsEndDate);
        (0, loyalty_utils_1.applyOptionalSchemeFields)(data, dto, actorId);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureSchemeCodeUnique(tx, lsCompId, lsCode);
                const created = await tx.loyaltyScheme.create({ data });
                const parties = await this.syncSchemeParties(tx, created.lsId, dto.parties, actorId);
                const payload = (0, loyalty_utils_1.toSchemePayload)({ ...created, parties, points: [], gifts: [] });
                await this.auditLogService.logEntityChange({
                    action: 'insert',
                    tableName: LOYALTY_SCHEME_TABLE_NAME,
                    screenName: LOYALTY_SCREEN_NAME,
                    screenType: 'master',
                    pk: created.lsId,
                    displayName: created.lsName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.resolveAuditActor(),
                    notes: 'Loyalty scheme created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, loyalty_utils_1.handleLoyaltyWriteError)(error);
            throw error;
        }
    }
    async updateScheme(dto) {
        const lsId = (0, loyalty_utils_1.requireUuid)(dto.ls_id, 'ls_id');
        const actorId = (0, loyalty_utils_1.resolveActorUuid)(this.requestContextService.getUserId());
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await this.findActiveSchemeWithChildren(tx, lsId);
                if (!existing) {
                    this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
                }
                const effectiveStartDate = (0, module_service_utils_1.hasOwnProperty)(dto, 'ls_start_date')
                    ? (0, loyalty_utils_1.requireDate)(dto.ls_start_date, 'ls_start_date')
                    : existing.lsStartDate;
                const effectiveEndDate = (0, module_service_utils_1.hasOwnProperty)(dto, 'ls_end_date')
                    ? (0, loyalty_utils_1.requireDate)(dto.ls_end_date, 'ls_end_date')
                    : existing.lsEndDate;
                const effectiveCompId = (0, module_service_utils_1.hasOwnProperty)(dto, 'ls_comp_id')
                    ? (0, loyalty_utils_1.requireUuid)(dto.ls_comp_id, 'ls_comp_id')
                    : existing.lsCompId;
                const effectiveCode = (0, module_service_utils_1.hasOwnProperty)(dto, 'ls_code')
                    ? (0, loyalty_utils_1.normalizeNullableString)(dto.ls_code)
                    : existing.lsCode;
                (0, loyalty_utils_1.ensureDateRange)(effectiveStartDate, effectiveEndDate);
                await this.ensureSchemeCodeUnique(tx, effectiveCompId, effectiveCode, lsId);
                const data = {
                    lsUpdatedOn: new Date(),
                    lsUpdatedBy: (0, loyalty_utils_1.resolveActorUuid)(dto.ls_updated_by, actorId),
                };
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ls_name')) {
                    data.lsName = (0, loyalty_utils_1.requireString)(dto.ls_name, 'ls_name');
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ls_type')) {
                    data.lsType = (0, loyalty_utils_1.requireString)(dto.ls_type, 'ls_type');
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ls_start_date')) {
                    data.lsStartDate = effectiveStartDate;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ls_end_date')) {
                    data.lsEndDate = effectiveEndDate;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ls_comp_id')) {
                    data.lsCompId = effectiveCompId;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'ls_code')) {
                    data.lsCode = effectiveCode;
                }
                (0, loyalty_utils_1.applyOptionalSchemeFields)(data, dto, actorId);
                const updated = await tx.loyaltyScheme.update({
                    where: { lsId },
                    data,
                });
                const parties = await this.syncSchemeParties(tx, lsId, dto.parties, actorId);
                const payload = (0, loyalty_utils_1.toSchemePayload)({
                    ...updated,
                    parties: (0, module_service_utils_1.hasOwnProperty)(dto, 'parties') ? parties : existing.parties,
                    points: existing.points,
                    gifts: existing.gifts,
                });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: LOYALTY_SCHEME_TABLE_NAME,
                    screenName: LOYALTY_SCREEN_NAME,
                    screenType: 'master',
                    pk: lsId,
                    displayName: updated.lsName,
                    originalRecord: (0, loyalty_utils_1.toSchemePayload)(existing),
                    modifiedRecord: payload,
                    userId: this.resolveAuditActor(),
                    notes: 'Loyalty scheme updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, loyalty_utils_1.handleLoyaltyWriteError)(error);
            throw error;
        }
    }
    calculatePointFactor(points, each) {
        const normalizedPoints = (0, loyalty_utils_1.requireNumber)(points, 'lspt_points', 0);
        const normalizedEach = (0, loyalty_utils_1.requireNumber)(each, 'lspt_each', Number.EPSILON);
        if (normalizedEach <= 0) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'lspt_each',
                    message: 'lspt_each must be greater than 0',
                },
            ]);
        }
        return normalizedPoints / normalizedEach;
    }
    async createPoint(dto) {
        const now = new Date();
        const actorId = (0, loyalty_utils_1.resolveActorUuid)(this.requestContextService.getUserId());
        const lsptLsId = (0, loyalty_utils_1.requireUuid)(dto.lspt_ls_id, 'lspt_ls_id');
        const lsptCreatedBy = (0, loyalty_utils_1.resolveActorUuid)(dto.lspt_created_by, actorId);
        const lsptUpdatedBy = (0, loyalty_utils_1.resolveActorUuid)(dto.lspt_updated_by, lsptCreatedBy, actorId);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const scheme = await this.getActiveScheme(tx, lsptLsId);
                await this.ensurePointReferenceRecords(tx, scheme.lsItemType, dto);
                const lsptSlno = dto.lspt_slno ?? (await this.getNextPointSlno(tx, lsptLsId));
                await this.ensurePointSlnoUnique(tx, lsptLsId, lsptSlno);
                const lsptPoints = (0, loyalty_utils_1.requireNumber)(dto.lspt_points, 'lspt_points', 0);
                const lsptEach = (0, loyalty_utils_1.requireNumber)(dto.lspt_each, 'lspt_each', Number.EPSILON);
                const lsptFactor = this.calculatePointFactor(lsptPoints, lsptEach);
                const data = {
                    lsptLsId,
                    lsptSlno,
                    lsptPoints,
                    lsptEach,
                    lsptFactor,
                    lsptCreatedOn: now,
                    lsptCreatedBy,
                    lsptUpdatedOn: now,
                    lsptUpdatedBy,
                };
                (0, loyalty_utils_1.applyOptionalPointFields)(data, dto);
                data.lsptEach = lsptEach;
                data.lsptFactor = lsptFactor;
                const created = await tx.loyaltySchemePoint.create({ data });
                const payload = (0, loyalty_utils_1.toPointPayload)(created);
                await this.auditLogService.logEntityChange({
                    action: 'insert',
                    tableName: LOYALTY_POINTS_TABLE_NAME,
                    screenName: LOYALTY_SCREEN_NAME,
                    screenType: 'master',
                    pk: created.lsptId,
                    displayName: (0, loyalty_utils_1.buildPointDisplayName)(created.lsptLsId, created.lsptSlno),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.resolveAuditActor(),
                    notes: 'Loyalty point created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, loyalty_utils_1.handleLoyaltyWriteError)(error);
            throw error;
        }
    }
    async updatePoint(dto) {
        const lsptId = (0, loyalty_utils_1.requireUuid)(dto.lspt_id, 'lspt_id');
        const actorId = (0, loyalty_utils_1.resolveActorUuid)(this.requestContextService.getUserId());
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.loyaltySchemePoint.findFirst({
                    where: { lsptId, lsptIsDeleted: false },
                });
                if (!existing) {
                    this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
                }
                const effectiveSchemeId = (0, module_service_utils_1.hasOwnProperty)(dto, 'lspt_ls_id')
                    ? (0, loyalty_utils_1.requireUuid)(dto.lspt_ls_id, 'lspt_ls_id')
                    : existing.lsptLsId;
                const effectiveSlno = (0, module_service_utils_1.hasOwnProperty)(dto, 'lspt_slno')
                    ? (0, loyalty_utils_1.requireInteger)(dto.lspt_slno, 'lspt_slno')
                    : existing.lsptSlno;
                const scheme = await this.getActiveScheme(tx, effectiveSchemeId);
                await this.ensurePointReferenceRecords(tx, scheme.lsItemType, dto);
                await this.ensurePointSlnoUnique(tx, effectiveSchemeId, effectiveSlno, lsptId);
                const effectivePoints = (0, module_service_utils_1.hasOwnProperty)(dto, 'lspt_points')
                    ? (0, loyalty_utils_1.requireNumber)(dto.lspt_points, 'lspt_points', 0)
                    : (0, loyalty_utils_1.requireNumber)(existing.lsptPoints.toNumber(), 'lspt_points', 0);
                const effectiveEach = (0, module_service_utils_1.hasOwnProperty)(dto, 'lspt_each')
                    ? (0, loyalty_utils_1.requireNumber)(dto.lspt_each, 'lspt_each', Number.EPSILON)
                    : (0, loyalty_utils_1.requireNumber)(existing.lsptEach.toNumber(), 'lspt_each', Number.EPSILON);
                const effectiveFactor = this.calculatePointFactor(effectivePoints, effectiveEach);
                const data = {
                    lsptUpdatedOn: new Date(),
                    lsptUpdatedBy: (0, loyalty_utils_1.resolveActorUuid)(dto.lspt_updated_by, actorId),
                };
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lspt_ls_id')) {
                    data.lsptLsId = effectiveSchemeId;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lspt_slno')) {
                    data.lsptSlno = effectiveSlno;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lspt_points')) {
                    data.lsptPoints = effectivePoints;
                }
                (0, loyalty_utils_1.applyOptionalPointFields)(data, dto);
                data.lsptPoints = effectivePoints;
                data.lsptEach = effectiveEach;
                data.lsptFactor = effectiveFactor;
                const updated = await tx.loyaltySchemePoint.update({
                    where: { lsptId },
                    data,
                });
                const payload = (0, loyalty_utils_1.toPointPayload)(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: LOYALTY_POINTS_TABLE_NAME,
                    screenName: LOYALTY_SCREEN_NAME,
                    screenType: 'master',
                    pk: lsptId,
                    displayName: (0, loyalty_utils_1.buildPointDisplayName)(updated.lsptLsId, updated.lsptSlno),
                    originalRecord: (0, loyalty_utils_1.toPointPayload)(existing),
                    modifiedRecord: payload,
                    userId: this.resolveAuditActor(),
                    notes: 'Loyalty point updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, loyalty_utils_1.handleLoyaltyWriteError)(error);
            throw error;
        }
    }
    async createGift(dto) {
        const now = new Date();
        const actorId = (0, loyalty_utils_1.resolveActorUuid)(this.requestContextService.getUserId());
        const lsgLsId = (0, loyalty_utils_1.requireUuid)(dto.lsg_ls_id, 'lsg_ls_id');
        const lsgCreatedBy = (0, loyalty_utils_1.resolveActorUuid)(dto.lsg_created_by, actorId);
        const lsgUpdatedBy = (0, loyalty_utils_1.resolveActorUuid)(dto.lsg_updated_by, lsgCreatedBy, actorId);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureSchemeExists(tx, lsgLsId);
                await this.ensureGiftReferenceRecords(tx, dto);
                const lsgSlno = dto.lsg_slno ?? (await this.getNextGiftSlno(tx, lsgLsId));
                await this.ensureGiftSlnoUnique(tx, lsgLsId, lsgSlno);
                const data = {
                    lsgLsId,
                    lsgSlno,
                    lsgItemId: (0, loyalty_utils_1.requireUuid)(dto.lsg_item_id, 'lsg_item_id'),
                    lsgUnitId: (0, loyalty_utils_1.requireUuid)(dto.lsg_unit_id, 'lsg_unit_id'),
                    lsgItemQty: (0, loyalty_utils_1.requireNumber)(dto.lsg_item_qty, 'lsg_item_qty', Number.EPSILON),
                    lsgRedeemPoints: (0, loyalty_utils_1.requireNumber)(dto.lsg_redeem_points, 'lsg_redeem_points', 0),
                    lsgCreatedOn: now,
                    lsgCreatedBy,
                    lsgUpdatedOn: now,
                    lsgUpdatedBy,
                };
                (0, loyalty_utils_1.applyOptionalGiftFields)(data, dto);
                const created = await tx.loyaltySchemeGift.create({ data });
                const payload = (0, loyalty_utils_1.toGiftPayload)(created);
                await this.auditLogService.logEntityChange({
                    action: 'insert',
                    tableName: LOYALTY_GIFT_TABLE_NAME,
                    screenName: LOYALTY_SCREEN_NAME,
                    screenType: 'master',
                    pk: created.lsgId,
                    displayName: (0, loyalty_utils_1.buildGiftDisplayName)(created.lsgLsId, created.lsgSlno),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.resolveAuditActor(),
                    notes: 'Loyalty gift created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, loyalty_utils_1.handleLoyaltyWriteError)(error);
            throw error;
        }
    }
    async updateGift(dto) {
        const lsgId = (0, loyalty_utils_1.requireUuid)(dto.lsg_id, 'lsg_id');
        const actorId = (0, loyalty_utils_1.resolveActorUuid)(this.requestContextService.getUserId());
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.loyaltySchemeGift.findFirst({
                    where: { lsgId, lsgIsDeleted: false },
                });
                if (!existing) {
                    this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
                }
                const effectiveSchemeId = (0, module_service_utils_1.hasOwnProperty)(dto, 'lsg_ls_id')
                    ? (0, loyalty_utils_1.requireUuid)(dto.lsg_ls_id, 'lsg_ls_id')
                    : existing.lsgLsId;
                const effectiveSlno = (0, module_service_utils_1.hasOwnProperty)(dto, 'lsg_slno')
                    ? (0, loyalty_utils_1.requireInteger)(dto.lsg_slno, 'lsg_slno')
                    : existing.lsgSlno;
                await this.ensureSchemeExists(tx, effectiveSchemeId);
                await this.ensureGiftReferenceRecords(tx, dto);
                await this.ensureGiftSlnoUnique(tx, effectiveSchemeId, effectiveSlno, lsgId);
                const data = {
                    lsgUpdatedOn: new Date(),
                    lsgUpdatedBy: (0, loyalty_utils_1.resolveActorUuid)(dto.lsg_updated_by, actorId),
                };
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsg_ls_id')) {
                    data.lsgLsId = effectiveSchemeId;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsg_slno')) {
                    data.lsgSlno = effectiveSlno;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsg_item_id')) {
                    data.lsgItemId = (0, loyalty_utils_1.requireUuid)(dto.lsg_item_id, 'lsg_item_id');
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsg_unit_id')) {
                    data.lsgUnitId = (0, loyalty_utils_1.requireUuid)(dto.lsg_unit_id, 'lsg_unit_id');
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsg_item_qty')) {
                    data.lsgItemQty = (0, loyalty_utils_1.requireNumber)(dto.lsg_item_qty, 'lsg_item_qty', Number.EPSILON);
                }
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsg_redeem_points')) {
                    data.lsgRedeemPoints = (0, loyalty_utils_1.requireNumber)(dto.lsg_redeem_points, 'lsg_redeem_points', 0);
                }
                (0, loyalty_utils_1.applyOptionalGiftFields)(data, dto);
                const updated = await tx.loyaltySchemeGift.update({
                    where: { lsgId },
                    data,
                });
                const payload = (0, loyalty_utils_1.toGiftPayload)(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: LOYALTY_GIFT_TABLE_NAME,
                    screenName: LOYALTY_SCREEN_NAME,
                    screenType: 'master',
                    pk: lsgId,
                    displayName: (0, loyalty_utils_1.buildGiftDisplayName)(updated.lsgLsId, updated.lsgSlno),
                    originalRecord: (0, loyalty_utils_1.toGiftPayload)(existing),
                    modifiedRecord: payload,
                    userId: this.resolveAuditActor(),
                    notes: 'Loyalty gift updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, loyalty_utils_1.handleLoyaltyWriteError)(error);
            throw error;
        }
    }
    async findActiveSchemeWithChildren(client, lsId) {
        return client.loyaltyScheme.findFirst({
            where: { lsId, lsIsDeleted: false },
            include: {
                parties: {
                    where: { lpsIsDeleted: false, lpsIsActive: true },
                    orderBy: [{ lpsSlno: 'asc' }, { lpsId: 'asc' }],
                },
                points: {
                    where: { lsptIsDeleted: false, lsptIsActive: true },
                    orderBy: [{ lsptSlno: 'asc' }, { lsptId: 'asc' }],
                },
                gifts: {
                    where: { lsgIsDeleted: false, lsgIsActive: true },
                    orderBy: [{ lsgSlno: 'asc' }, { lsgId: 'asc' }],
                },
            },
        });
    }
    async syncSchemeParties(client, lsId, inputParties, actorId) {
        const existing = await client.loyaltySchemeParty.findMany({
            where: { lpsLsId: lsId, lpsIsDeleted: false },
            orderBy: [{ lpsSlno: 'asc' }, { lpsId: 'asc' }],
        });
        if (inputParties === undefined) {
            return existing;
        }
        const existingMap = new Map(existing.map((party) => [party.lpsId, party]));
        const keptIds = new Set();
        const seenSlnos = new Set();
        const now = new Date();
        const persisted = [];
        for (const [index, inputParty] of inputParties.entries()) {
            const lpsSlno = inputParty.lps_slno ?? index + 1;
            if (seenSlnos.has(lpsSlno)) {
                this.throwConflict('Duplicate loyalty party serial number is not allowed', [
                    {
                        field: 'lps_slno',
                        message: `A loyalty party scope row already exists with serial number ${lpsSlno}`,
                    },
                ]);
            }
            seenSlnos.add(lpsSlno);
            if (inputParty.lps_id) {
                const existingParty = existingMap.get(inputParty.lps_id);
                if (!existingParty) {
                    this.throwNotFound('lps_id', inputParty.lps_id, 'Loyalty party scope row not found');
                }
                const updated = await client.loyaltySchemeParty.update({
                    where: { lpsId: inputParty.lps_id },
                    data: {
                        lpsSlno,
                        lpsScopeType: (0, loyalty_utils_1.requireString)(inputParty.lps_scope_type, 'lps_scope_type'),
                        lpsScopeId: (0, loyalty_utils_1.requireUuid)(inputParty.lps_scope_id, 'lps_scope_id'),
                        lpsIsExclude: inputParty.lps_is_exclude ?? false,
                        lpsNotes: inputParty.lps_notes ?? null,
                        lpsIsActive: inputParty.lps_is_active ?? true,
                        lpsUpdatedOn: now,
                        lpsUpdatedBy: (0, loyalty_utils_1.resolveActorUuid)(inputParty.lps_updated_by, actorId),
                    },
                });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: LOYALTY_PARTY_TABLE_NAME,
                    screenName: LOYALTY_SCREEN_NAME,
                    screenType: 'master',
                    pk: updated.lpsId,
                    displayName: (0, loyalty_utils_1.buildPartyDisplayName)(updated.lpsLsId, updated.lpsSlno),
                    originalRecord: (0, loyalty_utils_1.toPartyPayload)(existingParty),
                    modifiedRecord: (0, loyalty_utils_1.toPartyPayload)(updated),
                    userId: this.resolveAuditActor(),
                    notes: 'Loyalty party scope updated',
                }, client);
                keptIds.add(updated.lpsId);
                persisted.push(updated);
                continue;
            }
            const createdBy = (0, loyalty_utils_1.resolveActorUuid)(inputParty.lps_created_by, actorId);
            const updatedBy = (0, loyalty_utils_1.resolveActorUuid)(inputParty.lps_updated_by, createdBy, actorId);
            const created = await client.loyaltySchemeParty.create({
                data: {
                    lpsLsId: lsId,
                    lpsSlno,
                    lpsScopeType: (0, loyalty_utils_1.requireString)(inputParty.lps_scope_type, 'lps_scope_type'),
                    lpsScopeId: (0, loyalty_utils_1.requireUuid)(inputParty.lps_scope_id, 'lps_scope_id'),
                    lpsIsExclude: inputParty.lps_is_exclude ?? false,
                    lpsNotes: inputParty.lps_notes ?? null,
                    lpsIsActive: inputParty.lps_is_active ?? true,
                    lpsCreatedOn: now,
                    lpsCreatedBy: createdBy,
                    lpsUpdatedOn: now,
                    lpsUpdatedBy: updatedBy,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'insert',
                tableName: LOYALTY_PARTY_TABLE_NAME,
                screenName: LOYALTY_SCREEN_NAME,
                screenType: 'master',
                pk: created.lpsId,
                displayName: (0, loyalty_utils_1.buildPartyDisplayName)(created.lpsLsId, created.lpsSlno),
                originalRecord: null,
                modifiedRecord: (0, loyalty_utils_1.toPartyPayload)(created),
                userId: this.resolveAuditActor(),
                notes: 'Loyalty party scope created',
            }, client);
            keptIds.add(created.lpsId);
            persisted.push(created);
        }
        const removedParties = existing.filter((party) => !keptIds.has(party.lpsId));
        for (const removedParty of removedParties) {
            const deleted = await client.loyaltySchemeParty.update({
                where: { lpsId: removedParty.lpsId },
                data: {
                    lpsIsDeleted: true,
                    lpsIsActive: false,
                    lpsUpdatedOn: now,
                    lpsUpdatedBy: (0, loyalty_utils_1.resolveActorUuid)(actorId),
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: LOYALTY_PARTY_TABLE_NAME,
                screenName: LOYALTY_SCREEN_NAME,
                screenType: 'master',
                pk: deleted.lpsId,
                displayName: (0, loyalty_utils_1.buildPartyDisplayName)(deleted.lpsLsId, deleted.lpsSlno),
                originalRecord: (0, loyalty_utils_1.toPartyPayload)(removedParty),
                modifiedRecord: (0, loyalty_utils_1.toPartyPayload)(deleted),
                userId: this.resolveAuditActor(),
                notes: 'Loyalty party scope soft deleted',
            }, client);
        }
        return persisted.sort((left, right) => {
            if (left.lpsSlno === right.lpsSlno) {
                return left.lpsId.localeCompare(right.lpsId);
            }
            return left.lpsSlno - right.lpsSlno;
        });
    }
    async ensureSchemeExists(client, lsId) {
        const scheme = await client.loyaltyScheme.findFirst({
            where: { lsId, lsIsDeleted: false },
            select: { lsId: true },
        });
        if (!scheme) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'ls_id',
                    message: `No active loyalty scheme found with id ${lsId}`,
                },
            ]);
        }
    }
    async getActiveScheme(client, lsId) {
        const scheme = await client.loyaltyScheme.findFirst({
            where: { lsId, lsIsDeleted: false },
            select: {
                lsId: true,
                lsItemType: true,
            },
        });
        if (!scheme) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'ls_id',
                    message: `No active loyalty scheme found with id ${lsId}`,
                },
            ]);
        }
        return scheme;
    }
    async ensureItemExists(client, itemId, field) {
        const item = await client.itemMaster.findFirst({
            where: {
                itemId,
                itemIsDeleted: false,
                itemIsActive: true,
            },
            select: { itemId: true },
        });
        if (!item) {
            this.throwBadRequest('Validation failed', [
                {
                    field,
                    message: `${field} does not reference an active item`,
                },
            ]);
        }
    }
    async ensureUnitExists(client, unitId, field) {
        const unit = await client.unit.findFirst({
            where: {
                unit_id: unitId,
                unit_is_deleted: false,
                unit_is_active: true,
            },
            select: { unit_id: true },
        });
        if (!unit) {
            this.throwBadRequest('Validation failed', [
                {
                    field,
                    message: `${field} does not reference an active unit`,
                },
            ]);
        }
    }
    async ensurePointReferenceRecords(client, schemeItemType, dto) {
        if (dto.lspt_item_id) {
            await this.ensurePointScopeReference(client, schemeItemType, dto.lspt_item_id, 'lspt_item_id');
        }
        if (dto.lspt_unit_id) {
            await this.ensureUnitExists(client, dto.lspt_unit_id, 'lspt_unit_id');
        }
    }
    async ensureGiftReferenceRecords(client, dto) {
        await this.ensureItemExists(client, (0, loyalty_utils_1.requireUuid)(dto.lsg_item_id, 'lsg_item_id'), 'lsg_item_id');
        await this.ensureUnitExists(client, (0, loyalty_utils_1.requireUuid)(dto.lsg_unit_id, 'lsg_unit_id'), 'lsg_unit_id');
    }
    async ensurePointScopeReference(client, schemeItemType, scopeId, field) {
        switch (schemeItemType) {
            case 'ITEM_GROUP': {
                const itemGroup = await client.itemGroupMaster.findFirst({
                    where: {
                        itgId: scopeId,
                        itgIsDeleted: false,
                        itgIsActive: true,
                    },
                    select: { itgId: true },
                });
                if (!itemGroup) {
                    this.throwBadRequest('Validation failed', [
                        {
                            field,
                            message: `${field} does not reference an active item group`,
                        },
                    ]);
                }
                return;
            }
            case 'ITEM_BRAND': {
                const itemBrand = await client.itemBrandMaster.findFirst({
                    where: {
                        brand_id: scopeId,
                        brand_is_deleted: false,
                        brand_is_active: true,
                    },
                    select: { brand_id: true },
                });
                if (!itemBrand) {
                    this.throwBadRequest('Validation failed', [
                        {
                            field,
                            message: `${field} does not reference an active item brand`,
                        },
                    ]);
                }
                return;
            }
            case 'ITEM_CATEGORY': {
                const itemCategory = await client.categoryMaster.findFirst({
                    where: {
                        categoryId: scopeId,
                        categoryIsDeleted: false,
                        categoryIsActive: true,
                    },
                    select: { categoryId: true },
                });
                if (!itemCategory) {
                    this.throwBadRequest('Validation failed', [
                        {
                            field,
                            message: `${field} does not reference an active item category`,
                        },
                    ]);
                }
                return;
            }
            case 'ITEM_SECTION': {
                const itemSection = await client.itemSectionMaster.findFirst({
                    where: {
                        secId: scopeId,
                        secIsDeleted: false,
                        secIsActive: true,
                    },
                    select: { secId: true },
                });
                if (!itemSection) {
                    this.throwBadRequest('Validation failed', [
                        {
                            field,
                            message: `${field} does not reference an active item section`,
                        },
                    ]);
                }
                return;
            }
            case 'ALL':
            case 'ITEM':
            default:
                await this.ensureItemExists(client, scopeId, field);
        }
    }
    async ensureSchemeCodeUnique(client, lsCompId, lsCode, excludeId) {
        if (!lsCode) {
            return;
        }
        const existing = await client.loyaltyScheme.findFirst({
            where: {
                lsCompId,
                lsIsDeleted: false,
                lsCode: { equals: lsCode, mode: client_1.Prisma.QueryMode.insensitive },
                ...(excludeId ? { NOT: { lsId: excludeId } } : {}),
            },
            select: { lsId: true },
        });
        if (existing) {
            this.throwConflict('Duplicate loyalty scheme code is not allowed', [
                {
                    field: 'ls_code',
                    message: `A loyalty scheme already exists with code ${lsCode}`,
                },
            ]);
        }
    }
    async ensurePointSlnoUnique(client, lsptLsId, lsptSlno, excludeId) {
        const existing = await client.loyaltySchemePoint.findFirst({
            where: {
                lsptLsId,
                lsptSlno,
                lsptIsDeleted: false,
                ...(excludeId ? { NOT: { lsptId: excludeId } } : {}),
            },
            select: { lsptId: true },
        });
        if (existing) {
            this.throwConflict('Duplicate loyalty point serial number is not allowed', [
                {
                    field: 'lspt_slno',
                    message: `A loyalty point slab already exists with serial number ${lsptSlno}`,
                },
            ]);
        }
    }
    async ensureGiftSlnoUnique(client, lsgLsId, lsgSlno, excludeId) {
        const existing = await client.loyaltySchemeGift.findFirst({
            where: {
                lsgLsId,
                lsgSlno,
                lsgIsDeleted: false,
                ...(excludeId ? { NOT: { lsgId: excludeId } } : {}),
            },
            select: { lsgId: true },
        });
        if (existing) {
            this.throwConflict('Duplicate loyalty gift serial number is not allowed', [
                {
                    field: 'lsg_slno',
                    message: `A loyalty gift rule already exists with serial number ${lsgSlno}`,
                },
            ]);
        }
    }
    async getNextPointSlno(client, lsptLsId) {
        const result = await client.loyaltySchemePoint.aggregate({
            where: { lsptLsId, lsptIsDeleted: false },
            _max: { lsptSlno: true },
        });
        return (result._max.lsptSlno ?? 0) + 1;
    }
    async getNextGiftSlno(client, lsgLsId) {
        const result = await client.loyaltySchemeGift.aggregate({
            where: { lsgLsId, lsgIsDeleted: false },
            _max: { lsgSlno: true },
        });
        return (result._max.lsgSlno ?? 0) + 1;
    }
    resolveAuditActor() {
        return this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_AUDIT_ACTOR;
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSalesBadRequest)(message, errors);
    }
    throwConflict(message, errors) {
        (0, module_service_utils_1.throwSalesConflict)(message, errors);
    }
    throwNotFound(field, value, message) {
        (0, module_service_utils_1.throwSalesNotFound)(message, field, `${field} ${value} was not found`);
    }
    buildErrorResponse(message, errors) {
        return (0, module_service_utils_1.buildSalesErrorResponse)(message, errors);
    }
};
exports.PromotionLoyaltyPointsService = PromotionLoyaltyPointsService;
exports.PromotionLoyaltyPointsService = PromotionLoyaltyPointsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], PromotionLoyaltyPointsService);
//# sourceMappingURL=promotion-loyalty-points.service.js.map