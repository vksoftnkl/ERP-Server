import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmpty, IsIn, IsOptional, ValidateNested } from 'class-validator';
import {
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalInteger,
  RequiredInteger,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
import { STOCK_BUCKETS, type StockBucket } from '../../stock-voucher/types/stock-voucher.types';

/** As for the opening — a grid this size is a data-entry problem, not a document. */
const MAX_LINES = 2000;

/**
 * ONE LINE OF A COUNT SHEET — a NARROWER DTO than the shared one, deliberately,
 * and not an extension of it.
 *
 * Eleven properties the shared line carries are absent here, and every one of
 * them is a property of the HOLDING this line already names by `lotId`:
 *
 *   qty, freeQty, weightQty, costRate, costRateWot, landedRate, taxPerc,
 *   uomId, baseUomId, batchNo, mfgDate, expiryDate, mrp, salePrice, serialNo,
 *   supplierId, barcode, bookQty
 *
 * The server reads all of them from `stock_balance` / `stock_lot` at save time
 * (§5.2). A count sheet with a client-supplied batch number is a count sheet
 * that can be pointed at the wrong lot, and a client-supplied book quantity
 * turns a variance into a wish.
 *
 * Because the API runs with `forbidNonWhitelisted`, sending any of them is a
 * 400 naming the property — which is the point of writing this DTO standalone
 * rather than extending the shared one and documenting eleven fields the API
 * refuses.
 *
 * WHAT IS LEFT IS ONE NUMBER PER LINE: `countedQty`.
 */
export class SavePhysicalStockVoucherItemDto {
  @ApiProperty({
    minimum: 1,
    description: 'Position on the sheet, 1-based. Assigned by GET /stock/physical/count-sheet.',
  })
  @RequiredInteger()
  lineNo!: number;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description: 'Always 1 on a generated sheet: one line already means one holding.',
  })
  @OptionalInteger()
  splitNo?: number;

  @ApiProperty({
    format: 'uuid',
    description: 'inventory.item_master.item_id, from the count sheet.',
  })
  @RequiredUuid()
  itemId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'inventory.godown_locations.gdl_id. Must equal the godown the header names — a count is per godown.',
  })
  @RequiredUuid()
  godownId!: string;

  @ApiPropertyOptional({
    enum: STOCK_BUCKETS,
    default: 'SALEABLE',
    description: 'Part of the holding key, from the count sheet.',
  })
  @IsOptional()
  @IsIn(STOCK_BUCKETS as unknown as string[], {
    message: `bucket must be one of ${STOCK_BUCKETS.join(', ')}`,
  })
  bucket?: StockBucket;

  @ApiProperty({
    format: 'uuid',
    description:
      'stock.stock_lot.slt_id — THE HOLDING THIS LINE IS ABOUT, taken verbatim from the count sheet.\n\n' +
      'Required, and the one place a count breaks the rule that the engine owns lot identity: the lot is WHERE THE BOOK FIGURE CAME FROM. A count line is generated from a stock_balance row, which is keyed by sbl_lot_id, and fn_svh_post uses it as given rather than resolving a new one. A lot with no live balance row in this godown is a 422 telling you to regenerate the sheet — which is also what happens when someone sells the last of a lot mid-count.',
  })
  @RequiredUuid()
  lotId!: string;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    description:
      'WHAT WAS FOUND ON THE SHELF — the one number the operator types.\n\n' +
      'A magnitude: only the derived svi_diff_qty (counted − book, GENERATED) is signed. Send 0 to record that nothing was found.\n\n' +
      'ABSENT IS NOT "0 FOUND", IT IS NOT COUNTED YET, and it is refused with a 422 naming the line. Declared optional here rather than required so that refusal carries that sentence instead of a bare field error: posting an uncounted line as a total shortage is the single most expensive mistake this screen can make.',
  })
  @NullableNumber(0)
  countedQty?: string | number | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'stock.stock_reason_master — overrides the header reason for the one pallet that was damaged rather than shrunk. Must be scoped to PHYSICAL, or to nothing at all.',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;
}

/**
 * THE VOUCHER TYPE IS NEVER TAKEN FROM THE PAYLOAD — see the opening's DTO for
 * the whole argument. This property exists only so a payload carrying anything
 * else is refused with a field-level message rather than silently ignored.
 *
 * `toGodownId` is not re-declared required here for the same class-validator
 * reason the opening documents: @IsOptional() on the base whitelists undefined
 * for every validator on the property, so a @RequiredUuid() added here would
 * never fire. The requirement lives in assertPayloadRules, driven off
 * StockVoucherTypeRules.requiresToGodown.
 */
export class SavePhysicalStockVoucherHeaderDto extends SaveStockVoucherHeaderDto {
  @ApiPropertyOptional({
    enum: ['PHYSICAL'],
    description: 'Optional, and only ever "PHYSICAL". The route decides the type.',
  })
  @IsOptional()
  @IsIn(['PHYSICAL'], {
    message:
      'voucherType must be PHYSICAL on this route. Other document types have their own routes because they state a quantity to move rather than what was found.',
  })
  voucherType?: 'PHYSICAL';

  /**
   * THE FOUR HEADER TOTALS ARE STILL REFUSED ON A COUNT.
   *
   * The shared header now takes svh_line_count / svh_total_qty /
   * svh_total_value / svh_total_value_wot straight from the payload, because on
   * a QTY document the screen has summed the grid and the server no longer
   * does. A COUNT is not that document: its header carries the NET VARIANCE,
   * read off the LEDGER by fn_svh_recompute at post, and three lines totalling
   * 236 counted units can total +1 there. Nothing the counter can see adds up
   * to it, so a client-supplied total here is a number that will be silently
   * replaced — better a 400 naming the property.
   *
   * Re-declared with @IsEmpty rather than left to `forbidNonWhitelisted`:
   * inheriting from SaveStockVoucherHeaderDto whitelists all four, so the pipe
   * would now accept them. See physical-stock-voucher.dto.spec.ts.
   */
  // @ApiHideProperty is a no-op at runtime — it exists for the CLI plugin
  // only, and cannot suppress a property inherited from the base schema. So
  // the refusal is DOCUMENTED instead of hidden, which is the more useful of
  // the two for anyone reading /api/docs.
  @ApiPropertyOptional({
    description:
      'NOT ACCEPTED on a count — sending it is a 400. Inherited from the shared header, where it is the screen\'s own total. A count header carries the NET VARIANCE, read off the ledger by fn_svh_recompute at post, and nothing on the count sheet adds up to it.',
  })
  @IsEmpty({
    message:
      'lineCount is not accepted on a count. The header carries the net variance, read off the ledger at post.',
  })
  lineCount?: undefined = undefined;

  // @ApiHideProperty is a no-op at runtime — it exists for the CLI plugin
  // only, and cannot suppress a property inherited from the base schema. So
  // the refusal is DOCUMENTED instead of hidden, which is the more useful of
  // the two for anyone reading /api/docs.
  @ApiPropertyOptional({
    description:
      'NOT ACCEPTED on a count — sending it is a 400. Inherited from the shared header, where it is the screen\'s own total. A count header carries the NET VARIANCE, read off the ledger by fn_svh_recompute at post, and nothing on the count sheet adds up to it.',
  })
  @IsEmpty({
    message:
      'totalQty is not accepted on a count. The header carries the net variance, read off the ledger at post.',
  })
  totalQty?: undefined = undefined;

  // @ApiHideProperty is a no-op at runtime — it exists for the CLI plugin
  // only, and cannot suppress a property inherited from the base schema. So
  // the refusal is DOCUMENTED instead of hidden, which is the more useful of
  // the two for anyone reading /api/docs.
  @ApiPropertyOptional({
    description:
      'NOT ACCEPTED on a count — sending it is a 400. Inherited from the shared header, where it is the screen\'s own total. A count header carries the NET VARIANCE, read off the ledger by fn_svh_recompute at post, and nothing on the count sheet adds up to it.',
  })
  @IsEmpty({
    message:
      'totalValue is not accepted on a count. The header carries the net variance, read off the ledger at post.',
  })
  totalValue?: undefined = undefined;

  // @ApiHideProperty is a no-op at runtime — it exists for the CLI plugin
  // only, and cannot suppress a property inherited from the base schema. So
  // the refusal is DOCUMENTED instead of hidden, which is the more useful of
  // the two for anyone reading /api/docs.
  @ApiPropertyOptional({
    description:
      'NOT ACCEPTED on a count — sending it is a 400. Inherited from the shared header, where it is the screen\'s own total. A count header carries the NET VARIANCE, read off the ledger by fn_svh_recompute at post, and nothing on the count sheet adds up to it.',
  })
  @IsEmpty({
    message:
      'totalValueWot is not accepted on a count. The header carries the net variance, read off the ledger at post.',
  })
  totalValueWot?: undefined = undefined;
}

/**
 * Structurally assignable to SaveStockVoucherDto, which is what
 * StockVoucherService.save takes — the three shared line properties this one
 * omits (`uomId`, `qty`, `costRate`) are optional there precisely so a count
 * can leave them out.
 */
export class SavePhysicalStockVoucherDto {
  @ApiProperty({ type: SavePhysicalStockVoucherHeaderDto })
  @ValidateNested()
  @Type(() => SavePhysicalStockVoucherHeaderDto)
  header!: SavePhysicalStockVoucherHeaderDto;

  @ApiProperty({
    type: SavePhysicalStockVoucherItemDto,
    isArray: true,
    description:
      'A full replace on update. NOTE that a re-save also refreshes every svi_book_qty from the current balance — right for a sheet still being filled in, and worth a confirmation on one being re-counted.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_LINES, { message: `lines may not exceed ${MAX_LINES} rows in one document` })
  @ValidateNested({ each: true })
  @Type(() => SavePhysicalStockVoucherItemDto)
  lines!: SavePhysicalStockVoucherItemDto[];
}
