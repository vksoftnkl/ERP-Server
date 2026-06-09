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
  @ApiPropertyOptional({ description: 'When provided, request updates grid details' })
  @OptionalNumberString()
  grid_id?: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  grid_name!: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @NullableString(1000)
  grid_description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  grid_sort_column?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  grid_sort_order?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  grid_sql?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  grid_status?: boolean;

  @ApiProperty({ maxLength: 200 })
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
}
