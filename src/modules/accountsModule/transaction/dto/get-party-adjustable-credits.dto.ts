import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { RequiredUuid, toUpperTrimmed } from 'src/common/dto/dtoDecorators';
import {
  AdjustableCreditSide,
  DEFAULT_ADJUSTABLE_CREDIT_SIDE,
} from '../types/transaction-api.types';

/**
 * Both parameters are required. `companyId` is not a convenience narrowing here
 * the way it is on the credit summary: offering one tenant's credits as
 * settlement on another tenant's bill is not a wider read, it is a wrong one.
 *
 * There is no accounting-year parameter. `acc_bill_balance` is partitioned by
 * the year the credit ORIGINATED in and is never carried forward, so a filter on
 * the entry screen's year would hide every credit raised before it — a March
 * advance would vanish on April 1 while the customer's money is still held. The
 * read scans every partition and each row reports its own `billAccYear`.
 */
export class GetPartyAdjustableCreditsDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The party whose credits to offer — the same id acc_bill_balance.abl_party_id carries.',
  })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Tenant scope. Required, not optional: a credit belonging to another company must never be offered as settlement.',
  })
  @RequiredUuid()
  companyId!: string;

  /**
   * Which side of the party's account to read. Optional, and CR when omitted —
   * every caller before this parameter existed asked the credit question, and
   * silently widening them to both sides would offer a supplier advance as
   * settlement on a sales invoice.
   *
   * Accepted in either case (`cr` / `CR`); the value is upper-cased before it is
   * validated, so the enum stays the one spelling the SQL binds.
   */
  @ApiPropertyOptional({
    enum: AdjustableCreditSide,
    default: DEFAULT_ADJUSTABLE_CREDIT_SIDE,
    description:
      'CR = the company owes the party (customer advances, sales returns) — the default. ' +
      'DR = the party owes the company (supplier advances, purchase returns). Case-insensitive.',
  })
  @IsOptional()
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsEnum(AdjustableCreditSide)
  type?: AdjustableCreditSide;
}
