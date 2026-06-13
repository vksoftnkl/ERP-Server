import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FixedErrorFieldDto,
  FixedErrorResponseDto,
} from '../../../common/utils/module-response.dto';

export {
  FixedErrorFieldDto as DropdownDetailErrorFieldDto,
  FixedErrorResponseDto as DropdownDetailErrorResponseDto,
};

export class DropdownColumnPayloadDto {
  @ApiProperty({ example: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001' })
  dropdown_columns_id!: string;

  @ApiProperty({ example: '1' })
  dropdown_columns_dropdown_id!: string;

  @ApiProperty()
  dropdown_columns_no!: number;

  @ApiProperty()
  dropdown_columns_data_type!: string;

  @ApiProperty()
  dropdown_columns_name!: string;

  @ApiPropertyOptional({ nullable: true })
  dropdown_columns_alias!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dropdown_columns_width!: number | null;

  @ApiProperty()
  dropdown_columns_visiblity!: boolean;

  @ApiPropertyOptional({ nullable: true })
  dropdown_columns_allignment!: string | null;

  @ApiProperty()
  dropdown_columns_filter!: boolean;

  @ApiPropertyOptional({ nullable: true })
  dropdown_columns_sql_name!: string | null;
}

export class DropdownDetailPayloadDto {
  @ApiProperty({ example: '1' })
  dropdown_id!: string;

  @ApiProperty()
  dropdown_name!: string;

  @ApiPropertyOptional({ nullable: true })
  dropdown_description!: string | null;

  @ApiProperty()
  dropdown_sql!: string;

  @ApiPropertyOptional({ nullable: true })
  dropdown_sort_order!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dropdown_sort_column!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dropdown_completion!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dropdown_sql_regional!: string | null;

  @ApiProperty()
  dropdown_max_visible_items!: number;

  @ApiProperty()
  dropdown_show_header!: boolean;

  @ApiPropertyOptional({ nullable: true })
  dropdown_width!: number | null;

  @ApiPropertyOptional({ nullable: true })
  dropdown_device_type!: string | null;

  @ApiProperty({
    type: [DropdownColumnPayloadDto],
    description: 'Columns belonging to this dropdown',
  })
  columns!: DropdownColumnPayloadDto[];
}

export class DropdownDetailDeleteResultDto {
  @ApiProperty({ example: '1' })
  dropdown_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class DropdownDetailSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Dropdown details fetched successfully' })
  message!: string;

  @ApiProperty({ type: DropdownDetailPayloadDto })
  data!: DropdownDetailPayloadDto;
}

export class DropdownDetailSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Dropdown details fetched successfully' })
  message!: string;

  @ApiProperty({ type: DropdownDetailPayloadDto, isArray: true })
  data!: DropdownDetailPayloadDto[];
}

export class DropdownDetailSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Dropdown details deleted successfully' })
  message!: string;

  @ApiProperty({ type: DropdownDetailDeleteResultDto })
  data!: DropdownDetailDeleteResultDto;
}

export class DropdownColumnDeleteResultDto {
  @ApiProperty({ example: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001' })
  dropdown_columns_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class DropdownDetailSuccessColumnDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Dropdown column deleted successfully' })
  message!: string;

  @ApiProperty({ type: DropdownColumnDeleteResultDto })
  data!: DropdownColumnDeleteResultDto;
}

export class DropdownDetailColumnUpdateResultDto {
  @ApiProperty({ example: 2 })
  updated!: number;
}

export class DropdownDetailSuccessColumnUpdateDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: DropdownDetailColumnUpdateResultDto })
  data!: DropdownDetailColumnUpdateResultDto;
}
