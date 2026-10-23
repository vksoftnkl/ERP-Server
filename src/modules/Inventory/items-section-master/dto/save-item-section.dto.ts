import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { NullableString, NullableUuid, toTrimmedString } from 'src/common/dto/dtoDecorators';

export class SaveItemSectionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item section',
  })
  @IsOptional()
  @IsUUID('all')
  sec_id?: string;

  @ApiProperty({ maxLength: 150, description: 'Trimmed; a blank name is refused (notes 139 A1).' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  sec_name!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(100)
  sec_alias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(50)
  sec_short?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true, description: 'Blank is stored as NULL.' })
  @NullableString(250)
  sec_description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sec_parent_id?: string | null;

  @ApiPropertyOptional({
    description:
      'The section position: grid 50 and dropdown 19 list sections by it, then by name. ' +
      'sec_position is kept equal to it.',
  })
  @IsOptional()
  @IsInt()
  sec_sort?: number;

  @ApiPropertyOptional({
    description:
      'Accepted and IGNORED: the level is the node depth (root = 1), computed by the server.',
  })
  @IsOptional()
  @IsInt()
  sec_level?: number;

  @ApiPropertyOptional({
    description: 'Same fact as sec_sort, and used for it only when sec_sort is not sent.',
  })
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
