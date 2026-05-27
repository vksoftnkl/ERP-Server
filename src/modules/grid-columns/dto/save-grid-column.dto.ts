import { IsNotEmpty, IsNumberString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableNumber,
  NullableString,
  OptionalBoolean,
  OptionalNumberString,
  RequiredInteger,
  TrimmedString,
} from '../../../common/dto/dtoDecorators';
import { toOptionalIdString } from '../../../common/dto/DtoTransforms';

export class SaveGridColumnDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates grid column',
  })
  @OptionalNumberString()
  grid_serialid?: string;

  @ApiProperty({ description: 'Numeric grid id' })
  @Transform(({ value }) => toOptionalIdString(value))
  @IsNumberString({ no_symbols: true })
  grid_id!: string;

  @ApiProperty({ minimum: 1 })
  @RequiredInteger(1)
  grid_column_number!: number;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  grid_column_name!: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  grid_column_width?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  grid_column_position?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  grid_column_alignment?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  grid_column_visibility?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  grid_column_filter?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  grid_column_condition?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  grid_column_condition_color?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  grid_column_group?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  grid_column_total?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  grid_column_data_type?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  grid_column_color?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @NullableString(1000)
  grid_column_notes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  grid_column_sql_field_name?: string | null;
}
