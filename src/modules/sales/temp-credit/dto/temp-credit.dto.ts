import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableDateString,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

/** §7 — `GET /temp-credits/open`. */
export class OpenTempCreditsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalTrimmedString(36)
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Comma list of OPEN, PARTIAL, SETTLED, WRITTEN_OFF, CANCELLED',
    default: 'OPEN,PARTIAL',
  })
  @OptionalTrimmedString(100)
  status?: string;

  @ApiPropertyOptional({ description: 'Name, mobile or bill number' })
  @OptionalTrimmedString(100)
  search?: string;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  overdueOnly?: boolean;
}

/** §7 — `PUT /temp-credits/follow-up`. */
export class TempCreditFollowUpDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  atcId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  @IsNotEmpty()
  atcAccYear!: string;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  promiseDate?: string | null;

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  remarks!: string;
}

/**
 * `POST /temp-credits/delete` — take a credit off the register. The key rides
 * in the body, as the bill's and the receipt's deletes do: the row is keyed by
 * id AND accounting year, since the table is partitioned by the year.
 */
export class DeleteTempCreditDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  atcId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  @IsNotEmpty()
  atcAccYear!: string;

  @ApiProperty({ maxLength: 250, description: 'Why it is being removed — kept on the row and in its trail' })
  @TrimmedString(250)
  @IsNotEmpty()
  reason!: string;
}
