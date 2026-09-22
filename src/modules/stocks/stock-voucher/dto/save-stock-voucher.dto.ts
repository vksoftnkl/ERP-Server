import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, Matches, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalNumberString,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import {
  SAVEABLE_STOCK_VOUCHER_STATUSES,
  STOCK_RATE_SOURCES,
  type SaveableStockVoucherStatus,
  type StockRateSource,
} from '../types/stock-voucher.types';
import { SaveStockVoucherItemDto } from './save-stock-voucher-item.dto';

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

/**
 * The shared save payload. One per document type extends it and pins the type
 * with @IsIn — see SaveOpeningStockVoucherDto.
 *
 * THE VOUCHER TYPE IS NEVER TRUSTED FROM HERE. The controller supplies it. A
 * payload carrying `voucherType: 'TRANSFER_OUT'` on the opening route must be
 * REJECTED rather than silently honoured: a transfer posted through this route
 * would leave its stock_transit row uncreated and the receiving branch waiting
 * for a document that never arrives.
 */
export class SaveStockVoucherHeaderDto {
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
  @Matches(ACC_YEAR_PATTERN, {
    message: 'accYear must be YYYY-YYYY, e.g. 2026-2027',
  })
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

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Where stock leaves from. Required by ISSUE-shaped documents, unused by OPENING.',
  })
  @NullableUuid()
  fromGodownId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Where stock arrives. REQUIRED for OPENING — ck_svh_godowns will not catch its absence, because an ISSUE satisfies that check with fromGodown alone.',
  })
  @NullableUuid()
  toGodownId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supplierId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The branch the stock is going to. TRANSFER_OUT only — see StockVoucherTypeRules.allowsToBranch.',
  })
  @NullableUuid()
  toBranchId?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description:
      "The other side's own reference — a supplier's docket number, a branch's despatch note.",
  })
  @NullableStringStrict(100)
  partyRef?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'stock.stock_reason_master. Unused by OPENING but required by ADJUSTMENT, which is the fix path when an opening turns out to be wrong.',
  })
  @NullableUuid()
  reasonId?: string | null;

  // ── The voucher this one answers ────────────────────────────────────────
  // All four or none — ck_svh_link. Carries its own year because a transfer
  // despatched on 29 March is received on 2 April, and because an opening
  // brought over by a migration points at a document in the year before it.
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  linkSrcModule?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  linkSrcDocType?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  linkSrcDocId?: string | null;

  @ApiPropertyOptional({ minLength: 9, maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  linkSrcAccYear?: string | null;

  // ── PHYSICAL only — see StockVoucherTypeRules.allowsCount ───────────────
  @ApiPropertyOptional({
    description:
      'Freeze the stock being counted. ck_svh_freeze refuses a freeze with no window: without one the difference posted is between a count taken at 6pm and a book figure read at 8pm.',
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
      'When an offline device synced this document up. Set by the device, not the server.',
  })
  @NullableDateString()
  syncDate?: string | null;

  // ── The totals. THE SCREEN'S, not the server's ──────────────────────────
  //
  // svh_line_count / svh_total_qty / svh_total_value / svh_total_value_wot are
  // ordinary writable numeric columns, and they are now written from THIS
  // PAYLOAD. The server no longer counts the lines or sums the grid: the screen
  // already has both, and a server that re-summed could print a total the user
  // never saw.
  //
  // All four are OPTIONAL because every one is NOT NULL DEFAULT 0 in the
  // database. Omitting one on a CREATE takes that column default; omitting it
  // on an UPDATE leaves the stored value alone. There is no server-side
  // fallback that would quietly substitute a computed value for a missing one.
  //
  // NOTE FOR ANY ENVIRONMENT CARRYING THE ENGINE DDL: stock.tr_svi_refresh_header
  // re-sums these on every line write, and stock.fn_svh_recompute does it again
  // at post. The API writes them AFTER the lines so the payload wins at save
  // time, but a post will still overwrite them from the lines. Dropping that
  // trigger is a schema change, and the engine DDL is not in this repo.

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
      'Which rate the lines are valued at. On a go-live day stock_item_cost is empty, so AVG_COST and LAST_PURCHASE have nothing to read — MANUAL is the honest default for an opening.',
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

  // ── The lorry. stock_transit's, not the voucher's ────────────────────────
  //
  // §0.3 of the transfer plan, and the reason they are here rather than on a
  // despatch-only DTO: they arrive with the document that despatches, and there
  // is no other request in which the driver is standing at the counter.
  //
  // fn_svh_post_transfer NEVER SETS THEM. stt_lr_no, stt_vehicle_no and
  // stt_expected_on exist on stock_transit and nothing in the engine writes
  // them, so the API updates the transit rows itself immediately after the post
  // returns, inside the same transaction, keyed by stt_out_voucher_id — option
  // (a) of §0.3, which needs no schema change. Inter-branch only: a same-branch
  // transfer creates no transit row for them to land on.

  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description:
      'Lorry receipt number. Goes to stock_transit, not to the voucher. Inter-branch despatch only.',
  })
  @NullableStringStrict(50)
  lrNo?: string | null;

  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: 'Vehicle number. Goes to stock_transit. Inter-branch despatch only.',
  })
  @NullableStringStrict(30)
  vehicleNo?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    nullable: true,
    example: '2026-09-12',
    description:
      'When the goods are expected. stt_expected_on is a DATE, not an instant — a lorry arrives on a day.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'expectedOn must be yyyy-MM-dd' })
  expectedOn?: string | null;

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
}

export class SaveStockVoucherDto {
  @ApiProperty({ type: SaveStockVoucherHeaderDto })
  @ValidateNested()
  @Type(() => SaveStockVoucherHeaderDto)
  header!: SaveStockVoucherHeaderDto;

  @ApiProperty({
    type: SaveStockVoucherItemDto,
    isArray: true,
    description:
      'A full replace on update. Merging by row number over a grid the user can insert into is where line numbers drift, and a DRAFT has no history worth preserving.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_LINES, {
    message: `lines may not exceed ${MAX_LINES} rows in one document`,
  })
  @ValidateNested({ each: true })
  @Type(() => SaveStockVoucherItemDto)
  lines!: SaveStockVoucherItemDto[];
}
