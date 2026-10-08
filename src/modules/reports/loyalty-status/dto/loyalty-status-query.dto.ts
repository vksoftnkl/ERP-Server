import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import {
  OptionalDateString,
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';

/**
 * Plan 2026-10-05 §5 — the query keys. Own DTOs, shared with no other route
 * (§3): the report is self-contained.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MEMBER_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED', 'MERGED'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** The house scope every route takes: `companyId` required, `branchId` absent = all branches. */
export class LoyaltyStatusScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Absent = all branches. Members / Expiring: the member’s home branch (lmb_branch_id). ' +
      'Scheme summary: where the movement happened (lld_branch_id). Plan D3.',
  })
  @OptionalUuid()
  branchId?: string;
}

/** Paging, sort and search — what every list route adds to the scope. */
export class LoyaltyStatusListDto extends LoyaltyStatusScopeDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @OptionalQueryInt(1, 200)
  limit?: number;

  @ApiPropertyOptional({ description: 'A column key of the route’s item; the route lists which.' })
  @OptionalTrimmedString(40)
  sort?: string;

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'asc' })
  @OptionalTrimmedString(4)
  @IsIn(SORT_ORDERS)
  order?: SortOrder;

  @ApiPropertyOptional({ description: 'ILIKE over card no, mobile and customer name.' })
  @OptionalTrimmedString(100)
  search?: string;
}

/** §5.1 `/members` — tab 1 grid + tiles. */
export class LoyaltyStatusMembersDto extends LoyaltyStatusListDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Scheme Name — the member’s lmb_lsc_id.' })
  @OptionalUuid()
  lscId?: string;

  @ApiPropertyOptional({
    enum: MEMBER_STATUSES,
    description: 'Absent = ACTIVE (and SUSPENDED when includeMergedClosed is false — see README).',
  })
  @OptionalTrimmedString(20)
  @IsIn(MEMBER_STATUSES)
  status?: MemberStatus;

  @ApiPropertyOptional({ default: true, description: 'Only wallets with a balance > 0.' })
  @OptionalQueryBoolean()
  balanceGtZero?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: '3.0 “Show eligible customers”: a best gift exists and the member is ACTIVE.',
  })
  @OptionalQueryBoolean()
  eligibleOnly?: boolean;

  @ApiPropertyOptional({ description: 'From Points — on the balance.' })
  @OptionalQueryInt(0)
  pointsMin?: number;

  @ApiPropertyOptional({ description: 'To Points — on the balance.' })
  @OptionalQueryInt(0)
  pointsMax?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Also list MERGED and CLOSED wallets (their balance should be 0).',
  })
  @OptionalQueryBoolean()
  includeMergedClosed?: boolean;

  @ApiPropertyOptional({
    example: '2026-04-01',
    description:
      '3.0 “Date From”: Earned becomes the points earned in [earnedFrom, earnedTo]. Absent = ' +
      'lifetime lmb_earned_points.',
  })
  @OptionalDateString()
  earnedFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-05' })
  @OptionalDateString()
  earnedTo?: string;
}

/** §5.2 `/statement` — tab 1 bottom left. */
export class LoyaltyStatusStatementDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'sales.loyalty_member.lmb_id' })
  @RequiredUuid()
  memberId!: string;

  @ApiPropertyOptional({ example: '2026-04-01', description: 'Absent = from the first row.' })
  @OptionalDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-05', description: 'Absent = today.' })
  @OptionalDateString()
  to?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'false hides BOTH halves of a reversed pair — the row and its lld_reversal_of_id partner — ' +
      'so the running balance stays true.',
  })
  @OptionalQueryBoolean()
  showReversals?: boolean;
}

/** §5.3 `/member` — tab 1 bottom right. */
export class LoyaltyStatusMemberDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'sales.loyalty_member.lmb_id' })
  @RequiredUuid()
  memberId!: string;
}

/** §5.4 `/expiring` — tab 2 grid + tiles. */
export class LoyaltyStatusExpiringDto extends LoyaltyStatusListDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The scheme the lapsing lot belongs to (lld_lsc_id).',
  })
  @OptionalUuid()
  lscId?: string;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 365 })
  @OptionalQueryInt(1, 365)
  withinDays?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Only members with a mobile (lmb_mobile, else cus_phone1).',
  })
  @OptionalQueryBoolean()
  hasMobile?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Only ACTIVE members.' })
  @OptionalQueryBoolean()
  activeOnly?: boolean;
}

/** §5.5 `/expiring/calendar` — tab 2 chart. */
export class LoyaltyStatusCalendarDto extends LoyaltyStatusScopeDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  lscId?: string;

  @ApiPropertyOptional({ default: 90, minimum: 7, maximum: 730 })
  @OptionalQueryInt(7, 730)
  days?: number;
}

export const SCHEME_SPLITS = ['scheme', 'scheme_branch', 'scheme_month'] as const;
export type SchemeSplit = (typeof SCHEME_SPLITS)[number];

/** The period the scheme routes share. */
export class LoyaltyStatusPeriodDto extends LoyaltyStatusScopeDto {
  @ApiProperty({ example: '2026-04-01', description: 'YYYY-MM-DD.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @ApiProperty({ example: '2026-10-05', description: 'YYYY-MM-DD, ≥ from.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  to!: string;
}

/** §5.6 `/schemes` — tab 3 grid. */
export class LoyaltyStatusSchemesDto extends LoyaltyStatusPeriodDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  lscId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Keep a CLOSED / ended scheme only while its outstanding is > 0; false drops it.',
  })
  @OptionalQueryBoolean()
  includeClosedHolding?: boolean;

  @ApiPropertyOptional({ enum: SCHEME_SPLITS, default: 'scheme' })
  @OptionalTrimmedString(20)
  @IsIn(SCHEME_SPLITS)
  splitBy?: SchemeSplit;

  @ApiPropertyOptional({
    description: 'lscId, schemeName, earned, redeemed, outstanding, holders, usedPct …',
  })
  @OptionalTrimmedString(40)
  sort?: string;

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'asc' })
  @OptionalTrimmedString(4)
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}

/** §5.7 `/schemes/monthly` — tab 3 bottom left. */
export class LoyaltyStatusMonthlyDto extends LoyaltyStatusPeriodDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  lscId!: string;
}

/** §5.8 `/schemes/gifts` — tab 3 bottom right. */
export class LoyaltyStatusGiftsDto extends LoyaltyStatusPeriodDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  lscId!: string;
}

export const EXPORT_TABS = ['members', 'expiring', 'schemes', 'statement'] as const;
export type ExportTab = (typeof EXPORT_TABS)[number];
export const EXPORT_FORMATS = ['pdf', 'xlsx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * §5.9 `/export` — the tab's filters, unpaged. One DTO carries every tab's
 * keys because the query is flat; the service reads the ones its `tab` uses
 * and prints exactly those as the "Printed as:" line.
 */
export class LoyaltyStatusExportDto extends LoyaltyStatusScopeDto {
  @ApiProperty({ enum: EXPORT_TABS })
  @IsString()
  @IsIn(EXPORT_TABS)
  tab!: ExportTab;

  @ApiPropertyOptional({
    enum: EXPORT_FORMATS,
    default: 'pdf',
    description: 'Echoed back; the client renders.',
  })
  @OptionalTrimmedString(4)
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;

  @ApiPropertyOptional({ description: 'Sort key of the tab.' })
  @OptionalTrimmedString(40)
  sort?: string;

  @ApiPropertyOptional({ enum: SORT_ORDERS })
  @OptionalTrimmedString(4)
  @IsIn(SORT_ORDERS)
  order?: SortOrder;

  @ApiPropertyOptional()
  @OptionalTrimmedString(100)
  search?: string;

  // members / expiring / schemes
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  lscId?: string;

  // members
  @ApiPropertyOptional({ enum: MEMBER_STATUSES })
  @OptionalTrimmedString(20)
  @IsIn(MEMBER_STATUSES)
  status?: MemberStatus;

  @ApiPropertyOptional()
  @OptionalQueryBoolean()
  balanceGtZero?: boolean;

  @ApiPropertyOptional()
  @OptionalQueryBoolean()
  eligibleOnly?: boolean;

  @ApiPropertyOptional()
  @OptionalQueryInt(0)
  pointsMin?: number;

  @ApiPropertyOptional()
  @OptionalQueryInt(0)
  pointsMax?: number;

  @ApiPropertyOptional()
  @OptionalQueryBoolean()
  includeMergedClosed?: boolean;

  @ApiPropertyOptional()
  @OptionalDateString()
  earnedFrom?: string;

  @ApiPropertyOptional()
  @OptionalDateString()
  earnedTo?: string;

  // expiring
  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @OptionalQueryInt(1, 365)
  withinDays?: number;

  @ApiPropertyOptional()
  @OptionalQueryBoolean()
  hasMobile?: boolean;

  @ApiPropertyOptional()
  @OptionalQueryBoolean()
  activeOnly?: boolean;

  // schemes / statement
  @ApiPropertyOptional({ example: '2026-04-01' })
  @OptionalDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-05' })
  @OptionalDateString()
  to?: string;

  @ApiPropertyOptional()
  @OptionalQueryBoolean()
  includeClosedHolding?: boolean;

  @ApiPropertyOptional({ enum: SCHEME_SPLITS })
  @OptionalTrimmedString(20)
  @IsIn(SCHEME_SPLITS)
  splitBy?: SchemeSplit;

  // statement
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  memberId?: string;

  @ApiPropertyOptional()
  @OptionalQueryBoolean()
  showReversals?: boolean;
}
