import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, ValidateNested } from 'class-validator';
import {
  OptionalTrimmedString,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { PdcStatus } from '../../receipt/types/receipt-enum';
import { ChequeAllocationDto, ChequeKeysDto } from './cheque-keys.dto';

/**
 * The five single-cheque actions. Each extends `ChequeKeysDto`, so every one
 * of them names its row the same way (§6.1).
 */

// ─── §4.3 — clear ────────────────────────────────────────────────────────────

export class ClearChequeDto extends ChequeKeysDto {
  @ApiProperty({
    example: '2026-09-22',
    description:
      'The day the money became ours. On or after the deposit date (ck_apd_seq) and not in the ' +
      'future.',
  })
  @UpperMaxString(10)
  clearDate!: string;

  @ApiPropertyOptional({
    example: '2026-09-22',
    nullable: true,
    description:
      'The date the BANK says it happened, which is not always the day we recorded it. Goes to ' +
      'av_recon_date on the bank leg — the hook bank reconciliation hangs off. Defaults to ' +
      'clearDate.',
  })
  @OptionalTrimmedString(10)
  bankDate?: string | null;

  @ApiPropertyOptional({
    type: () => ChequeAllocationDto,
    isArray: true,
    description:
      'ON_CLEARING rows ONLY — under ON_RECEIPT the receipt already settled the bills and this ' +
      'must be empty. An empty array on an ON_CLEARING row means auto-FIFO, not "settle ' +
      'nothing": money that arrives always goes somewhere, and the remainder becomes an ADVANCE.',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ChequeAllocationDto)
  allocations: ChequeAllocationDto[] = [];

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @OptionalTrimmedString(500)
  remarks?: string | null;
}

// ─── §4.4 — bounce ───────────────────────────────────────────────────────────

export class BounceChequeDto extends ChequeKeysDto {
  @ApiProperty({
    example: '2026-09-14',
    description: 'On or after the deposit date (ck_apd_seq) and not in the future.',
  })
  @UpperMaxString(10)
  bounceDate!: string;

  @ApiProperty({
    maxLength: 150,
    example: 'Funds insufficient',
    description:
      'Why the bank sent it back. ck_apd_bounced refuses a BOUNCED row without one. ' +
      'accounts.bounce_reasons is a PRE-FILL and not a whitelist — any non-blank reason is ' +
      'accepted, because a bank returns cheques for reasons no list anticipates.',
  })
  @TrimmedString(150)
  reason!: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 500,
    description: 'The free text behind a reason of "Other", or whatever the bank actually wrote.',
  })
  @OptionalTrimmedString(500)
  reasonText?: string | null;

  @ApiProperty({
    default: 0,
    minimum: 0,
    example: 250,
    description:
      'What the BANK charged US to return it. An expense we bear — posts DR BANK_CHARGES / ' +
      'CR the bank. 0 skips both legs and resolves no role.',
  })
  @RequiredNumber(0)
  bankCharge!: number;

  @ApiProperty({
    default: 0,
    minimum: 0,
    example: 300,
    description:
      'What WE charge the party for bouncing. Income — posts DR party / CR ' +
      'BOUNCE_CHARGES_RECOVERED and raises a JOURNAL bill they now owe. NOT the same number as ' +
      'bankCharge. 0 skips the legs, the bill and the role.',
  })
  @RequiredNumber(0)
  partyCharge!: number;
}

// ─── §4.5 — re-present ───────────────────────────────────────────────────────

export class RepresentChequeDto extends ChequeKeysDto {
  @ApiProperty({ format: 'uuid', description: 'A live BANK ledger of this company.' })
  @RequiredUuid()
  bankLedgerId!: string;

  @ApiProperty({ example: '2026-09-25' })
  @UpperMaxString(10)
  depositDate!: string;

  @ApiProperty({ maxLength: 50, example: 'D-137' })
  @TrimmedString(50)
  slipNo!: string;

  @ApiPropertyOptional({
    type: () => ChequeAllocationDto,
    isArray: true,
    description:
      'ON_RECEIPT only, and optional — an OVERRIDE, for the rare case where the operator really ' +
      'is re-pointing the money at different bills.\n\n' +
      'LEAVE IT OUT and the re-issued credit goes back on the bills the bounce took it off, ' +
      'with the amounts it took — a re-presentation is the same money for the same debt, and ' +
      'the per-bill split lives in the reversed adjustment rows. It is NOT auto-FIFO: settling ' +
      "whichever of the party's invoices sorts first would pay a bill this cheque was never " +
      'against. If a bill cannot take its share back — deleted, or paid by something else since ' +
      'the bounce — the whole re-presentation is refused with a 409 naming that bill, rather ' +
      'than the money landing somewhere else.\n\n' +
      "The bounce-charge bill is in the party's open items, so it may be named here like any " +
      'other.',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ChequeAllocationDto)
  allocations: ChequeAllocationDto[] = [];

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @OptionalTrimmedString(500)
  remarks?: string | null;
}

// ─── §4.6 — replace ──────────────────────────────────────────────────────────

/**
 * The paper the party handed over instead. A NEW instrument, not an edit of
 * the old one — §10: "no edit of a register row's cheque facts".
 */
export class ReplacementChequeDto {
  @ApiProperty({ maxLength: 30, example: '221955' })
  @TrimmedString(30)
  instrumentNo!: string;

  @ApiProperty({
    example: '2026-10-05',
    description:
      'ck_apd_dates: within three months before and one year after today, because the new row ' +
      'is received TODAY.',
  })
  @UpperMaxString(10)
  instrumentDate!: string;

  @ApiProperty({
    example: 12300,
    minimum: 0,
    description:
      'The NEW amount, which need not equal the old one — a party often replaces a bounced ' +
      'cheque with a smaller one and pays the rest another way.',
  })
  @RequiredNumber(0)
  amount!: number;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @OptionalTrimmedString(100)
  bankName?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @OptionalTrimmedString(100)
  bankBranch?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 11 })
  @OptionalTrimmedString(11)
  ifsc?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 9 })
  @OptionalTrimmedString(9)
  micr?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 150 })
  @OptionalTrimmedString(150)
  drawerName?: string | null;
}

export class ReplaceChequeDto extends ChequeKeysDto {
  @ApiProperty({ type: () => ReplacementChequeDto })
  @ValidateNested()
  @Type(() => ReplacementChequeDto)
  newCheque!: ReplacementChequeDto;

  @ApiPropertyOptional({
    type: () => ChequeAllocationDto,
    isArray: true,
    description: 'ON_RECEIPT only. Which bills the re-issued credit settles. Empty = auto-FIFO.',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ChequeAllocationDto)
  allocations: ChequeAllocationDto[] = [];

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 250,
    description:
      'Required in practice when replacing from HELD, because that path RETURNS the old cheque ' +
      'first and ck_apd_cancelled refuses a RETURNED row with no reason. Defaults to a sentence ' +
      'naming the replacement.',
  })
  @OptionalTrimmedString(250)
  reason?: string | null;
}

// ─── §4.7 — return ───────────────────────────────────────────────────────────

export class ReturnChequeDto extends ChequeKeysDto {
  @ApiProperty({
    enum: [PdcStatus.RETURNED, PdcStatus.CANCELLED],
    example: PdcStatus.RETURNED,
    description:
      'RETURNED — the paper went back to the party and they have it. CANCELLED — it is void, ' +
      'nobody has it, and ux_apd_instrument excludes CANCELLED so the same cheque number may be ' +
      'keyed again.',
  })
  @IsIn([PdcStatus.RETURNED, PdcStatus.CANCELLED])
  action!: PdcStatus.RETURNED | PdcStatus.CANCELLED;

  @ApiProperty({
    maxLength: 250,
    description: 'Why. ck_apd_cancelled refuses either status without one.',
  })
  @TrimmedString(250)
  reason!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @OptionalTrimmedString(500)
  remarks?: string | null;
}
