import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableInteger,
  NullableNumber,
  NullableString,
  NullableUuid,
  toTrimmedString,
} from 'src/common/dto/dtoDecorators';

/** The decimals the units screen offers (notes 139 B5). */
export const MAX_UNIT_DECIMAL_COUNT = 3;

export class SaveUnitDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the unit',
  })
  @NullableUuid()
  unit_id?: string;

  @ApiProperty({
    maxLength: 50,
    description:
      'Trimmed. Unique among live units ignoring case: a new or renamed unit whose name only ' +
      'differs in case from another live unit is a 409 UNIT_NAME_TAKEN (notes 139 B6).',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit_name!: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  unit_alias?: string | null;

  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: 'A GST unit code (item_gst_units); an unknown one is a 400 UNIT_CODE_NOT_FOUND.',
  })
  @NullableString(30)
  unit_code?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  unit_description?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: MAX_UNIT_DECIMAL_COUNT })
  @NullableInteger(0)
  @Max(MAX_UNIT_DECIMAL_COUNT)
  unit_decimal_count?: number;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @NullableNumber(0)
  unit_weight?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  unit_loading?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  unit_unloading?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  unit_attach_charge?: number | null;

  @ApiPropertyOptional({
    default: false,
    description: 'A pack unit needs unit_base_unit_id: 400 UNIT_PACK_BASE_REQUIRED without one.',
  })
  @IsOptional()
  @IsBoolean()
  unit_is_pack_unit?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  unit_base_unit_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  @ValidateIf(
    (dto: SaveUnitDto) => dto.unit_base_unit_id !== undefined && dto.unit_base_unit_id !== null,
  )
  @IsNumber()
  @IsPositive()
  unit_conversion?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  unit_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  unit_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  unit_modified_by?: string | null;
}
