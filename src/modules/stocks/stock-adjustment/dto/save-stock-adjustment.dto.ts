import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
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
} from 'src/common/dto/dtoDecorators';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
import { STOCK_BUCKETS, type StockBucket } from '../../stock-voucher/types/stock-voucher.types';
import { STOCK_ADJUSTMENT_KINDS, type StockAdjustmentKind } from '../stock-adjustment.rules';

const MAX_LINES = 2000;

/**
 * The header is the shared one plus the Type selector. `voucherType` is
 * REQUIRED here — one screen, four documents — and only the four kinds are
 * accepted; anything else 400s before the service sees it.
 */
export class SaveStockAdjustmentHeaderDto extends SaveStockVoucherHeaderDto {
  @ApiProperty({
    enum: STOCK_ADJUSTMENT_KINDS,
    description:
      'Which of the four documents this is. A re-lot is an ADJUSTMENT carrying a RELOT_OUT / RELOT_IN pair.',
  })
  @IsIn(STOCK_ADJUSTMENT_KINDS as readonly string[], {
    message: `voucherType must be one of ${STOCK_ADJUSTMENT_KINDS.join(', ')}`,
  })
  voucherType!: StockAdjustmentKind;
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
      'The quantity, in the document unit. SIGNED only under a reason whose direction is BOTH (+ in, − out); an IN or OUT reason fixes the sign and a quantity the wrong way round is refused. Never 0.',
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
      'OUTWARD: the holding, from GET /stock/adjustment/pick-stock; omit it and the engine picks lots by the item\'s issue strategy. Required on an EXPIRY_WRITEOFF (the expiry is the lot\'s). INWARD: leave empty — the identity fields resolve the lot.',
  })
  @NullableUuid()
  lotId?: string | null;

  @ApiPropertyOptional({ enum: STOCK_BUCKETS, default: 'SALEABLE' })
  @IsIn(STOCK_BUCKETS as readonly string[])
  bucket?: StockBucket;

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
      'INWARD only, and only when the header names no rate source that derives one: what the stock is worth per document unit. An OUTWARD line is always stamped by the engine at the branch average; a keyed cost is ignored.',
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
