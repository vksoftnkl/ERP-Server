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
exports.StockTrackPolicyService = exports.DERIVED_FROM_ITEM_REMARK = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const STP_TABLE_NAME = 'stock track policy';
const STP_AUDIT_SCREEN_NAME = 'Stock Track Policy';
exports.DERIVED_FROM_ITEM_REMARK = 'Auto-derived from item master';
let StockTrackPolicyService = class StockTrackPolicyService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async syncFromItem(item, tx) {
        const client = tx ?? this.prisma;
        const derived = this.deriveFromItem(item);
        const atSlot = await client.stockTrackPolicy.findFirst({
            where: {
                stpScope: 'ITEM',
                stpItemId: item.itemId,
                stpCompanyId: item.itemCompanyId,
                stpBranchId: item.itemBranchId,
                stpIsDeleted: false,
            },
            orderBy: { stpCreatedOn: 'asc' },
        });
        if (atSlot && atSlot.stpRemarks !== exports.DERIVED_FROM_ITEM_REMARK) {
            return {
                stp_id: atSlot.stpId,
                item_id: item.itemId,
                outcome: 'skipped_manual',
                track_signature: atSlot.stpTrackSignature,
            };
        }
        const existing = atSlot ??
            (await client.stockTrackPolicy.findFirst({
                where: {
                    stpScope: 'ITEM',
                    stpItemId: item.itemId,
                    stpRemarks: exports.DERIVED_FROM_ITEM_REMARK,
                    stpIsDeleted: false,
                },
                orderBy: { stpCreatedOn: 'asc' },
            }));
        return existing
            ? this.updateDerived(existing, item, derived, client)
            : this.createDerived(item, derived, client);
    }
    deriveFromItem(item) {
        const trackMrp = item.itemBatchConfig === 1;
        const trackExpiry = item.itemIsExpiryItem;
        const trackBatch = item.itemBatchConfig === 2 || item.itemIsBatchBased || item.itemIsExpiryItem;
        return {
            trackBatch,
            trackMrp,
            trackSalePrice: false,
            trackExpiry,
            trackSerial: false,
            trackSupplier: false,
            valuationMethod: 'WAVG',
            issueStrategy: trackExpiry ? 'FEFO' : 'FIFO',
            allowNegative: item.itemAllowNegStock ? 'ALLOW' : 'BLOCK',
            shelfLifeDays: this.positiveOrNull(item.itemExpiryDays),
            nearExpiryDays: this.nonNegativeOr(item.itemIntimateBeforeDays, 30),
            blockExpiredSale: false,
            ageingBasis: 'INWARD_DATE',
        };
    }
    async findByItemId(itemId, tx) {
        const client = tx ?? this.prisma;
        return client.stockTrackPolicy.findFirst({
            where: {
                stpScope: 'ITEM',
                stpItemId: itemId,
                stpIsDeleted: false,
            },
            orderBy: { stpCreatedOn: 'asc' },
        });
    }
    async createDerived(item, derived, client) {
        const actor = this.actor();
        const created = await client.stockTrackPolicy.create({
            data: {
                stpCompanyId: item.itemCompanyId,
                stpBranchId: item.itemBranchId,
                stpScope: 'ITEM',
                stpScopeId: item.itemId,
                ...this.toColumns(derived),
                stpRemarks: exports.DERIVED_FROM_ITEM_REMARK,
                stpCreatedBy: actor,
            },
        });
        await this.logChange(client, created.stpId, item.itemId, null, created, actor, 'New');
        return {
            stp_id: created.stpId,
            item_id: item.itemId,
            outcome: 'created',
            track_signature: created.stpTrackSignature,
        };
    }
    async updateDerived(existing, item, derived, client) {
        const moved = existing.stpCompanyId !== item.itemCompanyId || existing.stpBranchId !== item.itemBranchId;
        if (!moved && !this.hasChanged(existing, derived)) {
            return {
                stp_id: existing.stpId,
                item_id: item.itemId,
                outcome: 'unchanged',
                track_signature: existing.stpTrackSignature,
            };
        }
        const actor = this.actor();
        const updated = await client.stockTrackPolicy.update({
            where: { stpId: existing.stpId },
            data: {
                stpCompanyId: item.itemCompanyId,
                stpBranchId: item.itemBranchId,
                ...this.toColumns(derived),
                stpModifiedOn: new Date(),
                stpModifiedBy: actor,
            },
        });
        await this.logChange(client, existing.stpId, item.itemId, existing, updated, actor, 'update');
        return {
            stp_id: updated.stpId,
            item_id: item.itemId,
            outcome: 'updated',
            track_signature: updated.stpTrackSignature,
        };
    }
    toColumns(derived) {
        return {
            stpTrackBatch: derived.trackBatch,
            stpTrackMrp: derived.trackMrp,
            stpTrackSalePrice: derived.trackSalePrice,
            stpTrackExpiry: derived.trackExpiry,
            stpTrackSerial: derived.trackSerial,
            stpTrackSupplier: derived.trackSupplier,
            stpValuationMethod: derived.valuationMethod,
            stpIssueStrategy: derived.issueStrategy,
            stpAllowNegative: derived.allowNegative,
            stpShelfLifeDays: derived.shelfLifeDays,
            stpNearExpiryDays: derived.nearExpiryDays,
            stpBlockExpiredSale: derived.blockExpiredSale,
            stpAgeingBasis: derived.ageingBasis,
        };
    }
    hasChanged(existing, derived) {
        const next = this.toColumns(derived);
        return Object.keys(next).some((column) => existing[column] !== next[column]);
    }
    actor() {
        return this.requestContextService.getUserId() ?? null;
    }
    positiveOrNull(value) {
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
    }
    nonNegativeOr(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0
            ? Math.trunc(value)
            : fallback;
    }
    async logChange(client, stpId, itemId, originalRecord, modifiedRecord, actor, action) {
        await this.auditLogService.logEntityChange({
            action,
            tableName: STP_TABLE_NAME,
            screenName: STP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: stpId,
            displayName: modifiedRecord.stpTrackSignature ?? itemId,
            originalRecord: originalRecord ? this.toAuditRecord(originalRecord) : null,
            modifiedRecord: this.toAuditRecord(modifiedRecord),
            userId: actor ?? undefined,
            notes: action === 'New'
                ? 'Track policy derived from item master'
                : 'Track policy refreshed from item master',
        }, client);
    }
    toAuditRecord(record) {
        return {
            stp_id: record.stpId,
            stp_company_id: record.stpCompanyId,
            stp_branch_id: record.stpBranchId,
            stp_scope: record.stpScope,
            stp_scope_id: record.stpScopeId,
            stp_item_id: record.stpItemId,
            stp_track_batch: record.stpTrackBatch,
            stp_track_mrp: record.stpTrackMrp,
            stp_track_sale_price: record.stpTrackSalePrice,
            stp_track_expiry: record.stpTrackExpiry,
            stp_track_serial: record.stpTrackSerial,
            stp_track_supplier: record.stpTrackSupplier,
            stp_track_signature: record.stpTrackSignature,
            stp_valuation_method: record.stpValuationMethod,
            stp_issue_strategy: record.stpIssueStrategy,
            stp_allow_negative: record.stpAllowNegative,
            stp_shelf_life_days: record.stpShelfLifeDays,
            stp_near_expiry_days: record.stpNearExpiryDays,
            stp_block_expired_sale: record.stpBlockExpiredSale,
            stp_ageing_basis: record.stpAgeingBasis,
            stp_effective_from: record.stpEffectiveFrom,
            stp_effective_to: record.stpEffectiveTo,
            stp_remarks: record.stpRemarks,
            stp_is_active: record.stpIsActive,
            stp_is_deleted: record.stpIsDeleted,
        };
    }
};
exports.StockTrackPolicyService = StockTrackPolicyService;
exports.StockTrackPolicyService = StockTrackPolicyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], StockTrackPolicyService);
//# sourceMappingURL=stock-track-policy.service.js.map