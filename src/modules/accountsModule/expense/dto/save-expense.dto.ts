import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalNumber,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { EXPENSE_LINES_MAX, EXPENSE_TENDERS_MAX } from '../types/expense-enum';

/** The house key of every expense verb. */
export class ExpenseKeyDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027', description: 'acc_voucher_header is partitioned by year.' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  voucherId!: string;
}

export class CancelExpenseDto extends ExpenseKeyDto {
  @ApiProperty({ example: 'Entered twice', maxLength: 250 })
  @UpperMaxString(250)
  reason!: string;
}

/** One expense line: a DR on an expense ledger. */
export class ExpenseLineDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @RequiredInteger(1)
  rowNo!: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'An expense ledger (under an Expenses group). A party, cash, bank or tax ledger is refused.',
  })
  @RequiredUuid()
  ledgerId!: string;

  @ApiProperty({
    example: 250,
    minimum: 0.01,
    description:
      'Without a GST bill: the whole amount. With one: the taxable value; the tax is worked out.',
  })
  @RequiredNumber(0.01)
  amount!: number;

  @ApiPropertyOptional({ nullable: true, maxLength: 250, example: 'Tea for the staff' })
  @NullableString(250)
  description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  costCentreId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'With a GST bill: inventory.tax_rate_master.tax_id. Ignored without one.',
  })
  @NullableUuid()
  taxId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 10, example: '996331' })
  @NullableString(10)
  hsn?: string | null;

  @ApiPropertyOptional({
    default: true,
    description: 'With a GST bill: claim the input tax. False = the tax is part of the expense.',
  })
  @OptionalBoolean()
  itc?: boolean;
}

/** How it was paid. One row per tender; cheques go on a bill-wise Payment. */
export class ExpenseTenderDto {
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
    example: 1,
    description: 'acc_tender_types.ttm_type_id (1 = CASH), checked against the master.',
  })
  @RequiredInteger(1)
  tdTenderTypeId!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only when the tender master allows editing its ledger (tnd_edit_ledger).',
  })
  @OptionalUuid()
  tdTenderLedgerId?: string;

  @ApiProperty({ example: 250, minimum: 0 })
  @RequiredNumber(0)
  tdAmount!: number;

  @ApiPropertyOptional({ example: 500, minimum: 0, description: 'Cash only.' })
  @OptionalNumber(0)
  tdReceivedAmt?: number;

  @ApiPropertyOptional({ example: 250, minimum: 0, description: 'Cash only.' })
  @OptionalNumber(0)
  tdChangeAmt?: number;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 100,
    description: 'UTR / transaction id / last 4.',
  })
  @NullableString(100)
  tdRefNo?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 150 })
  @NullableString(150)
  tdBankName?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  tdPayerVpa?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @NullableString(250)
  tdNotes?: string | null;
}

/** "With GST bill": what GSTR-2 needs to claim the input tax. */
export class ExpenseGstBillDto {
  @ApiPropertyOptional({
    nullable: true,
    example: '33AAACT1234F1Z5',
    description: 'Defaults to the supplier ledger’s GSTIN.',
  })
  @IsOptional()
  @Matches(/^\d{2}[A-Z0-9]{13}$/, { message: 'supplierGstin must be a 15-character GSTIN' })
  supplierGstin?: string | null;

  @ApiProperty({ example: 'INV-2231', maxLength: 50 })
  @UpperMaxString(50)
  invoiceNo!: string;

  @ApiProperty({ example: '2026-10-08' })
  @IsDateString()
  invoiceDate!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '33',
    description:
      'Place of supply, 2-digit state code. Defaults to the GSTIN’s state; INTER when it is not the company’s.',
  })
  @IsOptional()
  @Matches(/^\d{2}$/, { message: 'placeOfSupplyCode must be a 2-digit state code' })
  placeOfSupplyCode?: string | null;
}

export class SaveExpenseDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = edit that DRAFT.' })
  @OptionalUuid()
  voucherId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tenantId?: string | null;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({
    example: '2026-10-08',
    description: 'The voucher date — on a till, the business date.',
  })
  @IsDateString()
  voucherDate!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Optional supplier ledger. The expense is still paid now (no outstanding); required with a GST bill.',
  })
  @NullableUuid()
  partyId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @NullableString(50)
  usrRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500, description: 'Paid to / notes.' })
  @NullableString(500)
  remarks?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The EXPENSE till reason picked (quick-reasons); kept with the draft.',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The client’s till session. The server decides at post (the device’s live session).',
  })
  @NullableUuid()
  sessionId?: string | null;

  @ApiProperty({ type: () => ExpenseLineDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EXPENSE_LINES_MAX)
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineDto)
  lines!: ExpenseLineDto[];

  @ApiProperty({ type: () => ExpenseTenderDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EXPENSE_TENDERS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ExpenseTenderDto)
  tenders!: ExpenseTenderDto[];

  @ApiPropertyOptional({ type: () => ExpenseGstBillDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpenseGstBillDto)
  gstBill?: ExpenseGstBillDto | null;
}

export class ExpenseLedgerPickQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'Part of the name.' })
  @NullableString(100)
  search?: string | null;
}

export class ExpenseReasonQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;
}
