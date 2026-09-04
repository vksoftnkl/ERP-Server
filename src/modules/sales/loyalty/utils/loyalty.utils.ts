import {
  LoyaltyScheme,
  LoyaltySchemeBranch,
  LoyaltySchemeGift,
  LoyaltySchemeItem,
  LoyaltySchemeParty,
  LoyaltySchemeSlab,
  Prisma,
} from '@prisma/client';
import {
  throwSalesBadRequest,
  throwSalesConflict,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import {
  LoyaltySchemeBranchPayload,
  LoyaltySchemeGiftPayload,
  LoyaltySchemeItemPayload,
  LoyaltySchemePartyPayload,
  LoyaltySchemePayload,
  LoyaltySchemeSlabPayload,
  LoyaltySchemeSummaryPayload,
  PromotionLoyaltyPointsErrorDetail,
  PromotionLoyaltyPointsErrorResponse,
} from '../types/promotion-loyalty-points-api.types';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── The vocabularies ─────────────────────────────────────────────────────────
// These ARE CHECK constraints on sales.loyalty_scheme and its five children —
// unlike promotion_scheme, whose migration carries none. They are repeated here
// so a bad payload comes back as a field-addressed 400 the screen can place on
// an input, instead of a Postgres constraint-violation string. Keep them in step
// with 20260831060000_replace_loyalty_scheme_tables.
export const LSC_TYPES = ['EARN', 'REDEEM', 'BOTH'] as const;
export const LSC_STATUSES = ['DRAFT', 'APPROVED', 'SUSPENDED', 'CLOSED'] as const;
export const LSC_APPLY_ON = ['BILL_AMOUNT', 'BILL_QTY', 'ITEM_AMOUNT', 'ITEM_QTY'] as const;
export const LSC_CALC_ON = ['GROSS_AMOUNT', 'NET_AMOUNT', 'TAXABLE_AMOUNT'] as const;
export const LSC_BILL_TYPES = ['ALL', 'CASH', 'CREDIT'] as const;
export const LSC_ROUNDING = ['FLOOR', 'ROUND', 'CEIL', 'NONE'] as const;
export const LSC_SCOPES = ['ALL', 'LIST'] as const;
export const LSC_POOL_MODES = ['COMPANY', 'BRANCH'] as const;
export const LSC_RETURN_MODES = ['REVERSE', 'IGNORE'] as const;
export const LSC_EXPIRY_BASES = [
  'NONE',
  'EARN_DATE',
  'MONTH_END',
  'YEAR_END',
  'SCHEME_END_DATE',
] as const;
/** No AREA or CITY: a wallet follows the person, not the route. */
export const LSP_KINDS = ['CUSTOMER', 'CUSTOMER_GROUP'] as const;
export const LSI_KINDS = [
  'ITEM',
  'ITEM_GROUP',
  'ITEM_CATEGORY',
  'ITEM_BRAND',
  'ITEM_SECTION',
] as const;

export const LSC_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
export const LSC_WEEKDAYS_PATTERN =
  /^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$/;

/** Narrowest first — the seed the engine reads when two rules both match. */
export const LSP_DEFAULT_MATCH_PRIORITY: Record<string, number> = {
  CUSTOMER: 2,
  CUSTOMER_GROUP: 1,
};
export const LSI_DEFAULT_MATCH_PRIORITY: Record<string, number> = {
  ITEM: 4,
  ITEM_BRAND: 3,
  ITEM_CATEGORY: 2,
  ITEM_SECTION: 1,
  ITEM_GROUP: 0,
};

// ─── Display lookups ──────────────────────────────────────────────────────────
//
// Every scope row stores an id and a kind; the NAME behind that id lives in one
// of seven masters. The grid needs the name, so the read paths pull it through
// the relations Prisma declares on the generated columns — one JOIN per kind, no
// CASE.
//
// These are `select`s rather than `include`s on purpose: a scope row must not
// drag a whole item or customer record into a grid response.

/** The two masters the HEADER points at. Display only, never written back. */
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
} as const;

export const ITEM_LOOKUP = {
  item: { select: { itemNameEn: true } },
  itemGroup: { select: { itgName: true } },
  itemCategory: { select: { categoryName: true } },
  itemBrand: { select: { brand_name: true } },
  itemSection: { select: { secName: true } },
} as const;

// item_unit_conversion carries no name of its own — only a pointer at
// item_unit_master — so the unit needs the second hop.
export const SLAB_LOOKUP = {
  item: { select: { itemNameEn: true } },
  unit: { select: { unit: { select: { unit_name: true } } } },
} as const;

export const GIFT_LOOKUP = {
  item: { select: { itemNameEn: true } },
  unit: { select: { unit: { select: { unit_name: true } } } },
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
export type BranchRow = LoyaltySchemeBranch & {
  branch?: { brName: string; brCode: string | null; brShort: string | null } | null;
};
export type PartyRow = LoyaltySchemeParty & {
  customer?: { cusName: string | null; cusCode: string | null } | null;
  customerGroup?: { cgrName: string; cgrShort: string | null } | null;
};
export type ItemRow = LoyaltySchemeItem & {
  item?: { itemNameEn: string } | null;
  itemGroup?: { itgName: string } | null;
  itemCategory?: { categoryName: string } | null;
  itemBrand?: { brand_name: string } | null;
  itemSection?: { secName: string } | null;
};
export type SlabRow = LoyaltySchemeSlab & {
  item?: { itemNameEn: string } | null;
  unit?: UnitLookup;
};
export type GiftRow = LoyaltySchemeGift & {
  item?: { itemNameEn: string } | null;
  unit?: UnitLookup;
};
export type SchemeRow = LoyaltyScheme & {
  company?: { compName: string } | null;
  branch?: { brName: string } | null;
};
export type SchemeWithChildren = SchemeRow & {
  branches: BranchRow[];
  parties: PartyRow[];
  items: ItemRow[];
  slabs: SlabRow[];
  gifts: GiftRow[];
};

/** First non-null of the lookups, or null when none of them was joined. */
function firstName(...candidates: Array<string | null | undefined>): string | null {
  return candidates.find((value) => value !== null && value !== undefined) ?? null;
}

// ─── Internal throw helpers ───────────────────────────────────────────────────

export function throwBadRequest(
  message: string,
  errors: PromotionLoyaltyPointsErrorDetail[],
): never {
  throwSalesBadRequest<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
    message,
    errors,
  );
}

export function throwConflict(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never {
  throwSalesConflict<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
    message,
    errors,
  );
}

export function fieldError(field: string, message: string): never {
  throwBadRequest('Validation failed', [{ field, message }]);
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toNullableIsoDate(value: Date | null): string | null {
  return value ? toIsoDate(value) : null;
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

export function parseNullableDateOnly(
  value: string | null | undefined,
  field: string,
): Date | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? parseDateOnly(trimmed, field) : null;
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

export function toBranchPayload(row: BranchRow): LoyaltySchemeBranchPayload {
  return {
    lsb_id: row.lsbId,
    lsb_lsc_id: row.lsbLscId,
    lsb_slno: row.lsbSlno,
    lsb_branch_id: row.lsbBranchId,
    lsb_branch_name: row.branch?.brName ?? null,
    lsb_branch_code: firstName(row.branch?.brCode, row.branch?.brShort),
    lsb_is_exclude: row.lsbIsExclude,
    lsb_notes: row.lsbNotes,
    lsb_is_active: row.lsbIsActive,
    lsb_is_deleted: row.lsbIsDeleted,
    lsb_sync_date: row.lsbSyncDate?.toISOString() ?? null,
    lsb_created_on: row.lsbCreatedOn.toISOString(),
    lsb_created_by: row.lsbCreatedBy,
    lsb_modified_on: row.lsbModifiedOn?.toISOString() ?? null,
    lsb_modified_by: row.lsbModifiedBy,
  };
}

export function toPartyPayload(row: PartyRow): LoyaltySchemePartyPayload {
  return {
    lsp_id: row.lspId,
    lsp_lsc_id: row.lspLscId,
    lsp_slno: row.lspSlno,
    lsp_kind: row.lspKind,
    lsp_scope_id: row.lspScopeId,
    lsp_cust_id: row.lspCustId,
    lsp_cust_group_id: row.lspCustGroupId,
    // COALESCE over the two masters — only the one matching lsp_kind is joined.
    lsp_scope_name: firstName(row.customer?.cusName, row.customerGroup?.cgrName),
    lsp_scope_code: firstName(row.customer?.cusCode, row.customerGroup?.cgrShort),
    lsp_is_exclude: row.lspIsExclude,
    lsp_match_priority: row.lspMatchPriority,
    lsp_notes: row.lspNotes,
    lsp_is_active: row.lspIsActive,
    lsp_is_deleted: row.lspIsDeleted,
    lsp_sync_date: row.lspSyncDate?.toISOString() ?? null,
    lsp_created_on: row.lspCreatedOn.toISOString(),
    lsp_created_by: row.lspCreatedBy,
    lsp_modified_on: row.lspModifiedOn?.toISOString() ?? null,
    lsp_modified_by: row.lspModifiedBy,
  };
}

export function toItemPayload(row: ItemRow): LoyaltySchemeItemPayload {
  return {
    lsi_id: row.lsiId,
    lsi_lsc_id: row.lsiLscId,
    lsi_slno: row.lsiSlno,
    lsi_kind: row.lsiKind,
    lsi_scope_id: row.lsiScopeId,
    lsi_item_id: row.lsiItemId,
    lsi_group_id: row.lsiGroupId,
    lsi_category_id: row.lsiCategoryId,
    lsi_brand_id: row.lsiBrandId,
    lsi_section_id: row.lsiSectionId,
    lsi_scope_name: firstName(
      row.item?.itemNameEn,
      row.itemGroup?.itgName,
      row.itemCategory?.categoryName,
      row.itemBrand?.brand_name,
      row.itemSection?.secName,
    ),
    lsi_is_exclude: row.lsiIsExclude,
    lsi_factor: toNumber(row.lsiFactor),
    lsi_points: toNumber(row.lsiPoints),
    lsi_max_points: toNumber(row.lsiMaxPoints),
    lsi_match_priority: row.lsiMatchPriority,
    lsi_notes: row.lsiNotes,
    lsi_is_active: row.lsiIsActive,
    lsi_is_deleted: row.lsiIsDeleted,
    lsi_sync_date: row.lsiSyncDate?.toISOString() ?? null,
    lsi_created_on: row.lsiCreatedOn.toISOString(),
    lsi_created_by: row.lsiCreatedBy,
    lsi_modified_on: row.lsiModifiedOn?.toISOString() ?? null,
    lsi_modified_by: row.lsiModifiedBy,
  };
}

export function toSlabPayload(row: SlabRow): LoyaltySchemeSlabPayload {
  return {
    lss_id: row.lssId,
    lss_lsc_id: row.lssLscId,
    lss_slno: row.lssSlno,
    lss_item_id: row.lssItemId,
    lss_unit_id: row.lssUnitId,
    lss_item_name: row.item?.itemNameEn ?? null,
    lss_unit_name: row.unit?.unit.unit_name ?? null,
    lss_exceeds: toNumber(row.lssExceeds),
    lss_upto: toNullableNumber(row.lssUpto),
    lss_each: toNumber(row.lssEach),
    lss_points: toNumber(row.lssPoints),
    lss_factor: toNumber(row.lssFactor),
    lss_max_points: toNumber(row.lssMaxPoints),
    lss_notes: row.lssNotes,
    lss_is_active: row.lssIsActive,
    lss_is_deleted: row.lssIsDeleted,
    lss_sync_date: row.lssSyncDate?.toISOString() ?? null,
    lss_created_on: row.lssCreatedOn.toISOString(),
    lss_created_by: row.lssCreatedBy,
    lss_modified_on: row.lssModifiedOn?.toISOString() ?? null,
    lss_modified_by: row.lssModifiedBy,
  };
}

export function toGiftPayload(row: GiftRow): LoyaltySchemeGiftPayload {
  return {
    lsg_id: row.lsgId,
    lsg_lsc_id: row.lsgLscId,
    lsg_slno: row.lsgSlno,
    lsg_item_id: row.lsgItemId,
    lsg_unit_id: row.lsgUnitId,
    lsg_item_name: row.item?.itemNameEn ?? null,
    lsg_unit_name: row.unit?.unit.unit_name ?? null,
    lsg_item_qty: toNumber(row.lsgItemQty),
    lsg_redeem_points: toNumber(row.lsgRedeemPoints),
    lsg_repeat: row.lsgRepeat,
    lsg_max_qty_per_bill: toNumber(row.lsgMaxQtyPerBill),
    lsg_stock_check: row.lsgStockCheck,
    lsg_valid_from: toNullableIsoDate(row.lsgValidFrom),
    lsg_valid_upto: toNullableIsoDate(row.lsgValidUpto),
    lsg_notes: row.lsgNotes,
    lsg_is_active: row.lsgIsActive,
    lsg_is_deleted: row.lsgIsDeleted,
    lsg_sync_date: row.lsgSyncDate?.toISOString() ?? null,
    lsg_created_on: row.lsgCreatedOn.toISOString(),
    lsg_created_by: row.lsgCreatedBy,
    lsg_modified_on: row.lsgModifiedOn?.toISOString() ?? null,
    lsg_modified_by: row.lsgModifiedBy,
  };
}

export function toSchemeSummaryPayload(scheme: SchemeRow): LoyaltySchemeSummaryPayload {
  return {
    lsc_id: scheme.lscId,
    lsc_comp_id: scheme.lscCompId,
    lsc_branch_id: scheme.lscBranchId,
    // Display only — joined from company and branch_master, never written back.
    lsc_comp_name: scheme.company?.compName ?? null,
    lsc_branch_name: scheme.branch?.brName ?? null,
    lsc_tenant_id: scheme.lscTenantId,
    lsc_code: scheme.lscCode,
    lsc_name: scheme.lscName,
    lsc_type: scheme.lscType,
    lsc_status: scheme.lscStatus,
    lsc_priority: scheme.lscPriority,
    lsc_auto_apply: scheme.lscAutoApply,
    lsc_apply_on: scheme.lscApplyOn,
    lsc_calc_on_amount_type: scheme.lscCalcOnAmountType,
    lsc_include_tax: scheme.lscIncludeTax,
    lsc_bill_type: scheme.lscBillType,
    lsc_min_bill_amount: toNumber(scheme.lscMinBillAmount),
    lsc_max_earn_points: toNumber(scheme.lscMaxEarnPoints),
    lsc_earn_on_discounted: scheme.lscEarnOnDiscounted,
    lsc_earn_on_charges: scheme.lscEarnOnCharges,
    lsc_earn_with_redeem: scheme.lscEarnWithRedeem,
    lsc_rounding_method: scheme.lscRoundingMethod,
    lsc_points_decimals: scheme.lscPointsDecimals,
    lsc_branch_scope: scheme.lscBranchScope,
    lsc_cust_scope: scheme.lscCustScope,
    lsc_item_scope: scheme.lscItemScope,
    lsc_price_level_id: scheme.lscPriceLevelId,
    lsc_pool_mode: scheme.lscPoolMode,
    lsc_allow_cross_branch_redeem: scheme.lscAllowCrossBranchRedeem,
    lsc_allow_point_redeem: scheme.lscAllowPointRedeem,
    lsc_allow_gift_redeem: scheme.lscAllowGiftRedeem,
    lsc_redeem_tender_id: scheme.lscRedeemTenderId,
    lsc_redeem_value_per_point: toNumber(scheme.lscRedeemValuePerPoint),
    lsc_min_redeem_points: toNumber(scheme.lscMinRedeemPoints),
    lsc_max_redeem_points: toNumber(scheme.lscMaxRedeemPoints),
    lsc_max_redeem_perc: toNumber(scheme.lscMaxRedeemPerc),
    lsc_redeem_min_bill_amount: toNumber(scheme.lscRedeemMinBillAmount),
    lsc_redeem_multiple: toNumber(scheme.lscRedeemMultiple),
    lsc_expiry_basis: scheme.lscExpiryBasis,
    lsc_points_valid_days: scheme.lscPointsValidDays,
    lsc_activation_days: scheme.lscActivationDays,
    lsc_return_mode: scheme.lscReturnMode,
    lsc_start_date: toIsoDate(scheme.lscStartDate),
    lsc_end_date: toIsoDate(scheme.lscEndDate),
    lsc_valid_from_time: toIsoTime(scheme.lscValidFromTime),
    lsc_valid_to_time: toIsoTime(scheme.lscValidToTime),
    lsc_valid_weekdays: scheme.lscValidWeekdays,
    lsc_remarks: scheme.lscRemarks,
    lsc_is_active: scheme.lscIsActive,
    lsc_is_deleted: scheme.lscIsDeleted,
    lsc_sync_date: scheme.lscSyncDate?.toISOString() ?? null,
    lsc_created_on: scheme.lscCreatedOn.toISOString(),
    lsc_created_by: scheme.lscCreatedBy,
    lsc_modified_on: scheme.lscModifiedOn?.toISOString() ?? null,
    lsc_modified_by: scheme.lscModifiedBy,
    lsc_approved_on: scheme.lscApprovedOn?.toISOString() ?? null,
    lsc_approved_by: scheme.lscApprovedBy,
  };
}

export function toSchemePayload(scheme: SchemeWithChildren): LoyaltySchemePayload {
  return {
    ...toSchemeSummaryPayload(scheme),
    branches: scheme.branches.map(toBranchPayload),
    parties: scheme.parties.map(toPartyPayload),
    items: scheme.items.map(toItemPayload),
    slabs: scheme.slabs.map(toSlabPayload),
    gifts: scheme.gifts.map(toGiftPayload),
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
  if (normalized.includes('lsc_company')) return 'lsc_comp_id';
  if (normalized.includes('lsc_branch')) return 'lsc_branch_id';
  if (normalized.includes('lsc_price_level')) return 'lsc_price_level_id';
  if (normalized.includes('lsc_redeem_tender')) return 'lsc_redeem_tender_id';
  if (normalized.includes('lsc_approved_by')) return 'lsc_approved_by';
  if (normalized.includes('lsb_branch')) return 'lsb_branch_id';
  if (normalized.includes('lsp_')) return 'lsp_scope_id';
  if (normalized.includes('lsi_')) return 'lsi_scope_id';
  if (normalized.includes('lss_item')) return 'lss_item_id';
  if (normalized.includes('lss_unit')) return 'lss_unit_id';
  if (normalized.includes('lsg_item')) return 'lsg_item_id';
  if (normalized.includes('lsg_unit')) return 'lsg_unit_id';
  return 'request';
}

/**
 * The write failures this module can provoke, turned into answers a screen can
 * show instead of a 500.
 *
 * A CHECK violation (23514) is the one worth naming: the loyalty tables DO carry
 * their constraints, unlike promotion_scheme, so a payload that slipped past
 * loyalty-scheme-invariants.ts still fails at the table — and the constraint
 * name is the most specific thing we can hand back.
 */
export function handleLoyaltyWriteError(error: unknown): void {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return;
  }
  if (error.code === 'P2002') {
    throwConflict('Duplicate loyalty data is not allowed', [
      { field: 'request', message: 'A record with the same unique values already exists' },
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
    return;
  }
  // P2010 / raw: a CHECK the invariants layer failed to catch first.
  const constraint = typeof error.meta?.constraint === 'string' ? error.meta.constraint : undefined;
  if (constraint?.startsWith('ck_ls')) {
    throwBadRequest('Validation failed', [
      { field: 'request', message: `Database constraint ${constraint} rejected this row` },
    ]);
  }
}
