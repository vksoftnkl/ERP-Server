import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalIntegerArray,
  OptionalUuid,
  TrimmedString,
} from '../../dto/dtoDecorators';

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

  @ApiPropertyOptional({ default: 0 })
  @NullableNumber()
  cgrOrder?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableNumber()
  cgrDiscPerc?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Collection days as integer array (JSON array or comma-separated values)',
  })
  @OptionalIntegerArray()
  cgrCollectionDays?: number[];

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cgrDebitAllowed?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  cgrDebitDays?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableNumber()
  cgrDebitLimit?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  cgrBillsLimit?: number;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  cgrOverdueBilling?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  cgrIsActive?: boolean;
}
