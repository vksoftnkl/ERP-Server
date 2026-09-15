import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillDrCr, OpeningDrCr, OpeningSource, OpeningStaleReason } from '../types/opening-balance-enum';

export class OpeningBalanceErrorFieldDto {
  @ApiProperty({ example: 'rows.3.opAmount' })
  field!: string;

  @ApiProperty({ example: 'Opening amount cannot be negative for "Sundry Debtors"' })
  message!: string;
}

export class OpeningBalanceErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: OpeningBalanceErrorFieldDto, isArray: true })
  errors!: OpeningBalanceErrorFieldDto[];
}

export class TrialBalanceDto {
  @ApiProperty({ example: 2184000.0 })
  totalDebit!: number;

  @ApiProperty({ example: 2184000.0 })
  totalCredit!: number;

  @ApiProperty({ example: 0, description: 'debit - credit. Signed, so it says which side is short.' })
  difference!: number;

  @ApiProperty({ example: true })
  isBalanced!: boolean;

  @ApiProperty({ example: 0, description: 'Ledgers under a NULL-nature group. Not in the totals.' })
  unmappedCount!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The OPENING_DIFFERENCE ledger. Null = unmapped, and the plug cannot be offered.',
  })
  differenceLedgerId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  differenceLedgerName!: string | null;
}

export class OpeningBalanceRowDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Null = this ledger has no opening yet.' })
  opId!: string | null;

  @ApiProperty({ format: 'uuid' })
  ledId!: string;

  @ApiProperty({ example: 'Sundry Debtors' })
  ledName!: string;

  @ApiPropertyOptional({ nullable: true })
  groupName!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Assets' })
  groupNature!: string | null;

  @ApiProperty({ description: 'When true the bills own the figure and the screen shows it read-only.' })
  ledIsBillByBill!: boolean;

  @ApiProperty({ example: 124500.0, description: 'Always positive.' })
  opAmount!: number;

  @ApiPropertyOptional({ enum: OpeningDrCr, nullable: true })
  opDrCr!: OpeningDrCr | null;

  @ApiPropertyOptional({ enum: OpeningSource, nullable: true })
  opSource!: OpeningSource | null;

  @ApiProperty()
  opIsStale!: boolean;

  @ApiPropertyOptional({ nullable: true })
  opStaleSince!: string | null;

  @ApiPropertyOptional({ enum: OpeningStaleReason, nullable: true })
  opStaleReason!: OpeningStaleReason | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 500,
    example: 'counted at go-live',
    description: 'Whatever was typed in Remarks on /create. Round-trips.',
  })
  opRemarks!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Last year's closing, for comparison." })
  priorClosingAmount!: number | null;

  @ApiPropertyOptional({ enum: OpeningDrCr, nullable: true })
  priorClosingDrCr!: OpeningDrCr | null;

  @ApiProperty({ example: 0 })
  billCount!: number;
}

export class UnclassifiedLedgerDto {
  @ApiProperty({ format: 'uuid' })
  ledId!: string;

  @ApiProperty()
  ledName!: string;

  @ApiPropertyOptional({ nullable: true })
  groupName!: string | null;
}

export class OpeningBalanceListPayloadDto {
  @ApiProperty({ format: 'uuid' })
  opCompanyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  opBranchId!: string | null;

  @ApiProperty({ example: '2026-2027' })
  opAccYear!: string;

  @ApiProperty({ type: OpeningBalanceRowDto, isArray: true })
  rows!: OpeningBalanceRowDto[];

  @ApiProperty({
    type: UnclassifiedLedgerDto,
    isArray: true,
    description: 'Ledgers under a group with no nature. A data problem the screen must surface.',
  })
  unclassified!: UnclassifiedLedgerDto[];

  @ApiProperty({ type: TrialBalanceDto })
  trialBalance!: TrialBalanceDto;
}

export class RetainedRowDto {
  @ApiProperty({ format: 'uuid' })
  opId!: string;

  @ApiProperty({ format: 'uuid' })
  ledId!: string;

  @ApiProperty()
  ledName!: string;

  @ApiProperty()
  billCount!: number;
}

export class OpeningBalanceSavePayloadDto {
  @ApiProperty({ format: 'uuid' })
  opCompanyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  opBranchId!: string | null;

  @ApiProperty({ example: '2026-2027' })
  opAccYear!: string;

  @ApiProperty({ example: 42 })
  created!: number;

  @ApiProperty({ example: 3 })
  updated!: number;

  @ApiProperty({ example: 2, description: 'Zero-amount rows — no row is written for them.' })
  skippedZero!: number;

  @ApiProperty({ example: 0 })
  deleted!: number;

  @ApiProperty({
    type: RetainedRowDto,
    isArray: true,
    description: 'Rows replace:true could not delete because they still have OPENING bills.',
  })
  retainedWithBills!: RetainedRowDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'opIds whose source flipped CARRY_FORWARD -> MANUAL because the figure was edited.',
  })
  flippedToManual!: string[];

  @ApiProperty({ type: TrialBalanceDto })
  trialBalance!: TrialBalanceDto;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Later years whose CARRY_FORWARD rows this write invalidated (§5.5 rule 4).',
  })
  staledAccYears!: string[];
}

export class OpeningBillRowDto {
  @ApiProperty({ format: 'uuid' })
  ablId!: string;

  @ApiProperty({ example: 'SB/2025/0412' })
  ablDocRefno!: string;

  @ApiProperty({ example: '2026-01-12' })
  ablDocDate!: string;

  @ApiPropertyOptional({ nullable: true })
  ablDueDate!: string | null;

  @ApiProperty()
  ablCreditDays!: number;

  @ApiProperty()
  ablGraceDays!: number;

  @ApiProperty({ enum: BillDrCr })
  ablDrCr!: BillDrCr;

  @ApiProperty({ example: 48600.0 })
  ablBillAmount!: number;

  @ApiProperty({ example: 0 })
  ablAllocAmount!: number;

  @ApiProperty({ example: 0 })
  ablDiscAmount!: number;

  @ApiProperty({ example: 0 })
  ablWriteoffAmount!: number;

  @ApiProperty({ example: 48600.0, description: 'GENERATED — never sent on a write.' })
  ablPendingAmount!: number;

  @ApiPropertyOptional({ nullable: true, example: 'OPEN', description: 'GENERATED.' })
  ablStatus!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ablNarration!: string | null;

  @ApiProperty({ description: 'Settled against. Accepts only date / days / narration changes.' })
  isFrozen!: boolean;
}

export class OpeningBillsPayloadDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  partyId!: string;

  @ApiProperty()
  partyName!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  opId!: string | null;

  @ApiProperty({ type: OpeningBillRowDto, isArray: true })
  bills!: OpeningBillRowDto[];

  @ApiProperty({ example: 218400.0 })
  billTotalAmount!: number;

  @ApiPropertyOptional({ enum: OpeningDrCr, nullable: true })
  billTotalDrCr!: OpeningDrCr | null;

  @ApiProperty({ example: 218400.0 })
  openingAmount!: number;

  @ApiPropertyOptional({ enum: OpeningDrCr, nullable: true })
  openingDrCr!: OpeningDrCr | null;

  @ApiProperty({ description: 'The §7.2 tie. The bills endpoint keeps it true by construction.' })
  isTied!: boolean;
}

export class OpeningBillsSavePayloadDto extends OpeningBillsPayloadDto {
  @ApiProperty()
  created!: number;

  @ApiProperty()
  updated!: number;

  @ApiProperty()
  deleted!: number;

  @ApiProperty({ description: 'Frozen bills left exactly as they were.' })
  frozenUnchanged!: number;

  @ApiProperty({ type: String, isArray: true })
  staledAccYears!: string[];
}

export class CarryForwardPayloadDto {
  @ApiProperty({ format: 'uuid', description: 'The acc_opening_run row that recorded this run.' })
  runId!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  branchId!: string | null;

  @ApiProperty({ example: '2025-2026' })
  fromAccYear!: string;

  @ApiProperty({ example: '2026-2027' })
  toAccYear!: string;

  @ApiProperty()
  created!: number;

  @ApiProperty()
  updated!: number;

  @ApiProperty({ description: 'MANUAL / MIGRATION rows left alone. Always reported, even when zero.' })
  skippedManual!: number;

  @ApiProperty({ description: 'OPENING bills written for bill-wise parties (§5.2 step 4).' })
  billsCarried!: number;

  @ApiProperty()
  totalDebit!: number;

  @ApiProperty()
  totalCredit!: number;

  @ApiProperty()
  difference!: number;

  @ApiProperty()
  isBalanced!: boolean;

  @ApiProperty({ description: "The previous year's net result, carried onto RETAINED_EARNINGS." })
  profitAndLossResult!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  retainedEarningsLedgerId!: string | null;
}

export class OpeningBalanceDeletePayloadDto {
  @ApiProperty({ format: 'uuid' })
  opId!: string;

  @ApiProperty({ example: '2026-2027' })
  opAccYear!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

// ─── Envelopes ───────────────────────────────────────────────────────────────

export class OpeningBalanceListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening balances fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningBalanceListPayloadDto })
  data!: OpeningBalanceListPayloadDto;
}

export class OpeningBalanceSaveSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening balances saved successfully' })
  message!: string;

  @ApiProperty({ type: OpeningBalanceSavePayloadDto })
  data!: OpeningBalanceSavePayloadDto;
}

export class TrialBalanceSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Trial balance fetched successfully' })
  message!: string;

  @ApiProperty({ type: TrialBalanceDto })
  data!: TrialBalanceDto;
}

export class OpeningBillsSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening bills fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningBillsPayloadDto })
  data!: OpeningBillsPayloadDto;
}

export class OpeningBillsSaveSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening bills saved successfully' })
  message!: string;

  @ApiProperty({ type: OpeningBillsSavePayloadDto })
  data!: OpeningBillsSavePayloadDto;
}

export class CarryForwardSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Carry forward completed successfully' })
  message!: string;

  @ApiProperty({ type: CarryForwardPayloadDto })
  data!: CarryForwardPayloadDto;
}

export class OpeningBalanceDeleteSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening balance deleted successfully' })
  message!: string;

  @ApiProperty({ type: OpeningBalanceDeletePayloadDto })
  data!: OpeningBalanceDeletePayloadDto;
}
