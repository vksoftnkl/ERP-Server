import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

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

const toNullableInteger = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export class SaveAreaDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing area',
  })
  @IsOptional()
  @IsUUID('all')
  armId?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  armName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  armAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  armShort?: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  armCityId!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  armSort?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  armDistanceKm?: number | null;

  @ApiPropertyOptional({ type: [Number], description: 'Collection days as integer array' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  armCollectionDays?: number[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  armIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  armCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  armModifiedBy?: string | null;
}
