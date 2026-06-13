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

export class SaveDropdownColumnDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates dropdown column by UUID',
    type: String,
  })
  @OptionalUuid()
  dropdown_columns_id?: string;

  @ApiProperty({ minimum: 1, type: Number })
  @RequiredInteger(1)
  dropdown_columns_no!: number;

  @ApiProperty({ maxLength: 50, type: String })
  @TrimmedString(50)
  @IsNotEmpty()
  dropdown_columns_data_type!: string;

  @ApiProperty({ maxLength: 200, type: String })
  @TrimmedString(200)
  @IsNotEmpty()
  dropdown_columns_name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200, type: String })
  @NullableString(200)
  dropdown_columns_alias?: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @NullableNumber()
  dropdown_columns_width?: number | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  dropdown_columns_visiblity?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 30, type: String })
  @NullableString(30)
  dropdown_columns_allignment?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  dropdown_columns_filter?: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  dropdown_columns_sql_name?: string | null;
}
