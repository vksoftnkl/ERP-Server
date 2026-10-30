import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { NullableString, NullableUuid, toTrimmedString } from 'src/common/dto/dtoDecorators';
export class SaveItemBrandDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item brand',
  })
  @IsOptional()
  @IsUUID('all')
  brand_id?: string;
  @ApiProperty({ maxLength: 150, description: 'Trimmed; a blank name is refused (notes 139 A1).' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  brand_name!: string;
  @ApiPropertyOptional({ maxLength: 150, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(150)
  brand_alias?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(50)
  brand_short?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(250)
  brand_description?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  brand_parent_id?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  brand_sort?: number;
  @ApiPropertyOptional({
    description:
      'Accepted and IGNORED: the level is the node depth (root = 1), computed by the server.',
  })
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
