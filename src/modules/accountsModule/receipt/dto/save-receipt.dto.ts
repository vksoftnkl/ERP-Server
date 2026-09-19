import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableString,
  OptionalBoolean,
  OptionalDateString,
  OptionalNumber,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { DrCr, VoucherDeviceType } from '../types/receipt-enum';
import { PostReceiptAllocationDto, PostReceiptCreditDto, ReceiptKeysDto } from './post-receipt.dto';

/**
 * §4.3 — `POST /receipts/create`, the DRAFT.
 *
 * Upsert on `avhVoucherId`: send one to edit that draft, omit it to start a new
 * one. A POSTED receipt is NOT editable here — money on a posted receipt is
 * changed by cancel-and-re-enter (R3), and `/receipts/update-header` is the
 * only thing that may touch a posted one.
 *
 * What a draft writes: the header (DRAFT, no number), the tender rows
 * (`td_voucher_id` NULL), and the other-ledger lines into `avh_draft_lines`.
 * What it does NOT write: a single row on any bill table, and not one voucher
 * leg (R10).
 */

/** The cheque detail that does not fit on a tender row. */
export class SaveReceiptChequeDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  bankBranch?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 11, example: 'KVBL0001234' })
  @NullableString(11)
  ifsc?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 9 })
  @NullableString(9)
  micr?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 150, example: 'Sri Krishna Traders' })
  @NullableString(150)
  drawerName?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The bank the cheque will be banked into. Null until the deposit is decided.',
  })
  @OptionalUuid()
  bankLedgerId?: string | null;
}

/**
 * One tender row. The `td*` names are identical to `/bills/create` on purpose
 * (§8 rule 1) — the same screen widget builds both.
 */
export class SaveReceiptTenderDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update that row.' })
  @OptionalUuid()
  tdId?: string;

  @ApiProperty({ minimum: 1, example: 1 })
  @RequiredInteger(1)
  tdRowNo!: number;

  @ApiProperty({ format: 'uuid', description: 'accounts.acc_tender_master.tnd_id.' })
  @RequiredUuid()
  tdTenderId!: string;

  @ApiProperty({
    example: 5,
    description:
      'accounts.acc_tender_types.ttm_type_id. Checked against the master — a row claiming a type ' +
      'its tender does not have is refused rather than silently corrected.',
  })
  @RequiredInteger(1)
  tdTenderTypeId!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The ledger the money lands in. A SNAPSHOT of the tender master unless tnd_edit_ledger is ' +
      "set, in which case this is honoured. Omit it and the server takes the master's.",
  })
  @OptionalUuid()
  tdTenderLedgerId?: string;

  @ApiProperty({ example: 5000, minimum: 0, description: 'The face value. Must be > 0.' })
  @RequiredNumber(0)
  tdAmount!: number;

  @ApiPropertyOptional({
    example: 5000,
    minimum: 0,
    description: 'Cash only. received − change must equal tdAmount (ck_td_cash_change).',
  })
  @OptionalNumber(0)
  tdReceivedAmt?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @OptionalNumber(0)
  tdChangeAmt?: number;

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    description:
      "The acquirer's cut, which never reaches the bank. The server seeds a BANK_CHARGES " +
      'other-line from it if the client did not, and refuses one that disagrees.',
  })
  @OptionalNumber(0)
  tdMdrAmt?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'What the CUSTOMER was charged for paying this way — income, and not the same figure as ' +
      'tdMdrAmt. Taken from the master unless tnd_edit_surcharge is set.',
  })
  @OptionalNumber(0)
  tdSurchargePerc?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @OptionalNumber(0)
  tdSurchargeAmt?: number;

  @ApiPropertyOptional({ nullable: true, maxLength: 100, example: '445123' })
  @NullableString(100)
  tdRefNo?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @NullableString(50)
  tdAuthCode?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 4, example: '4242' })
  @NullableString(4)
  tdCardLast4?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 150, example: 'KVB' })
  @NullableString(150)
  tdBankName?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  tdPayerVpa?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-09-20',
    description:
      'The date on the instrument. REQUIRED on a cheque. Later than the receipt date makes it ' +
      'post-dated, which gives it a voucher of its own dated this day (R2).',
  })
  @NullableDateString()
  tdInstrumentDate?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @NullableString(250)
  tdNotes?: string | null;

  @ApiPropertyOptional({
    type: () => SaveReceiptChequeDto,
    description: 'Cheque detail. Ignored on a non-cheque row.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveReceiptChequeDto)
  cheque?: SaveReceiptChequeDto;

  // tdIsPdc is NEVER sent. It is computed from tdInstrumentDate against the
  // receipt date, and a client-supplied value could disagree with the voucher
  // the server then builds.
}

/**
 * One other-ledger line — the band that makes TDS, a claim, bank charges,
 * surcharge and interest ordinary rows instead of five fixed header fields (R8).
 *
 * Give it either a `role` (resolved through `acc_ledger_map`, which is how
 * every report finds it again) or a `ledgerId` the operator picked. A role is
 * always better: a free ledger posts with `av_role` NULL and is invisible to
 * every role-based report.
 */
export class SaveReceiptOtherLineDto {
  @ApiPropertyOptional({
    example: 'TDS_RECEIVABLE',
    description:
      'accounts.acc_ledger_role.alr_role. One of TDS_RECEIVABLE, BANK_CHARGES, ' +
      'SURCHARGE_RECOVERED, CLAIMS_ALLOWED, INTEREST_INCOME, TCS_PAYABLE.',
  })
  @IsOptional()
  @UpperMaxString(30)
  role?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'A ledger chosen by hand, when no role fits. Must be live, visible to the company, and NOT ' +
      'the party — a line pointing at the party would settle their bill with their own balance.',
  })
  @OptionalUuid()
  ledgerId?: string;

  @ApiProperty({
    enum: DrCr,
    description:
      'Checked against the role: an expense or asset is DR, income and a tax payable are CR. A ' +
      'line claiming the wrong side is refused rather than silently unbalancing the voucher.',
  })
  @IsIn(Object.values(DrCr))
  drCr!: DrCr;

  @ApiProperty({ example: 700, minimum: 0 })
  @RequiredNumber(0)
  amount!: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Does this line REDUCE what the party owes on a bill? True for TDS and a claim — the bill ' +
      'closes for its full face and the withheld part goes to a ledger. False for a line that is ' +
      'merely part of the money moving; it then flows to on account instead of settling anything. ' +
      'A CR line never settles and the flag is ignored on one.',
  })
  @OptionalBoolean()
  settlesBill?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 250, example: 'damage claim CN-88' })
  @NullableString(250)
  narration?: string | null;
}

export class SaveReceiptDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = edit that DRAFT. A POSTED receipt is refused here (R3).',
  })
  @OptionalUuid()
  avhVoucherId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  avhCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  avhBranchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  avhAccYear!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  avhTenantId?: string | null;

  @ApiProperty({ example: '2026-09-14', description: 'Must fall in an OPEN, unlocked year.' })
  @UpperMaxString(10)
  avhVoucherDate!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The party — a customer id, a supplier id or a ledger id, which are all the same value. ' +
      'Any live ledger the company can see is accepted (R5); one holding no bills simply gets an ' +
      'empty panel.',
  })
  @RequiredUuid()
  avhPartyId!: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Collected by (R6). An ARRAY because avh_employee_id is one, but a receipt names ONE ' +
      'salesman; more than one is refused. Mandatory when accounts.receipt_salesman_mandatory is on.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  avhEmployeeId?: string[];

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  avhUsrRefno?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 100,
    description:
      "The party's own reference. Unique per company/party/type/year (ux_avh_doc_refno).",
  })
  @NullableString(100)
  avhDocRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-14' })
  @NullableDateString()
  avhDocDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(2000)
  avhRemarks?: string | null;

  @ApiPropertyOptional({ enum: VoucherDeviceType })
  @IsOptional()
  @IsIn(Object.values(VoucherDeviceType))
  avhDeviceType?: VoucherDeviceType;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(250)
  avhDeviceId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  avhSessionId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Falls back to the authenticated user when omitted.',
  })
  @OptionalUuid()
  avhUserId?: string;

  @ApiProperty({ type: () => SaveReceiptTenderDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaveReceiptTenderDto)
  tenders!: SaveReceiptTenderDto[];

  @ApiPropertyOptional({ type: () => SaveReceiptOtherLineDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SaveReceiptOtherLineDto)
  otherLines?: SaveReceiptOtherLineDto[];

  @ApiPropertyOptional({
    default: true,
    description:
      'true — the default — means the arrays ARE the document: a tender row left out is removed. ' +
      'false leaves rows the payload did not mention alone.',
  })
  @OptionalBoolean()
  replace?: boolean;

  // avhDocAmount is not accepted: it is Σ tdAmount and is derived (§12).
}

/**
 * What `POST /receipts/create` actually takes: everything a draft is, plus the
 * bill-wise settlement the operator had arranged when they saved it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS IS A SUBCLASS AND NOT TWO MORE FIELDS ON SaveReceiptDto
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `AmendReceiptDto extends SaveReceiptDto` and re-declares `allocations` as
 * REQUIRED. Adding an optional `allocations` to the base would collide with
 * that (TS2612), and the two ways out of TS2612 are both traps this module has
 * already been bitten by: `declare` silently strips every decorator, and an
 * initializer would quietly turn a dropped `allocations` array on an amend
 * into "settle nothing, hold it all on account".
 *
 * The split is also honest rather than merely convenient. **The two arrays
 * mean different things on the two routes.** On `/post` and `/amend` an
 * allocation is an INSTRUCTION, checked to the paisa and refused on a
 * mismatch. Here it is a NOTE — what the operator had arranged when they
 * walked away — and it is neither checked nor applied.
 */
export class SaveDraftReceiptDto extends SaveReceiptDto {
  @ApiPropertyOptional({
    type: () => PostReceiptAllocationDto,
    isArray: true,
    description:
      'The bill-wise settlement as the operator left it, REMEMBERED so reopening the draft does ' +
      'not lose it. Same shape /receipts/post takes.\n\n' +
      '**Nothing is applied.** No acc_bill_adjustment row is written and no abl_pending_amount ' +
      'moves (R10) — a draft still touches no bill, which is what lets two people hold drafts ' +
      "against the same party without reserving each other's outstanding.\n\n" +
      '**Nothing is validated.** A remembered figure can go stale between saving and reopening ' +
      'if somebody else settles the same bill, and it is handed back exactly as it was stored. ' +
      'Re-read /receipts/open-items on reopen and clamp each figure to what the bill can still ' +
      'take — refusing the load here would cost the whole draft to save one number.\n\n' +
      'OMIT the key to leave whatever is already remembered alone; send `[]` to clear it. A ' +
      'client that has never heard of this field cannot wipe it.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptAllocationDto)
  allocations?: PostReceiptAllocationDto[];

  @ApiPropertyOptional({
    type: () => PostReceiptCreditDto,
    isArray: true,
    description:
      'The credits the operator had ticked, remembered on the same terms as `allocations` — not ' +
      'applied, not validated, and omitted rather than emptied to leave them alone.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptCreditDto)
  creditsApplied?: PostReceiptCreditDto[];
}

/**
 * §4.7 — `PUT /receipts/update-header`, the optional seventh route.
 *
 * Takes the four keys and the four editable fields. Nothing else is accepted,
 * and a body carrying anything else is a 400 rather than a silent ignore: a
 * client that believes it changed the money must be told that it did not.
 */
export class UpdateReceiptHeaderDto extends ReceiptKeysDto {
  @ApiPropertyOptional({ nullable: true })
  @NullableString(2000)
  avhRemarks?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  avhUsrRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  avhDocRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-14' })
  @NullableDateString()
  avhDocDate?: string | null;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Collected by (R6). **One id, exactly as /receipts/create requires** — the column is an ' +
      "array because every voucher header's is, not because a collection may be shared. Sending " +
      'an empty array clears it, and is refused when accounts.receipt_salesman_mandatory is on.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  avhEmployeeId?: string[];

  @ApiProperty({
    maxLength: 500,
    description: "Why. Appended to the document's status trail; not optional.",
  })
  @UpperMaxString(500)
  editRemark!: string;

  // Nothing else is accepted. A body carrying tenders, allocations or an amount
  // is a 400 and not a silent ignore (§5.4) — a client that thinks it changed
  // the money must be told that it did not.
}

/**
 * The regularise sweep, for a cron caller.
 *
 * ── R-B1: the company is not optional ────────────────────────────────────
 * This is a WRITE, and it used to take nothing but `asOf` — so one
 * authenticated call regularised every company in the database. The effect was
 * idempotent and corrupted nothing, and it was still a write across a tenant
 * boundary, which is the one thing no route here may do.
 *
 * The branch and the year are filters rather than keys, and that is deliberate
 * — see `RegulariseScope` for why requiring them would make the sweep miss the
 * bills it exists to find.
 */
export class RegularisePdcDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The company to sweep. Required: a sweep is a write, and writes are scoped.',
  })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Narrow the sweep to one branch. **Omit it for the nightly run.** A bill raised at one ' +
      'branch is settled at another all the time and outstanding is company-wide, so a sweep ' +
      'pinned to a branch leaves matured cheques uncounted.',
  })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({
    example: '2026-2027',
    description:
      'Narrow the sweep to settlements booked in one accounting year. **Omit it for the nightly ' +
      'run.** acc_bill_balance is partitioned by the year a bill ORIGINATED in and is never ' +
      'carried forward, so a sweep pinned to this year walks past every bill raised before it.',
  })
  @IsOptional()
  @UpperMaxString(9)
  accYear?: string;

  @ApiPropertyOptional({
    example: '2026-09-20',
    description:
      'Regularise every post-dated settlement maturing ON OR BEFORE this date. Defaults to today. ' +
      'Idempotent, and a run after an outage repairs every day that was missed.',
  })
  @OptionalDateString()
  asOf?: string;
}
