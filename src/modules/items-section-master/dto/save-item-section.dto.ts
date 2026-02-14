import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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

export class SaveItemSectionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item section',
  })
  @IsOptional()
  @IsUUID('all')
  sec_id?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  sec_name!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sec_alias?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sec_short?: string;

  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  sec_description?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  sec_company_id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  sec_parent_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sec_sort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sec_level?: number;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  sec_path_ids?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sec_position?: number;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sec_color_code?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sec_icon?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Raw base64 string or data URL (data:*;base64,...). For multipart/form-data, upload a file using the same field name.',
  })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  sec_photo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sec_photo_url?: string;
}
