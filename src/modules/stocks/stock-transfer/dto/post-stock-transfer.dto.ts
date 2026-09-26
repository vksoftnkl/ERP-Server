import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Matches, MaxLength, MinLength } from 'class-validator';
import {
  NullableStringStrict,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

export class StockTransferRefDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  svhId!: string;

  @ApiProperty({ example: '2026-2027', minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' })
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Falls back to the authenticated user from the request context.',
  })
  @OptionalUuid()
  userId?: string;
}

/**
 * §4 — despatch.
 *
 * The lorry's three columns ride along here as well as on the save, because a
 * despatch is often the first moment anyone knows them: the document was
 * drafted yesterday and the driver is at the counter now. Sent here they are
 * written to the transit rows after fn_svh_post_transfer returns, in the same
 * transaction; omitted, whatever the draft carried stands.
 *
 * They are IGNORED on a same-branch transfer, which creates no transit row for
 * them to land on. That is not an error worth refusing a despatch over — the
 * screen is the same screen — but the response says `sameBranch: true` so the
 * client can stop showing them.
 */
export class DespatchStockTransferDto extends StockTransferRefDto {
  @ApiPropertyOptional({ maxLength: 50, nullable: true, description: 'Lorry receipt number.' })
  @NullableStringStrict(50)
  lrNo?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  vehicleNo?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', example: '2026-09-12' })
  @NullableStringStrict(10)
  expectedOn?: string | null;
}

/**
 * §9.2 — cancel, and ONLY a same-branch POSTED transfer reaches the engine.
 *
 * `tr_svh_transfer_cancel_guard` refuses an IN_TRANSIT or RECEIVED OUT ("goods
 * that left cannot be cancelled on paper") and any POSTED TRANSFER_IN
 * ("un-receiving is a reverse transfer back to the sender"). Both surface as
 * 409 carrying the engine's own sentence, which reads as an instruction.
 */
export class CancelStockTransferDto extends StockTransferRefDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 250,
    description:
      'Required even though the column is nullable: a cancelled transfer with no reason is unanswerable three months later.',
  })
  @TrimmedString(250)
  @MinLength(3, { message: 'reason must say something — at least 3 characters.' })
  @MaxLength(250)
  reason!: string;
}
