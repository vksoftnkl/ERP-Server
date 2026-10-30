import { IsNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  OptionalBoolean,
  OptionalNumberString,
  TrimmedString,
} from '../../../common/dto/dtoDecorators';
import { gridDeviceTypeEnum } from '../types/grid-detail-enum';
import { SaveGridColumnDto } from './save-grid-column.dto';

export class SaveGridDetailDto {
  @ApiPropertyOptional({ description: 'When provided, request updates grid details', type: String })
  @OptionalNumberString()
  grid_id?: string;

  @ApiProperty({ maxLength: 200, type: String })
  @TrimmedString(200)
  @IsNotEmpty()
  grid_name!: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true, type: String })
  @NullableString(1000)
  grid_description?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  grid_sort_column?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  grid_sort_order?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @NullableString()
  grid_sql?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  grid_status?: boolean;

  @ApiProperty({ maxLength: 200, enum: gridDeviceTypeEnum })
  @TrimmedString(200)
  @IsNotEmpty()
  grid_device_type!: gridDeviceTypeEnum;

  @ApiPropertyOptional({
    description: 'Array of columns to create or update for this grid',
    type: [SaveGridColumnDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveGridColumnDto)
  grid_columns?: SaveGridColumnDto[];

  @ApiPropertyOptional({
    description:
      'When true, columns not present in grid_columns are soft deleted (full replace). When false or omitted, provided columns are only created/updated.',
    default: false,
  })
  @OptionalBoolean()
  replace_columns?: boolean;
}
