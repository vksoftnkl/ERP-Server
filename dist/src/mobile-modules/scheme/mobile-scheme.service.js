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
exports.MobileSchemeService = exports.PHONE_SCHEME_WHERE = void 0;
exports.numText = numText;
exports.istTimestamp = istTimestamp;
exports.toPhoneScheme = toPhoneScheme;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const promotion_scheme_utils_1 = require("../../modules/sales/promotion-scheme/utils/promotion-scheme.utils");
const mobile_scope_1 = require("../common/mobile-scope");
exports.PHONE_SCHEME_WHERE = {
    prmIsDeleted: false,
    prmIsActive: true,
    prmStatus: 'APPROVED',
    prmAutoApply: true,
    prmCouponBatchId: null,
};
const ITEM_UNIT_NAME = { select: { unit: { select: { unit_name: true } } } };
const PHONE_SCHEME_SELECT = {
    prmId: true,
    prmCompId: true,
    prmBranchId: true,
    prmCode: true,
    prmName: true,
    prmStatus: true,
    prmApplyOn: true,
    prmBenefit: true,
    prmPriority: true,
    prmStackMode: true,
    prmAutoApply: true,
    prmAllowWithManualDisc: true,
    prmCalcOnAmountType: true,
    prmIncludeTax: true,
    prmBillType: true,
    prmMinBillAmount: true,
    prmMinQty: true,
    prmBranchScope: true,
    prmCustScope: true,
    prmItemScope: true,
    prmPriceLevelId: true,
    prmMaxBenefitPerBill: true,
    prmCouponBatchId: true,
    prmStartDate: true,
    prmEndDate: true,
    prmValidFromTime: true,
    prmValidToTime: true,
    prmValidWeekdays: true,
    prmRemarks: true,
    prmModifiedOn: true,
    branches: {
        where: { prbIsDeleted: false, prbIsActive: true },
        orderBy: [{ prbSlno: 'asc' }, { prbId: 'asc' }],
        select: {
            prbId: true,
            prbBranchId: true,
            prbIsExclude: true,
            branch: { select: { brName: true } },
        },
    },
    parties: {
        where: { prpIsDeleted: false, prpIsActive: true },
        orderBy: [{ prpSlno: 'asc' }, { prpId: 'asc' }],
        select: {
            prpId: true,
            prpKind: true,
            prpScopeId: true,
            prpIsExclude: true,
            prpMatchPriority: true,
            customer: { select: { cusName: true } },
            customerGroup: { select: { cgrName: true } },
            area: { select: { armName: true } },
            city: { select: { ctmName: true } },
        },
    },
    items: {
        where: { priIsDeleted: false, priIsActive: true },
        orderBy: [{ priSlno: 'asc' }, { priId: 'asc' }],
        select: {
            priId: true,
            priKind: true,
            priScopeId: true,
            priUnitId: true,
            priIsExclude: true,
            priDiscPerc: true,
            priDiscQty: true,
            priDiscAmt: true,
            priMinQty: true,
            priFactor: true,
            priMaxBenefit: true,
            priMatchPriority: true,
            item: { select: { itemNameEn: true } },
            itemGroup: { select: { itgName: true } },
            itemCategory: { select: { categoryName: true } },
            itemBrand: { select: { brand_name: true } },
            itemSection: { select: { secName: true } },
            unit: ITEM_UNIT_NAME,
        },
    },
    slabs: {
        where: { prsIsDeleted: false, prsIsActive: true },
        orderBy: [{ prsSlno: 'asc' }, { prsId: 'asc' }],
        select: {
            prsId: true,
            prsSlno: true,
            prsBenefit: true,
            prsExceeds: true,
            prsUpto: true,
            prsEach: true,
            prsIsRepeat: true,
            prsMaxRepeats: true,
            prsFreeItemId: true,
            prsFreeUnitId: true,
            prsFreeQty: true,
            prsFreeStockCheck: true,
            prsDiscPerc: true,
            prsDiscQty: true,
            prsDiscAmt: true,
            prsFixedPrice: true,
            prsMaxBenefitAmt: true,
            freeItem: { select: { itemNameEn: true } },
            freeUnit: { select: { iucToBaseFactor: true, unit: { select: { unit_name: true } } } },
        },
    },
};
function numText(value, scale) {
    return value === null ? null : new client_1.Prisma.Decimal(value).toFixed(scale);
}
function istTimestamp(value) {
    if (!value) {
        return null;
    }
    return new Date(value.getTime() + 330 * 60_000).toISOString().replace('Z', '+05:30');
}
function firstName(...candidates) {
    return candidates.find((value) => value !== null && value !== undefined) ?? null;
}
function toPhoneScheme(row) {
    return {
        prm_id: row.prmId,
        prm_comp_id: row.prmCompId,
        prm_branch_id: row.prmBranchId,
        prm_code: row.prmCode,
        prm_name: row.prmName,
        prm_status: row.prmStatus,
        prm_apply_on: row.prmApplyOn,
        prm_benefit: row.prmBenefit,
        prm_priority: row.prmPriority,
        prm_stack_mode: row.prmStackMode,
        prm_auto_apply: row.prmAutoApply,
        prm_allow_with_manual_disc: row.prmAllowWithManualDisc,
        prm_calc_on_amount_type: row.prmCalcOnAmountType,
        prm_include_tax: row.prmIncludeTax,
        prm_bill_type: row.prmBillType,
        prm_min_bill_amount: numText(row.prmMinBillAmount, 2),
        prm_min_qty: numText(row.prmMinQty, 3),
        prm_branch_scope: row.prmBranchScope,
        prm_cust_scope: row.prmCustScope,
        prm_item_scope: row.prmItemScope,
        prm_price_level_id: row.prmPriceLevelId,
        prm_max_benefit_per_bill: numText(row.prmMaxBenefitPerBill, 2),
        prm_coupon_batch_id: row.prmCouponBatchId,
        prm_start_date: (0, promotion_scheme_utils_1.toIsoDate)(row.prmStartDate),
        prm_end_date: (0, promotion_scheme_utils_1.toIsoDate)(row.prmEndDate),
        prm_valid_from_time: (0, promotion_scheme_utils_1.toIsoTime)(row.prmValidFromTime),
        prm_valid_to_time: (0, promotion_scheme_utils_1.toIsoTime)(row.prmValidToTime),
        prm_valid_weekdays: row.prmValidWeekdays,
        prm_remarks: row.prmRemarks,
        prm_modified_on: istTimestamp(row.prmModifiedOn),
        branches: row.branches.map((b) => ({
            prb_id: b.prbId,
            prb_branch_id: b.prbBranchId,
            prb_branch_name: b.branch?.brName ?? null,
            prb_is_exclude: b.prbIsExclude,
        })),
        parties: row.parties.map((p) => ({
            prp_id: p.prpId,
            prp_kind: p.prpKind,
            prp_scope_id: p.prpScopeId,
            prp_scope_name: firstName(p.customer?.cusName, p.customerGroup?.cgrName, p.area?.armName, p.city?.ctmName),
            prp_is_exclude: p.prpIsExclude,
            prp_match_priority: p.prpMatchPriority,
        })),
        items: row.items.map((i) => ({
            pri_id: i.priId,
            pri_kind: i.priKind,
            pri_scope_id: i.priScopeId,
            pri_scope_name: firstName(i.item?.itemNameEn, i.itemGroup?.itgName, i.itemCategory?.categoryName, i.itemBrand?.brand_name, i.itemSection?.secName),
            pri_unit_id: i.priUnitId,
            pri_unit_name: i.unit?.unit.unit_name ?? null,
            pri_is_exclude: i.priIsExclude,
            pri_disc_perc: numText(i.priDiscPerc, 4),
            pri_disc_qty: numText(i.priDiscQty, 4),
            pri_disc_amt: numText(i.priDiscAmt, 2),
            pri_min_qty: numText(i.priMinQty, 3),
            pri_factor: numText(i.priFactor, 4),
            pri_max_benefit: numText(i.priMaxBenefit, 2),
            pri_match_priority: i.priMatchPriority,
        })),
        slabs: row.slabs.map((s) => ({
            prs_id: s.prsId,
            prs_slno: s.prsSlno,
            prs_benefit: s.prsBenefit,
            prs_exceeds: numText(s.prsExceeds, 3),
            prs_upto: numText(s.prsUpto, 3),
            prs_each: numText(s.prsEach, 3),
            prs_is_repeat: s.prsIsRepeat,
            prs_max_repeats: s.prsMaxRepeats,
            prs_free_item_id: s.prsFreeItemId,
            prs_free_item_name: s.freeItem?.itemNameEn ?? null,
            prs_free_unit_id: s.prsFreeUnitId,
            prs_free_unit_name: s.freeUnit?.unit.unit_name ?? null,
            prs_free_unit_factor: numText(s.freeUnit?.iucToBaseFactor ?? null, 6),
            prs_free_qty: numText(s.prsFreeQty, 3),
            prs_free_stock_check: s.prsFreeStockCheck,
            prs_disc_perc: numText(s.prsDiscPerc, 4),
            prs_disc_qty: numText(s.prsDiscQty, 4),
            prs_disc_amt: numText(s.prsDiscAmt, 2),
            prs_fixed_price: numText(s.prsFixedPrice, 4),
            prs_max_benefit_amt: numText(s.prsMaxBenefitAmt, 2),
        })),
    };
}
let MobileSchemeService = class MobileSchemeService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async active(q) {
        await (0, mobile_scope_1.assertMobileCompany)(this.prisma, q.companyId);
        if (q.deviceUid) {
            await (0, mobile_scope_1.resolveMobileDevice)(this.prisma, q.deviceUid);
        }
        const asOf = await (0, mobile_scope_1.databaseToday)(this.prisma);
        const ids = await this.liveSchemeIds(q.companyId, asOf);
        const rows = ids.length
            ? await this.prisma.promotionScheme.findMany({
                where: { prmId: { in: ids }, prmCompId: q.companyId, ...exports.PHONE_SCHEME_WHERE },
                orderBy: [{ prmPriority: 'asc' }, { prmCode: 'asc' }, { prmId: 'asc' }],
                select: PHONE_SCHEME_SELECT,
            })
            : [];
        return { companyId: q.companyId, asOf, schemes: rows.map(toPhoneScheme) };
    }
    async liveSchemeIds(companyId, asOf) {
        const rows = await this.prisma.$queryRaw `
      SELECT p.prm_id AS "prmId"
        FROM sales.promotion_scheme p
       WHERE p.prm_comp_id = ${companyId}::uuid
         AND p.prm_is_deleted = false
         AND p.prm_is_active = true
         AND p.prm_status = 'APPROVED'
         AND p.prm_auto_apply = true
         AND p.prm_coupon_batch_id IS NULL
         AND p.prm_end_date >= ${asOf}::date`;
        return rows.map((row) => row.prmId);
    }
};
exports.MobileSchemeService = MobileSchemeService;
exports.MobileSchemeService = MobileSchemeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MobileSchemeService);
//# sourceMappingURL=mobile-scheme.service.js.map