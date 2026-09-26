import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, Matches, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalNumberString,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import {
  SAVEABLE_STOCK_VOUCHER_STATUSES,
  STOCK_BUCKETS,
  STOCK_RATE_SOURCES,
  type SaveableStockVoucherStatus,
  type StockBucket,
  type StockRateSource,
} from '../../stock-voucher/types/stock-voucher.types';

/**
 * `YYYY-YYYY`, second year = first + 1 — ck_svh_acc_year.
 *
 * The column is `character(9)`, NOT varchar: bpchar space-pads anything shorter
 * and the CHECK then rejects the padded value with a message mentioning neither
 * padding nor length. So all nine characters are demanded here, where the error
 * can say so.
 */
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

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
 * STANDALONE, NOT AN EXTENSION OF THE SHARED VOUCHER HEADER — for the reason
 * the opening's DTO sets out at length, and one more of its own.
 *
 * This class used to extend `SaveStockVoucherHeaderDto` and refuse fifteen of
 * its properties with `@IsEmpty`. That refusal WORKED — every one was a 400 —
 * but the properties were still THERE: class-validator merges a base class's
 * metadata into the subclass, so a subclass can only ever ADD. Which meant
 *
 *   * `forbidNonWhitelisted` could never refuse them (they are whitelisted, by
 *     the base), hence the fifteen `@IsEmpty` + `= undefined` pairs, each of
 *     which TS2612 also demanded an initializer for;
 *   * they were still rendered in the /api/docs schema and in the example body,
 *     because @ApiHideProperty is a no-op at runtime — it feeds the CLI plugin,
 *     which this project does not enable — and cannot suppress an inherited
 *     property. A field documented as "NOT ACCEPTED" is still a field the
 *     client sees and sends;
 *   * a subclass cannot TIGHTEN either: `@IsOptional()` on the base whitelists
 *     `undefined` for EVERY validator on that property, so a `@RequiredUuid()`
 *     added here never fired. That is why `toGodownId` — which a count cannot
 *     be saved without — was a 422 from `assertPayloadRules` rather than a 400
 *     naming the field. Declared here from scratch, it is simply required.
 *
 * WHAT IS ABSENT IS NOW REFUSED FOR FREE, by `forbidNonWhitelisted`, with no
 * `@IsEmpty()` anywhere — and, more to the point, is no longer in the payload
 * at all:
 *
 *   fromGodownId        a count is ONE GODOWN against its own book figure, and
 *                       that godown is toGodownId. The service reads the counted
 *                       godown as `toGodownId ?? fromGodownId`, so a payload
 *                       sending both and disagreeing was a count of one godown
 *                       filed against another
 *   toBranchId          only a transfer leaves the branch
 *   supplierId          a count receives from nobody. svi_supplier_id on a
 *                       counted line is read from the HOLDING, never the header
 *   partyRef            there is no counterparty to reference
 *   linkSrcModule / linkSrcDocType / linkSrcDocId / linkSrcAccYear
 *                       nothing outside the count causes it — it is what the
 *                       shelf said. ck_svh_link is all-or-nothing and is
 *                       satisfied by all four being NULL
 *   lrNo / vehicleNo / expectedOn
 *                       stock_transit columns (stt_lr_no, stt_vehicle_no,
 *                       stt_expected_on), written only by the transfer service
 *                       after fn_svh_post_transfer. A count despatches nothing,
 *                       so there is no transit row for them to land on; sent
 *                       here they were accepted and SILENTLY DISCARDED
 *
 * WHAT THIS COSTS: drift. A column added to the shared header no longer reaches
 * this route on its own. That is the trade, and it is why the shared class
 * still exists for the routes that want every column at once.
 *
 * THE VOUCHER TYPE IS NEVER TAKEN FROM THE PAYLOAD — see the opening's DTO for
 * the whole argument. The property below exists only so a payload carrying
 * anything else is refused with a field-level message rather than ignored.
 */
export class SavePhysicalStockVoucherHeaderDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = update the existing DRAFT; absent = create.',
  })
  @OptionalUuid()
  svhId?: string;
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
  @ApiProperty({
    minLength: 9,
    maxLength: 9,
    example: '2026-2027',
    description:
      'character(9). Send all nine characters — bpchar pads, and ck_svh_acc_year rejects the padding.',
  })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' })
  accYear!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tenantId?: string | null;
  @ApiProperty({
    format: 'uuid',
    description:
      'fixed.device_master.dev_id. NOT NULL, and the number series — see stock-voucher-numbering.helper.ts.',
  })
  @RequiredUuid()
  deviceId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sessionId?: string | null;
  @ApiPropertyOptional({
    description:
      'The serial this device already assigned offline. Generated when absent; honoured verbatim when present, because the device has already printed it.',
  })
  @OptionalNumberString()
  slno?: string;
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'The printed number. Generated as PHY/{accYear}/{deviceCode}/{slno} when absent.',
  })
  @OptionalTrimmedString(100)
  refno?: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: "The user's own reference" })
  @NullableStringStrict(100)
  usrRefno?: string | null;
  @ApiProperty({ type: 'string', format: 'date', example: '2026-06-30' })
  @TrimmedString(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'docDate must be yyyy-MM-dd' })
  docDate!: string;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    nullable: true,
    description:
      'When the count was actually taken. Defaults to now() at the server. A handheld that numbered its own sheet offline should send the moment it was keyed, not the moment it synced.',
  })
  @NullableDateString()
  docDatetime?: string | null;
  /**
   * THE COUNTED GODOWN, and required — which extending could never make it.
   *
   * A count is one godown against its own book figure. `requiresToGodown` in
   * PHYSICAL_RULES still enforces it for the shared service, but the refusal
   * now happens here, naming the field, before the payload is walked.
   */
  @ApiProperty({
    format: 'uuid',
    description:
      'inventory.godown_locations.gdl_id — THE GODOWN BEING COUNTED. Every line must be in it. ck_svh_godowns will not catch its absence, because an ISSUE satisfies that check with a from-godown alone.',
  })
  @RequiredUuid()
  toGodownId!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'stock.stock_reason_master — why the variance is being accepted, for the whole sheet. A line may override it. Must be scoped to PHYSICAL, or to nothing at all.',
  })
  @NullableUuid()
  reasonId?: string | null;
  // ── The freeze window. THE COUNT IS THE ONLY TYPE THAT HAS ONE ──────────
  //
  // ck_svh_freeze refuses a freeze with no window: without one the difference
  // posted is between a count taken at 6pm and a book figure read at 8pm.
  @ApiPropertyOptional({
    description:
      'Freeze the stock being counted for the window below. Requires both freezeFrom and freezeTo — ck_svh_freeze refuses a freeze with no window.',
  })
  @OptionalBoolean()
  freezeStock?: boolean;
  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  freezeFrom?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  freezeTo?: string | null;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    nullable: true,
    description:
      'When an offline handheld synced this sheet up. Set by the device, not the server — a count is the one document routinely keyed away from the counter.',
  })
  @NullableDateString()
  syncDate?: string | null;
  // THE TOTALS ARE THE SCREEN'S, on this route as on every other: nothing
  // server-side counts the lines or sums the grid. All four are written
  // verbatim from this payload, AFTER the lines, and each is optional because
  // its column is NOT NULL DEFAULT 0 — omitting one on a create takes that
  // default, omitting it on an update leaves the stored value alone.
  //
  // WHAT THEY MEAN ON A COUNT IS THE SCREEN'S DECISION, and it is not the
  // decision an opening makes. A count sheet has two defensible totals — the
  // COUNTED figures (236 units on the shelf) and the NET VARIANCE (+1 against
  // the book) — and they are not the same number. The response DTO labels
  // these columns "the net variance", so send the variance if the screen shows
  // one figure; a screen that shows counted totals should say so in its own
  // heading rather than quietly redefining the column.
  //
  // WHICH IS WHY totalQty / totalValue / totalValueWot TAKE A NEGATIVE HERE and
  // the opening's do not: a shortage is a real net variance and the column has
  // no >= 0 constraint. lineCount is still floored at 0 — a sheet cannot have
  // fewer than no lines.
  //
  // NOTE FOR ANY ENVIRONMENT CARRYING THE ENGINE DDL, which this deployment
  // does NOT: stock.tr_svi_refresh_header re-sums these on every line write —
  // the API writes them after the lines, so the payload still wins at save
  // time — and stock.fn_svh_recompute overwrites them at post with the figures
  // read off the ledger. Here, nothing does either, so what is sent is what a
  // posted count keeps.
  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'How many lines the sheet has, as the screen counted them — including the ones that agreed with the book. svh_line_count is NOT NULL DEFAULT 0; omit to take the default.',
  })
  @OptionalInteger(0)
  lineCount?: number;
  @ApiPropertyOptional({
    default: 0,
    description:
      'The sheet total quantity, as the screen summed it. MAY BE NEGATIVE — on a count this column is read back as the net variance, and a shortage is negative. numeric(18,6), NOT NULL DEFAULT 0.',
  })
  @OptionalNumber()
  totalQty?: number;
  @ApiPropertyOptional({
    default: 0,
    description:
      'The sheet total value, inclusive of tax, as the screen summed it. May be negative — see totalQty. numeric(18,2), NOT NULL DEFAULT 0.',
  })
  @OptionalNumber()
  totalValue?: number;
  @ApiPropertyOptional({
    default: 0,
    description:
      'The sheet total value excluding tax, as the screen summed it. May be negative — see totalQty. numeric(18,2), NOT NULL DEFAULT 0.',
  })
  @OptionalNumber()
  totalValueWot?: number;
  @ApiPropertyOptional({
    enum: STOCK_RATE_SOURCES,
    nullable: true,
    description:
      'Which rate the OVERAGE side is valued at; defaults to AVG_COST. A shortage is never valued from the document — fn_sml_cost_default relieves it at what the stock cost us, stamped from the item valuation policy, never by the counter.',
  })
  @IsOptional()
  @IsIn(STOCK_RATE_SOURCES as unknown as string[], {
    message: `rateSource must be one of ${STOCK_RATE_SOURCES.join(', ')}`,
  })
  rateSource?: StockRateSource | null;
  @ApiPropertyOptional({
    enum: SAVEABLE_STOCK_VOUCHER_STATUSES,
    default: 'DRAFT',
    description:
      "What to leave the sheet as. Omitted or 'DRAFT' saves a draft. 'POSTED' saves and then posts it in one transaction — preflight, lots, ledger, balance and the status trail — so a line the preflight refuses fails the save as well.",
  })
  @IsOptional()
  @IsIn(SAVEABLE_STOCK_VOUCHER_STATUSES as unknown as string[], {
    message: `status must be one of ${SAVEABLE_STOCK_VOUCHER_STATUSES.join(', ')} — a document is cancelled by cancelling it, never by saving`,
  })
  status?: SaveableStockVoucherStatus;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Falls back to the authenticated user from the request context.',
  })
  @OptionalUuid()
  userId?: string;
  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description:
      'Who created the sheet — written on a CREATE only. Falls back to userId, then to the authenticated user.',
  })
  @NullableStringStrict(100)
  createdBy?: string | null;
  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description:
      'Who last changed it — written on an UPDATE only, and never overwrites created_by. Falls back to userId, then to the authenticated user.',
  })
  @NullableStringStrict(100)
  modifiedBy?: string | null;
}
/**
 * A NARROWER SHAPE than SaveStockVoucherDto, which is what
 * StockVoucherService.save takes — narrower on both halves now that the header
 * is standalone too, so the controller widens it with a cast at the call. The
 * service reads only what a count fills in: every property omitted here is one
 * it would have written as NULL, or one it overwrites at post.
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
