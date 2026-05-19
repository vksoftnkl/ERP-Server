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

export class SaveDropdownColumnDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates dropdown column',
  })
  @OptionalNumberString()
  drop_columns_serial_id?: string;

  @ApiProperty({ description: 'Numeric dropdown id' })
  @Transform(({ value }) => toOptionalIdString(value))
  @IsNumberString({ no_symbols: true })
  dropdown_id!: string;

  @ApiProperty({ minimum: 1 })
  @RequiredInteger(1)
  drop_columns_column_no!: number;

  @ApiProperty({ maxLength: 50 })
  @TrimmedString(50)
  @IsNotEmpty()
  drop_columns_data_type!: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  drop_columns_column_name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @NullableString(200)
  drop_columns_column_alias?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  drop_columns_column_width?: number | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  drop_columns_column_visiblity?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 30 })
  @NullableString(30)
  drop_columns_column_allignment?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  drop_columns_column_filter?: boolean;
}
