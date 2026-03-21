import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

const toRequiredUpperCode = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim().toUpperCase();
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

const toNullableUpperCode = (value: unknown): string | null | undefined => {
  const normalized = toNullableString(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  return normalized.toUpperCase();
};

export class SaveStateCodeMasterDto {
  @ApiProperty({ minLength: 2, maxLength: 2, description: '2-character state code' })
  @Transform(({ value }) => toRequiredUpperCode(value))
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  stateCode!: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  stateName!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  stateUt?: boolean;

  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperCode(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Length(2, 2)
  tinCode?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  createdBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  modifiedBy?: string | null;
}
