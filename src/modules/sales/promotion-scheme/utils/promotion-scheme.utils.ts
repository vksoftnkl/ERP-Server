import {
  Prisma,
  PromotionScheme,
  PromotionSchemeBranch,
  PromotionSchemeItem,
  PromotionSchemeParty,
  PromotionSchemeSlab,
} from '@prisma/client';
import {
  isExclusionConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import {
  PromotionSchemeBranchPayload,
  PromotionSchemeErrorDetail,
  PromotionSchemeErrorResponse,
  PromotionSchemeItemPayload,
  PromotionSchemePartyPayload,
  PromotionSchemePayload,
  PromotionSchemeSlabPayload,
  PromotionSchemeSummaryPayload,
} from '../types/promotion-scheme-api.types';
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// ─── The vocabularies ─────────────────────────────────────────────────────────
// These were CHECK constraints in the DDL. They are deliberately NOT in the
// migration, so this file is the only thing standing between the till and a
// scheme nobody can evaluate. Keep them in step with the .prisma headers.
export const PRM_STATUSES = ['DRAFT', 'APPROVED', 'SUSPENDED', 'CLOSED'] as const;
export const PRM_APPLY_ON = ['BILL_AMOUNT', 'BILL_QTY', 'ITEM_AMOUNT', 'ITEM_QTY'] as const;
export const PRM_BENEFITS = ['FREE_ITEM', 'DISC_PERC', 'DISC_AMT', 'FIXED_PRICE','DISC_PER_ITEM'] as const;
export const PRM_STACK_MODES = ['EXCLUSIVE', 'STACKABLE'] as const;
export const PRM_CALC_ON = ['GROSS_AMOUNT', 'NET_AMOUNT', 'TAXABLE_AMOUNT'] as const;
export const PRM_BILL_TYPES = ['ALL', 'CASH', 'CREDIT'] as const;
export const PRM_SCOPES = ['ALL', 'LIST'] as const;
export const PRP_KINDS = ['CUSTOMER', 'CUSTOMER_GROUP', 'AREA', 'CITY'] as const;
export const PRI_KINDS = [
  'ITEM',
  'ITEM_GROUP',
  'ITEM_CATEGORY',
  'ITEM_BRAND',
  'ITEM_SECTION',
] as const;
export const PRM_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
export const PRM_WEEKDAYS_PATTERN =
  /^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$/;
/** Narrowest first — the seed the engine reads when two rules both match. */
export const PRP_DEFAULT_MATCH_PRIORITY: Record<string, number> = {
  CUSTOMER: 4,
  AREA: 3,
  CITY: 2,
  CUSTOMER_GROUP: 1,
};
export const PRI_DEFAULT_MATCH_PRIORITY: Record<string, number> = {
  ITEM: 4,
  ITEM_BRAND: 3,
  ITEM_CATEGORY: 2,
  ITEM_SECTION: 1,
  ITEM_GROUP: 0,
};
// ─── Display lookups ──────────────────────────────────────────────────────────
//
// Every scope row stores an id and a kind; the NAME behind that id lives in one
// of nine masters. The grid needs the name, so the read paths pull it through
// the relations Prisma already declares on the generated columns — one JOIN per
// kind, no CASE, exactly as 15q_promotion_scope_queries.sql does it.
//
// These are `select`s rather than `include`s on purpose: a scope row must not
// drag a whole item or customer record into a grid response.
/**
 * The two masters the HEADER points at. Same idea as the grid lookups below:
 * the id is the truth, the name is for the screen, and neither is ever written
 * back. Read paths join them; the write paths' audit snapshots do not, which is
 * why the fields are optional on SchemeRow.
 */
export const SCHEME_LOOKUP = {
  company: { select: { compName: true } },
  branch: { select: { brName: true } },
} as const;
export const BRANCH_LOOKUP = {
  branch: { select: { brName: true, brCode: true, brShort: true } },
} as const;
export const PARTY_LOOKUP = {
  customer: { select: { cusName: true, cusCode: true } },
  customerGroup: { select: { cgrName: true, cgrShort: true } },
  area: { select: { armName: true, armShort: true } },
  city: { select: { ctmName: true, ctmShort: true } },
} as const;
export const ITEM_LOOKUP = {
  item: { select: { itemNameEn: true } },
  itemGroup: { select: { itgName: true } },
  itemCategory: { select: { categoryName: true } },
  itemBrand: { select: { brand_name: true } },
  itemSection: { select: { secName: true } },
  // item_unit_conversion carries no name of its own — only a pointer at
  // item_unit_master — so the unit needs the second hop.
  unit: { select: { unit: { select: { unit_name: true } } } },
} as const;
export const SLAB_LOOKUP = {
  freeItem: { select: { itemNameEn: true } },
  freeUnit: { select: { unit: { select: { unit_name: true } } } },
} as const;
type UnitLookup = { unit: { unit_name: string } } | null;
/**
 * A child row that may or may not arrive with its lookups attached.
 *
 * The relations are OPTIONAL so a bare Prisma row still satisfies the type —
 * the write paths build audit records from rows they never joined, and those
 * have no business paying for a lookup. Read paths pass the joined row and the
 * *_name fields come back filled.
 */
export type BranchRow = PromotionSchemeBranch & {
  branch?: { brName: string; brCode: string | null; brShort: string | null } | null;
};
export type PartyRow = PromotionSchemeParty & {
  customer?: { cusName: string | null; cusCode: string | null } | null;
  customerGroup?: { cgrName: string; cgrShort: string | null } | null;
  area?: { armName: string; armShort: string | null } | null;
  city?: { ctmName: string; ctmShort: string | null } | null;
};
export type ItemRow = PromotionSchemeItem & {
  item?: { itemNameEn: string } | null;
  itemGroup?: { itgName: string } | null;
  itemCategory?: { categoryName: string } | null;
  itemBrand?: { brand_name: string } | null;
  itemSection?: { secName: string } | null;
  unit?: UnitLookup;
};
export type SlabRow = PromotionSchemeSlab & {
  freeItem?: { itemNameEn: string } | null;
  freeUnit?: UnitLookup;
};
export type SchemeRow = PromotionScheme & {
  company?: { compName: string } | null;
  branch?: { brName: string } | null;
};
export type SchemeWithChildren = SchemeRow & {
  branches: BranchRow[];
  parties: PartyRow[];
  items: ItemRow[];
  slabs: SlabRow[];
};
/** First non-null of the lookups, or null when none of them was joined. */
function firstName(...candidates: Array<string | null | undefined>): string | null {
  return candidates.find((value) => value !== null && value !== undefined) ?? null;
}
// ─── Internal throw helpers ───────────────────────────────────────────────────
export function throwBadRequest(message: string, errors: PromotionSchemeErrorDetail[]): never {
  throwSalesBadRequest<PromotionSchemeErrorDetail, PromotionSchemeErrorResponse>(message, errors);
}
export function throwConflict(message: string, errors: PromotionSchemeErrorDetail[]): never {
  throwSalesConflict<PromotionSchemeErrorDetail, PromotionSchemeErrorResponse>(message, errors);
}
export function fieldError(field: string, message: string): never {
  throwBadRequest('Validation failed', [{ field, message }]);
}
// ─── Format helpers ───────────────────────────────────────────────────────────
export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
export function toIsoTime(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  const hours = String(value.getUTCHours()).padStart(2, '0');
  const minutes = String(value.getUTCMinutes()).padStart(2, '0');
  const seconds = String(value.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
export function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
export function resolveActor(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}
export function resolveActorUuid(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && UUID_PATTERN.test(candidate)) {
      return candidate;
    }
  }
  return null;
}
// ─── Validation primitives ────────────────────────────────────────────────────
export function requireString(value: string | undefined | null, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    fieldError(field, `${field} is required`);
  }
  return value.trim();
}
export function requireUuid(value: string | undefined | null, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    fieldError(field, `${field} must be a valid uuid`);
  }
  return value;
}
/**
 * Trim and upper-case a vocabulary value without judging it. The verdict is the
 * invariants layer's job, so that one bad payload reports every problem at once
 * instead of dying on the first field.
 */
export function normalizeEnum(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}
export function requireNumber(
  value: number | undefined | null,
  field: string,
  minValue: number,
  maxValue?: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minValue) {
    fieldError(field, `${field} must be a number greater than or equal to ${minValue}`);
  }
  if (maxValue !== undefined && value > maxValue) {
    fieldError(field, `${field} must be less than or equal to ${maxValue}`);
  }
  return value;
}
export function requireInteger(
  value: number | undefined | null,
  field: string,
  minValue: number,
  maxValue?: number,
): number {
  if (!Number.isInteger(value)) {
    fieldError(field, `${field} must be an integer`);
  }
  return requireNumber(value as number, field, minValue, maxValue);
}
export function parseDateOnly(value: string | undefined | null, field: string): Date {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    fieldError(field, `${field} is required`);
  }
  const parsed = new Date(`${trimmed.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    fieldError(field, `${field} must be a valid date (YYYY-MM-DD)`);
  }
  return parsed;
}
export function parseTimeToUtcDate(value: string, field: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) {
    fieldError(field, `${field} must be a valid time (HH:mm or HH:mm:ss)`);
  }
  const [, hours, minutes, seconds] = match;
  return new Date(Date.UTC(1970, 0, 1, Number(hours), Number(minutes), Number(seconds ?? 0)));
}
// ─── Row mappers ──────────────────────────────────────────────────────────────
export function toBranchPayload(row: BranchRow): PromotionSchemeBranchPayload {
  return {
    prb_id: row.prbId,
    prb_prm_id: row.prbPrmId,
    prb_slno: row.prbSlno,
    prb_branch_id: row.prbBranchId,
    prb_branch_name: row.branch?.brName ?? null,
    prb_branch_code: firstName(row.branch?.brCode, row.branch?.brShort),
    prb_is_exclude: row.prbIsExclude,
    prb_notes: row.prbNotes,
    prb_is_active: row.prbIsActive,
    prb_is_deleted: row.prbIsDeleted,
    prb_sync_date: row.prbSyncDate?.toISOString() ?? null,
    prb_created_on: row.prbCreatedOn.toISOString(),
    prb_created_by: row.prbCreatedBy,
    prb_modified_on: row.prbModifiedOn?.toISOString() ?? null,
    prb_modified_by: row.prbModifiedBy,
  };
}
export function toPartyPayload(row: PartyRow): PromotionSchemePartyPayload {
  return {
    prp_id: row.prpId,
    prp_prm_id: row.prpPrmId,
    prp_slno: row.prpSlno,
    prp_kind: row.prpKind,
    prp_scope_id: row.prpScopeId,
    prp_cust_id: row.prpCustId,
    prp_cust_group_id: row.prpCustGroupId,
    prp_area_id: row.prpAreaId,
    prp_city_id: row.prpCityId,
    // COALESCE over the four masters — only the one matching prp_kind is joined.
    prp_scope_name: firstName(
      row.customer?.cusName,
      row.customerGroup?.cgrName,
      row.area?.armName,
      row.city?.ctmName,
    ),
    // Note the master columns are not uniform: cus_code, then the three shorts.
    prp_scope_code: firstName(
      row.customer?.cusCode,
      row.customerGroup?.cgrShort,
      row.area?.armShort,
      row.city?.ctmShort,
    ),
    prp_is_exclude: row.prpIsExclude,
    prp_match_priority: row.prpMatchPriority,
    prp_notes: row.prpNotes,
    prp_is_active: row.prpIsActive,
    prp_is_deleted: row.prpIsDeleted,
    prp_sync_date: row.prpSyncDate?.toISOString() ?? null,
    prp_created_on: row.prpCreatedOn.toISOString(),
    prp_created_by: row.prpCreatedBy,
    prp_modified_on: row.prpModifiedOn?.toISOString() ?? null,
    prp_modified_by: row.prpModifiedBy,
  };
}
export function toItemPayload(row: ItemRow): PromotionSchemeItemPayload {
  return {
    pri_id: row.priId,
    pri_prm_id: row.priPrmId,
    pri_slno: row.priSlno,
    pri_kind: row.priKind,
    pri_scope_id: row.priScopeId,
    pri_item_id: row.priItemId,
    pri_group_id: row.priGroupId,
    pri_category_id: row.priCategoryId,
    pri_brand_id: row.priBrandId,
    pri_section_id: row.priSectionId,
    pri_unit_id: row.priUnitId,
    pri_scope_name: firstName(
      row.item?.itemNameEn,
      row.itemGroup?.itgName,
      row.itemCategory?.categoryName,
      row.itemBrand?.brand_name,
      row.itemSection?.secName,
    ),
    pri_unit_name: row.unit?.unit.unit_name ?? null,
    pri_is_exclude: row.priIsExclude,
    pri_disc_perc: toNumber(row.priDiscPerc),
    pri_disc_qty: toNumber(row.priDiscQty),
    pri_disc_amt: toNumber(row.priDiscAmt),
    pri_min_qty: toNumber(row.priMinQty),
    pri_factor: toNumber(row.priFactor),
    pri_max_benefit: toNumber(row.priMaxBenefit),
    pri_match_priority: row.priMatchPriority,
    pri_notes: row.priNotes,
    pri_is_active: row.priIsActive,
    pri_is_deleted: row.priIsDeleted,
    pri_sync_date: row.priSyncDate?.toISOString() ?? null,
    pri_created_on: row.priCreatedOn.toISOString(),
    pri_created_by: row.priCreatedBy,
    pri_modified_on: row.priModifiedOn?.toISOString() ?? null,
    pri_modified_by: row.priModifiedBy,
  };
}
export function toSlabPayload(row: SlabRow): PromotionSchemeSlabPayload {
  return {
    prs_id: row.prsId,
    prs_prm_id: row.prsPrmId,
    prs_slno: row.prsSlno,
    prs_benefit: row.prsBenefit,
    prs_exceeds: toNumber(row.prsExceeds),
    prs_upto: toNullableNumber(row.prsUpto),
    prs_each: toNumber(row.prsEach),
    prs_is_repeat: row.prsIsRepeat,
    prs_max_repeats: row.prsMaxRepeats,
    prs_free_item_id: row.prsFreeItemId,
    prs_free_unit_id: row.prsFreeUnitId,
    prs_free_item_name: row.freeItem?.itemNameEn ?? null,
    prs_free_unit_name: row.freeUnit?.unit.unit_name ?? null,
    prs_free_qty: toNumber(row.prsFreeQty),
    prs_free_stock_check: row.prsFreeStockCheck,
    prs_disc_perc: toNumber(row.prsDiscPerc),
    prs_disc_qty: toNumber(row.prsDiscQty),
    prs_disc_amt: toNumber(row.prsDiscAmt),
    prs_fixed_price: toNullableNumber(row.prsFixedPrice),
    prs_max_benefit_amt: toNumber(row.prsMaxBenefitAmt),
    prs_notes: row.prsNotes,
    prs_is_active: row.prsIsActive,
    prs_is_deleted: row.prsIsDeleted,
    prs_sync_date: row.prsSyncDate?.toISOString() ?? null,
    prs_created_on: row.prsCreatedOn.toISOString(),
    prs_created_by: row.prsCreatedBy,
    prs_modified_on: row.prsModifiedOn?.toISOString() ?? null,
    prs_modified_by: row.prsModifiedBy,
  };
}
export function toSchemeSummaryPayload(scheme: SchemeRow): PromotionSchemeSummaryPayload {
  return {
    prm_id: scheme.prmId,
    prm_comp_id: scheme.prmCompId,
    prm_branch_id: scheme.prmBranchId,
    // Display only — joined from company and branch_master, never written back.
    prm_comp_name: scheme.company?.compName ?? null,
    prm_branch_name: scheme.branch?.brName ?? null,
    prm_tenant_id: scheme.prmTenantId,
    prm_code: scheme.prmCode,
    prm_name: scheme.prmName,
    prm_status: scheme.prmStatus,
    prm_apply_on: scheme.prmApplyOn,
    prm_benefit: scheme.prmBenefit,
    prm_priority: scheme.prmPriority,
    prm_stack_mode: scheme.prmStackMode,
    prm_auto_apply: scheme.prmAutoApply,
    prm_allow_with_manual_disc: scheme.prmAllowWithManualDisc,
    prm_calc_on_amount_type: scheme.prmCalcOnAmountType,
    prm_include_tax: scheme.prmIncludeTax,
    prm_bill_type: scheme.prmBillType,
    prm_min_bill_amount: toNumber(scheme.prmMinBillAmount),
    prm_min_qty: toNumber(scheme.prmMinQty),
    prm_branch_scope: scheme.prmBranchScope,
    prm_cust_scope: scheme.prmCustScope,
    prm_item_scope: scheme.prmItemScope,
    prm_price_level_id: scheme.prmPriceLevelId,
    prm_max_benefit_per_bill: toNumber(scheme.prmMaxBenefitPerBill),
    prm_max_uses_total: scheme.prmMaxUsesTotal,
    prm_max_uses_per_cust: scheme.prmMaxUsesPerCust,
    prm_budget_amount: toNumber(scheme.prmBudgetAmount),
    prm_coupon_batch_id: scheme.prmCouponBatchId,
    prm_start_date: toIsoDate(scheme.prmStartDate),
    prm_end_date: toIsoDate(scheme.prmEndDate),
    prm_valid_from_time: toIsoTime(scheme.prmValidFromTime),
    prm_valid_to_time: toIsoTime(scheme.prmValidToTime),
    prm_valid_weekdays: scheme.prmValidWeekdays,
    prm_remarks: scheme.prmRemarks,
    prm_is_active: scheme.prmIsActive,
    prm_is_deleted: scheme.prmIsDeleted,
    prm_sync_date: scheme.prmSyncDate?.toISOString() ?? null,
    prm_created_on: scheme.prmCreatedOn.toISOString(),
    prm_created_by: scheme.prmCreatedBy,
    prm_modified_on: scheme.prmModifiedOn?.toISOString() ?? null,
    prm_modified_by: scheme.prmModifiedBy,
    prm_approved_on: scheme.prmApprovedOn?.toISOString() ?? null,
    prm_approved_by: scheme.prmApprovedBy,
  };
}
export function toSchemePayload(scheme: SchemeWithChildren): PromotionSchemePayload {
  return {
    ...toSchemeSummaryPayload(scheme),
    branches: scheme.branches.map(toBranchPayload),
    parties: scheme.parties.map(toPartyPayload),
    items: scheme.items.map(toItemPayload),
    slabs: scheme.slabs.map(toSlabPayload),
  };
}
// ─── Error mapping ────────────────────────────────────────────────────────────
function resolveForeignKeyField(error: Prisma.PrismaClientKnownRequestError): string {
  const meta =
    typeof error.meta?.field_name === 'string'
      ? error.meta.field_name
      : typeof error.meta?.target === 'string'
        ? error.meta.target
        : '';
  const normalized = meta.toLowerCase();
  if (normalized.includes('prm_company')) return 'prm_comp_id';
  if (normalized.includes('prm_branch')) return 'prm_branch_id';
  if (normalized.includes('prm_price_level')) return 'prm_price_level_id';
  if (normalized.includes('prm_coupon_batch')) return 'prm_coupon_batch_id';
  if (normalized.includes('prm_approved_by')) return 'prm_approved_by';
  if (normalized.includes('prb_branch')) return 'prb_branch_id';
  if (normalized.includes('prp_')) return 'prp_scope_id';
  if (normalized.includes('pri_unit')) return 'pri_unit_id';
  if (normalized.includes('pri_')) return 'pri_scope_id';
  if (normalized.includes('prs_free_item')) return 'prs_free_item_id';
  if (normalized.includes('prs_free_unit')) return 'prs_free_unit_id';
  if (normalized.includes('prs_scheme_benefit')) return 'prs_benefit';
  return 'request';
}
/**
 * Turns the three write failures this module can provoke into answers a screen
 * can show, instead of a 500.
 *
 * The exclusion branch is the interesting one: ex_prm_exclusive_clash is a GiST
 * EXCLUDE, which Prisma surfaces with no error code at all — see
 * isExclusionConstraintError. It fires when a second APPROVED, EXCLUSIVE scheme
 * would sit on the same company/branch/trigger at the same priority over
 * overlapping dates, which is exactly the tie the engine cannot break.
 */
export function handlePromotionWriteError(error: unknown): void {
  if (isExclusionConstraintError(error)) {
    throwConflict('Conflicting promotion scheme', [
      {
        field: 'prm_priority',
        message:
          'Another approved exclusive scheme already runs on this branch and trigger at this ' +
          'priority over an overlapping date range. Change the priority, the dates, or use ' +
          'STACKABLE.',
      },
    ]);
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return;
  }
  if (error.code === 'P2002') {
    throwConflict('Duplicate promotion data is not allowed', [
      {
        field: 'request',
        message: 'A record with the same unique values already exists',
      },
    ]);
    return;
  }
  if (error.code === 'P2003') {
    throwBadRequest('Validation failed', [
      {
        field: resolveForeignKeyField(error),
        message: 'Referenced master record was not found or is inactive',
      },
    ]);
  }
}