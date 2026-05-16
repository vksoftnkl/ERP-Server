import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableString, NullableUuid } from '../../utils/inventory-dto.decorators';
export class SaveItemBrandDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item brand',
  })
  @IsOptional()
  @IsUUID('all')
  brand_id?: string;
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  brand_name!: string;
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  brand_alias?: string;
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand_short?: string;
  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  brand_description?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  brand_parent_id?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  brand_sort?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  brand_level?: number;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Raw base64 string or data URL (data:*;base64,...). For multipart/form-data, upload a file using the same field name.',
  })
  @NullableString()
  brand_photo?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand_photo_url?: string;
}
