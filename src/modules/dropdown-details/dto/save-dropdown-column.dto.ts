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
  drop_columns_id?: string;

  @ApiProperty({ minimum: 1, type: Number })
  @RequiredInteger(1)
  drop_columns_column_no!: number;

  @ApiProperty({ maxLength: 50, type: String })
  @TrimmedString(50)
  @IsNotEmpty()
  drop_columns_data_type!: string;

  @ApiProperty({ maxLength: 200, type: String })
  @TrimmedString(200)
  @IsNotEmpty()
  drop_columns_column_name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200, type: String })
  @NullableString(200)
  drop_columns_column_alias?: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @NullableNumber()
  drop_columns_column_width?: number | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  drop_columns_column_visiblity?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 30, type: String })
  @NullableString(30)
  drop_columns_column_allignment?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  drop_columns_column_filter?: boolean;
}
