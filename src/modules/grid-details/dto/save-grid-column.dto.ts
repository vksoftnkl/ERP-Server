import { IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableNumber,
  NullableString,
  OptionalBoolean,
  OptionalUuid,
  RequiredInteger,
  TrimmedString,
} from '../../../common/dto/dtoDecorators';

export class SaveGridColumnDto {
  @ApiPropertyOptional({ description: 'When provided, request updates grid column by UUID', type: String })
  @OptionalUuid()
  grid_serialid?: string;

  @ApiProperty({ minimum: 1, type: Number })
  @RequiredInteger(1)
  grid_column_number!: number;

  @ApiProperty({ maxLength: 200, type: String })
  @TrimmedString(200)
  @IsNotEmpty()
  grid_column_name!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @NullableNumber()
  grid_column_width?: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @NullableNumber()
  grid_column_position?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100, type: String })
  @NullableString(100)
  grid_column_alignment?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  grid_column_visibility?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  grid_column_filter?: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  grid_column_condition?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100, type: String })
  @NullableString(100)
  grid_column_condition_color?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  grid_column_group?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  grid_column_total?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 100, type: String })
  @NullableString(100)
  grid_column_data_type?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100, type: String })
  @NullableString(100)
  grid_column_color?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000, type: String })
  @NullableString(1000)
  grid_column_notes?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  grid_column_sql_field_name?: string | null;
}
