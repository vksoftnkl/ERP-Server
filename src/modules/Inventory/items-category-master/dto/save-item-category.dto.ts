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
import { NullableString, NullableUuid, toTrimmedString } from 'src/common/dto/dtoDecorators';

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

  @ApiProperty({ maxLength: 150, description: 'Trimmed; a blank name is refused (notes 139 A1).' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  category_name!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(100)
  category_alias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(50)
  category_short?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(250)
  category_description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  category_parent_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  category_sort?: number;

  @ApiPropertyOptional({
    description:
      'Accepted and IGNORED: the level is the node depth (root = 1), computed by the server.',
  })
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
