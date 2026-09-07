import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  NullableDateString,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalInteger,
  OptionalNumber,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import { STOCK_BUCKETS, type StockBucket } from '../types/stock-voucher.types';

/**
 * One line of a stock voucher, as the SCREEN sends it.
 *
 * Deliberately NOT the shape of stock_voucher_item. Four groups of columns are
 * absent because the client is not allowed to decide them:
 *
 *   * svi_to_base_factor / svi_base_qty / svi_free_base_qty — read from
 *     inventory.item_unit_conversion and multiplied server-side. A factor from
 *     the payload multiplies the opening quantity of an entire branch by
 *     whatever the client felt like.
 *   * svi_value / svi_value_wot / svi_diff_qty — GENERATED ALWAYS ... STORED.
 *     Postgres rejects any write to them.
 *   * svi_lot_id — fn_slt_resolve owns lot identity, and only at post time.
 *   * svi_company_id / _branch_id / _acc_year / _tenant_id — copied from the
 *     header, so a line can never be filed under a different scope than the
 *     document it belongs to.
 */
export class SaveStockVoucherItemDto {
  @ApiProperty({ minimum: 1, description: 'Position in the grid, 1-based (ck_svi_line_no)' })
  @RequiredInteger()
  lineNo!: number;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description:
      'A second allocation of the same line — one line drawn from three batches is three rows. Only meaningful with a batchNo (ck_svi_batch_split).',
  })
  @OptionalInteger()
  splitNo?: number;

  @ApiProperty({ format: 'uuid', description: 'inventory.item_master.item_id' })
  @RequiredUuid()
  itemId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'inventory.item_unit_conversion.iuc_id — NOT item_unit_master.unit_id. The unit must belong to this item (iuc_item_id).',
  })
  @RequiredUuid()
  uomId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The item's base unit, also an iuc_id. Resolved server-side from item_unit_conversion when omitted.",
  })
  @NullableUuid()
  baseUomId?: string | null;

  @ApiProperty({ format: 'uuid', description: 'inventory.godown_locations.gdl_id' })
  @RequiredUuid()
  godownId!: string;

  @ApiPropertyOptional({
    enum: STOCK_BUCKETS,
    default: 'SALEABLE',
    description: 'ck_svi_bucket',
  })
  @IsOptional()
  @IsIn(STOCK_BUCKETS as unknown as string[], {
    message: `bucket must be one of ${STOCK_BUCKETS.join(', ')}`,
  })
  bucket?: StockBucket;

  // ── As entered. Kept verbatim even when the item's track policy does not ──
  // ── track them: a reprint must show what was keyed. ──────────────────────
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
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
  mrp?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  salePrice?: string | number | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  serialNo?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supplierId?: string | null;

  // ── Quantity. MAGNITUDES — direction comes from the voucher type, never ──
  // ── from a sign here (ck_svi_qty_sign). ─────────────────────────────────
  @ApiProperty({ description: 'In uomId, not in the base unit. Must not be negative.' })
  @RequiredNumber()
  qty!: string | number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Free goods, in uomId. They are stock, and they count toward the totals.',
  })
  @OptionalNumber()
  freeQty?: string | number;

  // ── Value ───────────────────────────────────────────────────────────────
  @ApiProperty({ description: 'Cost per unit of uomId, inclusive of tax.' })
  @RequiredNumber()
  costRate!: string | number;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Cost excluding tax. Leave 0 — the engine derives it from taxPerc at post and writes it back (20 ÷ 1.05 = 19.047619).',
  })
  @OptionalNumber()
  costRateWot?: string | number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber()
  taxPerc?: string | number;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;
}
