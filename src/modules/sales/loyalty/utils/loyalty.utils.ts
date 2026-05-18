import {
  LoyaltyScheme,
  LoyaltySchemeGift,
  LoyaltySchemeParty,
  LoyaltySchemePoint,
  Prisma,
} from '@prisma/client';
import { SaveLoyaltyGiftDto } from '../dto/save-loyalty-gift.dto';
import { SaveLoyaltyPointDto } from '../dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from '../dto/save-loyalty-scheme.dto';
import {
  LoyaltyGiftPayload,
  LoyaltyPartyPayload,
  LoyaltyPointPayload,
  LoyaltySchemePayload,
  LoyaltySchemeSummaryPayload,
  PromotionLoyaltyPointsErrorDetail,
  PromotionLoyaltyPointsErrorResponse,
} from '../types/promotion-loyalty-points-api.types';
import {
  hasOwnProperty,
  throwSalesBadRequest,
  throwSalesConflict,
  toNumber,
} from 'src/common/utils/module-service.utils';
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type SchemeWithChildren = LoyaltyScheme & {
  parties: LoyaltySchemeParty[];
  points: LoyaltySchemePoint[];
  gifts: LoyaltySchemeGift[];
};
// ─── Internal throw helpers ───────────────────────────────────────────────────
function throwBadRequest(
  message: string,
  errors: PromotionLoyaltyPointsErrorDetail[],
): never {
  throwSalesBadRequest<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
    message,
    errors,
  );
}
function throwConflict(
  message: string,
  errors: PromotionLoyaltyPointsErrorDetail[],
): never {
  throwSalesConflict<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
    message,
    errors,
  );
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
  const milliseconds = value.getUTCMilliseconds();
  if (milliseconds === 0) {
    return `${hours}:${minutes}:${seconds}`;
  }
  const fraction = String(milliseconds).padStart(3, '0').replace(/0+$/, '');
  return `${hours}:${minutes}:${seconds}.${fraction}`;
}
export function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
export function resolveActorUuid(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && UUID_PATTERN.test(candidate)) {
      return candidate;
    }
  }
  return null;
}
// ─── Validation helpers ───────────────────────────────────────────────────────
export function parseDateBoundary(
  value: string,
  field: string,
  boundary: 'start' | 'end',
): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throwBadRequest('Validation failed', [
      {
        field,
        message: `${field} must be a valid date`,
      },
    ]);
  }
  if (boundary === 'end') {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
}
export function parseTimeToUtcDate(value: string, field: string): Date {
  const trimmed = value.trim();
  if (!trimmed) {
    throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/.exec(trimmed);
  if (!match) {
    throwBadRequest('Validation failed', [
      {
        field,
        message: `${field} must be a valid time (HH:mm or HH:mm:ss)`,
      },
    ]);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  const millis = match[4] ? Number(match[4].padEnd(3, '0')) : 0;
  const date = new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds, millis));
  if (Number.isNaN(date.getTime())) {
    throwBadRequest('Validation failed', [
      {
        field,
        message: `${field} must be a valid time`,
      },
    ]);
  }
  return date;
}
export function requireString(value: string | undefined, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
  }
  return value.trim();
}
export function requireUuid(value: string | undefined, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
  }
  return value;
}
export function requireInteger(value: number | undefined, field: string): number {
  if (!Number.isInteger(value)) {
    throwBadRequest('Validation failed', [
      {
        field,
        message: `${field} must be an integer`,
      },
    ]);
  }
  return value as number;
}
export function requireNumber(
  value: number | undefined,
  field: string,
  minValue: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minValue) {
    throwBadRequest('Validation failed', [
      {
        field,
        message: `${field} must be greater than or equal to ${minValue}`,
      },
    ]);
  }
  return value;
}
export function requireDate(value: string | undefined, field: string): Date {
  if (!value) {
    throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
  }
  return parseDateBoundary(value, field, 'start');
}
export function requireDateTime(value: string | undefined, field: string): Date {
  if (!value) {
    throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throwBadRequest('Validation failed', [
      {
        field,
        message: `${field} must be a valid datetime`,
      },
    ]);
  }
  return parsed;
}
// ─── Date range helpers ───────────────────────────────────────────────────────
export function ensureDateRange(startDate: Date, endDate: Date): void {
  if (startDate.getTime() > endDate.getTime()) {
    throwBadRequest('Validation failed', [
      {
        field: 'ls_end_date',
        message: 'ls_end_date must be greater than or equal to ls_start_date',
      },
    ]);
  }
}
export function buildDateRangeFilter(
  fromValue: string | undefined,
  toValue: string | undefined,
  field: 'ls_start_date' | 'ls_end_date',
): Prisma.DateTimeFilter<'LoyaltyScheme'> | undefined {
  if (!fromValue && !toValue) {
    return undefined;
  }
  const filter: Prisma.DateTimeFilter<'LoyaltyScheme'> = {};
  if (fromValue) {
    filter.gte = parseDateBoundary(fromValue, field, 'start');
  }
  if (toValue) {
    filter.lte = parseDateBoundary(toValue, field, 'end');
  }
  return filter;
}
// ─── Apply optional fields ────────────────────────────────────────────────────

export function applyOptionalSchemeFields(
  data: Prisma.LoyaltySchemeUncheckedCreateInput | Prisma.LoyaltySchemeUncheckedUpdateInput,
  dto: SaveLoyaltySchemeDto,
  actorId: string | null,
): void {
  if (hasOwnProperty(dto, 'ls_status')) {
    data.lsStatus = requireString(dto.ls_status, 'ls_status');
  }
  if (hasOwnProperty(dto, 'ls_auto_apply')) {
    data.lsAutoApply = dto.ls_auto_apply ?? true;
  }
  if (hasOwnProperty(dto, 'ls_apply_on')) {
    data.lsApplyOn = requireString(dto.ls_apply_on, 'ls_apply_on');
  }
  if (hasOwnProperty(dto, 'ls_calc_on_amount_type')) {
    data.lsCalcOnAmountType = requireString(
      dto.ls_calc_on_amount_type,
      'ls_calc_on_amount_type',
    );
  }
  if (hasOwnProperty(dto, 'ls_bill_type')) {
    data.lsBillType = requireString(dto.ls_bill_type, 'ls_bill_type');
  }
  if (hasOwnProperty(dto, 'ls_cust_type')) {
    data.lsCustType = requireString(dto.ls_cust_type, 'ls_cust_type');
  }
  if (hasOwnProperty(dto, 'ls_item_type')) {
    data.lsItemType = requireString(dto.ls_item_type, 'ls_item_type');
  }
  if (hasOwnProperty(dto, 'ls_valid_from_time')) {
    const value = dto.ls_valid_from_time;
    data.lsValidFromTime = value ? parseTimeToUtcDate(value, 'ls_valid_from_time') : null;
  }
  if (hasOwnProperty(dto, 'ls_valid_to_time')) {
    const value = dto.ls_valid_to_time;
    data.lsValidToTime = value ? parseTimeToUtcDate(value, 'ls_valid_to_time') : null;
  }
  if (hasOwnProperty(dto, 'ls_valid_weekdays')) {
    data.lsValidWeekdays = dto.ls_valid_weekdays ?? null;
  }
  if (hasOwnProperty(dto, 'ls_branch_id')) {
    data.lsBranchId = dto.ls_branch_id ?? null;
  }
  if (hasOwnProperty(dto, 'ls_include_tax_for_points')) {
    data.lsIncludeTaxForPoints = dto.ls_include_tax_for_points ?? false;
  }
  if (hasOwnProperty(dto, 'ls_rounding_method')) {
    data.lsRoundingMethod = requireString(dto.ls_rounding_method, 'ls_rounding_method');
  }
  if (hasOwnProperty(dto, 'ls_recur_apl')) {
    data.lsRecurApl = dto.ls_recur_apl ?? false;
  }
  if (hasOwnProperty(dto, 'ls_bal_apl')) {
    data.lsBalApl = dto.ls_bal_apl ?? false;
  }
  if (hasOwnProperty(dto, 'ls_allow_point_redeem')) {
    data.lsAllowPointRedeem = dto.ls_allow_point_redeem ?? false;
  }
  if (hasOwnProperty(dto, 'ls_allow_gift_redeem')) {
    data.lsAllowGiftRedeem = dto.ls_allow_gift_redeem ?? false;
  }
  if (hasOwnProperty(dto, 'ls_redeem_value_per_point')) {
    data.lsRedeemValuePerPoint = requireNumber(
      dto.ls_redeem_value_per_point,
      'ls_redeem_value_per_point',
      0,
    );
  }
  if (hasOwnProperty(dto, 'ls_min_redeem_points')) {
    data.lsMinRedeemPoints = requireNumber(dto.ls_min_redeem_points, 'ls_min_redeem_points', 0);
  }
  if (hasOwnProperty(dto, 'ls_max_redeem_points_per_bill')) {
    data.lsMaxRedeemPointsPerBill = requireNumber(
      dto.ls_max_redeem_points_per_bill,
      'ls_max_redeem_points_per_bill',
      0,
    );
  }
  if (hasOwnProperty(dto, 'ls_max_redeem_percent_per_bill')) {
    data.lsMaxRedeemPercentPerBill = requireNumber(
      dto.ls_max_redeem_percent_per_bill,
      'ls_max_redeem_percent_per_bill',
      0,
    );
  }
  if (hasOwnProperty(dto, 'ls_redeem_min_bill_amount')) {
    data.lsRedeemMinBillAmount = requireNumber(
      dto.ls_redeem_min_bill_amount,
      'ls_redeem_min_bill_amount',
      0,
    );
  }
  if (hasOwnProperty(dto, 'ls_points_valid_days')) {
    data.lsPointsValidDays = requireInteger(dto.ls_points_valid_days, 'ls_points_valid_days');
  }
  if (hasOwnProperty(dto, 'ls_expiry_basis')) {
    data.lsExpiryBasis = requireString(dto.ls_expiry_basis, 'ls_expiry_basis');
  }
  if (hasOwnProperty(dto, 'ls_remarks')) {
    data.lsRemarks = dto.ls_remarks ?? null;
  }
  if (hasOwnProperty(dto, 'ls_is_active')) {
    data.lsIsActive = dto.ls_is_active ?? true;
  }
  if (hasOwnProperty(dto, 'ls_approved_on')) {
    const approvedOn = (dto as { ls_approved_on?: unknown }).ls_approved_on;
    if (approvedOn === null || approvedOn === undefined || approvedOn === '') {
      data.lsApprovedOn = null;
    } else {
      data.lsApprovedOn = requireDateTime(String(approvedOn), 'ls_approved_on');
    }
  }
  if (hasOwnProperty(dto, 'ls_approved_by')) {
    data.lsApprovedBy = resolveActorUuid(dto.ls_approved_by, actorId);
  }
}

export function applyOptionalPointFields(
  data:
    | Prisma.LoyaltySchemePointUncheckedCreateInput
    | Prisma.LoyaltySchemePointUncheckedUpdateInput,
  dto: SaveLoyaltyPointDto,
): void {
  if (hasOwnProperty(dto, 'lspt_item_id')) {
    data.lsptItemId = dto.lspt_item_id ?? null;
  }
  if (hasOwnProperty(dto, 'lspt_unit_id')) {
    data.lsptUnitId = dto.lspt_unit_id ?? null;
  }
  if (hasOwnProperty(dto, 'lspt_exceeds')) {
    data.lsptExceeds = requireNumber(dto.lspt_exceeds, 'lspt_exceeds', 0);
  }
  if (hasOwnProperty(dto, 'lspt_each')) {
    data.lsptEach = requireNumber(dto.lspt_each, 'lspt_each', Number.EPSILON);
  }
  if (hasOwnProperty(dto, 'lspt_notes')) {
    data.lsptNotes = dto.lspt_notes ?? null;
  }
  if (hasOwnProperty(dto, 'lspt_is_active')) {
    data.lsptIsActive = dto.lspt_is_active ?? true;
  }
}

export function applyOptionalGiftFields(
  data:
    | Prisma.LoyaltySchemeGiftUncheckedCreateInput
    | Prisma.LoyaltySchemeGiftUncheckedUpdateInput,
  dto: SaveLoyaltyGiftDto,
): void {
  if (hasOwnProperty(dto, 'lsg_repeat')) {
    data.lsgRepeat = dto.lsg_repeat ?? false;
  }
  if (hasOwnProperty(dto, 'lsg_notes')) {
    data.lsgNotes = dto.lsg_notes ?? null;
  }
  if (hasOwnProperty(dto, 'lsg_is_active')) {
    data.lsgIsActive = dto.lsg_is_active ?? true;
  }
}

// ─── Payload converters ───────────────────────────────────────────────────────

export function toPartyPayload(party: LoyaltySchemeParty): LoyaltyPartyPayload {
  return {
    lps_id: party.lpsId,
    lps_ls_id: party.lpsLsId,
    lps_slno: party.lpsSlno,
    lps_scope_type: party.lpsScopeType,
    lps_scope_id: party.lpsScopeId,
    lps_is_exclude: party.lpsIsExclude,
    lps_notes: party.lpsNotes,
    lps_is_active: party.lpsIsActive,
    lps_is_deleted: party.lpsIsDeleted,
    lps_sync_date: party.lpsSyncDate?.toISOString() ?? null,
    lps_created_on: party.lpsCreatedOn.toISOString(),
    lps_created_by: party.lpsCreatedBy,
    lps_updated_on: party.lpsUpdatedOn?.toISOString() ?? null,
    lps_updated_by: party.lpsUpdatedBy,
  };
}

export function toPointPayload(point: LoyaltySchemePoint): LoyaltyPointPayload {
  return {
    lspt_id: point.lsptId,
    lspt_ls_id: point.lsptLsId,
    lspt_slno: point.lsptSlno,
    lspt_item_id: point.lsptItemId,
    lspt_unit_id: point.lsptUnitId,
    lspt_exceeds: toNumber(point.lsptExceeds),
    lspt_each: toNumber(point.lsptEach),
    lspt_factor: toNumber(point.lsptFactor),
    lspt_points: toNumber(point.lsptPoints),
    lspt_notes: point.lsptNotes,
    lspt_is_active: point.lsptIsActive,
    lspt_is_deleted: point.lsptIsDeleted,
    lspt_sync_date: point.lsptSyncDate?.toISOString() ?? null,
    lspt_created_on: point.lsptCreatedOn.toISOString(),
    lspt_created_by: point.lsptCreatedBy,
    lspt_updated_on: point.lsptUpdatedOn?.toISOString() ?? null,
    lspt_updated_by: point.lsptUpdatedBy,
  };
}

export function toGiftPayload(gift: LoyaltySchemeGift): LoyaltyGiftPayload {
  return {
    lsg_id: gift.lsgId,
    lsg_ls_id: gift.lsgLsId,
    lsg_slno: gift.lsgSlno,
    lsg_item_id: gift.lsgItemId,
    lsg_unit_id: gift.lsgUnitId,
    lsg_item_qty: toNumber(gift.lsgItemQty),
    lsg_redeem_points: toNumber(gift.lsgRedeemPoints),
    lsg_repeat: gift.lsgRepeat,
    lsg_notes: gift.lsgNotes,
    lsg_is_active: gift.lsgIsActive,
    lsg_is_deleted: gift.lsgIsDeleted,
    lsg_sync_date: gift.lsgSyncDate?.toISOString() ?? null,
    lsg_created_on: gift.lsgCreatedOn.toISOString(),
    lsg_created_by: gift.lsgCreatedBy,
    lsg_updated_on: gift.lsgUpdatedOn?.toISOString() ?? null,
    lsg_updated_by: gift.lsgUpdatedBy,
  };
}

export function toSchemeSummaryPayload(scheme: LoyaltyScheme): LoyaltySchemeSummaryPayload {
  return {
    ls_id: scheme.lsId,
    ls_code: scheme.lsCode,
    ls_name: scheme.lsName,
    ls_type: scheme.lsType,
    ls_status: scheme.lsStatus,
    ls_auto_apply: scheme.lsAutoApply,
    ls_apply_on: scheme.lsApplyOn,
    ls_calc_on_amount_type: scheme.lsCalcOnAmountType,
    ls_bill_type: scheme.lsBillType,
    ls_cust_type: scheme.lsCustType,
    ls_item_type: scheme.lsItemType,
    ls_start_date: toIsoDate(scheme.lsStartDate),
    ls_end_date: toIsoDate(scheme.lsEndDate),
    ls_valid_from_time: toIsoTime(scheme.lsValidFromTime),
    ls_valid_to_time: toIsoTime(scheme.lsValidToTime),
    ls_valid_weekdays: scheme.lsValidWeekdays,
    ls_comp_id: scheme.lsCompId,
    ls_branch_id: scheme.lsBranchId,
    ls_include_tax_for_points: scheme.lsIncludeTaxForPoints,
    ls_rounding_method: scheme.lsRoundingMethod,
    ls_recur_apl: scheme.lsRecurApl,
    ls_bal_apl: scheme.lsBalApl,
    ls_allow_point_redeem: scheme.lsAllowPointRedeem,
    ls_allow_gift_redeem: scheme.lsAllowGiftRedeem,
    ls_redeem_value_per_point: toNumber(scheme.lsRedeemValuePerPoint),
    ls_min_redeem_points: toNumber(scheme.lsMinRedeemPoints),
    ls_max_redeem_points_per_bill: toNumber(scheme.lsMaxRedeemPointsPerBill),
    ls_max_redeem_percent_per_bill: toNumber(scheme.lsMaxRedeemPercentPerBill),
    ls_redeem_min_bill_amount: toNumber(scheme.lsRedeemMinBillAmount),
    ls_points_valid_days: scheme.lsPointsValidDays,
    ls_expiry_basis: scheme.lsExpiryBasis,
    ls_remarks: scheme.lsRemarks,
    ls_is_active: scheme.lsIsActive,
    ls_is_deleted: scheme.lsIsDeleted,
    ls_sync_date: scheme.lsSyncDate?.toISOString() ?? null,
    ls_created_on: scheme.lsCreatedOn.toISOString(),
    ls_created_by: scheme.lsCreatedBy,
    ls_updated_on: scheme.lsUpdatedOn?.toISOString() ?? null,
    ls_updated_by: scheme.lsUpdatedBy,
    ls_approved_on: scheme.lsApprovedOn?.toISOString() ?? null,
    ls_approved_by: scheme.lsApprovedBy,
  };
}

export function toSchemePayload(scheme: SchemeWithChildren): LoyaltySchemePayload {
  return {
    ...toSchemeSummaryPayload(scheme),
    parties: scheme.parties.map(toPartyPayload),
    points: scheme.points.map(toPointPayload),
    gifts: scheme.gifts.map(toGiftPayload),
  };
}

// ─── Display name builders ────────────────────────────────────────────────────

export function buildPartyDisplayName(lpsLsId: string, lpsSlno: number): string {
  return `Scheme ${lpsLsId} / Party ${lpsSlno}`;
}

export function buildPointDisplayName(lsptLsId: string, lsptSlno: number): string {
  return `Scheme ${lsptLsId} / Point ${lsptSlno}`;
}

export function buildGiftDisplayName(lsgLsId: string, lsgSlno: number): string {
  return `Scheme ${lsgLsId} / Gift ${lsgSlno}`;
}

// ─── Error helpers ────────────────────────────────────────────────────────────

export function resolveForeignKeyField(
  error: Prisma.PrismaClientKnownRequestError,
): string {
  const metaField =
    typeof error.meta?.field_name === 'string'
      ? error.meta.field_name
      : typeof error.meta?.target === 'string'
        ? error.meta.target
        : '';

  const normalized = metaField.toLowerCase();

  if (normalized.includes('lspt_item')) return 'lspt_item_id';
  if (normalized.includes('lspt_unit')) return 'lspt_unit_id';
  if (normalized.includes('lsg_item')) return 'lsg_item_id';
  if (normalized.includes('lsg_unit')) return 'lsg_unit_id';
  if (normalized.includes('lps_scope')) return 'lps_scope_id';
  if (
    normalized.includes('lspt_ls') ||
    normalized.includes('lsg_ls') ||
    normalized.includes('lps_ls')
  ) {
    return 'ls_id';
  }

  return 'request';
}

export function handleLoyaltyWriteError(error: unknown): void {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return;
  }

  if (error.code === 'P2002') {
    throwConflict('Duplicate loyalty data is not allowed', [
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
