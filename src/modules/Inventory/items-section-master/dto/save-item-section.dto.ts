import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableString, NullableUuid } from 'src/common/dto/dtoDecorators';

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

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sec_parent_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sec_sort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sec_level?: number;

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
      'Base64 string or data URL (data:*;base64,...). For multipart/form-data, upload a file using the same field name to send raw bytes.',
  })
  @NullableString()
  sec_photo?: string | Buffer | Uint8Array | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sec_photo_url?: string;
}
