import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  NullableDateString,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalNumber,
  RequiredNumber,
  RequiredUuid,
  SkipOnNullish,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
import { STOCK_BUCKETS, type StockBucket } from '../../stock-voucher/types/stock-voucher.types';
import { STOCK_ADJUSTMENT_SAVE_KINDS, type StockAdjustmentSaveKind } from '../stock-adjustment.rules';

const MAX_LINES = 2000;

/**
 * The header is the shared one plus the Type selector, with the three value
 * totals declared again. `voucherType` is REQUIRED here — one screen, five
 * documents — and only those are accepted; anything else 400s before the
 * service sees it.
 *
 * The totals are OMITTED from the shared header and declared here, not
 * redeclared over it: nestjs/swagger merges a redecorated property's options
 * with the base's up the prototype chain, so `minimum: 0` would stay in
 * /api/docs. OmitType copies every other property's validators, transforms
 * and docs, and leaves these three to this class.
 */
export class SaveStockAdjustmentHeaderDto extends OmitType(SaveStockVoucherHeaderDto, [
  'totalQty',
  'totalValue',
  'totalValueWot',
] as const) {
  @ApiProperty({
    enum: STOCK_ADJUSTMENT_SAVE_KINDS,
    description:
      'Which document this is. A re-lot is an ADJUSTMENT carrying a RELOT_OUT / RELOT_IN pair. BUCKET_MOVE ("Move stock") is stored as an ADJUSTMENT: every line moves one lot from `bucket` to `toBucket` in the same godown, and no accounts voucher is written.',
  })
  @IsIn(STOCK_ADJUSTMENT_SAVE_KINDS as readonly string[], {
    message: `voucherType must be one of ${STOCK_ADJUSTMENT_SAVE_KINDS.join(', ')}`,
  })
  voucherType!: StockAdjustmentSaveKind;

  // ── The totals are the NET of the lines, so they may be negative ─────────
  //
  // The shared header floors them at 0 (`@OptionalNumber(0)`), which is right
  // for an opening and wrong here: an adjustment that takes out more than it
  // brings in nets below zero, as a count's shortage does (the physical header
  // takes a signed total for the same reason; notes 65 §2). lineCount keeps
  // its floor — a document cannot have fewer than no lines.

  @ApiPropertyOptional({
    default: 0,
    description:
      'The document total quantity, as the screen summed it: the NET of the lines, so MAY BE NEGATIVE when more goes out than comes in. A move counts the quantity moved. numeric(18,6), NOT NULL DEFAULT 0 — omit to take the default; the post re-sums it from the ledger either way.',
  })
  @OptionalNumber()
  totalQty?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'The document total value, inclusive of tax: the net, may be negative — see totalQty. numeric(18,2), NOT NULL DEFAULT 0.',
  })
  @OptionalNumber()
  totalValue?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'The document total value excluding tax: the net, may be negative — see totalQty. numeric(18,2), NOT NULL DEFAULT 0.',
  })
  @OptionalNumber()
  totalValueWot?: number;
}

/**
 * One line of an adjustment. Its OWN class rather than the shared line DTO,
 * because the quantity may be SIGNED here: under a reason whose direction is
 * BOTH, + brings stock in and − takes it out (plan §0). The service stores
 * |qty| and the sign (`svi_direction`) — the row's quantities stay magnitudes.
 *
 * There is no free quantity on an adjustment (§2): a free line is refused.
 */
export class SaveStockAdjustmentItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Update only: the id of an existing line of this document (svi_id, as /get returns it). ' +
      'A line WITH it updates that row, a line WITHOUT one is inserted, and a stored line whose ' +
      'id is not sent is deleted — so a line keeps its identity across saves (notes 89). ' +
      'Refused on a create, and refused when it names a line of another document.',
  })
  @OptionalUuid()
  sviId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  lineNo!: number;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiProperty({ format: 'uuid', description: 'inventory.item_unit_conversion.iuc_id the line is keyed in.' })
  @RequiredUuid()
  uomId!: string;

  @ApiProperty({ format: 'uuid', description: "The item's BASE conversion row." })
  @RequiredUuid()
  baseUomId!: string;

  @ApiProperty({ description: 'Document unit → base unit.' })
  @IsPositive({ message: 'toBaseFactor must be greater than 0' })
  toBaseFactor!: number;

  @ApiProperty({
    description:
      'The quantity, in the document unit. SIGNED only under a reason whose direction is BOTH (+ in, − out); an IN or OUT reason fixes the sign and a quantity the wrong way round is refused. On a BUCKET_MOVE line, the quantity moved, positive. Never 0.',
  })
  @RequiredNumber()
  qty!: number;

  @ApiProperty({ description: 'qty × toBaseFactor, in the base unit, with the same sign as qty.' })
  @RequiredNumber()
  baseQty!: number;

  @ApiPropertyOptional({ default: 0, description: 'Must be 0: an adjustment has no free goods.' })
  @OptionalNumber(0)
  freeQty?: number;

  @ApiPropertyOptional({ default: 0, description: 'Must be 0: an adjustment has no free goods.' })
  @OptionalNumber(0)
  freeBaseQty?: number;

  @ApiProperty({ format: 'uuid', description: "The line's godown — the header's from/to godown." })
  @RequiredUuid()
  godownId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'OUTWARD: the holding, from GET /stock/adjustment/pick-stock; omit it and the engine picks lots by the item\'s issue strategy. Required on an EXPIRY_WRITEOFF (the expiry is the lot\'s) and on a BUCKET_MOVE (the lot names the supplier the stock goes back to). INWARD: leave empty — the identity fields resolve the lot.',
  })
  @NullableUuid()
  lotId?: string | null;

  @ApiPropertyOptional({
    enum: STOCK_BUCKETS,
    default: 'SALEABLE',
    description: 'The holding\'s bucket; absent means SALEABLE. On a BUCKET_MOVE line, the bucket the stock LEAVES.',
  })
  @IsOptional()
  @IsIn(STOCK_BUCKETS as readonly string[])
  bucket?: StockBucket;

  @ApiPropertyOptional({
    enum: STOCK_BUCKETS,
    nullable: true,
    description:
      'BUCKET_MOVE only, and required there: the bucket the same lot moves to (never `bucket` itself). The screen defaults it from the reason — MOVE_DAMAGED → DAMAGED, MOVE_SALEABLE → SALEABLE. Refused on every other kind.',
  })
  @SkipOnNullish()
  @IsIn(STOCK_BUCKETS as readonly string[], { message: `toBucket must be one of ${STOCK_BUCKETS.join(', ')}` })
  toBucket?: StockBucket | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'Inward identity, when the policy tracks it.' })
  @NullableStringStrict(100)
  batchNo?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  mfgDate?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  expiryDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  mrp?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  salePrice?: number | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  serialNo?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supplierId?: string | null;

  @ApiPropertyOptional({
    description:
      'INWARD only, and only when the header names no rate source that derives one: what the stock is worth per BASE unit (a rate keyed per document unit is divided by toBaseFactor first). The line value is (baseQty + freeBaseQty) × costRate, the way svi_value is generated. An OUTWARD line is always stamped by the engine at what the stock cost — the batch\'s own cost for a tracked item, the branch average for plain stock (notes 92); a keyed cost is ignored.',
  })
  @OptionalNumber(0)
  costRate?: number;

  @ApiPropertyOptional()
  @OptionalNumber(0)
  costRateWot?: number;

  @ApiPropertyOptional()
  @OptionalNumber(0)
  taxPerc?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: "stock.stock_reason_master, per line. Falls back to the header's reason.",
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'What the scanner read, echoed back.' })
  @NullableStringStrict(200)
  barcode?: string | null;
}

export class SaveStockAdjustmentDto {
  @ApiProperty({ type: SaveStockAdjustmentHeaderDto })
  @ValidateNested()
  @Type(() => SaveStockAdjustmentHeaderDto)
  header!: SaveStockAdjustmentHeaderDto;

  @ApiProperty({ type: SaveStockAdjustmentItemDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(MAX_LINES, { message: `lines may not exceed ${MAX_LINES} rows in one document` })
  @ValidateNested({ each: true })
  @Type(() => SaveStockAdjustmentItemDto)
  lines!: SaveStockAdjustmentItemDto[];
}
