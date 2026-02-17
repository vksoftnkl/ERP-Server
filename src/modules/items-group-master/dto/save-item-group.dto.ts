import {
  IsArray,
  IsBoolean,
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
import { Transform } from 'class-transformer';

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

const toNullablePhotoString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const photoPayload = value as {
    data_base64?: unknown;
    data_url?: unknown;
  };

  if (typeof photoPayload.data_base64 === 'string') {
    const trimmed = photoPayload.data_base64.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  if (typeof photoPayload.data_url === 'string') {
    const trimmed = photoPayload.data_url.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

export class SaveItemGroupDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item group',
  })
  @IsOptional()
  @IsUUID('all')
  itg_id?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  itg_name!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  itg_alias?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itg_short?: string;

  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  itg_description?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  itg_parent_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  itg_sort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  itg_level?: number;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  itg_path_ids_cache?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  itg_tax_claim?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  itg_default_tax_id?: string | null;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  itg_default_hsn?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  itg_default_uom_id?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Raw base64 string, data URL (data:*;base64,...) or object payload containing data_base64/data_url. For multipart/form-data, upload a file using the same field name.',
  })
  @IsOptional()
  @Transform(({ value }) => toNullablePhotoString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  itg_photo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itg_photo_url?: string;
}
