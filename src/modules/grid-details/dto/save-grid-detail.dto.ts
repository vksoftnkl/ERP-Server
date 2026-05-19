import { IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  OptionalBoolean,
  OptionalNumberString,
  TrimmedString,
} from '../../../common/dto/dtoDecorators';

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
}
