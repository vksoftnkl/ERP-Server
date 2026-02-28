import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DropdownDetailErrorFieldDto {
  @ApiProperty({ example: 'dropdown_name' })
  field!: string;

  @ApiProperty({ example: 'dropdown_name is required' })
  message!: string;
}

export class DropdownDetailErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: DropdownDetailErrorFieldDto, isArray: true })
  errors!: DropdownDetailErrorFieldDto[];
}

export class DropdownDetailPayloadDto {
  @ApiProperty({ example: '1' })
  dropdown_id!: string;

  @ApiProperty()
  dropdown_name!: string;

  @ApiProperty()
  dropdown_sql!: string;

  @ApiPropertyOptional({ nullable: true })
  dropdown_description!: string | null;

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
}

export class DropdownDetailListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
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

  @ApiProperty({ type: DropdownDetailListMetaDto })
  meta!: DropdownDetailListMetaDto;
}

export class DropdownDetailSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Dropdown details deleted successfully' })
  message!: string;

  @ApiProperty({ type: DropdownDetailDeleteResultDto })
  data!: DropdownDetailDeleteResultDto;
}
