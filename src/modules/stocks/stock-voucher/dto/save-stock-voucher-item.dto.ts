import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsPositive } from 'class-validator';
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
 * Deliberately NOT the shape of stock_voucher_item. Three groups of columns are
 * absent because the client is not allowed to decide them:
 *
 *   * svi_value / svi_value_wot / svi_diff_qty — GENERATED ALWAYS ... STORED.
 *     Postgres rejects any write to them.
 *   * svi_lot_id — fn_slt_resolve owns lot identity, and only at post time.
 *     A COUNT is the exception, and the one place that rule bends: its line
 *     comes from a count sheet that already names the holding whose book
 *     figure it is reconciling.
 *   * svi_company_id / _branch_id / _acc_year / _tenant_id — copied from the
 *     header, so a line can never be filed under a different scope than the
 *     document it belongs to.
 *
 * THE UNIT CONVERSION IS THE CLIENT'S TO STATE. `baseUomId`, `toBaseFactor`
 * and `baseQty` / `freeBaseQty` used to be read from
 * inventory.item_unit_conversion and multiplied server-side; they are now taken
 * verbatim from this payload and written straight through. The screen already
 * holds the conversion it priced the line with, and a server that re-derived it
 * could disagree with the number the user was looking at. Nothing on the save
 * path reads item_unit_conversion any more, so nothing cross-checks that the
 * unit belongs to the item either — fk_svi_uom and fk_svi_base_uom still refuse
 * an iuc_id that does not exist, and ck_svi_to_base_factor still refuses a
 * factor <= 0, but "this unit belongs to a different item" is now the client's
 * to get right.
 *
 * THREE PROPERTIES ARE OPTIONAL HERE AND REQUIRED IN PRACTICE — `uomId`, `qty`
 * and `costRate`. They are required on all ten QTY document types and refused
 * on the eleventh: a PHYSICAL count states what was FOUND, in the base unit the
 * book figure is held in, valued by the engine in both directions. This DTO is
 * SHARED, so a property that one type must omit cannot be declared required on
 * it; the requirement lives in StockVoucherService.assertPayloadRules instead,
 * where it is answered as a 422 beside every other per-line problem rather than
 * one field error at a time. The physical route's own line DTO omits all three
 * outright, so `forbidNonWhitelisted` turns a client that sends one into a 400.
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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'inventory.item_unit_conversion.iuc_id — NOT item_unit_master.unit_id. The unit must belong to this item (iuc_item_id).\n\n' +
      'REQUIRED on every QTY document, and refused on a COUNT: a count line names no unit, because the book figure it is measured against is held in the base unit and is read from the balance row with factor 1. Declared optional here only so the one type that must omit it can, and enforced instead in StockVoucherService.assertPayloadRules, which answers 422 alongside every other per-line problem.',
  })
  @NullableUuid()
  uomId?: string;

  @ApiProperty({
    format: 'uuid',
    description:
      "The item's base unit, also an iuc_id — NOT item_unit_master.unit_id.\n\n" +
      'REQUIRED: svi_base_uom_id is NOT NULL and is no longer resolved server-side. Send the base unit the grid converted through; the server writes it verbatim.',
  })
  @RequiredUuid()
  baseUomId!: string;

  @ApiProperty({
    minimum: 0,
    exclusiveMinimum: true,
    example: 12,
    description:
      'How many base units one uomId is worth — item_unit_conversion.iuc_to_base_factor as the grid used it.\n\n' +
      'REQUIRED: svi_to_base_factor is NOT NULL and is no longer read from item_unit_conversion. Must be > 0 (ck_svi_to_base_factor). numeric(18,6).',
  })
  @RequiredNumber()
  @IsPositive({ message: 'toBaseFactor must be greater than 0 (ck_svi_to_base_factor)' })
  toBaseFactor!: number;

  @ApiProperty({ format: 'uuid', description: 'inventory.godown_locations.gdl_id' })
  @RequiredUuid()
  godownId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The holding this line is about. REQUIRED, REFUSED or IGNORED depending on the document type — see StockVoucherTypeRules.requiresLot.\n\n' +
      'REQUIRED on a TRANSFER (both halves): a transfer MOVES existing stock, so the destination must receive the same slt_id or ageing resets. The grid is loaded from stock_balance, which carries it.\n\n' +
      'REQUIRED on a COUNT: the line comes from a count sheet that already names the lot its book figure was read from.\n\n' +
      'REFUSED on an OPENING and every other QTY document: fn_slt_resolve owns lot identity there, and a client-chosen lot would let two documents open the same holding under two different lots.',
  })
  @NullableUuid()
  lotId?: string | null;

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
  @ApiPropertyOptional({
    nullable: true,
    description:
      'What the scanner read, verbatim. Never resolved server-side — itemId, batchNo and serialNo are what identify the line, and a barcode that disagrees with them does not override them. Stored so a reprint can show the symbol actually scanned.',
  })
  @NullableStringStrict()
  barcode?: string | null;

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
  @ApiPropertyOptional({
    description:
      'In uomId, not in the base unit. Must not be negative.\n\n' +
      'REQUIRED on every QTY document; absent — or 0 — on a COUNT, whose lines state what was FOUND rather than a quantity to move. Optional here for that one type; a QTY line without it is refused by assertPayloadRules as "has no quantity".',
  })
  @OptionalNumber()
  qty?: string | number;

  @ApiProperty({
    minimum: 0,
    example: 120,
    description:
      'The same quantity IN THE BASE UNIT — qty x toBaseFactor as the grid computed it.\n\n' +
      'REQUIRED: svi_base_qty is NOT NULL and is no longer multiplied server-side. It is what svi_value is GENERATED from, so it is the number the document is actually valued on. Must not be negative (ck_svi_qty_sign). numeric(18,6).',
  })
  @RequiredNumber(0)
  baseQty!: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Free goods, in uomId. They are stock, and they count toward the totals.',
  })
  @OptionalNumber()
  freeQty?: string | number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'The free quantity IN THE BASE UNIT — freeQty x toBaseFactor as the grid computed it. No longer multiplied server-side.\n\n' +
      'Omit to take the column default of 0; svi_free_base_qty is NOT NULL DEFAULT 0. Counts toward svi_value alongside baseQty. Must not be negative (ck_svi_qty_sign). numeric(18,6).',
  })
  @OptionalNumber(0)
  freeBaseQty?: number;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Net weight, for goods sold or held by weight. Carried alongside the quantity rather than derived from it: a 10kg bag that actually weighs 9.7kg opens at the weight on the scale, and the conversion factor cannot know that.',
  })
  @OptionalNumber()
  weightQty?: string | number;

  // ── PHYSICAL count only — see StockVoucherTypeRules.allowsCount ─────────
  @ApiPropertyOptional({
    nullable: true,
    description: 'What the system thought was on the shelf. PHYSICAL only.',
  })
  @NullableNumber()
  bookQty?: string | number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'What was actually on the shelf. PHYSICAL only. The variance (svi_diff_qty) is GENERATED from these two and cannot be sent — storing only the difference makes it impossible to defend a year later, and storing it generated makes it impossible to fudge.',
  })
  @NullableNumber()
  countedQty?: string | number | null;

  // ── Value ───────────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    description:
      'Cost per unit of uomId, inclusive of tax.\n\n' +
      "Absent on a COUNT: an overage is valued from the document's rate source and a shortage at what the stock cost us, stamped by fn_sml_cost_default from the item's valuation policy — never by the counter.",
  })
  @OptionalNumber()
  costRate?: string | number;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Cost excluding tax. Leave 0 — the engine derives it from taxPerc at post and writes it back (20 ÷ 1.05 = 19.047619).',
  })
  @OptionalNumber()
  costRateWot?: string | number;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Cost including the freight, duty and handling attributed to the line. Kept beside costRate rather than folded into it, so a valuation can answer both "what did it cost" and "what did it cost to get here".',
  })
  @OptionalNumber()
  landedRate?: string | number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber()
  taxPerc?: string | number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'stock.stock_reason_master, per line — a document can be raised for one reason and a single line adjusted for another.',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    nullable: true,
    description: 'When an offline device synced this line up.',
  })
  @NullableDateString()
  syncDate?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;

  /**
   * WHO, per line. Both fall back to the header's createdBy / modifiedBy and
   * then to the resolved actor, so a grid that does not track this per row can
   * ignore them entirely.
   *
   * A save REPLACES the lines rather than merging them (see the service), so
   * every line of an updated document is inserted afresh and takes createdBy
   * from this save. modifiedBy is written only when something actually supplies
   * it — a created line with a modified_by would claim an edit that never
   * happened.
   */
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  createdBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  modifiedBy?: string | null;
}
