import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableInteger,
  NullableNumber,
  NullableString,
  NullableUuid,
} from '../../utils/inventory-dto.decorators';

export class SaveUnitDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the unit',
  })
  @NullableUuid()
  unit_id?: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit_name!: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  unit_alias?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  unit_code?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  unit_description?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  unit_decimal_count?: number;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
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

  @ApiPropertyOptional({ default: false })
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
