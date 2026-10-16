import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  NullableNumber,
  NullableString,
  NullableUuid,
  OptionalUuid,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { SAFE_GAP_TREATMENTS, TillRemitMode, type TillSafeGapTreatment } from '../types/till-enum';
import { TillCountLineDto, TillScopeDto } from './till-session.dto';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = { message: '$property must be a date, YYYY-MM-DD' };

/** GET /till/safes/balance (notes 118 §1). */
export class TillSafeBalanceQueryDto extends TillScopeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'One safe (an inactive one too); left out = every active safe of the branch.',
  })
  @OptionalUuid()
  safeId?: string;
}

/** The decision a safe gap beyond tolerance takes in the same step (notes 118 §2). */
class TillSafeGapDecisionDto extends TillScopeDto {
  @ApiPropertyOptional({
    enum: SAFE_GAP_TREATMENTS,
    nullable: true,
    description:
      'Only read for a gap beyond till.cash_tolerance: decide it in this step under SAFE_VARIANCE — the caller’s ' +
      'Till Approval Authority grant covering it and their PIN (`approverPin`), the rule’s no-self flag not binding ' +
      '(a safe gap judges nobody else’s cash), and on a two-person rule (as shipped) the witness’s PIN as the second ' +
      'signature. Needs Cash Office (287) OVERRIDE. Left out = SENT_FOR_APPROVAL (safes/decide-variance). EXPENSE → ' +
      'Cash Short & Excess · SUSPENSE → Tender suspense (no RECOVER: no cashier).',
  })
  @IsOptional()
  @IsIn([...SAFE_GAP_TREATMENTS])
  treatment?: TillSafeGapTreatment | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'With `treatment`: a till_reason of category VARIANCE (422 TILL_REASON_INVALID otherwise).',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'With `treatment`: the caller’s till PIN, as the SAFE_VARIANCE rule’s channel asks (EITHER as shipped: a ' +
      'PIN, else remote authority). Wrong → 403 TILL_APPROVER_PIN, journalled PIN_FAIL; none set → 422 TILL_APPROVER_NO_PIN.',
  })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'A second person at the desk (never the caller): the witness, typing their own till PIN. A two-person ' +
      'SAFE_VARIANCE rule takes them as its second signature.',
  })
  @NullableUuid()
  witnessId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The witness’s till PIN. None set → 422 TILL_WITNESS_NO_PIN; none typed → 403 TILL_WITNESS_PIN_REQUIRED; ' +
      'wrong → 403 TILL_WITNESS_PIN, journalled PIN_FAIL.',
  })
  @NullableString(20)
  witnessPin?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableString(500)
  notes?: string | null;
}

/** POST /till/safes/count (notes 118 §2). */
export class CountTillSafeDto extends TillSafeGapDecisionDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tenantId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  safeId!: string;

  @ApiProperty({
    type: () => TillCountLineDto,
    isArray: true,
    description:
      'The safe counted, cash by denomination (tenderTypeId 1; loose coin as one enteredAmount line). An empty ' +
      'safe is one line of 0. Blind: what it should hold comes back only in the answer.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines!: TillCountLineDto[];
}

/** POST /till/safes/decide-variance (notes 118 §2) — a PENDING safe gap decided later. */
export class DecideTillSafeVarianceDto extends TillScopeDto {
  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid', description: 'The till_variance row (stage SAFE or REMIT).' })
  @RequiredUuid()
  tvrId!: string;

  @ApiProperty({ enum: SAFE_GAP_TREATMENTS })
  @IsIn([...SAFE_GAP_TREATMENTS])
  treatment!: TillSafeGapTreatment;

  @ApiProperty({ format: 'uuid', description: 'A till_reason of category VARIANCE.' })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The caller’s till PIN (the rule’s channel).',
  })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'A two-person SAFE_VARIANCE rule (as shipped): the second person — not the caller, not whoever counted the ' +
      'safe / confirmed the remittance — typing `secondPin` here. Missing → 403 TILL_APPROVER_SECOND.',
  })
  @NullableUuid()
  secondId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(20)
  secondPin?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableString(500)
  notes?: string | null;
}

/** POST /till/movements/remit (notes 118 §3). */
export class RemitTillCashDto extends TillScopeDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tenantId?: string | null;

  @ApiProperty({ format: 'uuid', description: 'The safe the cash leaves.' })
  @RequiredUuid()
  safeId!: string;

  @ApiProperty({
    example: 50000,
    description: 'Never above what the safe should hold (422 TILL_REMIT_OVER_BALANCE).',
  })
  @RequiredNumber(0.01)
  amount!: number;

  @ApiProperty({
    format: 'uuid',
    description: 'The bank it is paid into: an active ledger under Bank Accounts / Bank OD A/c.',
  })
  @RequiredUuid()
  bankLedgerId!: string;

  @ApiProperty({
    enum: TillRemitMode,
    description:
      'BANK_DEPOSIT: staff paid it in — CRem Dr Bank / Cr Safe, DEPOSITED. CIT: an agency took it — CRem Dr Cash in ' +
      'transit / Cr Safe, IN_TRANSIT until movements/remit-confirm.',
  })
  @IsIn(Object.values(TillRemitMode))
  mode!: TillRemitMode;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(30)
  bagNo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(30)
  sealNo?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'CIT: the agency.' })
  @NullableString(100)
  citAgency?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The deposit slip / pickup receipt no (tcm_ref_no).',
  })
  @NullableString(50)
  slipNo?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-10-15' })
  @IsOptional()
  @Matches(ISO_DATE, ISO_DATE_MESSAGE)
  slipDate?: string | null;

  @ApiPropertyOptional({
    type: () => TillCountLineDto,
    isArray: true,
    nullable: true,
    description:
      'The notes sent, by denomination (cash): their total must be `amount`. A REMIT till_count.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines?: TillCountLineDto[] | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableString(500)
  notes?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Only when the REMITTANCE rule asks (shipped NEVER): who approves it at this desk — left out = the caller, ' +
      'refused as self unless the rule allows it. Someone else always types their PIN here (channel COUNTER).',
  })
  @NullableUuid()
  approverId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(20)
  approverPin?: string | null;
}

/** POST /till/movements/remit-confirm (notes 118 §3). */
export class ConfirmTillRemitDto extends TillSafeGapDecisionDto {
  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid', description: 'The REMIT, a CIT one IN_TRANSIT.' })
  @RequiredUuid()
  tcmId!: string;

  @ApiProperty({
    example: '2026-10-16',
    description:
      'The date the bank statement shows it: from the day it was sent to today. The Contra’s date.',
  })
  @Matches(ISO_DATE, ISO_DATE_MESSAGE)
  bankDate!: string;

  @ApiProperty({ example: 'UTR 1234', description: 'The statement’s reference.' })
  @TrimmedString(50)
  @IsNotEmpty()
  bankRef!: string;

  @ApiPropertyOptional({
    example: 49900,
    nullable: true,
    description:
      'What the bank credited; left out = what was sent. A difference is a REMIT-stage gap against Cash in transit.',
  })
  @NullableNumber(0)
  bankAmount?: number | null;
}
