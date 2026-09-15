import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { BillDrCr } from '../types/opening-balance-enum';

/**
 * One OPENING bill. The refno and date are the ORIGINAL invoice's, not
 * today's: a bill carried into the opening keeps its own identity so ageing
 * measures from when the money was actually invoiced.
 */
export class SaveOpeningBillRowDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update, absent = insert.' })
  @OptionalUuid()
  ablId?: string;

  @ApiProperty({
    maxLength: 50,
    example: 'SB/2025/0412',
    description:
      'The ORIGINAL invoice number. Unique per company/party/type/year (ux_abl_doc_refno) — ' +
      'the same refno in the PREVIOUS year as a SALES bill is fine, different year and type.',
  })
  @UpperMaxString(50)
  ablDocRefno!: string;

  @ApiProperty({ example: '2026-01-12', description: 'The ORIGINAL invoice date — what ageing measures from.' })
  @UpperMaxString(10)
  ablDocDate!: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-02-11', description: 'Must be >= ablDocDate (ck_abl_due_date).' })
  @NullableDateString()
  ablDueDate?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @OptionalInteger(0)
  ablCreditDays?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @OptionalInteger(0)
  ablGraceDays?: number;

  @ApiProperty({
    enum: BillDrCr,
    description: "TWO characters here — acc_opening_balance uses one. Do not unify them.",
  })
  @IsIn(Object.values(BillDrCr))
  ablDrCr!: BillDrCr;

  @ApiProperty({
    example: 48600.0,
    minimum: 0,
    description: 'Strictly greater than zero (ck_abl_amount). Positive; the side is ablDrCr.',
  })
  @RequiredNumber(0)
  ablBillAmount!: number;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(2000)
  ablNarration?: string | null;
}

/**
 * §4.6 POST. The whole breakup for ONE party at ONE branch.
 *
 * This endpoint OWNS the party's opening figure: it recomputes
 * `op_amount / op_dr_cr` from these bills in the same transaction (§5.5
 * rule 2), so the tie in §7.2 is true by construction rather than by a check
 * that can fail.
 */
export class SaveOpeningBillsDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'REQUIRED, unlike a ledger opening. abl_branch_id is NOT NULL, so a bill always has a ' +
      "branch — a bill-wise party's company-level opening is the SUM of its branch bills " +
      '(DECISION 9a).',
  })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid', description: 'acc_ledger_master.led_id — the party ledger.' })
  @RequiredUuid()
  partyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The party's acc_opening_balance row, which every bill is linked to via abl_src_doc_id. " +
      'Omit on the first save — the service creates the opening row and links the bills to it.',
  })
  @OptionalUuid()
  opId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  tenantId?: string | null;

  @ApiProperty({ type: () => SaveOpeningBillRowDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => SaveOpeningBillRowDto)
  bills!: SaveOpeningBillRowDto[];

  @ApiPropertyOptional({
    default: false,
    description: 'true = bills absent from the array are soft deleted, unless they are frozen (§5.5 rule 3).',
  })
  @OptionalBoolean()
  replace?: boolean;
}

/** §4.6 GET. */
export class ListOpeningBillsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid', description: 'REQUIRED — bills are always branch-scoped.' })
  @RequiredUuid()
  branchId!: string;
}
