import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FixedErrorFieldDto,
  FixedErrorResponseDto,
} from '../../../common/utils/module-response.dto';

export {
  FixedErrorFieldDto as GridDetailErrorFieldDto,
  FixedErrorResponseDto as GridDetailErrorResponseDto,
};

export class GridColumnPayloadDto {
  @ApiProperty({ example: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001' })
  grid_column_id!: string;

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

  @ApiPropertyOptional({ nullable: true, example: '120px' })
  grid_column_px!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_column_sql_field_name!: string | null;

  @ApiProperty()
  grid_column_is_deleted!: boolean;

  @ApiProperty({ example: '2026-06-13T10:00:00.000Z' })
  grid_column_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  grid_column_created_by!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-13T10:00:00.000Z' })
  grid_column_modified_on!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_column_modified_by!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-13T10:00:00.000Z' })
  grid_column_sync_on!: string | null;
}

export class GridDetailPayloadDto {
  @ApiProperty({ example: '1' })
  grid_id!: string;

  @ApiProperty()
  grid_name!: string;

  @ApiPropertyOptional({ nullable: true })
  grid_description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sort_column!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sort_order!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_device_type!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_sql!: string | null;

  @ApiProperty()
  grid_status!: boolean;

  @ApiProperty()
  grid_is_deleted!: boolean;

  @ApiProperty({ example: '2026-06-13T10:00:00.000Z' })
  grid_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  grid_created_by!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-13T10:00:00.000Z' })
  grid_modified_on!: string | null;

  @ApiPropertyOptional({ nullable: true })
  grid_modified_by!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-13T10:00:00.000Z' })
  grid_sync_on!: string | null;

  @ApiProperty({ type: [GridColumnPayloadDto], description: 'Columns belonging to this grid' })
  columns!: GridColumnPayloadDto[];
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
}

export class GridDetailSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid details deleted successfully' })
  message!: string;

  @ApiProperty({ type: GridDetailDeleteResultDto })
  data!: GridDetailDeleteResultDto;
}

export class GridColumnDeleteResultDto {
  @ApiProperty({ example: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001' })
  grid_column_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class GridDetailSuccessColumnDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Grid column deleted successfully' })
  message!: string;

  @ApiProperty({ type: GridColumnDeleteResultDto })
  data!: GridColumnDeleteResultDto;
}

export class GridDetailColumnUpdateResultDto {
  @ApiProperty({ example: 2 })
  updated!: number;
}

export class GridDetailSuccessColumnUpdateDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: GridDetailColumnUpdateResultDto })
  data!: GridDetailColumnUpdateResultDto;
}
