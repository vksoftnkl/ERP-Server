import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  toTrimmedString,
} from 'src/common/dto/dtoDecorators';

export class SaveItemUnitConversionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item unit conversion row',
  })
  @OptionalUuid()
  iuc_id?: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  iuc_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  iuc_unit_id!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iuc_base_unit_id?: string;
  @ApiPropertyOptional({ example: 1 })
  @OptionalNumber()
  iuc_to_base_factor?: number;
  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  iuc_unit_slno?: number;
  @ApiPropertyOptional({ example: 1 })
  @OptionalNumber()
  iuc_unit_factor?: number;
  @OptionalNumber()
  iul_unit_factor?: number;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  iuc_is_default_unit?: boolean;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  iuc_is_base_unit?: boolean;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  iuc_is_big_unit?: boolean;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  iuc_uom_weight?: number;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  iuc_uom_remarks?: string | null;
  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  iuc_is_active?: boolean;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  iuc_sync_date?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  iuc_created_by?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  iuc_updated_by?: string | null;
}
