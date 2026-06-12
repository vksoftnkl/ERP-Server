import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ConfiguredGridStyleDto {
  @ApiProperty({ example: '1' })
  grid_column_id!: string;

  @ApiProperty({ example: 1 })
  grid_column_number!: number;
  @ApiProperty({ example: 'unit_name' })
  grid_column_name!: string;
  @ApiPropertyOptional({ nullable: true, example: 180 })
  grid_column_width!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 1 })
  grid_column_position!: number | null;
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

  @ApiPropertyOptional({ nullable: true, example: 'unit_name' })
  grid_column_sql_field_name!: string | null;
}
