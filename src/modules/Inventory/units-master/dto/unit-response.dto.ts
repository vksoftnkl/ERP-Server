import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as UnitErrorFieldDto };
export { InventoryErrorResponseDto as UnitErrorResponseDto };
export class UnitPayloadDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  unit_id!: string;

  @ApiProperty({ maxLength: 50 })
  unit_name!: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  unit_alias!: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  unit_code!: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  unit_description!: string | null;

  @ApiProperty({ example: 0 })
  unit_decimal_count!: number;

  @ApiPropertyOptional({ nullable: true, example: 0.5 })
  unit_weight!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 5 })
  unit_loading!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 5 })
  unit_unloading!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 2 })
  unit_attach_charge!: number | null;

  @ApiProperty({ example: false })
  unit_is_pack_unit!: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    example: '019c6f6c-be87-7a11-8905-36092c46fd06',
  })
  unit_base_unit_id!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true, example: 'Box' })
  unit_base_unit_name!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 10 })
  unit_conversion!: number | null;

  @ApiProperty({ example: true })
  unit_is_active!: boolean;

  @ApiProperty({ example: false })
  unit_is_deleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  unit_sync_date!: string | null;

  @ApiProperty()
  unit_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  unit_created_by!: string | null;

  @ApiProperty()
  unit_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  unit_modified_by!: string | null;
}

export class UnitGridStyleDto {
  @ApiProperty({ example: 1 })
  grid_column_number!: number;

  @ApiProperty({ example: 'unit_name' })
  grid_column_name!: string;

  @ApiPropertyOptional({ nullable: true, example: 180 })
  grid_column_width!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'left' })
  grid_column_alignment!: string | null;

  @ApiProperty({ example: true })
  grid_column_visibility!: boolean;

  @ApiProperty({ example: true })
  grid_column_filter!: boolean;

  @ApiPropertyOptional({ nullable: true, example: null })
  grid_column_condition!: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  grid_column_condition_color!: string | null;

  @ApiProperty({ example: false })
  grid_column_group!: boolean;

  @ApiProperty({ example: false })
  grid_column_total!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'text' })
  grid_column_data_type!: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  grid_column_color!: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  grid_column_notes!: string | null;
}

export class UnitDeleteResultDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  unit_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class UnitSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Unit fetched successfully' })
  message!: string;

  @ApiProperty({ type: UnitPayloadDto })
  data!: UnitPayloadDto;
}
export class UnitSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Unit deleted successfully' })
  message!: string;

  @ApiProperty({ type: UnitDeleteResultDto })
  data!: UnitDeleteResultDto;
}
