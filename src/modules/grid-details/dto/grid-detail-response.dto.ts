import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GridDetailErrorFieldDto {
  @ApiProperty({ example: 'grid_name' })
  field!: string;

  @ApiProperty({ example: 'grid_name is required' })
  message!: string;
}

export class GridDetailErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: GridDetailErrorFieldDto, isArray: true })
  errors!: GridDetailErrorFieldDto[];
}

export class GridDetailPayloadDto {
  @ApiProperty({ example: '1' })
  grid_id!: string;

  @ApiProperty()
  grid_name!: string;

  @ApiPropertyOptional({ nullable: true })
  grid_description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sort_column!: number | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sort_order!: number | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sql!: string | null;

  @ApiProperty()
  grid_status!: boolean;

  @ApiProperty()
  grid_is_deleted!: boolean;
}

export class GridDetailListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class GridDetailDeleteResultDto {
  @ApiProperty({ example: '1' })
  grid_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class GridDetailSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid details fetched successfully' })
  message!: string;

  @ApiProperty({ type: GridDetailPayloadDto })
  data!: GridDetailPayloadDto;
}

export class GridDetailSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid details fetched successfully' })
  message!: string;

  @ApiProperty({ type: GridDetailPayloadDto, isArray: true })
  data!: GridDetailPayloadDto[];

  @ApiProperty({ type: GridDetailListMetaDto })
  meta!: GridDetailListMetaDto;
}

export class GridDetailSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid details deleted successfully' })
  message!: string;

  @ApiProperty({ type: GridDetailDeleteResultDto })
  data!: GridDetailDeleteResultDto;
}
