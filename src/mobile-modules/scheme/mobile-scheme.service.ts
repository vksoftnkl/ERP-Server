import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toIsoDate,
  toIsoTime,
} from '../../modules/sales/promotion-scheme/utils/promotion-scheme.utils';
import { assertMobileCompany, databaseToday, resolveMobileDevice } from '../common/mobile-scope';
import { ActiveMobileSchemesQueryDto } from './dto/mobile-scheme.dto';
import type {
  MobileScheme,
  MobileSchemeBranch,
  MobileSchemeItem,
  MobileSchemeParty,
  MobileSchemeSlab,
  MobileSchemesPayload,
} from './types/mobile-scheme-api.types';

/**
 * The header filter of a scheme the phone's engine can apply by itself (plan
 * decision 4): approved, live, auto-apply, no coupon. The end date is not here:
 * Prisma binds a JS Date against a DATE column as a timestamp, which the IST
 * session shifts by 5h30 (memory db-session-timezone-ist), so that filter runs
 * in SQL on a 'YYYY-MM-DD'::date (liveSchemeIds).
 */
export const PHONE_SCHEME_WHERE = {
  prmIsDeleted: false,
  prmIsActive: true,
  prmStatus: 'APPROVED',
  prmAutoApply: true,
  prmCouponBatchId: null,
} satisfies Prisma.PromotionSchemeWhereInput;

const ITEM_UNIT_NAME = { select: { unit: { select: { unit_name: true } } } } as const;

/**
 * The phone's columns of each table, plus the names /promotion-scheme/list
 * joins (its README "Display names"), plus the free unit's factor. Children:
 * live and active rows only, by slno then id.
 */
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
      // One join per kind through the generated carrier columns: only the one
      // matching prp_kind is non-null (as PARTY_LOOKUP).
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
} satisfies Prisma.PromotionSchemeSelect;

export type PhoneSchemeRow = Prisma.PromotionSchemeGetPayload<{
  select: typeof PHONE_SCHEME_SELECT;
}>;

/** An exact numeric at its column scale; NULL stays null. */
export function numText(value: Prisma.Decimal, scale: number): string;
export function numText(value: Prisma.Decimal | null, scale: number): string | null;
export function numText(value: Prisma.Decimal | null, scale: number): string | null {
  return value === null ? null : new Prisma.Decimal(value).toFixed(scale);
}

/** A timestamptz as IST text with its offset (2026-08-24T15:20:31.123+05:30). */
export function istTimestamp(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return new Date(value.getTime() + 330 * 60_000).toISOString().replace('Z', '+05:30');
}

/** First non-null of the joined names, as /promotion-scheme/list's firstName. */
function firstName(...candidates: Array<string | null | undefined>): string | null {
  return candidates.find((value) => value !== null && value !== undefined) ?? null;
}

export function toPhoneScheme(row: PhoneSchemeRow): MobileScheme {
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
    prm_start_date: toIsoDate(row.prmStartDate),
    prm_end_date: toIsoDate(row.prmEndDate),
    prm_valid_from_time: toIsoTime(row.prmValidFromTime),
    prm_valid_to_time: toIsoTime(row.prmValidToTime),
    prm_valid_weekdays: row.prmValidWeekdays,
    prm_remarks: row.prmRemarks,
    prm_modified_on: istTimestamp(row.prmModifiedOn),
    branches: row.branches.map(
      (b): MobileSchemeBranch => ({
        prb_id: b.prbId,
        prb_branch_id: b.prbBranchId,
        prb_branch_name: b.branch?.brName ?? null,
        prb_is_exclude: b.prbIsExclude,
      }),
    ),
    parties: row.parties.map(
      (p): MobileSchemeParty => ({
        prp_id: p.prpId,
        prp_kind: p.prpKind,
        prp_scope_id: p.prpScopeId,
        prp_scope_name: firstName(
          p.customer?.cusName,
          p.customerGroup?.cgrName,
          p.area?.armName,
          p.city?.ctmName,
        ),
        prp_is_exclude: p.prpIsExclude,
        prp_match_priority: p.prpMatchPriority,
      }),
    ),
    items: row.items.map(
      (i): MobileSchemeItem => ({
        pri_id: i.priId,
        pri_kind: i.priKind,
        pri_scope_id: i.priScopeId,
        pri_scope_name: firstName(
          i.item?.itemNameEn,
          i.itemGroup?.itgName,
          i.itemCategory?.categoryName,
          i.itemBrand?.brand_name,
          i.itemSection?.secName,
        ),
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
      }),
    ),
    slabs: row.slabs.map(
      (s): MobileSchemeSlab => ({
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
      }),
    ),
  };
}

/**
 * The phone's read of the promotion schemes (plan-item-schemes-offers §6.1).
 * Read-only. Every branch row is sent (no branch filter): the phone checks the
 * order's own branch offline.
 */
@Injectable()
export class MobileSchemeService {
  constructor(private readonly prisma: PrismaService) {}

  async active(q: ActiveMobileSchemesQueryDto): Promise<MobileSchemesPayload> {
    await assertMobileCompany(this.prisma, q.companyId);
    if (q.deviceUid) {
      await resolveMobileDevice(this.prisma, q.deviceUid);
    }
    const asOf = await databaseToday(this.prisma);
    const ids = await this.liveSchemeIds(q.companyId, asOf);
    const rows = ids.length
      ? await this.prisma.promotionScheme.findMany({
          // The header filter again: a scheme suspended between the two reads drops out.
          where: { prmId: { in: ids }, prmCompId: q.companyId, ...PHONE_SCHEME_WHERE },
          orderBy: [{ prmPriority: 'asc' }, { prmCode: 'asc' }, { prmId: 'asc' }],
          select: PHONE_SCHEME_SELECT,
        })
      : [];
    return { companyId: q.companyId, asOf, schemes: rows.map(toPhoneScheme) };
  }

  /**
   * The ids of the company's schemes the phone can apply that have not ended
   * by `asOf` (a future start is kept: it starts working offline on its day).
   */
  private async liveSchemeIds(companyId: string, asOf: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ prmId: string }[]>`
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
}
