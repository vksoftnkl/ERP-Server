import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDate,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  TrimmedString,
  UpperString,
} from '../../dto/dtoDecorators';

export class SaveAccountGroupDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing account group',
  })
  @OptionalUuid()
  accGroupId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  accGroupCompanyId?: string | null;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  accGroupName!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @NullableString(100)
  accGroupAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50 })
  @NullableString(50)
  accGroupShort?: string | null;

  @ApiPropertyOptional({ maxLength: 250 })
  @NullableString(250)
  accGroupDescription?: string | null;

  @ApiPropertyOptional({ maxLength: 150 })
  @NullableString(150)
  accGroupTallyName?: string | null;

  @ApiPropertyOptional({ maxLength: 150 })
  @NullableString(150)
  accGroupPrimaryName?: string | null;

  @ApiPropertyOptional({ maxLength: 20 })
  @NullableString(20)
  accGroupNature?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  accGroupParentId?: string | null;

  @ApiPropertyOptional()
  @OptionalInteger()
  accGroupSort?: number;

  @ApiProperty({
    minLength: 2,
    maxLength: 2,
    description: '2-char account group type code',
  })
  @UpperString(2)
  accGroupTypeCode!: string;

  @ApiPropertyOptional()
  @OptionalBoolean()
  accGroupIsDefault?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  accGroupBehaveAsSubledger?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  accGroupNetDebitCredit?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  accGroupUsedForCalculation?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  accGroupAffectsGrossProfit?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  accGroupIsActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @NullableDate()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Date)
  @IsDate()
  accGroupSyncDate?: Date | null;
}
