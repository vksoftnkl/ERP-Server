import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsPositive,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  NullableDateString,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalInteger,
  OptionalNumber,
  OptionalNumberString,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
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
 * STANDALONE, NOT AN EXTENSION OF THE SHARED VOUCHER DTOs.
 *
 * `SaveStockVoucherHeaderDto` / `SaveStockVoucherItemDto` describe all eleven
 * voucher types at once, because `stock.stock_voucher` is one table and a
 * receipt, an issue, a transfer and a physical count differ in WHICH COLUMNS
 * THEY FILL rather than in shape. These two classes describe ONE of them.
 *
 * WHY NOT EXTEND AND NARROW, which is what this file used to do:
 *
 *   * class-validator MERGES a subclass's metadata with the base's, so a
 *     subclass can only ever ADD. Refusing an inherited field took an
 *     `@IsEmpty()` and a `= undefined` initializer — TS2612 demands the
 *     initializer, and `declare` is not the way out because a declare field
 *     emits no decorator metadata at all. Nine fields had grown that treatment.
 *   * Worse, a subclass CANNOT TIGHTEN. `@IsOptional()` on a base property
 *     whitelists `undefined` for EVERY validator on that property, so a
 *     `@RequiredUuid()` added downstream never fires. That is why `toGodownId`
 *     and `uomId` — neither of which an opening can be saved without — were
 *     422s from `StockVoucherService.assertPayloadRules` rather than 400s
 *     naming the field. Declared here from scratch, they are simply required.
 *
 * WHAT THIS COSTS: drift. A column added to the shared header no longer reaches
 * this route on its own — it has to be added here too. That is the trade, and
 * it is the reason the shared classes still exist for the routes that want it.
 *
 * WHAT IS ABSENT IS REFUSED, for free. The API runs with
 * `forbidNonWhitelisted`, so every property the shared DTOs carry and this one
 * omits is a 400 naming the property, with no `@IsEmpty()` anywhere:
 *
 *   header  fromGodownId  an opening is INWARD; there is no godown it came from
 *           toBranchId    only a transfer leaves the branch
 *           reasonId      a reason belongs to an ADJUSTMENT — the fix path when
 *                         an opening turns out to be wrong — not to the opening
 *           freezeStock / freezeFrom / freezeTo   only a PHYSICAL count freezes
 *           lrNo / vehicleNo / expectedOn         stock_transit columns, written
 *                         only by the transfer service. Sent here they used to
 *                         be accepted and SILENTLY DISCARDED
 *           supplierId / partyRef   an opening is the starting figure, not a
 *                         receipt from anybody; there is no counterparty to name
 *           linkSrcModule / linkSrcDocType / linkSrcDocId / linkSrcAccYear
 *                         nothing causes an opening — it is where the ledger
 *                         starts, so there is no source document to point at.
 *                         `ck_svh_link` is all-or-nothing and is satisfied by
 *                         all four being NULL
 *           syncDate      set by the device, and this route is not the offline
 *                         path
 *   line    lotId         fn_slt_resolve owns lot identity, and only at post time
 *           bookQty / countedQty   svi_diff_qty is GENERATED from the pair and is
 *                         what POSTS; on a document that counted nothing it
 *                         would post a variance nobody entered
 *           reasonId      the header has none either — nothing DECIDED an
 *                         opening, it is the starting figure. A reason belongs
 *                         to the ADJUSTMENT that corrects one
 *           syncDate      the HEADER still carries one, and a line does not
 *                         sync on its own — the document does
 *
 * The generated columns (`svi_value`, `svi_value_wot`, `svi_diff_qty`) are
 * absent from every one of these DTOs for the same reason they always were:
 * Postgres rejects any write to them, including a write of the value it would
 * itself compute.
 *
 * TWO RULES STAY IN THE SERVICE, because neither is a property of one field:
 * a line needs `qty` OR `freeQty` (a free-goods line legitimately has qty 0),
 * and `costRate` is required only when `rateSource` derives nothing — which
 * depends on the header. Both remain 422s from `assertPayloadRules`.
 */

/**
 * `YYYY-YYYY`, second year = first + 1 — ck_svh_acc_year.
 *
 * The column is `character(9)`, NOT varchar. bpchar space-pads anything shorter
 * than nine characters, and the CHECK then rejects the padded value with a
 * message that mentions neither padding nor length. So the full nine characters
 * are demanded here, where the error can say so.
 */
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * A grid this size is already a data-entry problem rather than a document; the
 * cap exists so a runaway import cannot hold a transaction — and its advisory
 * lock — open across ten thousand lines.
 */
const MAX_LINES = 2000;

export class SaveOpeningStockVoucherHeaderDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = update the existing DRAFT; absent = create.',
  })
  @OptionalUuid()
  svhId?: string;

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
    description:
      'The printed number. Generated as {typeCode}/{accYear}/{deviceCode}/{slno} when absent.',
  })
  @OptionalTrimmedString(100)
  refno?: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: "The user's own reference" })
  @NullableStringStrict(100)
  usrRefno?: string | null;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-04-01' })
  @TrimmedString(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'docDate must be yyyy-MM-dd' })
  docDate!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    nullable: true,
    description:
      'When the document was actually raised. Defaults to now() at the server. A device that numbered its own document offline should send the moment it was keyed, not the moment it synced — otherwise a week of backlog all lands at the same instant and the order the documents were raised in is lost.',
  })
  @NullableDateString()
  docDatetime?: string | null;

  /**
   * REQUIRED HERE, and this is the whole point of the standalone DTO.
   *
   * `ck_svh_godowns` will NOT catch its absence — that check is satisfied by a
   * from-godown alone, because an ISSUE has no to-godown at all — so the engine
   * would answer a not_null_violation much later. On the shared header this
   * could only ever be a 422 from `assertPayloadRules`, because the base
   * carries `@IsOptional()` and that whitelists `undefined` for every validator
   * on the property. Declared from scratch, it is a 400 naming the field.
   */
  @ApiProperty({
    format: 'uuid',
    description:
      'Where the stock arrives. REQUIRED — an opening is inward, and this is the godown it opens in.',
  })
  @RequiredUuid()
  toGodownId!: string;

  // ── The totals. THE SCREEN'S, not the server's ──────────────────────────
  //
  // All four are written from this payload verbatim; nothing counts the lines
  // or sums the grid. They are optional because every one is NOT NULL DEFAULT 0
  // — omitting one on a create takes that column default, omitting it on an
  // update leaves the stored value alone, and there is no server-side fallback
  // that would quietly substitute a computed value for a missing one.
  //
  // NOTE FOR ANY ENVIRONMENT CARRYING THE ENGINE DDL: stock.tr_svi_refresh_header
  // re-sums these on every line write and stock.fn_svh_recompute does it again
  // at post. The API writes them AFTER the lines so the payload wins at save
  // time, but a post will still overwrite them from the lines.

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'How many lines the document has, as the screen counted them. svh_line_count is NOT NULL DEFAULT 0; omit to take the default.',
  })
  @OptionalInteger(0)
  lineCount?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'The document total quantity, as the screen summed it. numeric(18,6), NOT NULL DEFAULT 0 — omit to take the default.',
  })
  @OptionalNumber(0)
  totalQty?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'The document total value, inclusive of tax, as the screen summed it. numeric(18,2), NOT NULL DEFAULT 0 — omit to take the default.',
  })
  @OptionalNumber(0)
  totalValue?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'The document total value excluding tax, as the screen summed it. numeric(18,2), NOT NULL DEFAULT 0 — omit to take the default.',
  })
  @OptionalNumber(0)
  totalValueWot?: number;

  @ApiPropertyOptional({
    enum: STOCK_RATE_SOURCES,
    nullable: true,
    description:
      'Which rate the lines are valued at. On a go-live day stock_item_cost is empty, so AVG_COST and LAST_PURCHASE have nothing to read — MANUAL is the honest default for an opening. A source that derives nothing is also what makes costRate required on every line.',
  })
  @IsOptional()
  @IsIn(STOCK_RATE_SOURCES as unknown as string[], {
    message: `rateSource must be one of ${STOCK_RATE_SOURCES.join(', ')}`,
  })
  rateSource?: StockRateSource | null;

  /**
   * WHAT THE SAVE SHOULD LEAVE THE DOCUMENT AS. Omit it and you get a DRAFT,
   * which is what every caller got before this field existed.
   *
   * 'POSTED' IS AN INSTRUCTION, NOT A COLUMN VALUE. It does not write
   * svh_status='POSTED' and stop — it saves the draft and then runs the whole
   * post inside the SAME transaction: the per-line preflight, the lots, the
   * stock_ledger rows, the stock_balance upsert and the POSTED row on
   * public.txn_status_log. Either the document is saved AND the stock moved, or
   * neither happened. That is the entire reason this is not a plain writable
   * column: a voucher that says POSTED while nothing moved is the one state
   * this module exists to prevent, and every stock report would quietly
   * disagree with it.
   *
   * A failing line therefore fails the SAVE too, with the same 422 the separate
   * post route returns. Send 'DRAFT' (or nothing) to save a document that is
   * not ready yet and post it later through /stock/opening/post.
   *
   * Only these two are accepted here. IN_TRANSIT and RECEIVED belong to the
   * transfer chain and CANCELLED is reached by cancelling, never by saving.
   */
  @ApiPropertyOptional({
    enum: SAVEABLE_STOCK_VOUCHER_STATUSES,
    default: 'DRAFT',
    description:
      "What to leave the document as. Omitted or 'DRAFT' saves a draft. 'POSTED' saves and then posts it in one transaction — preflight, lots, ledger, balance and the status trail — so a line the preflight refuses fails the save as well.",
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

  /**
   * WHO. `svh_created_by` and `svh_modified_by` are free TEXT and carry no
   * foreign key, so they take whatever the client wants the audit trail to say —
   * a user id, a till name, an import job's name.
   *
   * Each is only ever written on the step it names: a CREATE writes createdBy
   * and an UPDATE writes modifiedBy, and an update NEVER rewrites created_by.
   * Who raised a document is not something a later edit gets to change, and
   * that is the one property of these two columns worth protecting.
   *
   * Both fall back to `userId`, and then to the authenticated user from the
   * request context, so an existing caller that sends neither behaves exactly
   * as it did before.
   */
  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description:
      'Who created the document — written on a CREATE only. Falls back to userId, then to the authenticated user.',
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

  /**
   * THE VOUCHER TYPE IS NEVER TAKEN FROM THE PAYLOAD.
   *
   * The controller pins 'OPENING'. This property exists only so that a payload
   * carrying something else is REJECTED with a field-level message rather than
   * silently ignored — a client that thinks it is raising a TRANSFER_OUT
   * through this route needs to be told that it is not. Honouring it would post
   * a transfer with no stock_transit row and leave the receiving branch waiting
   * for a document that never arrives.
   */
  @ApiPropertyOptional({
    enum: ['OPENING'],
    description: 'Optional, and only ever "OPENING". The route decides the type.',
  })
  @IsOptional()
  @IsIn(['OPENING'], {
    message:
      'voucherType must be OPENING on this route. Other document types have their own routes because they write tables this one does not.',
  })
  voucherType?: 'OPENING';
}

/**
 * ONE LINE OF AN OPENING.
 *
 * THE BATCH GROUP IS KEPT AND IS NOT OPTIONAL DECORATION. `batchNo`, `mfgDate`,
 * `expiryDate`, `mrp`, `salePrice`, `serialNo` and `supplierId` are what
 * `fn_slt_resolve` builds `stock_lot` from at post time — an opening that could
 * not send them could not bring in a batch- or serial-tracked item at all, and
 * the whole StockTrackPolicy module would be unreachable from this route. They
 * are also stored AS ENTERED alongside the resolved lot, because the resolver
 * may legitimately blank a value the item's policy does not track, and losing
 * what was keyed would make the document unreadable a year later.
 *
 * `splitNo` is kept for the same order of reason: one line drawn from three
 * batches is three rows, and `ux_svi_line` is keyed on the pair.
 */
export class SaveOpeningStockVoucherItemDto {
  @ApiProperty({ minimum: 1, description: 'Position in the grid, 1-based (ck_svi_line_no)' })
  @RequiredInteger(1)
  lineNo!: number;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description:
      'A second allocation of the same line — one line drawn from three batches is three rows. Only meaningful with a batchNo (ck_svi_batch_split).',
  })
  @OptionalInteger(1)
  splitNo?: number;

  @ApiProperty({ format: 'uuid', description: 'inventory.item_master.item_id' })
  @RequiredUuid()
  itemId!: string;

  /**
   * REQUIRED HERE — the second thing the standalone DTO buys.
   *
   * `svi_uom_id` is NOT NULL and nothing fills it in server-side any more. On
   * the shared line this had to stay `@NullableUuid()` so a COUNT could omit it,
   * and its absence was a 422 from `assertPayloadRules`.
   */
  @ApiProperty({
    format: 'uuid',
    description:
      'inventory.item_unit_conversion.iuc_id — NOT item_unit_master.unit_id. The unit must belong to this item (iuc_item_id).',
  })
  @RequiredUuid()
  uomId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      "The item's base unit, also an iuc_id. REQUIRED: svi_base_uom_id is NOT NULL and is not resolved server-side — send the base unit the grid converted through.",
  })
  @RequiredUuid()
  baseUomId!: string;

  @ApiProperty({
    minimum: 0,
    exclusiveMinimum: true,
    example: 12,
    description:
      'How many base units one uomId is worth — item_unit_conversion.iuc_to_base_factor as the grid used it. REQUIRED, and must be > 0 (ck_svi_to_base_factor). numeric(18,6).',
  })
  @RequiredNumber()
  @IsPositive({ message: 'toBaseFactor must be greater than 0 (ck_svi_to_base_factor)' })
  toBaseFactor!: number;

  @ApiProperty({ format: 'uuid', description: 'inventory.godown_locations.gdl_id' })
  @RequiredUuid()
  godownId!: string;

  @ApiPropertyOptional({
    enum: STOCK_BUCKETS,
    default: 'SALEABLE',
    description: 'ck_svi_bucket. An opening can bring stock in DAMAGED or QUARANTINE.',
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
  // ── from a sign here (ck_svi_qty_sign), so none of these may be negative. ─
  @ApiPropertyOptional({
    minimum: 0,
    description:
      'In uomId, not in the base unit. A line needs a qty OR a freeQty — a free-goods line legitimately has qty 0 — so that pair is checked in the service, not here.',
  })
  @OptionalNumber(0)
  qty?: string | number;

  @ApiProperty({
    minimum: 0,
    example: 120,
    description:
      'The same quantity IN THE BASE UNIT — qty x toBaseFactor as the grid computed it. REQUIRED: svi_base_qty is NOT NULL and is not multiplied server-side. It is what svi_value is GENERATED from, so it is the number the document is actually valued on. numeric(18,6).',
  })
  @RequiredNumber(0)
  baseQty!: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Free goods, in uomId. They are stock, and they count toward the totals.',
  })
  @OptionalNumber(0)
  freeQty?: string | number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'The free quantity IN THE BASE UNIT — freeQty x toBaseFactor as the grid computed it. Omit to take the column default of 0; svi_free_base_qty is NOT NULL DEFAULT 0. Counts toward svi_value alongside baseQty. numeric(18,6).',
  })
  @OptionalNumber(0)
  freeBaseQty?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'Net weight, for goods sold or held by weight. Carried alongside the quantity rather than derived from it: a 10kg bag that actually weighs 9.7kg opens at the weight on the scale, and the conversion factor cannot know that.',
  })
  @OptionalNumber(0)
  weightQty?: string | number;

  // ── Value ───────────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    minimum: 0,
    description:
      'Cost per unit of uomId, inclusive of tax. Required in practice on an opening — it is inward, and a rateSource of MANUAL derives nothing — but that depends on the header, so it is checked in the service.',
  })
  @OptionalNumber(0)
  costRate?: string | number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'Cost excluding tax. Leave 0 — the engine derives it from taxPerc at post and writes it back (20 ÷ 1.05 = 19.047619).',
  })
  @OptionalNumber(0)
  costRateWot?: string | number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'Cost including the freight, duty and handling attributed to the line. Kept beside costRate rather than folded into it, so a valuation can answer both "what did it cost" and "what did it cost to get here".',
  })
  @OptionalNumber(0)
  landedRate?: string | number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @OptionalNumber(0)
  taxPerc?: string | number;

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

/**
 * Structurally assignable to SaveStockVoucherDto, which is what
 * StockVoucherService.save takes — every property here is either identical to
 * the shared one or a narrowing of it, and the shared properties this omits are
 * all optional there.
 */
export class SaveOpeningStockVoucherDto {
  @ApiProperty({ type: SaveOpeningStockVoucherHeaderDto })
  @ValidateNested()
  @Type(() => SaveOpeningStockVoucherHeaderDto)
  header!: SaveOpeningStockVoucherHeaderDto;

  @ApiProperty({
    type: SaveOpeningStockVoucherItemDto,
    isArray: true,
    description:
      'A full replace on update. Merging by row number over a grid the user can insert into is where line numbers drift, and a DRAFT has no history worth preserving.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_LINES, { message: `lines may not exceed ${MAX_LINES} rows in one document` })
  @ValidateNested({ each: true })
  @Type(() => SaveOpeningStockVoucherItemDto)
  lines!: SaveOpeningStockVoucherItemDto[];
}
