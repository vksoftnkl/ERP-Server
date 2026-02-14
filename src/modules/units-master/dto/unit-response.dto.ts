import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UnitErrorFieldDto {
  @ApiProperty({ example: 'unit_name' })
  field!: string;

  @ApiProperty({ example: 'Duplicate unit_name is not allowed' })
  message!: string;
}

export class UnitErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: UnitErrorFieldDto, isArray: true })
  errors!: UnitErrorFieldDto[];
}

export class UnitPayloadDto {
  @ApiProperty({ example: 1 })
  unit_id!: number;

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

  @ApiPropertyOptional({ nullable: true, example: 1 })
  unit_base_unit_id!: number | null;

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

export class UnitListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class UnitDeleteResultDto {
  @ApiProperty({ example: 1 })
  unit_id!: number;

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

export class UnitSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Units fetched successfully' })
  message!: string;

  @ApiProperty({ type: UnitPayloadDto, isArray: true })
  data!: UnitPayloadDto[];

  @ApiProperty({ type: UnitListMetaDto })
  meta!: UnitListMetaDto;
}

export class UnitSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Unit deleted successfully' })
  message!: string;

  @ApiProperty({ type: UnitDeleteResultDto })
  data!: UnitDeleteResultDto;
}
