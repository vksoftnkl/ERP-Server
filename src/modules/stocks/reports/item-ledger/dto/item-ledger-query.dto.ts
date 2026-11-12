import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import {
  BUCKET_CHOICES,
  ORDERS,
  REPORT_TYPE_CODES,
  VALUE_AT,
  type BucketChoice,
  type Order,
  type ValueAt,
} from '../item-ledger.rules';

/**
 * Plan §5.1 — the query keys. Own DTOs, shared with no other route: when the
 * stock voucher / sales / purchase routes change shape, this report does not
 * move. A malformed key (a non-uuid id, a date that is not a calendar date, an
 * unknown bucket / order / valueAt / type, limit > 5,000) is the house
 * ValidationPipe's 400 VALIDATION_*; everything that needs the database is a
 * 422 ITEM_LEDGER_* from the service.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ITEM_LEDGER_MAX_LIMIT = 5_000;
export const ITEM_LEDGER_DEFAULT_LIMIT = 1_000;

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Every id is compared with the database's (lower-case) uuid text in the
 * service, so `019C8EA6-…` must arrive as `019c8ea6-…`. Trim + lower-case
 * commutes with the house uuid transform (trim, '' → absent), so it does not
 * matter which of the two class-transformer runs first.
 */
const LowerCaseId = () => Transform(lower);

/**
 * `types=SALE,PURCHASE` or `types=SALE&types=PURCHASE` → ['SALE', 'PURCHASE'].
 * Read from the RAW source (`obj[key]`), as OptionalQueryBoolean does: the
 * global pipe's implicit conversion would otherwise hand a string[] property
 * its own idea of an array.
 */
function toTypeList({ obj, key }: { obj: unknown; key: string }): unknown {
  const raw = (obj as Record<string, unknown> | undefined)?.[key];
  if (raw === undefined || raw === null) return undefined;
  const list: unknown[] = Array.isArray(raw) ? (raw as unknown[]) : [raw];
  const parts = list
    .flatMap((v): unknown[] => (typeof v === 'string' ? v.split(',') : [v]))
    .map((v): unknown => (typeof v === 'string' ? v.trim().toUpperCase() : v))
    .filter((v) => v !== '');
  return [...new Set(parts)];
}

/** `/options` — the item facts and the More-filters choices. */
export class ItemLedgerOptionsDto {
  @ApiProperty({ format: 'uuid' })
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

  @ApiProperty({
    format: 'uuid',
    description: 'inventory.item_master — live, this company’s or shared.',
  })
  @RequiredUuid()
  @LowerCaseId()
  itemId!: string;
}

/** Everything but `from` — the Month-wise tab runs from the start of the financial year of `to`. */
export class ItemLedgerMonthsDto extends ItemLedgerOptionsDto {
  @ApiProperty({ example: '2026-11-10', description: 'YYYY-MM-DD, a calendar date.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'to must be a calendar date' })
  to!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Scope: one godown of the branch (godown_locations.gdl_branch_id). Absent = all godowns.',
  })
  @OptionalUuid()
  @LowerCaseId()
  godownId?: string;

  @ApiPropertyOptional({
    enum: BUCKET_CHOICES,
    default: 'SALEABLE',
    description: 'Scope: one stock bucket, or ALL.',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(BUCKET_CHOICES)
  bucket?: BucketChoice;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Scope: one lot (stock_lot.slt_item_id must be itemId). Absent = all batches.',
  })
  @OptionalUuid()
  @LowerCaseId()
  lotId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Qty in: an item_unit_conversion.iuc_id of the item (live). Absent = the base unit. ' +
      'Quantities ÷ its to-base factor, rates × it.',
  })
  @OptionalUuid()
  @LowerCaseId()
  unitId?: string;

  @ApiPropertyOptional({
    enum: VALUE_AT,
    default: 'WITHOUT_TAX',
    description: 'Cost basis: the ledger’s _wot columns (default, Q3) or the tax-inclusive ones.',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(VALUE_AT)
  valueAt?: ValueAt;

  @ApiPropertyOptional({
    type: String,
    example: 'SALE,PURCHASE',
    description:
      'Row filter: report type codes, comma-separated (or repeated). Absent = all. Balances never ' +
      `move with it. Codes: ${REPORT_TYPE_CODES.join(', ')}.`,
  })
  @IsOptional()
  @Transform(toTypeList)
  @IsArray()
  @ArrayMaxSize(REPORT_TYPE_CODES.length)
  @IsIn(REPORT_TYPE_CODES, { each: true })
  types?: string[];

  @ApiPropertyOptional({
    default: true,
    description:
      'Row filter: false hides the cancelled / amended pairs whose quantity AND value net to 0. ' +
      'A partial revaluation reversal always shows.',
  })
  @OptionalQueryBoolean()
  showReversed?: boolean;
}

/** `/`, `/days`, `/export` — the scope with both dates. */
export class ItemLedgerScopeDto extends ItemLedgerMonthsDto {
  @ApiProperty({ example: '2026-11-01', description: 'YYYY-MM-DD, a calendar date; ≤ to.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'from must be a calendar date' })
  from!: string;
}

/** `/export` — the scope + the order of the rows. */
export class ItemLedgerExportDto extends ItemLedgerScopeDto {
  @ApiPropertyOptional({
    enum: ORDERS,
    default: 'asc',
    description:
      'Posting order (asc) or newest first (desc). Balances are always the ascending ones.',
  })
  @IsOptional()
  @Transform(lower)
  @IsIn(ORDERS)
  order?: Order;
}

/** `GET /stock/reports/item-ledger` — + paging. */
export class ItemLedgerQueryDto extends ItemLedgerExportDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: ITEM_LEDGER_MAX_LIMIT,
    default: ITEM_LEDGER_DEFAULT_LIMIT,
  })
  @OptionalQueryInt(1, ITEM_LEDGER_MAX_LIMIT)
  limit?: number;
}
