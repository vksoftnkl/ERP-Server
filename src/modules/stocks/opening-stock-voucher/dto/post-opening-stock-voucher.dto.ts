import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { OptionalUuid, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

export class PostOpeningStockVoucherDto {
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

export class CancelOpeningStockVoucherDto extends PostOpeningStockVoucherDto {
  /**
   * Required by this API even though the trail's tsl_remarks is nullable in
   * general. A cancelled opening with no reason is unanswerable three months
   * later, and the cancellation is a reversal in the ledger — the row exists
   * for ever, so the explanation had better too.
   */
  @ApiProperty({ maxLength: 250, description: 'Why the document is being reversed.' })
  @TrimmedString(250)
  reason!: string;
}
