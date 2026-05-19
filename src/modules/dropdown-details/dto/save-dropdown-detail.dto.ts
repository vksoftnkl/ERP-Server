import { IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableInteger,
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumberString,
  TrimmedString,
} from '../../../common/dto/dtoDecorators';

export class SaveDropdownDetailDto {
  @ApiPropertyOptional({ description: 'When provided, request updates dropdown details' })
  @OptionalNumberString()
  dropdown_id?: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  dropdown_name!: string;

  @ApiProperty({ description: 'SQL query for dropdown source' })
  @TrimmedString()
  @IsNotEmpty()
  dropdown_sql!: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  dropdown_description?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 20 })
  @NullableString(20)
  dropdown_sort_order?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  dropdown_sort_column?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  dropdown_completion?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  dropdown_sql_regional?: string | null;

  @ApiPropertyOptional({ minimum: 1, default: 10 })
  @OptionalInteger(1)
  dropdown_max_visible_items?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  dropdown_show_header?: boolean;

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @NullableInteger(1)
  dropdown_width?: number | null;
}
