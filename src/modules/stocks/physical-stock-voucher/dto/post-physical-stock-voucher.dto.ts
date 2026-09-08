import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { OptionalUuid, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

export class PostPhysicalStockVoucherDto {
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

export class CancelPhysicalStockVoucherDto extends PostPhysicalStockVoucherDto {
  /**
   * Required by this API even though svh_cancel_reason is nullable.
   *
   * A cancelled count is a rarer and nastier thing than a cancelled opening: it
   * UN-CORRECTS a correction, so the book figure goes back to being the one the
   * shelf disagreed with. The usual right answer to "the counter miscounted" is
   * a SECOND COUNT, not a cancellation — a holding may be counted any number of
   * times, each posting its own variance from the then-current book figure, and
   * the ledger keeps both for ever.
   */
  @ApiProperty({
    maxLength: 250,
    description: 'Why the count is being reversed. Consider a second count instead.',
  })
  @TrimmedString(250)
  reason!: string;
}
