import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { NullableUuid } from '../../utils/inventory-dto.decorators';

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

export class SaveItemCategoryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item category',
  })
  @IsOptional()
  @IsUUID('all')
  category_id?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  category_name!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category_alias?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category_short?: string;

  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  category_description?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  category_parent_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  category_sort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  category_level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  category_tax_claim?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  category_default_tax_id?: string | null;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  category_default_hsn?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  category_default_uom_id?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Raw base64 string, data URL (data:*;base64,...) or object payload containing data_base64/data_url. For multipart/form-data, upload a file using the same field name.',
  })
  @IsOptional()
  @Transform(({ value }) => toNullablePhotoString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  category_photo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category_photo_url?: string;
}
