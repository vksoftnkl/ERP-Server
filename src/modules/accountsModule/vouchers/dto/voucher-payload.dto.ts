import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import {
  NullableDateString,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalDateString,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { TenderChequeDetailDto } from '../../tenderDetail/dto/save-tender-detail.dto';

/**
 * §6.13 — the payload: ONLY what the operator typed. Never a generated leg.
 *
 * Amounts arrive as numbers or numeric strings and are kept as STRINGS here so
 * the service can make a Prisma.Decimal of them without a float in between
 * (money-decimal rule). `enableImplicitConversion` turns a JSON number into a
 * string on the way in; the regex refuses anything that is not a plain figure.
 */
const MONEY = /^-?\d{1,16}(\.\d{1,6})?$/;

function MoneyString(): PropertyDecorator {
  return (target, key) => {
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'number' ? value.toString() : value,
    )(target, key);
    IsString()(target, key);
    Matches(MONEY, { message: `${String(key)} must be a plain figure, e.g. 25000 or "4000.00"` })(
      target,
      key,
    );
  };
}

export class VoucherLineGstDto {
  @ApiProperty({ format: 'uuid', description: 'inventory.tax_rate_master.tax_id' })
  @RequiredUuid()
  taxId!: string;

  @ApiPropertyOptional({ example: '998533', description: 'HSN or SAC. A leading 99 is a service.' })
  @NullableString(20)
  hsn?: string | null;

  @ApiPropertyOptional({
    enum: ['INPUTS', 'INPUT_SERVICES', 'CAPITAL_GOODS', 'INELIGIBLE'],
    description:
      'GSTR-3B table 4 class. Defaults from the ledger’s led_itc_eligibility; meaningful on input-side types only.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(['INPUTS', 'INPUT_SERVICES', 'CAPITAL_GOODS', 'INELIGIBLE'])
  itcEligibility?: string | null;
}

/**
 * notes (54) — the INSTRUMENT a customer line carries on a Receipt Voucher: the
 * tender (cash, cheque, UPI …) the money came in by. The names are the
 * Receipt's tender DTO's, so the same screen widget builds both. The amount is
 * the line's; the server generates the Dr leg from the tender's ledger, and a
 * cheque becomes a HELD row on the Received Cheques screen (menu 51).
 */
export class VoucherInstrumentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'accounts.acc_tender_master.tnd_id — from GET /vouchers/instruments.',
  })
  @RequiredUuid()
  tenderId!: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 100,
    example: '445123',
    description:
      'The cheque / UTR / transaction number. REQUIRED on a cheque and on any tender whose type needs a reference.',
  })
  @NullableString(100)
  refNo?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-10-05',
    description:
      'The date on the instrument. REQUIRED on a cheque. Later than the voucher date makes it POST-DATED: ' +
      'its legs post on that day, in a voucher of their own, and its bills settle when it matures.',
  })
  @NullableDateString()
  instrumentDate?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 150, example: 'KVB' })
  @NullableString(150)
  bankName?: string | null;

  @ApiPropertyOptional({
    type: () => TenderChequeDetailDto,
    nullable: true,
    description: 'Cheque detail (drawer, branch, IFSC, MICR). Ignored on a non-cheque tender.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => TenderChequeDetailDto)
  cheque?: TenderChequeDetailDto | null;

  // ── notes (55): a PAYMENT's instrument — we pay out ───────────────────────
  // On a Payment Voucher line (party side DR) the money leaves one of OUR bank
  // accounts. The leaf is never sent: /post takes the book's next leaf.

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'PAYMENT: the bank account (a ledger under Bank Accounts / Bank OD) the money leaves. ' +
      'REQUIRED on a cheque, bank transfer or UPI (VCH_BANK_REQUIRED); ignored on cash, which ' +
      'posts to the CASH tender’s own ledger.',
  })
  @NullableUuid()
  bankLedgerId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'PAYMENT, cheque only: the book the leaf comes from (GET /vouchers/cheque-books). REQUIRED ' +
      '(VCH_BOOK_REQUIRED); it must be drawn on `bankLedgerId` (VCH_BOOK_BANK) and have a leaf left ' +
      '(VCH_BOOK_FINISHED). `refNo` is ignored — the server takes the next leaf.',
  })
  @NullableUuid()
  chequeBookId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 150,
    description: 'PAYMENT: who the cheque / transfer is made out to. Omitted = the party’s name.',
  })
  @NullableString(150)
  favouring?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    default: true,
    description: 'PAYMENT, cheque only: crossed "A/c Payee" (Q8). Omitted = true.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  acPayee?: boolean | null;
}

export class VoucherLineDto {
  @ApiProperty({
    example: 1,
    description: 'The operator’s row. Positive, unique within the voucher.',
  })
  @RequiredInteger(1)
  rowNo!: number;

  @ApiProperty({ enum: ['DR', 'CR'] })
  @IsIn(['DR', 'CR'])
  drCr!: 'DR' | 'CR';

  @ApiProperty({ format: 'uuid', description: 'accounts.acc_ledger_master.led_id' })
  @RequiredUuid()
  ledgerId!: string;

  @ApiProperty({ example: 25000, description: 'Positive. The side is drCr.' })
  @MoneyString()
  amount!: string;

  @ApiPropertyOptional({ maxLength: 250 })
  @NullableString(250)
  remarks?: string | null;

  @ApiPropertyOptional({ type: VoucherLineGstDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => VoucherLineGstDto)
  gst?: VoucherLineGstDto | null;

  @ApiPropertyOptional({
    description:
      'Does this line’s amount count toward the TDS base? Omitted = the ledger’s led_is_tds_applicable.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  tdsBase?: boolean | null;

  @ApiPropertyOptional({
    type: VoucherInstrumentDto,
    nullable: true,
    description:
      'notes (54): on a type with instruments (the Receipt Voucher), the tender this line’s money came in ' +
      'by. Refused on any other type (VCH_INSTRUMENT_NOT_ALLOWED).',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => VoucherInstrumentDto)
  instrument?: VoucherInstrumentDto | null;
}

export class VoucherAllocationDto {
  @ApiProperty({
    example: 0,
    description:
      '0 = the generated party leg (party mode ONE); n = typed line n (party mode MANY).',
  })
  @IsInt()
  @Min(0)
  lineRowNo!: number;

  @ApiProperty({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id' })
  @RequiredUuid()
  billId!: string;

  @ApiProperty({
    example: '2026-2027',
    description: 'The bill’s OWN year — the table is partitioned on it.',
  })
  @UpperMaxString(9)
  billAccYear!: string;

  @ApiProperty({ example: 5000 })
  @MoneyString()
  amount!: string;
}

export class VoucherNewBillDto {
  @ApiPropertyOptional({
    example: 30,
    description: 'RAISE types: due = date + dueDays. Defaults to the party’s credit days.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(3650)
  dueDays?: number | null;
}

export class VoucherHeaderDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Absent on a new voucher (the server mints uuidv7). Present to update a DRAFT or post one.',
  })
  @OptionalUuid()
  voucherId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ example: 'PurA', description: 'acc_voucher_types.vchr_type_code — never an id.' })
  @TrimmedString(20)
  typeCode!: string;

  @ApiProperty({ example: '2026-09-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Party mode ONE: required. NONE: omitted. MANY: omitted (the parties are on the lines).',
  })
  @OptionalUuid()
  partyId?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'The supplier’s / customer’s document number.',
  })
  @NullableString(100)
  docRefno?: string | null;

  @ApiPropertyOptional({ example: '2026-09-12' })
  @OptionalDateString()
  docDate?: string | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @NullableString(100)
  usrRefno?: string | null;

  @ApiPropertyOptional({
    example: '33',
    description:
      'Place of supply (state code). Default: the party’s state on output-side types, the company’s on input-side / reverse charge.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @Matches(/^\d{2}$/, { message: 'posStcd must be a two-digit state code' })
  posStcd?: string | null;

  @ApiPropertyOptional({ default: false, description: 'Purchase (Accounting) only.' })
  @OptionalBoolean()
  reverseCharge?: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @NullableString(500)
  remarks?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description:
      'notes (54): the salesmen / collectors (public.employee_master ids) → avh_employee_id; the first is the ' +
      'cheque register row’s salesman. Omit or [] for none.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
    each: true,
    message: 'each employeeId must be a valid UUID',
  })
  employeeIds?: string[];
}

export class VoucherPayloadDto {
  @ApiProperty({ type: VoucherHeaderDto })
  @ValidateNested()
  @Type(() => VoucherHeaderDto)
  header!: VoucherHeaderDto;

  @ApiProperty({ type: [VoucherLineDto], description: 'TYPED lines only — never a generated leg.' })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => VoucherLineDto)
  lines!: VoucherLineDto[];

  @ApiPropertyOptional({
    type: [VoucherAllocationDto],
    description: 'Bill-wise, against the party leg. Absent ≠ empty: omit to leave a draft’s alone.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => VoucherAllocationDto)
  allocations?: VoucherAllocationDto[];

  @ApiPropertyOptional({ type: VoucherNewBillDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => VoucherNewBillDto)
  newBill?: VoucherNewBillDto | null;
}

export class ValidateVoucherDto extends VoucherPayloadDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'WARN codes the operator has seen and chosen to override (needs um_can_override).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  overrides?: string[];
}

export class PostVoucherDto extends ValidateVoucherDto {}

export class VoucherKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  voucherId!: string;
}

export class CancelVoucherDto extends VoucherKeysDto {
  @ApiProperty({ maxLength: 250, description: 'Required. ck_avh_cancel keeps it on the row.' })
  @TrimmedString(250)
  reason!: string;
}

export class DeleteVoucherDto extends VoucherKeysDto {}

export class GetVoucherQueryDto extends VoucherKeysDto {}
