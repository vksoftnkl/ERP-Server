import { IsNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableInteger,
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumberString,
  TrimmedString,
} from '../../../common/dto/dtoDecorators';
import { SaveDropdownColumnDto } from './save-dropdown-column.dto';

export class SaveDropdownDetailDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates dropdown details',
    type: String,
  })
  @OptionalNumberString()
  dropdown_id?: string;

  @ApiProperty({ maxLength: 200, type: String })
  @TrimmedString(200)
  @IsNotEmpty()
  dropdown_name!: string;

  @ApiProperty({ description: 'SQL query for dropdown source', type: String })
  @TrimmedString()
  @IsNotEmpty()
  dropdown_sql!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  dropdown_description?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 20, type: String })
  @NullableString(20)
  dropdown_sort_order?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100, type: String })
  @NullableString(100)
  dropdown_sort_column?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  dropdown_completion?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  dropdown_sql_regional?: string | null;

  @ApiPropertyOptional({ minimum: 1, default: 10 })
  @OptionalInteger(1)
  dropdown_max_visible_items?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  dropdown_show_header?: boolean;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @NullableInteger(0)
  dropdown_width?: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  dropdown_device_type?: string | null;

  @ApiPropertyOptional({
    description: 'Array of columns to create or update for this dropdown',
    type: [SaveDropdownColumnDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveDropdownColumnDto)
  dropdown_columns?: SaveDropdownColumnDto[];

  @ApiPropertyOptional({
    description:
      'When true, columns not present in dropdown_columns are deleted (full replace). When false or omitted, provided columns are only created/updated.',
    default: false,
  })
  @OptionalBoolean()
  replace_columns?: boolean;
}
