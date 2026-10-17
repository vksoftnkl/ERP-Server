import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalUuid,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { COLLECTION_DAYS, type CollectionDay } from '../party-outstanding.ageing';

/**
 * Plan §5 — the query keys. Own DTOs, shared with no other route (§2): when the
 * receipt / ledger / credit routes change shape, this module does not move.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

export const OUTSTANDING_SIDES = ['RECEIVABLE', 'PAYABLE'] as const;
export const AGE_BY_VALUES = ['BILL_DATE', 'DUE_DATE'] as const;
export const SORT_DIRS = ['asc', 'desc'] as const;
/** bucket0..bucket7: six edges give seven buckets, eight with DUE_DATE's 'Not due'. */
export const PARTY_SORTS = [
  'net',
  'name',
  'overdue',
  'oldest',
  'owed',
  'bucket0',
  'bucket1',
  'bucket2',
  'bucket3',
  'bucket4',
  'bucket5',
  'bucket6',
  'bucket7',
] as const;
export const BILL_SORTS = ['date', 'party', 'due', 'refno', 'pending', 'age', 'overdue'] as const;
export const SUMMARY_GROUP_BY = ['AREA', 'GROUP', 'SALESMAN', 'BRANCH'] as const;
export const EXPORT_SHAPES = ['PARTIES', 'BILLS', 'PARTY_STATEMENT'] as const;

export type PartySort = (typeof PARTY_SORTS)[number];
export type BillSort = (typeof BILL_SORTS)[number];
export type SortDir = (typeof SORT_DIRS)[number];

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** `/options` — company and side only. */
export class OutstandingOptionsDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ enum: OUTSTANDING_SIDES })
  @Transform(upper)
  @IsIn(OUTSTANDING_SIDES)
  side!: (typeof OUTSTANDING_SIDES)[number];
}

/**
 * Everything but the party — `OutstandingFilterDto`. Every key here narrows
 * WHICH bills / parties are read; none of them changes how a number is defined.
 */
export class OutstandingFilterDto extends OutstandingOptionsDto {
  @ApiProperty({
    example: '2026-10-09',
    description:
      'YYYY-MM-DD. Decides the fiscal year (no accYear key — §4.1); outside every year of the ' +
      'company = 422 AS_ON_OUTSIDE_YEARS. A future date is allowed (isFuture: true).',
  })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'asOn must be YYYY-MM-DD' })
  asOn!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = all branches combined.' })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'accounts.acc_group_master — the party ledger’s group or any sub-group. Absent = the ' +
      'side’s default (Sundry Debtors / Sundry Creditors), which also takes in every customer ' +
      '(Receivable) / supplier (Payable) whose ledger sits elsewhere (O3).',
  })
  @OptionalUuid()
  groupId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'customers.cus_area_id — Receivable only.' })
  @OptionalUuid()
  areaId?: string;

  @ApiPropertyOptional({
    enum: COLLECTION_DAYS,
    description: 'The customer’s area collects on this weekday — Receivable only.',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(COLLECTION_DAYS)
  collectionDay?: CollectionDay;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'customers.cus_default_salesman (abl_salesman_id is never stamped) — Receivable only.',
  })
  @OptionalUuid()
  salesmanId?: string;

  @ApiPropertyOptional({ enum: AGE_BY_VALUES, default: 'BILL_DATE' })
  @IsOptional()
  @Transform(upper)
  @IsIn(AGE_BY_VALUES)
  ageBy?: (typeof AGE_BY_VALUES)[number];

  @ApiPropertyOptional({
    example: '30,60,90,180',
    default: '30,60,90,180',
    description: '1 to 6 rising whole numbers of days, max 3650 — otherwise 422 BAD_BUCKETS.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  buckets?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Parties with overdue > 0 only. On /bills, /bill-wise and the bills of an export: overdue ' +
      'owed bills only.',
  })
  @OptionalQueryBoolean()
  onlyOverdue?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'false drops on-account bills (advances, returns, notes) from every figure.',
  })
  @OptionalQueryBoolean()
  includeOnAccount?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Subtract the PDC in hand (not yet effective) from net.',
  })
  @OptionalQueryBoolean()
  deductPdc?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Drop parties whose owed and on-account are both 0 on asOn.',
  })
  @OptionalQueryBoolean()
  hideZero?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      '3.0’s "Due days ≥" — on overdueDays of owed bills (party: any bill; bills: each).',
  })
  @OptionalQueryInt(0, 36500)
  minDueDays?: number;

  @ApiPropertyOptional({ minimum: 0, description: '3.0’s "Due days ≤" — as minDueDays.' })
  @OptionalQueryInt(0, 36500)
  maxDueDays?: number;
}

/** `OutstandingScopeDto` of the plan — the filters plus an optional party. */
export class OutstandingScopeDto extends OutstandingFilterDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'acc_ledger_master.led_id = abl_party_id.' })
  @OptionalUuid()
  partyId?: string;
}

/** `/party`, `/bills` — one party, required. */
export class OutstandingPartyDto extends OutstandingFilterDto {
  @ApiProperty({ format: 'uuid', description: 'acc_ledger_master.led_id = abl_party_id.' })
  @RequiredUuid()
  partyId!: string;
}

/** `/parties` — the grid, server-sorted and paged. */
export class OutstandingPartiesDto extends OutstandingScopeDto {
  @ApiPropertyOptional({ enum: PARTY_SORTS, default: 'net' })
  @IsOptional()
  @Transform(lower)
  @IsIn(PARTY_SORTS)
  sort?: PartySort;

  @ApiPropertyOptional({ enum: SORT_DIRS, default: 'desc' })
  @IsOptional()
  @Transform(lower)
  @IsIn(SORT_DIRS)
  dir?: SortDir;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ default: 200, minimum: 1, maximum: 500 })
  @OptionalQueryInt(1, 500)
  pageSize?: number;
}

/** `/bill-wise` — open items across parties, paged. */
export class OutstandingBillWiseDto extends OutstandingScopeDto {
  @ApiPropertyOptional({ enum: BILL_SORTS, default: 'date' })
  @IsOptional()
  @Transform(lower)
  @IsIn(BILL_SORTS)
  sort?: BillSort;

  @ApiPropertyOptional({ enum: SORT_DIRS, default: 'asc' })
  @IsOptional()
  @Transform(lower)
  @IsIn(SORT_DIRS)
  dir?: SortDir;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ default: 200, minimum: 1, maximum: 500 })
  @OptionalQueryInt(1, 500)
  pageSize?: number;

  @ApiPropertyOptional({
    example: '2026-10-15',
    description: 'Owed bills whose dueEff is this day only (the Due calendar’s day click).',
  })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'dueOn must be YYYY-MM-DD' })
  dueOn?: string;
}

/** `/bill-history` — what settled one bill. */
export class OutstandingBillHistoryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'acc_bill_balance.abl_id' })
  @RequiredUuid()
  billId!: string;

  @ApiProperty({ example: '2026-2027', description: 'acc_bill_balance.abl_acc_year' })
  @UpperMaxString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' })
  accYear!: string;

  @ApiProperty({ example: '2026-10-09', description: 'Rows dated after it are effective: false.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'asOn must be YYYY-MM-DD' })
  asOn!: string;
}

/** `/summary` — the Group / area summary tab. */
export class OutstandingSummaryDto extends OutstandingScopeDto {
  @ApiProperty({
    enum: SUMMARY_GROUP_BY,
    description: 'AREA and SALESMAN are refused on Payable (NOT_FOR_PAYABLE).',
  })
  @Transform(upper)
  @IsIn(SUMMARY_GROUP_BY)
  groupBy!: (typeof SUMMARY_GROUP_BY)[number];
}

/** `/due-calendar` — owed bills by dueEff in [from, to], at most 92 days. */
export class OutstandingDueCalendarDto extends OutstandingScopeDto {
  @ApiProperty({ example: '2026-10-09' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @ApiProperty({ example: '2026-11-08' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  to!: string;
}

/** `/export` — rows for Print / PDF / Excel / WhatsApp. */
export class OutstandingExportDto extends OutstandingScopeDto {
  @ApiProperty({
    enum: EXPORT_SHAPES,
    description:
      'PARTIES = the /parties rows unpaged; BILLS = the /bill-wise rows unpaged; ' +
      'PARTY_STATEMENT = one party’s open bills, ageing and net (needs partyId).',
  })
  @Transform(upper)
  @IsIn(EXPORT_SHAPES)
  shape!: (typeof EXPORT_SHAPES)[number];

  @ApiPropertyOptional({
    enum: [...PARTY_SORTS, ...BILL_SORTS],
    description: 'PARTIES takes the /parties sorts, BILLS the /bill-wise ones (else 422 BAD_SORT).',
  })
  @IsOptional()
  @Transform(lower)
  @IsIn([...PARTY_SORTS, ...BILL_SORTS])
  sort?: PartySort | BillSort;

  @ApiPropertyOptional({ enum: SORT_DIRS })
  @IsOptional()
  @Transform(lower)
  @IsIn(SORT_DIRS)
  dir?: SortDir;
}
