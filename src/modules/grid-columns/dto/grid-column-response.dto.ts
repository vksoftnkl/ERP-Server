import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GridColumnErrorFieldDto {
  @ApiProperty({ example: 'grid_column_name' })
  field!: string;

  @ApiProperty({ example: 'grid_column_name is required' })
  message!: string;
}

export class GridColumnErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: GridColumnErrorFieldDto, isArray: true })
  errors!: GridColumnErrorFieldDto[];
}

export class GridColumnPayloadDto {
  @ApiProperty({ example: '1' })
  grid_serialid!: string;

  @ApiProperty({ example: '1' })
  grid_id!: string;

  @ApiProperty()
  grid_column_number!: number;

  @ApiProperty()
  grid_column_name!: string;

  @ApiPropertyOptional({ nullable: true })
  grid_column_width!: number | null;

  @ApiPropertyOptional({ nullable: true })
  grid_column_position!: number | null;

  @ApiPropertyOptional({ nullable: true })
  grid_column_alignment!: string | null;

  @ApiProperty()
  grid_column_visibility!: boolean;

  @ApiProperty()
  grid_column_filter!: boolean;

  @ApiPropertyOptional({ nullable: true })
  grid_column_condition!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_column_condition_color!: string | null;

  @ApiProperty()
  grid_column_group!: boolean;

  @ApiProperty()
  grid_column_total!: boolean;

  @ApiPropertyOptional({ nullable: true })
  grid_column_data_type!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_column_color!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_column_notes!: string | null;

  @ApiProperty()
  grid_column_is_deleted!: boolean;
}

export class GridColumnListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class GridColumnDeleteResultDto {
  @ApiProperty({ example: '1' })
  grid_serialid!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class GridColumnSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid column fetched successfully' })
  message!: string;

  @ApiProperty({ type: GridColumnPayloadDto })
  data!: GridColumnPayloadDto;
}

export class GridColumnSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid columns fetched successfully' })
  message!: string;

  @ApiProperty({ type: GridColumnPayloadDto, isArray: true })
  data!: GridColumnPayloadDto[];

  @ApiProperty({ type: GridColumnListMetaDto })
  meta!: GridColumnListMetaDto;
}

export class GridColumnSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid column deleted successfully' })
  message!: string;

  @ApiProperty({ type: GridColumnDeleteResultDto })
  data!: GridColumnDeleteResultDto;
}
