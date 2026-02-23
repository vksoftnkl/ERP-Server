import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
  isUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toNullableUuid = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return isUUID(trimmed, 'all') ? trimmed : null;
};

const toNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toOptionalTypeCode = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
};

export class SaveAccountGroupDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing account group',
  })
  @IsOptional()
  @IsUUID('all')
  accGroupId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  accGroupCompanyId?: string | null;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  accGroupName!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  accGroupAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  accGroupShort?: string | null;

  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  accGroupDescription?: string | null;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(150)
  accGroupTallyName?: string | null;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(150)
  accGroupPrimaryName?: string | null;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  accGroupNature?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  accGroupParentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  accGroupSort?: number;

  @ApiProperty({
    minLength: 2,
    maxLength: 2,
    description: '2-char account group type code',
  })
  @Transform(({ value }) => toOptionalTypeCode(value))
  @IsString()
  @Length(2, 2)
  accGroupTypeCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accGroupIsDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accGroupBehaveAsSubledger?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accGroupNetDebitCredit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accGroupUsedForCalculation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accGroupAffectsGrossProfit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accGroupIsActive?: boolean;
}
