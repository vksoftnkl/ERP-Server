import { ApiProperty, ApiPropertyOptional, IntersectionType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import { VALUE_AT, type ValueAt } from '../../item-ledger/item-ledger.rules';
import {
  DEFAULT_LIMIT,
  DEFAULT_NO_SALE_DAYS,
  EXPORT_TABS,
  GROUP_BY,
  MAX_LIMIT,
  NO_KEY,
  QTY_IN,
  SHOW_CHOICES,
  SORT_KEYS,
  SUMMARY_BUCKET_CHOICES,
  type QtyIn,
  type ShowChoice,
  type SortKey,
  type SummaryBucket,
} from '../stock-summary.rules';
import type { ExportTab, GroupBy } from '../types/stock-summary.types';

/**
 * Plan §5.1 — the query keys. Own DTOs, shared with no other route (the Item
 * Ledger's DTOs are not reused). A malformed key — a non-uuid id, a date that
 * is not a calendar date, an unknown enum, limit > 5,000, noSaleDays outside
 * 1–3,650, an undeclared key such as godownId on /branches — is the house
 * ValidationPipe's 400 VALIDATION_*; everything that needs the database is a
 * 422 STOCK_SUMMARY_* from the service.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_OR_NONE = /^(NONE|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Ids compare with the database's lower-case uuid text (IL review #7). */
const LowerCaseId = () => Transform(lower);

/** `name` / `inTransit` / `lastSale` … whatever case the client sends. */
const SORT_BY_LOWER = new Map(SORT_KEYS.map((k) => [k.toLowerCase(), k]));
const sortKey = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (SORT_BY_LOWER.get(value.trim().toLowerCase()) ?? value) : value;

const groupKey = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  return v === NO_KEY.toLowerCase() ? NO_KEY : v;
};

/** `/options` — the company and the branch. */
export class StockSummaryOptionsDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Any company (Q2: the page has a Company dropdown, as the Item Ledger).',
  })
  @RequiredUuid()
  @LowerCaseId()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'One branch: branch_master.br_comp_id must be companyId.',
  })
  @RequiredUuid()
  @LowerCaseId()
  branchId!: string;
}

/** The scope of a Show (§5.1 StockSummaryScopeDto). */
export class StockSummaryScopeDto extends StockSummaryOptionsDto {
  @ApiProperty({ example: '2026-11-01', description: 'YYYY-MM-DD, a calendar date; ≤ to.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'from must be a calendar date' })
  from!: string;

  @ApiProperty({ example: '2026-11-14', description: 'YYYY-MM-DD, a calendar date.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'to must be a calendar date' })
  to!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Scope: one godown of the branch (gdl_branch_id). Absent = all godowns.',
  })
  @OptionalUuid()
  @LowerCaseId()
  godownId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Item filter: the group and its whole subtree (by parent). Absent = all groups.',
  })
  @OptionalUuid()
  @LowerCaseId()
  groupId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Item filter: the brand and its whole subtree (by parent). Absent = all brands.',
  })
  @OptionalUuid()
  @LowerCaseId()
  brandId?: string;

  @ApiPropertyOptional({ enum: SUMMARY_BUCKET_CHOICES, default: 'SALEABLE' })
  @IsOptional()
  @Transform(upper)
  @IsIn(SUMMARY_BUCKET_CHOICES)
  bucket?: SummaryBucket;

  @ApiPropertyOptional({
    enum: VALUE_AT,
    default: 'WITHOUT_TAX',
    description: 'Cost basis: the _wot columns (default, D5) or the tax-inclusive ones.',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(VALUE_AT)
  valueAt?: ValueAt;

  @ApiPropertyOptional({
    enum: QTY_IN,
    default: 'BASE',
    description: 'Quantities in the base unit, or each item’s default unit (rates follow).',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(QTY_IN)
  qtyIn?: QtyIn;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3650,
    default: DEFAULT_NO_SALE_DAYS,
    description: 'The NO SALE chip: closing > 0 and no sale for this many days up to `to` (D2).',
  })
  @OptionalQueryInt(1, 3650)
  noSaleDays?: number;
}

/** A view of a run — applied in memory, no SQL (§5.1 StockSummaryViewDto). */
export class StockSummaryViewDto {
  @ApiPropertyOptional({ enum: SORT_KEYS, default: 'name' })
  @IsOptional()
  @Transform(sortKey)
  @IsIn(SORT_KEYS)
  sort?: SortKey;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @Transform(lower)
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT })
  @OptionalQueryInt(1, MAX_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    default: true,
    description:
      'Hide rows whose opening, inward, outward, closing, reserved and in transit are all 0 (D26).',
  })
  @OptionalQueryBoolean()
  hideZero?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Only rows with closing < 0.' })
  @OptionalQueryBoolean()
  onlyNegative?: boolean;

  @ApiPropertyOptional({ enum: SHOW_CHOICES, default: 'ALL', description: 'A tile filter (D31).' })
  @IsOptional()
  @Transform(upper)
  @IsIn(SHOW_CHOICES)
  show?: ShowChoice;

  @ApiPropertyOptional({
    maxLength: 60,
    description: 'Code, name, barcode or SKU contains this (case-insensitive).',
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(60)
  find?: string;

  @ApiPropertyOptional({
    enum: GROUP_BY,
    description:
      'The Group summary drill (with groupKey): only the rows of that group / brand / section / ' +
      'category. On /export with tab=GROUPS it is the "Summarise by" instead.',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(GROUP_BY)
  groupBy?: GroupBy;

  @ApiPropertyOptional({
    description: 'The drill key: a /groups row key (uuid), or NONE for its "(No …)" line.',
  })
  @IsOptional()
  @Transform(groupKey)
  @IsString()
  @Matches(UUID_OR_NONE, { message: 'groupKey must be a uuid or NONE' })
  groupKey?: string;
}

/** `GET /stock/reports/summary` — Show: scope + the first view. */
export class StockSummaryQueryDto extends IntersectionType(
  StockSummaryScopeDto,
  StockSummaryViewDto,
) {}

/** A run by its id. */
export class StockSummaryRunDto {
  @ApiProperty({ format: 'uuid', description: 'head.runId of a Show (Item-wise or Branch-wise).' })
  @RequiredUuid()
  @LowerCaseId()
  runId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optional: when sent it must be the run’s company, else 410 (as an unknown run).',
  })
  @OptionalUuid()
  @LowerCaseId()
  companyId?: string;
}

/** `/rows` — another page / sort / filter of a run. */
export class StockSummaryRowsDto extends IntersectionType(
  StockSummaryRunDto,
  StockSummaryViewDto,
) {}

/** `/godowns` — the Godown-wise tab of an Item-wise run. */
export class StockSummaryGodownsDto extends StockSummaryRowsDto {}

/** `/groups` — the Group summary of an Item-wise run. */
export class StockSummaryGroupsDto extends StockSummaryRunDto {
  @ApiPropertyOptional({ enum: GROUP_BY, default: 'GROUP', description: 'Summarise by.' })
  @IsOptional()
  @Transform(upper)
  @IsIn(GROUP_BY)
  groupBy?: GroupBy;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  hideZero?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  onlyNegative?: boolean;

  @ApiPropertyOptional({ enum: SHOW_CHOICES, default: 'ALL' })
  @IsOptional()
  @Transform(upper)
  @IsIn(SHOW_CHOICES)
  show?: ShowChoice;
}

/** `/branches` — a Branch-wise run: the scope WITHOUT godownId (sending it is a 400), + a view. */
export class StockSummaryBranchesDto extends IntersectionType(
  OmitType(StockSummaryScopeDto, ['godownId'] as const),
  StockSummaryViewDto,
) {}

/** `/item` — the panes for one row (stateless; `runId` only adds the "= grid row" tie). */
export class StockSummaryItemDto extends StockSummaryScopeDto {
  @ApiProperty({
    format: 'uuid',
    description: 'inventory.item_master — live, this company’s or shared.',
  })
  @RequiredUuid()
  @LowerCaseId()
  itemId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optional: the Show’s run, to check the panes against the grid row (ties.row).',
  })
  @OptionalUuid()
  @LowerCaseId()
  runId?: string;
}

/** `/export` — every row of the tab on screen (no paging), for Excel and print. */
export class StockSummaryExportDto extends StockSummaryRowsDto {
  @ApiProperty({
    enum: EXPORT_TABS,
    description: 'BRANCHES needs a Branch-wise run, the rest an Item-wise one.',
  })
  @Transform(upper)
  @IsIn(EXPORT_TABS)
  tab!: ExportTab;
}
