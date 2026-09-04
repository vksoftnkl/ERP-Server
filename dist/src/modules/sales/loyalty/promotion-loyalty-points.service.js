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
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const loyalty_scheme_invariants_1 = require("./utils/loyalty-scheme-invariants");
const loyalty_utils_1 = require("./utils/loyalty.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const SCREEN_NAME = 'Promotion Loyalty Points';
const SCHEME_TABLE_NAME = 'loyalty scheme';
const BRANCH_TABLE_NAME = 'loyalty scheme branch';
const PARTY_TABLE_NAME = 'loyalty scheme party';
const ITEM_TABLE_NAME = 'loyalty scheme item';
const SLAB_TABLE_NAME = 'loyalty scheme slab';
const GIFT_TABLE_NAME = 'loyalty scheme gift';
const EDITABLE_CHILDREN_INCLUDE = {
    branches: {
        where: { lsbIsDeleted: false },
        orderBy: [{ lsbSlno: 'asc' }, { lsbId: 'asc' }],
        include: loyalty_utils_1.BRANCH_LOOKUP,
    },
    parties: {
        where: { lspIsDeleted: false },
        orderBy: [{ lspSlno: 'asc' }, { lspId: 'asc' }],
        include: loyalty_utils_1.PARTY_LOOKUP,
    },
    items: {
        where: { lsiIsDeleted: false },
        orderBy: [{ lsiSlno: 'asc' }, { lsiId: 'asc' }],
        include: loyalty_utils_1.ITEM_LOOKUP,
    },
    slabs: {
        where: { lssIsDeleted: false },
        orderBy: [{ lssExceeds: 'asc' }, { lssSlno: 'asc' }, { lssId: 'asc' }],
        include: loyalty_utils_1.SLAB_LOOKUP,
    },
    gifts: {
        where: { lsgIsDeleted: false },
        orderBy: [{ lsgRedeemPoints: 'asc' }, { lsgSlno: 'asc' }, { lsgId: 'asc' }],
        include: loyalty_utils_1.GIFT_LOOKUP,
    },
};
const LIVE_CHILDREN_INCLUDE = {
    branches: {
        where: { lsbIsDeleted: false, lsbIsActive: true },
        orderBy: [{ lsbSlno: 'asc' }, { lsbId: 'asc' }],
        include: loyalty_utils_1.BRANCH_LOOKUP,
    },
    parties: {
        where: { lspIsDeleted: false, lspIsActive: true },
        orderBy: [{ lspSlno: 'asc' }, { lspId: 'asc' }],
        include: loyalty_utils_1.PARTY_LOOKUP,
    },
    items: {
        where: { lsiIsDeleted: false, lsiIsActive: true },
        orderBy: [{ lsiSlno: 'asc' }, { lsiId: 'asc' }],
        include: loyalty_utils_1.ITEM_LOOKUP,
    },
    slabs: {
        where: { lssIsDeleted: false, lssIsActive: true },
        orderBy: [{ lssExceeds: 'asc' }, { lssSlno: 'asc' }, { lssId: 'asc' }],
        include: loyalty_utils_1.SLAB_LOOKUP,
    },
    gifts: {
        where: { lsgIsDeleted: false, lsgIsActive: true },
        orderBy: [{ lsgRedeemPoints: 'asc' }, { lsgSlno: 'asc' }, { lsgId: 'asc' }],
        include: loyalty_utils_1.GIFT_LOOKUP,
    },
};
const EMPTY_CHILDREN = {
    branches: [],
    parties: [],
    items: [],
    slabs: [],
    gifts: [],
};
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
        return dto.lsc_id ? this.updateScheme(dto) : this.createScheme(dto);
    }
    async listSchemes(query) {
        const schemes = await this.prisma.loyaltyScheme.findMany({
            where: {
                ...(query.lsc_comp_id ? { lscCompId: query.lsc_comp_id } : {}),
                ...(query.lsc_branch_id ? { lscBranchId: query.lsc_branch_id } : {}),
                lscIsDeleted: false,
                lscIsActive: true,
            },
            orderBy: [{ lscCode: 'asc' }, { lscId: 'asc' }],
            include: { ...loyalty_utils_1.SCHEME_LOOKUP, ...LIVE_CHILDREN_INCLUDE },
        });
        return schemes.map(loyalty_utils_1.toSchemePayload);
    }
    async getSchemeById(lscId) {
        const scheme = await this.findSchemeWithChildren(this.prisma, lscId);
        if (!scheme) {
            this.throwNotFound('lsc_id', lscId, 'Loyalty scheme not found');
        }
        return (0, loyalty_utils_1.toSchemePayload)(scheme);
    }
    async checkEligibility(lscId, cusId) {
        const scheme = await this.requireScheme(this.prisma, lscId);
        if (scheme.lscCustScope !== 'LIST') {
            return {
                lsc_id: lscId,
                cus_id: cusId,
                qualifies: true,
                decided_by: 'ALL',
                matched_by: null,
                matched_row_id: null,
                match_priority: null,
                is_exclude: null,
                reason: `YES — lsc_cust_scope is ${scheme.lscCustScope}, the scheme covers every customer`,
            };
        }
        const customer = await this.prisma.customer.findFirst({
            where: { cusId, cusIsDeleted: false },
            select: { cusId: true, cusGroupId: true },
        });
        if (!customer) {
            this.throwNotFound('cus_id', cusId, 'Customer not found');
        }
        const scopeMatches = [{ lspCustId: customer.cusId }];
        if (customer.cusGroupId) {
            scopeMatches.push({ lspCustGroupId: customer.cusGroupId });
        }
        const decider = await this.prisma.loyaltySchemeParty.findFirst({
            where: {
                lspLscId: lscId,
                lspIsDeleted: false,
                lspIsActive: true,
                OR: scopeMatches,
            },
            orderBy: [{ lspMatchPriority: 'desc' }, { lspIsExclude: 'desc' }],
        });
        if (!decider) {
            return {
                lsc_id: lscId,
                cus_id: cusId,
                qualifies: false,
                decided_by: 'NO_RULE',
                matched_by: null,
                matched_row_id: null,
                match_priority: null,
                is_exclude: null,
                reason: 'NO — the scheme is scoped to a list and no row on it reaches this customer',
            };
        }
        return {
            lsc_id: lscId,
            cus_id: cusId,
            qualifies: !decider.lspIsExclude,
            decided_by: 'RULE',
            matched_by: decider.lspKind,
            matched_row_id: decider.lspId,
            match_priority: decider.lspMatchPriority,
            is_exclude: decider.lspIsExclude,
            reason: decider.lspIsExclude
                ? `NO — carved out by the ${decider.lspKind} rule`
                : `YES — via ${decider.lspKind}`,
        };
    }
    async softDeleteScheme(lscId, modifiedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await this.findSchemeWithChildren(tx, lscId);
            if (!existing) {
                this.throwNotFound('lsc_id', lscId, 'Loyalty scheme not found');
            }
            const modifiedOn = new Date();
            const actor = this.resolveWriteActor(modifiedBy);
            const updated = await tx.loyaltyScheme.update({
                where: { lscId },
                data: {
                    lscIsDeleted: true,
                    lscIsActive: false,
                    lscModifiedOn: modifiedOn,
                    lscModifiedBy: actor,
                },
            });
            await Promise.all([
                tx.loyaltySchemeBranch.updateMany({
                    where: { lsbLscId: lscId, lsbIsDeleted: false },
                    data: {
                        lsbIsDeleted: true,
                        lsbIsActive: false,
                        lsbModifiedOn: modifiedOn,
                        lsbModifiedBy: actor,
                    },
                }),
                tx.loyaltySchemeParty.updateMany({
                    where: { lspLscId: lscId, lspIsDeleted: false },
                    data: {
                        lspIsDeleted: true,
                        lspIsActive: false,
                        lspModifiedOn: modifiedOn,
                        lspModifiedBy: actor,
                    },
                }),
                tx.loyaltySchemeItem.updateMany({
                    where: { lsiLscId: lscId, lsiIsDeleted: false },
                    data: {
                        lsiIsDeleted: true,
                        lsiIsActive: false,
                        lsiModifiedOn: modifiedOn,
                        lsiModifiedBy: actor,
                    },
                }),
                tx.loyaltySchemeSlab.updateMany({
                    where: { lssLscId: lscId, lssIsDeleted: false },
                    data: {
                        lssIsDeleted: true,
                        lssIsActive: false,
                        lssModifiedOn: modifiedOn,
                        lssModifiedBy: actor,
                    },
                }),
                tx.loyaltySchemeGift.updateMany({
                    where: { lsgLscId: lscId, lsgIsDeleted: false },
                    data: {
                        lsgIsDeleted: true,
                        lsgIsActive: false,
                        lsgModifiedOn: modifiedOn,
                        lsgModifiedBy: actor,
                    },
                }),
            ]);
            await this.audit(tx, 'cancel', SCHEME_TABLE_NAME, lscId, existing.lscName, (0, loyalty_utils_1.toSchemePayload)(existing), (0, loyalty_utils_1.toSchemePayload)({ ...updated, ...EMPTY_CHILDREN }), 'Loyalty scheme soft deleted with all scope, slab and gift rows');
            return { deleted: true, lsc_id: lscId };
        });
    }
    async createScheme(dto) {
        const actor = this.resolveWriteActor(dto.lsc_created_by);
        const data = {
            lscCompId: (0, loyalty_utils_1.requireUuid)(dto.lsc_comp_id, 'lsc_comp_id'),
            lscCode: (0, loyalty_utils_1.requireString)(dto.lsc_code, 'lsc_code'),
            lscName: (0, loyalty_utils_1.requireString)(dto.lsc_name, 'lsc_name'),
            lscStartDate: (0, loyalty_utils_1.parseDateOnly)(dto.lsc_start_date, 'lsc_start_date'),
            lscEndDate: (0, loyalty_utils_1.parseDateOnly)(dto.lsc_end_date, 'lsc_end_date'),
            lscCreatedBy: actor,
        };
        this.applySchemeFields(data, dto);
        const effective = this.effectiveScheme(null, data);
        this.assertSchemeInvariants(effective);
        await this.assertCodeIsFree(this.prisma, data.lscCompId, effective.lscCode, null);
        await this.assertPrimaryIsFree(this.prisma, data, effective, null);
        return this.prisma
            .$transaction(async (tx) => {
            const row = await tx.loyaltyScheme.create({ data });
            await this.audit(tx, 'insert', SCHEME_TABLE_NAME, row.lscId, row.lscName, null, (0, loyalty_utils_1.toSchemePayload)({ ...row, ...EMPTY_CHILDREN }), 'Loyalty scheme created');
            await this.syncChildren(tx, row, dto);
            const after = await this.findSchemeWithChildren(tx, row.lscId);
            return (0, loyalty_utils_1.toSchemePayload)(after ?? { ...row, ...EMPTY_CHILDREN });
        })
            .catch((error) => {
            (0, loyalty_utils_1.handleLoyaltyWriteError)(error);
            throw error;
        });
    }
    async updateScheme(dto) {
        const lscId = (0, loyalty_utils_1.requireUuid)(dto.lsc_id, 'lsc_id');
        return this.prisma
            .$transaction(async (tx) => {
            const existing = await this.findSchemeWithChildren(tx, lscId);
            if (!existing) {
                this.throwNotFound('lsc_id', lscId, 'Loyalty scheme not found');
            }
            const data = {
                lscModifiedOn: new Date(),
                lscModifiedBy: this.resolveWriteActor(dto.lsc_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_comp_id')) {
                data.lscCompId = (0, loyalty_utils_1.requireUuid)(dto.lsc_comp_id, 'lsc_comp_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_code')) {
                data.lscCode = (0, loyalty_utils_1.requireString)(dto.lsc_code, 'lsc_code');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_name')) {
                data.lscName = (0, loyalty_utils_1.requireString)(dto.lsc_name, 'lsc_name');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_start_date')) {
                data.lscStartDate = (0, loyalty_utils_1.parseDateOnly)(dto.lsc_start_date, 'lsc_start_date');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_end_date')) {
                data.lscEndDate = (0, loyalty_utils_1.parseDateOnly)(dto.lsc_end_date, 'lsc_end_date');
            }
            this.applySchemeFields(data, dto);
            const effective = this.effectiveScheme(existing, data);
            this.assertSchemeInvariants(effective);
            const compId = data.lscCompId ?? existing.lscCompId;
            await this.assertCodeIsFree(tx, compId, effective.lscCode, lscId);
            await this.assertPrimaryIsFree(tx, { ...existing, ...data }, effective, lscId);
            const updated = await tx.loyaltyScheme.update({ where: { lscId }, data });
            await this.syncChildren(tx, updated, dto);
            const after = await this.findSchemeWithChildren(tx, lscId);
            await this.audit(tx, 'update', SCHEME_TABLE_NAME, lscId, updated.lscName, (0, loyalty_utils_1.toSchemePayload)(existing), after ? (0, loyalty_utils_1.toSchemePayload)(after) : null, 'Loyalty scheme updated');
            return after ? (0, loyalty_utils_1.toSchemePayload)(after) : (0, loyalty_utils_1.toSchemePayload)({ ...updated, ...EMPTY_CHILDREN });
        })
            .catch((error) => {
            (0, loyalty_utils_1.handleLoyaltyWriteError)(error);
            throw error;
        });
    }
    applySchemeFields(data, dto) {
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_branch_id'))
            data.lscBranchId = dto.lsc_branch_id ?? null;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_tenant_id'))
            data.lscTenantId = dto.lsc_tenant_id ?? null;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_type'))
            data.lscType = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_type);
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_status'))
            data.lscStatus = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_status);
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_priority'))
            data.lscPriority = dto.lsc_priority;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_auto_apply'))
            data.lscAutoApply = dto.lsc_auto_apply ?? true;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_apply_on'))
            data.lscApplyOn = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_apply_on);
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_calc_on_amount_type')) {
            data.lscCalcOnAmountType = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_calc_on_amount_type);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_include_tax'))
            data.lscIncludeTax = dto.lsc_include_tax ?? false;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_bill_type'))
            data.lscBillType = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_bill_type);
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_min_bill_amount')) {
            data.lscMinBillAmount = dto.lsc_min_bill_amount;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_max_earn_points')) {
            data.lscMaxEarnPoints = dto.lsc_max_earn_points;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_earn_on_discounted')) {
            data.lscEarnOnDiscounted = dto.lsc_earn_on_discounted ?? true;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_earn_on_charges')) {
            data.lscEarnOnCharges = dto.lsc_earn_on_charges ?? false;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_earn_with_redeem')) {
            data.lscEarnWithRedeem = dto.lsc_earn_with_redeem ?? false;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_rounding_method')) {
            data.lscRoundingMethod = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_rounding_method);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_points_decimals')) {
            data.lscPointsDecimals = dto.lsc_points_decimals;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_branch_scope')) {
            data.lscBranchScope = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_branch_scope);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_cust_scope')) {
            data.lscCustScope = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_cust_scope);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_item_scope')) {
            data.lscItemScope = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_item_scope);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_price_level_id')) {
            data.lscPriceLevelId = dto.lsc_price_level_id ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_pool_mode'))
            data.lscPoolMode = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_pool_mode);
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_allow_cross_branch_redeem')) {
            data.lscAllowCrossBranchRedeem = dto.lsc_allow_cross_branch_redeem ?? true;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_allow_point_redeem')) {
            data.lscAllowPointRedeem = dto.lsc_allow_point_redeem ?? false;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_allow_gift_redeem')) {
            data.lscAllowGiftRedeem = dto.lsc_allow_gift_redeem ?? false;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_redeem_tender_id')) {
            data.lscRedeemTenderId = dto.lsc_redeem_tender_id ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_redeem_value_per_point')) {
            data.lscRedeemValuePerPoint = dto.lsc_redeem_value_per_point;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_min_redeem_points')) {
            data.lscMinRedeemPoints = dto.lsc_min_redeem_points;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_max_redeem_points')) {
            data.lscMaxRedeemPoints = dto.lsc_max_redeem_points;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_max_redeem_perc')) {
            data.lscMaxRedeemPerc = dto.lsc_max_redeem_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_redeem_min_bill_amount')) {
            data.lscRedeemMinBillAmount = dto.lsc_redeem_min_bill_amount;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_redeem_multiple')) {
            data.lscRedeemMultiple = dto.lsc_redeem_multiple;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_expiry_basis')) {
            data.lscExpiryBasis = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_expiry_basis);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_points_valid_days')) {
            data.lscPointsValidDays = dto.lsc_points_valid_days;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_activation_days')) {
            data.lscActivationDays = dto.lsc_activation_days;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_return_mode')) {
            data.lscReturnMode = (0, loyalty_utils_1.normalizeEnum)(dto.lsc_return_mode);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_valid_from_time')) {
            data.lscValidFromTime = dto.lsc_valid_from_time
                ? (0, loyalty_utils_1.parseTimeToUtcDate)(dto.lsc_valid_from_time, 'lsc_valid_from_time')
                : null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_valid_to_time')) {
            data.lscValidToTime = dto.lsc_valid_to_time
                ? (0, loyalty_utils_1.parseTimeToUtcDate)(dto.lsc_valid_to_time, 'lsc_valid_to_time')
                : null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_valid_weekdays')) {
            const weekdays = (0, loyalty_utils_1.normalizeNullableString)(dto.lsc_valid_weekdays);
            data.lscValidWeekdays = weekdays ? weekdays.toUpperCase() : null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_remarks')) {
            data.lscRemarks = (0, loyalty_utils_1.normalizeNullableString)(dto.lsc_remarks);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_is_active'))
            data.lscIsActive = dto.lsc_is_active ?? true;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_approved_on')) {
            const value = (0, loyalty_utils_1.normalizeNullableString)(dto.lsc_approved_on);
            if (value === null) {
                data.lscApprovedOn = null;
            }
            else {
                const parsed = new Date(value);
                if (Number.isNaN(parsed.getTime())) {
                    this.throwBadRequest('Validation failed', [
                        { field: 'lsc_approved_on', message: 'lsc_approved_on must be a valid datetime' },
                    ]);
                }
                data.lscApprovedOn = parsed;
            }
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'lsc_approved_by')) {
            data.lscApprovedBy = (0, loyalty_utils_1.resolveActorUuid)(dto.lsc_approved_by);
        }
    }
    effectiveScheme(existing, data) {
        const pick = (key, fallback) => {
            const value = data[key];
            return value === undefined ? fallback : value;
        };
        return {
            lscCode: pick('lscCode', existing?.lscCode ?? ''),
            lscType: pick('lscType', existing?.lscType ?? 'BOTH'),
            lscStatus: pick('lscStatus', existing?.lscStatus ?? 'DRAFT'),
            lscApplyOn: pick('lscApplyOn', existing?.lscApplyOn ?? 'BILL_AMOUNT'),
            lscCalcOnAmountType: pick('lscCalcOnAmountType', existing?.lscCalcOnAmountType ?? 'NET_AMOUNT'),
            lscBillType: pick('lscBillType', existing?.lscBillType ?? 'ALL'),
            lscRoundingMethod: pick('lscRoundingMethod', existing?.lscRoundingMethod ?? 'FLOOR'),
            lscBranchScope: pick('lscBranchScope', existing?.lscBranchScope ?? 'ALL'),
            lscCustScope: pick('lscCustScope', existing?.lscCustScope ?? 'ALL'),
            lscItemScope: pick('lscItemScope', existing?.lscItemScope ?? 'ALL'),
            lscPoolMode: pick('lscPoolMode', existing?.lscPoolMode ?? 'COMPANY'),
            lscReturnMode: pick('lscReturnMode', existing?.lscReturnMode ?? 'REVERSE'),
            lscExpiryBasis: pick('lscExpiryBasis', existing?.lscExpiryBasis ?? 'EARN_DATE'),
            lscPriority: pick('lscPriority', existing?.lscPriority ?? 1),
            lscPointsDecimals: pick('lscPointsDecimals', existing?.lscPointsDecimals ?? 2),
            lscActivationDays: pick('lscActivationDays', existing?.lscActivationDays ?? 0),
            lscPointsValidDays: pick('lscPointsValidDays', existing?.lscPointsValidDays ?? 0),
            lscMinBillAmount: pick('lscMinBillAmount', (0, module_service_utils_1.toNumber)(existing?.lscMinBillAmount ?? 0)),
            lscMaxEarnPoints: pick('lscMaxEarnPoints', (0, module_service_utils_1.toNumber)(existing?.lscMaxEarnPoints ?? 0)),
            lscAllowPointRedeem: pick('lscAllowPointRedeem', existing?.lscAllowPointRedeem ?? false),
            lscRedeemValuePerPoint: pick('lscRedeemValuePerPoint', (0, module_service_utils_1.toNumber)(existing?.lscRedeemValuePerPoint ?? 0)),
            lscMinRedeemPoints: pick('lscMinRedeemPoints', (0, module_service_utils_1.toNumber)(existing?.lscMinRedeemPoints ?? 0)),
            lscMaxRedeemPoints: pick('lscMaxRedeemPoints', (0, module_service_utils_1.toNumber)(existing?.lscMaxRedeemPoints ?? 0)),
            lscMaxRedeemPerc: pick('lscMaxRedeemPerc', (0, module_service_utils_1.toNumber)(existing?.lscMaxRedeemPerc ?? 100)),
            lscRedeemMinBillAmount: pick('lscRedeemMinBillAmount', (0, module_service_utils_1.toNumber)(existing?.lscRedeemMinBillAmount ?? 0)),
            lscRedeemMultiple: pick('lscRedeemMultiple', (0, module_service_utils_1.toNumber)(existing?.lscRedeemMultiple ?? 0)),
            lscStartDate: pick('lscStartDate', existing?.lscStartDate ?? new Date(0)),
            lscEndDate: pick('lscEndDate', existing?.lscEndDate ?? new Date(0)),
            lscValidFromTime: pick('lscValidFromTime', existing?.lscValidFromTime ?? null),
            lscValidToTime: pick('lscValidToTime', existing?.lscValidToTime ?? null),
            lscValidWeekdays: pick('lscValidWeekdays', existing?.lscValidWeekdays ?? null),
            lscApprovedBy: pick('lscApprovedBy', existing?.lscApprovedBy ?? null),
        };
    }
    assertSchemeInvariants(scheme) {
        const errors = (0, loyalty_scheme_invariants_1.collectSchemeInvariantErrors)(scheme);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    async assertCodeIsFree(client, compId, code, ignoreLscId) {
        const clash = await client.loyaltyScheme.findFirst({
            where: {
                lscCompId: compId,
                lscIsDeleted: false,
                lscCode: { equals: code, mode: 'insensitive' },
                ...(ignoreLscId ? { lscId: { not: ignoreLscId } } : {}),
            },
            select: { lscId: true },
        });
        if (clash) {
            this.throwConflict('Duplicate loyalty scheme code', [
                { field: 'lsc_code', message: `lsc_code ${code} already exists for this company` },
            ]);
        }
    }
    async assertPrimaryIsFree(client, data, effective, ignoreLscId) {
        const isActive = data.lscIsActive === undefined ? true : Boolean(data.lscIsActive);
        if (effective.lscPriority !== 1 || effective.lscStatus !== 'APPROVED' || !isActive) {
            return;
        }
        const compId = data.lscCompId;
        if (!compId) {
            return;
        }
        const branchId = data.lscBranchId ?? null;
        const clash = await client.loyaltyScheme.findFirst({
            where: {
                lscCompId: compId,
                lscBranchId: branchId,
                lscType: effective.lscType,
                lscPriority: 1,
                lscStatus: 'APPROVED',
                lscIsActive: true,
                lscIsDeleted: false,
                ...(ignoreLscId ? { lscId: { not: ignoreLscId } } : {}),
            },
            select: { lscId: true, lscCode: true },
        });
        if (clash) {
            this.throwConflict('Conflicting primary loyalty scheme', [
                {
                    field: 'lsc_priority',
                    message: `Scheme ${clash.lscCode} is already the approved primary (priority 1) ` +
                        `${effective.lscType} scheme for this company and branch. Lower this scheme's ` +
                        'priority, or retire that one.',
                },
            ]);
        }
    }
    async saveBranchRow(tx, lscId, row, index) {
        const slno = row.lsb_slno ?? index + 1;
        (0, loyalty_utils_1.requireInteger)(slno, 'lsb_slno', 1);
        this.assertBranchInvariants({ lsbSlno: slno });
        if (row.lsb_id) {
            const existing = await tx.loyaltySchemeBranch.findFirst({
                where: { lsbId: row.lsb_id, lsbLscId: lscId, lsbIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('lsb_id', row.lsb_id, 'Loyalty scheme branch row not found');
            }
            const data = {
                lsbModifiedOn: new Date(),
                lsbModifiedBy: this.resolveWriteActor(row.lsb_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsb_slno'))
                data.lsbSlno = slno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsb_branch_id')) {
                data.lsbBranchId = (0, loyalty_utils_1.requireUuid)(row.lsb_branch_id, 'lsb_branch_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsb_is_exclude'))
                data.lsbIsExclude = row.lsb_is_exclude ?? false;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsb_notes'))
                data.lsbNotes = (0, loyalty_utils_1.normalizeNullableString)(row.lsb_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsb_is_active'))
                data.lsbIsActive = row.lsb_is_active ?? true;
            const updated = await tx.loyaltySchemeBranch.update({
                where: { lsbId: row.lsb_id },
                data,
                include: loyalty_utils_1.BRANCH_LOOKUP,
            });
            await this.audit(tx, 'update', BRANCH_TABLE_NAME, updated.lsbId, `Scheme ${lscId} / Branch ${updated.lsbSlno}`, (0, loyalty_utils_1.toBranchPayload)(existing), (0, loyalty_utils_1.toBranchPayload)(updated), 'Loyalty scheme branch row updated');
            return updated;
        }
        const created = await tx.loyaltySchemeBranch.create({
            data: {
                lsbLscId: lscId,
                lsbSlno: slno,
                lsbBranchId: (0, loyalty_utils_1.requireUuid)(row.lsb_branch_id, 'lsb_branch_id'),
                lsbIsExclude: row.lsb_is_exclude ?? false,
                lsbNotes: (0, loyalty_utils_1.normalizeNullableString)(row.lsb_notes),
                lsbIsActive: row.lsb_is_active ?? true,
                lsbCreatedBy: this.resolveWriteActor(row.lsb_created_by),
            },
            include: loyalty_utils_1.BRANCH_LOOKUP,
        });
        await this.audit(tx, 'insert', BRANCH_TABLE_NAME, created.lsbId, `Scheme ${lscId} / Branch ${created.lsbSlno}`, null, (0, loyalty_utils_1.toBranchPayload)(created), 'Loyalty scheme branch row created');
        return created;
    }
    async savePartyRow(tx, lscId, row, index) {
        const existing = row.lsp_id
            ? await tx.loyaltySchemeParty.findFirst({
                where: { lspId: row.lsp_id, lspLscId: lscId, lspIsDeleted: false },
            })
            : null;
        if (row.lsp_id && !existing) {
            this.throwNotFound('lsp_id', row.lsp_id, 'Loyalty scheme party row not found');
        }
        const slno = row.lsp_slno ?? existing?.lspSlno ?? index + 1;
        const kind = (0, module_service_utils_1.hasOwnProperty)(row, 'lsp_kind')
            ? (0, loyalty_utils_1.normalizeEnum)(row.lsp_kind)
            : (existing?.lspKind ?? (0, loyalty_utils_1.normalizeEnum)(row.lsp_kind));
        const matchPriority = (0, module_service_utils_1.hasOwnProperty)(row, 'lsp_match_priority')
            ? row.lsp_match_priority
            : (existing?.lspMatchPriority ?? loyalty_utils_1.LSP_DEFAULT_MATCH_PRIORITY[kind] ?? 1);
        this.assertPartyInvariants({
            lspSlno: slno,
            lspKind: kind,
            lspMatchPriority: matchPriority,
        });
        if (existing) {
            const data = {
                lspModifiedOn: new Date(),
                lspModifiedBy: this.resolveWriteActor(row.lsp_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsp_slno'))
                data.lspSlno = slno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsp_kind'))
                data.lspKind = kind;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsp_scope_id')) {
                data.lspScopeId = (0, loyalty_utils_1.requireUuid)(row.lsp_scope_id, 'lsp_scope_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsp_is_exclude'))
                data.lspIsExclude = row.lsp_is_exclude ?? false;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsp_match_priority'))
                data.lspMatchPriority = matchPriority;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsp_notes'))
                data.lspNotes = (0, loyalty_utils_1.normalizeNullableString)(row.lsp_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsp_is_active'))
                data.lspIsActive = row.lsp_is_active ?? true;
            const updated = await tx.loyaltySchemeParty.update({
                where: { lspId: existing.lspId },
                data,
                include: loyalty_utils_1.PARTY_LOOKUP,
            });
            await this.audit(tx, 'update', PARTY_TABLE_NAME, updated.lspId, `Scheme ${lscId} / ${updated.lspKind} ${updated.lspScopeId}`, (0, loyalty_utils_1.toPartyPayload)(existing), (0, loyalty_utils_1.toPartyPayload)(updated), 'Loyalty scheme party row updated');
            return updated;
        }
        const created = await tx.loyaltySchemeParty.create({
            data: {
                lspLscId: lscId,
                lspSlno: slno,
                lspKind: kind,
                lspScopeId: (0, loyalty_utils_1.requireUuid)(row.lsp_scope_id, 'lsp_scope_id'),
                lspIsExclude: row.lsp_is_exclude ?? false,
                lspMatchPriority: matchPriority,
                lspNotes: (0, loyalty_utils_1.normalizeNullableString)(row.lsp_notes),
                lspIsActive: row.lsp_is_active ?? true,
                lspCreatedBy: this.resolveWriteActor(row.lsp_created_by),
            },
            include: loyalty_utils_1.PARTY_LOOKUP,
        });
        await this.audit(tx, 'insert', PARTY_TABLE_NAME, created.lspId, `Scheme ${lscId} / ${created.lspKind} ${created.lspScopeId}`, null, (0, loyalty_utils_1.toPartyPayload)(created), 'Loyalty scheme party row created');
        return created;
    }
    async saveItemRow(tx, lscId, row, index) {
        const existing = row.lsi_id
            ? await tx.loyaltySchemeItem.findFirst({
                where: { lsiId: row.lsi_id, lsiLscId: lscId, lsiIsDeleted: false },
            })
            : null;
        if (row.lsi_id && !existing) {
            this.throwNotFound('lsi_id', row.lsi_id, 'Loyalty scheme item row not found');
        }
        const slno = row.lsi_slno ?? existing?.lsiSlno ?? index + 1;
        const kind = (0, module_service_utils_1.hasOwnProperty)(row, 'lsi_kind')
            ? (0, loyalty_utils_1.normalizeEnum)(row.lsi_kind)
            : (existing?.lsiKind ?? (0, loyalty_utils_1.normalizeEnum)(row.lsi_kind));
        const factor = this.pickNumber(row, 'lsi_factor', existing?.lsiFactor, 1);
        const points = this.pickNumber(row, 'lsi_points', existing?.lsiPoints, 0);
        const maxPoints = this.pickNumber(row, 'lsi_max_points', existing?.lsiMaxPoints, 0);
        const isExclude = (0, module_service_utils_1.hasOwnProperty)(row, 'lsi_is_exclude')
            ? (row.lsi_is_exclude ?? false)
            : (existing?.lsiIsExclude ?? false);
        const matchPriority = (0, module_service_utils_1.hasOwnProperty)(row, 'lsi_match_priority')
            ? row.lsi_match_priority
            : (existing?.lsiMatchPriority ?? loyalty_utils_1.LSI_DEFAULT_MATCH_PRIORITY[kind] ?? 1);
        this.assertItemInvariants({
            lsiSlno: slno,
            lsiKind: kind,
            lsiIsExclude: isExclude,
            lsiFactor: factor,
            lsiPoints: points,
            lsiMaxPoints: maxPoints,
            lsiMatchPriority: matchPriority,
        });
        if (existing) {
            const data = {
                lsiModifiedOn: new Date(),
                lsiModifiedBy: this.resolveWriteActor(row.lsi_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_slno'))
                data.lsiSlno = slno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_kind'))
                data.lsiKind = kind;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_scope_id')) {
                data.lsiScopeId = (0, loyalty_utils_1.requireUuid)(row.lsi_scope_id, 'lsi_scope_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_is_exclude'))
                data.lsiIsExclude = isExclude;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_factor'))
                data.lsiFactor = factor;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_points'))
                data.lsiPoints = points;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_max_points'))
                data.lsiMaxPoints = maxPoints;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_match_priority'))
                data.lsiMatchPriority = matchPriority;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_notes'))
                data.lsiNotes = (0, loyalty_utils_1.normalizeNullableString)(row.lsi_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsi_is_active'))
                data.lsiIsActive = row.lsi_is_active ?? true;
            const updated = await tx.loyaltySchemeItem.update({
                where: { lsiId: existing.lsiId },
                data,
                include: loyalty_utils_1.ITEM_LOOKUP,
            });
            await this.audit(tx, 'update', ITEM_TABLE_NAME, updated.lsiId, `Scheme ${lscId} / ${updated.lsiKind} ${updated.lsiScopeId}`, (0, loyalty_utils_1.toItemPayload)(existing), (0, loyalty_utils_1.toItemPayload)(updated), 'Loyalty scheme item row updated');
            return updated;
        }
        const created = await tx.loyaltySchemeItem.create({
            data: {
                lsiLscId: lscId,
                lsiSlno: slno,
                lsiKind: kind,
                lsiScopeId: (0, loyalty_utils_1.requireUuid)(row.lsi_scope_id, 'lsi_scope_id'),
                lsiIsExclude: isExclude,
                lsiFactor: factor,
                lsiPoints: points,
                lsiMaxPoints: maxPoints,
                lsiMatchPriority: matchPriority,
                lsiNotes: (0, loyalty_utils_1.normalizeNullableString)(row.lsi_notes),
                lsiIsActive: row.lsi_is_active ?? true,
                lsiCreatedBy: this.resolveWriteActor(row.lsi_created_by),
            },
            include: loyalty_utils_1.ITEM_LOOKUP,
        });
        await this.audit(tx, 'insert', ITEM_TABLE_NAME, created.lsiId, `Scheme ${lscId} / ${created.lsiKind} ${created.lsiScopeId}`, null, (0, loyalty_utils_1.toItemPayload)(created), 'Loyalty scheme item row created');
        return created;
    }
    async saveSlabRow(tx, lscId, row, index) {
        const existing = row.lss_id
            ? await tx.loyaltySchemeSlab.findFirst({
                where: { lssId: row.lss_id, lssLscId: lscId, lssIsDeleted: false },
            })
            : null;
        if (row.lss_id && !existing) {
            this.throwNotFound('lss_id', row.lss_id, 'Loyalty scheme slab row not found');
        }
        const band = {
            lssSlno: row.lss_slno ?? existing?.lssSlno ?? index + 1,
            lssExceeds: this.pickNumber(row, 'lss_exceeds', existing?.lssExceeds, 0),
            lssUpto: this.pickNullableNumber(row, 'lss_upto', existing?.lssUpto),
            lssEach: this.pickNumber(row, 'lss_each', existing?.lssEach, 1),
            lssPoints: this.pickNumber(row, 'lss_points', existing?.lssPoints, 0),
            lssFactor: this.pickNumber(row, 'lss_factor', existing?.lssFactor, 1),
            lssMaxPoints: this.pickNumber(row, 'lss_max_points', existing?.lssMaxPoints, 0),
        };
        this.assertSlabInvariants(band);
        if (existing) {
            const data = {
                lssModifiedOn: new Date(),
                lssModifiedBy: this.resolveWriteActor(row.lss_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_slno'))
                data.lssSlno = band.lssSlno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_item_id'))
                data.lssItemId = row.lss_item_id ?? null;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_unit_id'))
                data.lssUnitId = row.lss_unit_id ?? null;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_exceeds'))
                data.lssExceeds = band.lssExceeds;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_upto'))
                data.lssUpto = band.lssUpto;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_each'))
                data.lssEach = band.lssEach;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_points'))
                data.lssPoints = band.lssPoints;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_factor'))
                data.lssFactor = band.lssFactor;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_max_points'))
                data.lssMaxPoints = band.lssMaxPoints;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_notes'))
                data.lssNotes = (0, loyalty_utils_1.normalizeNullableString)(row.lss_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lss_is_active'))
                data.lssIsActive = row.lss_is_active ?? true;
            const updated = await tx.loyaltySchemeSlab.update({
                where: { lssId: existing.lssId },
                data,
                include: loyalty_utils_1.SLAB_LOOKUP,
            });
            await this.audit(tx, 'update', SLAB_TABLE_NAME, updated.lssId, `Scheme ${lscId} / Band ${updated.lssSlno}`, (0, loyalty_utils_1.toSlabPayload)(existing), (0, loyalty_utils_1.toSlabPayload)(updated), 'Loyalty scheme slab row updated');
            return updated;
        }
        const created = await tx.loyaltySchemeSlab.create({
            data: {
                lssLscId: lscId,
                lssSlno: band.lssSlno,
                lssItemId: row.lss_item_id ?? null,
                lssUnitId: row.lss_unit_id ?? null,
                lssExceeds: band.lssExceeds,
                lssUpto: band.lssUpto,
                lssEach: band.lssEach,
                lssPoints: band.lssPoints,
                lssFactor: band.lssFactor,
                lssMaxPoints: band.lssMaxPoints,
                lssNotes: (0, loyalty_utils_1.normalizeNullableString)(row.lss_notes),
                lssIsActive: row.lss_is_active ?? true,
                lssCreatedBy: this.resolveWriteActor(row.lss_created_by),
            },
            include: loyalty_utils_1.SLAB_LOOKUP,
        });
        await this.audit(tx, 'insert', SLAB_TABLE_NAME, created.lssId, `Scheme ${lscId} / Band ${created.lssSlno}`, null, (0, loyalty_utils_1.toSlabPayload)(created), 'Loyalty scheme slab row created');
        return created;
    }
    async saveGiftRow(tx, lscId, row, index) {
        const existing = row.lsg_id
            ? await tx.loyaltySchemeGift.findFirst({
                where: { lsgId: row.lsg_id, lsgLscId: lscId, lsgIsDeleted: false },
            })
            : null;
        if (row.lsg_id && !existing) {
            this.throwNotFound('lsg_id', row.lsg_id, 'Loyalty scheme gift row not found');
        }
        const validFrom = (0, module_service_utils_1.hasOwnProperty)(row, 'lsg_valid_from')
            ? (0, loyalty_utils_1.parseNullableDateOnly)(row.lsg_valid_from, 'lsg_valid_from')
            : (existing?.lsgValidFrom ?? null);
        const validUpto = (0, module_service_utils_1.hasOwnProperty)(row, 'lsg_valid_upto')
            ? (0, loyalty_utils_1.parseNullableDateOnly)(row.lsg_valid_upto, 'lsg_valid_upto')
            : (existing?.lsgValidUpto ?? null);
        const gift = {
            lsgSlno: row.lsg_slno ?? existing?.lsgSlno ?? index + 1,
            lsgItemQty: this.pickNumber(row, 'lsg_item_qty', existing?.lsgItemQty, 1),
            lsgRedeemPoints: this.pickNumber(row, 'lsg_redeem_points', existing?.lsgRedeemPoints, 0),
            lsgMaxQtyPerBill: this.pickNumber(row, 'lsg_max_qty_per_bill', existing?.lsgMaxQtyPerBill, 0),
            lsgValidFrom: validFrom,
            lsgValidUpto: validUpto,
        };
        this.assertGiftInvariants(gift);
        if (existing) {
            const data = {
                lsgModifiedOn: new Date(),
                lsgModifiedBy: this.resolveWriteActor(row.lsg_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_slno'))
                data.lsgSlno = gift.lsgSlno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_item_id')) {
                data.lsgItemId = (0, loyalty_utils_1.requireUuid)(row.lsg_item_id, 'lsg_item_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_unit_id')) {
                data.lsgUnitId = (0, loyalty_utils_1.requireUuid)(row.lsg_unit_id, 'lsg_unit_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_item_qty'))
                data.lsgItemQty = gift.lsgItemQty;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_redeem_points'))
                data.lsgRedeemPoints = gift.lsgRedeemPoints;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_repeat'))
                data.lsgRepeat = row.lsg_repeat ?? false;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_max_qty_per_bill')) {
                data.lsgMaxQtyPerBill = gift.lsgMaxQtyPerBill;
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_stock_check'))
                data.lsgStockCheck = row.lsg_stock_check ?? true;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_valid_from'))
                data.lsgValidFrom = validFrom;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_valid_upto'))
                data.lsgValidUpto = validUpto;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_notes'))
                data.lsgNotes = (0, loyalty_utils_1.normalizeNullableString)(row.lsg_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'lsg_is_active'))
                data.lsgIsActive = row.lsg_is_active ?? true;
            const updated = await tx.loyaltySchemeGift.update({
                where: { lsgId: existing.lsgId },
                data,
                include: loyalty_utils_1.GIFT_LOOKUP,
            });
            await this.audit(tx, 'update', GIFT_TABLE_NAME, updated.lsgId, `Scheme ${lscId} / Gift ${updated.lsgSlno}`, (0, loyalty_utils_1.toGiftPayload)(existing), (0, loyalty_utils_1.toGiftPayload)(updated), 'Loyalty scheme gift row updated');
            return updated;
        }
        const created = await tx.loyaltySchemeGift.create({
            data: {
                lsgLscId: lscId,
                lsgSlno: gift.lsgSlno,
                lsgItemId: (0, loyalty_utils_1.requireUuid)(row.lsg_item_id, 'lsg_item_id'),
                lsgUnitId: (0, loyalty_utils_1.requireUuid)(row.lsg_unit_id, 'lsg_unit_id'),
                lsgItemQty: gift.lsgItemQty,
                lsgRedeemPoints: gift.lsgRedeemPoints,
                lsgRepeat: row.lsg_repeat ?? false,
                lsgMaxQtyPerBill: gift.lsgMaxQtyPerBill,
                lsgStockCheck: row.lsg_stock_check ?? true,
                lsgValidFrom: validFrom,
                lsgValidUpto: validUpto,
                lsgNotes: (0, loyalty_utils_1.normalizeNullableString)(row.lsg_notes),
                lsgIsActive: row.lsg_is_active ?? true,
                lsgCreatedBy: this.resolveWriteActor(row.lsg_created_by),
            },
            include: loyalty_utils_1.GIFT_LOOKUP,
        });
        await this.audit(tx, 'insert', GIFT_TABLE_NAME, created.lsgId, `Scheme ${lscId} / Gift ${created.lsgSlno}`, null, (0, loyalty_utils_1.toGiftPayload)(created), 'Loyalty scheme gift row created');
        return created;
    }
    assertBranchInvariants(row) {
        const errors = (0, loyalty_scheme_invariants_1.collectBranchInvariantErrors)(row);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    assertPartyInvariants(row) {
        const errors = (0, loyalty_scheme_invariants_1.collectPartyInvariantErrors)(row);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    assertItemInvariants(row) {
        const errors = (0, loyalty_scheme_invariants_1.collectItemInvariantErrors)(row);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    assertSlabInvariants(band) {
        const errors = (0, loyalty_scheme_invariants_1.collectSlabInvariantErrors)(band);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    assertGiftInvariants(row) {
        const errors = (0, loyalty_scheme_invariants_1.collectGiftInvariantErrors)(row);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    async findSchemeWithChildren(client, lscId) {
        return client.loyaltyScheme.findFirst({
            where: { lscId, lscIsDeleted: false },
            include: { ...loyalty_utils_1.SCHEME_LOOKUP, ...EDITABLE_CHILDREN_INCLUDE },
        });
    }
    async requireScheme(client, lscId) {
        const scheme = await client.loyaltyScheme.findFirst({
            where: { lscId, lscIsDeleted: false },
        });
        if (!scheme) {
            this.throwNotFound('lsc_id', lscId, 'Loyalty scheme not found');
        }
        return scheme;
    }
    async syncChildren(tx, scheme, dto) {
        const actor = dto.lsc_modified_by ?? dto.lsc_created_by;
        if (dto.branches !== undefined) {
            this.assertNoDuplicates(dto.branches.map((row, index) => ({ key: row.lsb_branch_id ?? `#${index}`, index })), 'lsb_branch_id');
            const kept = [];
            for (let index = 0; index < dto.branches.length; index += 1) {
                const saved = await this.saveBranchRow(tx, scheme.lscId, dto.branches[index], index);
                kept.push(saved.lsbId);
            }
            const stale = await tx.loyaltySchemeBranch.findMany({
                where: { lsbLscId: scheme.lscId, lsbIsDeleted: false, lsbId: { notIn: kept } },
            });
            for (const row of stale) {
                await this.softDeleteBranchRow(tx, row, actor);
            }
        }
        if (dto.parties !== undefined) {
            this.assertNoDuplicates(dto.parties.map((row, index) => ({
                key: `${(row.lsp_kind ?? '').toUpperCase()}:${row.lsp_scope_id ?? `#${index}`}`,
                index,
            })), 'lsp_scope_id');
            const kept = [];
            for (let index = 0; index < dto.parties.length; index += 1) {
                const saved = await this.savePartyRow(tx, scheme.lscId, dto.parties[index], index);
                kept.push(saved.lspId);
            }
            const stale = await tx.loyaltySchemeParty.findMany({
                where: { lspLscId: scheme.lscId, lspIsDeleted: false, lspId: { notIn: kept } },
            });
            for (const row of stale) {
                await this.softDeletePartyRow(tx, row, actor);
            }
        }
        if (dto.items !== undefined) {
            this.assertNoDuplicates(dto.items.map((row, index) => ({
                key: `${(row.lsi_kind ?? '').toUpperCase()}:${row.lsi_scope_id ?? `#${index}`}`,
                index,
            })), 'lsi_scope_id');
            const kept = [];
            for (let index = 0; index < dto.items.length; index += 1) {
                const saved = await this.saveItemRow(tx, scheme.lscId, dto.items[index], index);
                kept.push(saved.lsiId);
            }
            const stale = await tx.loyaltySchemeItem.findMany({
                where: { lsiLscId: scheme.lscId, lsiIsDeleted: false, lsiId: { notIn: kept } },
            });
            for (const row of stale) {
                await this.softDeleteItemRow(tx, row, actor);
            }
        }
        if (dto.slabs !== undefined) {
            this.assertNoDuplicates(dto.slabs.map((row, index) => ({
                key: `${row.lss_item_id ?? '-'}:${row.lss_exceeds ?? 0}`,
                index,
            })), 'lss_exceeds');
            const kept = [];
            for (let index = 0; index < dto.slabs.length; index += 1) {
                const saved = await this.saveSlabRow(tx, scheme.lscId, dto.slabs[index], index);
                kept.push(saved.lssId);
            }
            const stale = await tx.loyaltySchemeSlab.findMany({
                where: { lssLscId: scheme.lscId, lssIsDeleted: false, lssId: { notIn: kept } },
            });
            for (const row of stale) {
                await this.softDeleteSlabRow(tx, row, actor);
            }
        }
        if (dto.gifts !== undefined) {
            this.assertNoDuplicates(dto.gifts.map((row, index) => ({
                key: `${row.lsg_item_id ?? `#${index}`}:${row.lsg_unit_id ?? '-'}`,
                index,
            })), 'lsg_item_id');
            const kept = [];
            for (let index = 0; index < dto.gifts.length; index += 1) {
                const saved = await this.saveGiftRow(tx, scheme.lscId, dto.gifts[index], index);
                kept.push(saved.lsgId);
            }
            const stale = await tx.loyaltySchemeGift.findMany({
                where: { lsgLscId: scheme.lscId, lsgIsDeleted: false, lsgId: { notIn: kept } },
            });
            for (const row of stale) {
                await this.softDeleteGiftRow(tx, row, actor);
            }
        }
    }
    async softDeleteBranchRow(tx, existing, modifiedBy) {
        const updated = await tx.loyaltySchemeBranch.update({
            where: { lsbId: existing.lsbId },
            data: {
                lsbIsDeleted: true,
                lsbIsActive: false,
                lsbModifiedOn: new Date(),
                lsbModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', BRANCH_TABLE_NAME, existing.lsbId, `Scheme ${existing.lsbLscId} / Branch ${existing.lsbSlno}`, (0, loyalty_utils_1.toBranchPayload)(existing), (0, loyalty_utils_1.toBranchPayload)(updated), 'Loyalty scheme branch row soft deleted');
    }
    async softDeletePartyRow(tx, existing, modifiedBy) {
        const updated = await tx.loyaltySchemeParty.update({
            where: { lspId: existing.lspId },
            data: {
                lspIsDeleted: true,
                lspIsActive: false,
                lspModifiedOn: new Date(),
                lspModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', PARTY_TABLE_NAME, existing.lspId, `Scheme ${existing.lspLscId} / ${existing.lspKind} ${existing.lspScopeId}`, (0, loyalty_utils_1.toPartyPayload)(existing), (0, loyalty_utils_1.toPartyPayload)(updated), 'Loyalty scheme party row soft deleted');
    }
    async softDeleteItemRow(tx, existing, modifiedBy) {
        const updated = await tx.loyaltySchemeItem.update({
            where: { lsiId: existing.lsiId },
            data: {
                lsiIsDeleted: true,
                lsiIsActive: false,
                lsiModifiedOn: new Date(),
                lsiModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', ITEM_TABLE_NAME, existing.lsiId, `Scheme ${existing.lsiLscId} / ${existing.lsiKind} ${existing.lsiScopeId}`, (0, loyalty_utils_1.toItemPayload)(existing), (0, loyalty_utils_1.toItemPayload)(updated), 'Loyalty scheme item row soft deleted');
    }
    async softDeleteSlabRow(tx, existing, modifiedBy) {
        const updated = await tx.loyaltySchemeSlab.update({
            where: { lssId: existing.lssId },
            data: {
                lssIsDeleted: true,
                lssIsActive: false,
                lssModifiedOn: new Date(),
                lssModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', SLAB_TABLE_NAME, existing.lssId, `Scheme ${existing.lssLscId} / Band ${existing.lssSlno}`, (0, loyalty_utils_1.toSlabPayload)(existing), (0, loyalty_utils_1.toSlabPayload)(updated), 'Loyalty scheme slab row soft deleted');
    }
    async softDeleteGiftRow(tx, existing, modifiedBy) {
        const updated = await tx.loyaltySchemeGift.update({
            where: { lsgId: existing.lsgId },
            data: {
                lsgIsDeleted: true,
                lsgIsActive: false,
                lsgModifiedOn: new Date(),
                lsgModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', GIFT_TABLE_NAME, existing.lsgId, `Scheme ${existing.lsgLscId} / Gift ${existing.lsgSlno}`, (0, loyalty_utils_1.toGiftPayload)(existing), (0, loyalty_utils_1.toGiftPayload)(updated), 'Loyalty scheme gift row soft deleted');
    }
    assertNoDuplicates(keys, field) {
        const seen = new Map();
        for (const { key, index } of keys) {
            const first = seen.get(key);
            if (first !== undefined) {
                this.throwBadRequest('Validation failed', [
                    { field, message: `Rows ${first + 1} and ${index + 1} target the same scope` },
                ]);
            }
            seen.set(key, index);
        }
    }
    pickNumber(row, key, existing, fallback) {
        if ((0, module_service_utils_1.hasOwnProperty)(row, key)) {
            const value = row[key];
            return typeof value === 'number' ? value : fallback;
        }
        if (existing === null || existing === undefined) {
            return fallback;
        }
        return Number(existing.toString());
    }
    pickNullableNumber(row, key, existing) {
        if ((0, module_service_utils_1.hasOwnProperty)(row, key)) {
            const value = row[key];
            return typeof value === 'number' ? value : null;
        }
        return existing === null || existing === undefined ? null : Number(existing.toString());
    }
    resolveWriteActor(explicit) {
        return (0, loyalty_utils_1.resolveActor)(explicit, this.requestContextService.getUserId()) ?? module_service_utils_1.DEFAULT_AUDIT_ACTOR;
    }
    resolveAuditActor() {
        return this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_AUDIT_ACTOR;
    }
    async audit(tx, action, tableName, pk, displayName, originalRecord, modifiedRecord, notes) {
        await this.auditLogService.logEntityChange({
            action,
            tableName,
            screenName: SCREEN_NAME,
            screenType: 'master',
            pk,
            displayName,
            originalRecord,
            modifiedRecord,
            userId: this.resolveAuditActor(),
            notes,
        }, tx);
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
};
exports.PromotionLoyaltyPointsService = PromotionLoyaltyPointsService;
exports.PromotionLoyaltyPointsService = PromotionLoyaltyPointsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], PromotionLoyaltyPointsService);
//# sourceMappingURL=promotion-loyalty-points.service.js.map