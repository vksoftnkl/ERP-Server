import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ModuleErrorFieldDto,
  ModuleErrorResponseDto,
  ModuleListMetaDto,
} from '../../../common/utils/module-response.dto';
export {
  ModuleErrorFieldDto as DropdownDetailErrorFieldDto,
  ModuleErrorResponseDto as DropdownDetailErrorResponseDto,
  ModuleListMetaDto as DropdownDetailListMetaDto,
};
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
  @ApiProperty({ type: ModuleListMetaDto })
  meta!: ModuleListMetaDto;
}
export class DropdownDetailSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Dropdown details deleted successfully' })
  message!: string;
  @ApiProperty({ type: DropdownDetailDeleteResultDto })
  data!: DropdownDetailDeleteResultDto;
}