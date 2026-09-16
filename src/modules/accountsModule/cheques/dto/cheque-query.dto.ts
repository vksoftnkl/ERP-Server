import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { ChequeKeysDto } from './cheque-keys.dto';

/**
 * The reads.
 *
 * ── Why `/list` exists here when the receipt has no `/list` ──────────────
 * The receipt's list is a registered grid and nothing else, because the whole
 * of it is rows. This one is a grid TOO — `MAIN LIST - RECEIVED CHEQUES`,
 * served by `/configured-grid-sql`, which is what TxnMainView reads and what
 * makes the operator's saved widths and filters apply.
 *
 * `/cheques/list` answers a different question the grid cannot: the SUMMARY
 * STRIP. "In hand 14 / 2,18,400 · With the bank 6 / 91,000" is an aggregate
 * over the whole register, not over the page the grid returned, and §7's last
 * check ("IN HAND + WITH THE BANK equals the Cheques In Hand ledger") is about
 * that total. A grid row count cannot answer it.
 */

// ─── §4.1 — list ─────────────────────────────────────────────────────────────

export class ListChequesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdBranchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  apdAccYear!: string;

  @ApiPropertyOptional({
    example: 'HELD,DEPOSITED',
    description: 'Comma-separated ck_apd_status values. Blank means every status.',
  })
  @OptionalTrimmedString(120)
  status?: string;

  @ApiPropertyOptional({ example: '2026-04-01', description: 'On the INSTRUMENT date.' })
  @OptionalTrimmedString(10)
  from?: string;

  @ApiPropertyOptional({ example: '2027-03-31', description: 'On the INSTRUMENT date.' })
  @OptionalTrimmedString(10)
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  bankLedgerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  partyId?: string;

  @ApiPropertyOptional({
    description: 'Cheque number, party name, drawer or drawn-on bank.',
  })
  @OptionalTrimmedString(100)
  search?: string;

  @ApiPropertyOptional({ default: 200, minimum: 1, maximum: 2000 })
  @OptionalQueryInt(1, 2000)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}

// ─── §4.1 — get and history ──────────────────────────────────────────────────

export class GetChequeQueryDto extends ChequeKeysDto {}

export class ChequeHistoryQueryDto extends ChequeKeysDto {}

// ─── §4.8 — the deposit slip ─────────────────────────────────────────────────

export class DepositSlipQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdBranchId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  bankLedgerId!: string;

  @ApiProperty({ example: '2026-09-15' })
  @UpperMaxString(10)
  depositDate!: string;

  @ApiProperty({ maxLength: 50, example: 'D-121' })
  @TrimmedString(50)
  slipNo!: string;
}
