import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toNullableString } from 'src/common/dto/dto-transforms';


const toNullableScalarString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  return value as string;
};

const toOptionalIdString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  return value as string;
};

export class SaveGridDetailDto {
  @ApiPropertyOptional({ description: 'When provided, request updates grid details' })
  @IsOptional()
  @Transform(({ value }) => toOptionalIdString(value))
  @IsNumberString({ no_symbols: true })
  grid_id?: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  grid_name!: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(1000)
  grid_description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableScalarString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  grid_sort_column?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableScalarString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  grid_sort_order?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  grid_sql?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  grid_status?: boolean;
}
