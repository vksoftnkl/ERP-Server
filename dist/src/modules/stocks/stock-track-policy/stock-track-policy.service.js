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
exports.StockTrackPolicyService = exports.DERIVED_FROM_GROUP_REMARK = exports.DERIVED_FROM_ITEM_REMARK = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const STP_TABLE_NAME = 'stock track policy';
const STP_AUDIT_SCREEN_NAME = 'Stock Track Policy';
exports.DERIVED_FROM_ITEM_REMARK = 'Auto-derived from item master';
exports.DERIVED_FROM_GROUP_REMARK = 'Auto-derived from item group master';
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
        const preset = await this.resolvePreset(item.itemTrackPresetId, client);
        const derived = preset ? this.presetToDerived(preset) : this.deriveFromItem(item);
        const remarks = this.derivedRemark(exports.DERIVED_FROM_ITEM_REMARK, preset?.sptCode ?? null);
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
        if (atSlot && !this.isDerivedRemark(atSlot.stpRemarks, exports.DERIVED_FROM_ITEM_REMARK)) {
            return this.result(atSlot, item.itemId, 'ITEM', 'skipped_manual');
        }
        const existing = atSlot ??
            (await client.stockTrackPolicy.findFirst({
                where: {
                    stpScope: 'ITEM',
                    stpItemId: item.itemId,
                    stpRemarks: { startsWith: exports.DERIVED_FROM_ITEM_REMARK },
                    stpIsDeleted: false,
                },
                orderBy: { stpCreatedOn: 'asc' },
            }));
        return existing
            ? this.updateDerived(existing, item.itemId, 'ITEM', derived, remarks, client, {
                companyId: item.itemCompanyId,
                branchId: item.itemBranchId,
            })
            : this.createDerived(item.itemId, 'ITEM', derived, remarks, client, {
                companyId: item.itemCompanyId,
                branchId: item.itemBranchId,
            });
    }
    async syncFromItemGroup(group, tx) {
        const client = tx ?? this.prisma;
        const companyId = this.requestContextService.getCompanyId();
        const preset = await this.resolvePreset(group.itgTrackPresetId, client);
        const atSlot = await client.stockTrackPolicy.findFirst({
            where: {
                stpScope: 'GROUP',
                stpGroupId: group.itgId,
                stpCompanyId: companyId,
                stpBranchId: null,
                stpIsDeleted: false,
            },
            orderBy: { stpCreatedOn: 'asc' },
        });
        if (atSlot && !this.isDerivedRemark(atSlot.stpRemarks, exports.DERIVED_FROM_GROUP_REMARK)) {
            return this.result(atSlot, group.itgId, 'GROUP', 'skipped_manual');
        }
        if (!preset) {
            return atSlot
                ? this.retireDerived(atSlot, group.itgId, client)
                : {
                    stp_id: null,
                    scope_id: group.itgId,
                    scope: 'GROUP',
                    outcome: 'no_preset',
                    track_signature: null,
                    preset_code: null,
                };
        }
        const derived = this.presetToDerived(preset);
        const remarks = this.derivedRemark(exports.DERIVED_FROM_GROUP_REMARK, preset.sptCode);
        return atSlot
            ? this.updateDerived(atSlot, group.itgId, 'GROUP', derived, remarks, client, {
                companyId,
                branchId: null,
            })
            : this.createDerived(group.itgId, 'GROUP', derived, remarks, client, {
                companyId,
                branchId: null,
            });
    }
    async resolvePreset(presetId, tx) {
        if (!presetId) {
            return null;
        }
        const client = tx ?? this.prisma;
        return client.stockTrackPreset.findUnique({ where: { sptId: presetId } });
    }
    presetToDerived(preset) {
        return {
            trackBatch: preset.sptTrackBatch,
            trackMrp: preset.sptTrackMrp,
            trackSalePrice: preset.sptTrackSalePrice,
            trackExpiry: preset.sptTrackExpiry,
            trackSerial: preset.sptTrackSerial,
            trackSupplier: preset.sptTrackSupplier,
            valuationMethod: preset.sptValuationMethod,
            issueStrategy: preset.sptIssueStrategy,
            allowNegative: preset.sptAllowNegative,
            shelfLifeDays: preset.sptShelfLifeDays,
            nearExpiryDays: preset.sptNearExpiryDays,
            blockExpiredSale: preset.sptBlockExpiredSale,
            ageingBasis: preset.sptAgeingBasis,
        };
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
    async findByGroupId(itgId, companyId, tx) {
        const client = tx ?? this.prisma;
        return client.stockTrackPolicy.findFirst({
            where: {
                stpScope: 'GROUP',
                stpGroupId: itgId,
                stpCompanyId: companyId,
                stpIsDeleted: false,
            },
            orderBy: { stpCreatedOn: 'asc' },
        });
    }
    async createDerived(scopeId, scope, derived, remarks, client, slot) {
        const actor = this.actor();
        const created = await client.stockTrackPolicy.create({
            data: {
                stpCompanyId: slot.companyId,
                stpBranchId: slot.branchId,
                stpScope: scope,
                stpScopeId: scopeId,
                ...this.toColumns(derived),
                stpRemarks: remarks,
                stpCreatedBy: actor,
            },
        });
        await this.logChange(client, created.stpId, scopeId, scope, null, created, actor, 'New');
        return this.result(created, scopeId, scope, 'created');
    }
    async updateDerived(existing, scopeId, scope, derived, remarks, client, slot) {
        const moved = existing.stpCompanyId !== slot.companyId || existing.stpBranchId !== slot.branchId;
        const rewritten = existing.stpRemarks !== remarks;
        if (!moved && !rewritten && !this.hasChanged(existing, derived)) {
            return this.result(existing, scopeId, scope, 'unchanged');
        }
        const actor = this.actor();
        const updated = await client.stockTrackPolicy.update({
            where: { stpId: existing.stpId },
            data: {
                stpCompanyId: slot.companyId,
                stpBranchId: slot.branchId,
                ...this.toColumns(derived),
                stpRemarks: remarks,
                stpIsActive: true,
                stpIsDeleted: false,
                stpModifiedOn: new Date(),
                stpModifiedBy: actor,
            },
        });
        await this.logChange(client, existing.stpId, scopeId, scope, existing, updated, actor, 'update');
        return this.result(updated, scopeId, scope, 'updated');
    }
    async retireDerived(existing, scopeId, client) {
        const actor = this.actor();
        const retired = await client.stockTrackPolicy.update({
            where: { stpId: existing.stpId },
            data: {
                stpIsActive: false,
                stpIsDeleted: true,
                stpModifiedOn: new Date(),
                stpModifiedBy: actor,
            },
        });
        await this.logChange(client, existing.stpId, scopeId, 'GROUP', existing, retired, actor, 'update');
        return this.result(retired, scopeId, 'GROUP', 'cleared');
    }
    derivedRemark(marker, presetCode) {
        return presetCode ? `${marker} [preset ${presetCode}]` : marker;
    }
    isDerivedRemark(remarks, marker) {
        return remarks === marker || (remarks?.startsWith(`${marker} [`) ?? false);
    }
    presetCodeFromRemark(remarks) {
        return /\[preset ([A-Za-z0-9_-]+)\]$/.exec(remarks ?? '')?.[1] ?? null;
    }
    result(record, scopeId, scope, outcome) {
        return {
            stp_id: record.stpId,
            scope_id: scopeId,
            scope,
            outcome,
            track_signature: record.stpTrackSignature,
            preset_code: this.presetCodeFromRemark(record.stpRemarks),
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
        return typeof value === 'number' && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null;
    }
    nonNegativeOr(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0
            ? Math.trunc(value)
            : fallback;
    }
    async logChange(client, stpId, scopeId, scope, originalRecord, modifiedRecord, actor, action) {
        const source = scope === 'ITEM' ? 'item master' : 'item group master';
        await this.auditLogService.logEntityChange({
            action,
            tableName: STP_TABLE_NAME,
            screenName: STP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: stpId,
            displayName: modifiedRecord.stpTrackSignature ?? scopeId,
            originalRecord: originalRecord ? this.toAuditRecord(originalRecord) : null,
            modifiedRecord: this.toAuditRecord(modifiedRecord),
            userId: actor ?? undefined,
            notes: action === 'New'
                ? `Track policy derived from ${source}`
                : modifiedRecord.stpIsDeleted
                    ? `Track policy retired — preset removed on ${source}`
                    : `Track policy refreshed from ${source}`,
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
            stp_group_id: record.stpGroupId,
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