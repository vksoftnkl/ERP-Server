import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  OptionalQueryBoolean,
  OptionalUuid,
  toTrimmedString,
} from 'src/common/dto/dtoDecorators';

export class SaveItemEanCodeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing EAN code row',
  })
  @OptionalUuid()
  ean_id?: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ean_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ean_unit_id!: string;

  @ApiProperty({ maxLength: 64 })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  ean_code!: string;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  ean_is_default?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  ean_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ean_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ean_modified_by?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  ean_remarks?: string | null;
}
