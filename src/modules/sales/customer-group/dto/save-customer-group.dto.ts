import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, Max } from 'class-validator';
import {
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalIntegerArray,
  OptionalUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

export class SaveCustomerGroupDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing customer group',
  })
  @OptionalUuid()
  cgrId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  cgrCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  cgrBranchId?: string | null;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  cgrName!: string;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  cgrAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  cgrShort?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  cgrNarration?: string | null;

  // F3: on these NOT NULL columns an explicit null means "cleared" and is stored as the
  // column default, 0.
  @ApiPropertyOptional({ type: Number, default: 0, nullable: true, description: 'null = 0' })
  @NullableNumber()
  cgrOrder?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    maximum: 100,
    nullable: true,
    description: 'null = 0',
  })
  @NullableNumber(0)
  @Max(100)
  cgrDiscPerc?: number | null;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Collection days as integer array (JSON array or comma-separated values)',
  })
  @OptionalIntegerArray()
  cgrCollectionDays?: number[];

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cgrDebitAllowed?: boolean;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableInteger(0)
  cgrDebitDays?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableNumber(0)
  cgrDebitLimit?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 0,
    minimum: 0,
    nullable: true,
    description: 'null = 0',
  })
  @NullableInteger(0)
  cgrBillsLimit?: number | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cgrOverdueBilling?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  cgrIsActive?: boolean;
}
