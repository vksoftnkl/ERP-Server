import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableUuid,
  OptionalBoolean,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * §4.5. One transaction over a whole company-year.
 *
 * `fromAccYear` and `toAccYear` are both explicit rather than derived: a
 * carry-forward that guesses which year it is closing is a carry-forward that
 * will eventually close the wrong one.
 */
export class CarryForwardDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ example: '2025-2026', description: 'The year being closed — read from.' })
  @UpperMaxString(9)
  fromAccYear!: string;

  @ApiProperty({
    example: '2026-2027',
    description: 'The year being opened — written into. Must follow fromAccYear.',
  })
  @UpperMaxString(9)
  toAccYear!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'null = the company-level set.',
  })
  @NullableUuid()
  branchId?: string | null;

  @ApiPropertyOptional({
    default: false,
    description:
      'false (the default) spares MANUAL and MIGRATION rows and reports them as skippedManual. ' +
      "true overwrites them — which discards an accountant's correction, so it is never the default.",
  })
  @OptionalBoolean()
  overwriteManual?: boolean;
}
