import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ModuleErrorFieldDto,
  ModuleErrorResponseDto,
  ModuleListMetaDto,
} from '../../../common/utils/module-response.dto';

export {
  ModuleErrorFieldDto as DropdownColumnErrorFieldDto,
  ModuleErrorResponseDto as DropdownColumnErrorResponseDto,
  ModuleListMetaDto as DropdownColumnListMetaDto,
};

export class DropdownColumnPayloadDto {
  @ApiProperty({ example: '1' })
  drop_columns_serial_id!: string;

  @ApiProperty({ example: '1' })
  dropdown_id!: string;

  @ApiProperty()
  drop_columns_column_no!: number;

  @ApiProperty()
  drop_columns_data_type!: string;

  @ApiProperty()
  drop_columns_column_name!: string;

  @ApiPropertyOptional({ nullable: true })
  drop_columns_column_alias!: string | null;

  @ApiPropertyOptional({ nullable: true })
  drop_columns_column_width!: number | null;

  @ApiProperty()
  drop_columns_column_visiblity!: boolean;

  @ApiPropertyOptional({ nullable: true })
  drop_columns_column_allignment!: string | null;

  @ApiProperty()
  drop_columns_column_filter!: boolean;

  @ApiProperty()
  drop_columns_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  drop_columns_modified_on!: string | null;
}

export class DropdownColumnDeleteResultDto {
  @ApiProperty({ example: '1' })
  drop_columns_serial_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class DropdownColumnSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Dropdown column fetched successfully' })
  message!: string;

  @ApiProperty({ type: DropdownColumnPayloadDto })
  data!: DropdownColumnPayloadDto;
}

export class DropdownColumnSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Dropdown columns fetched successfully' })
  message!: string;

  @ApiProperty({ type: DropdownColumnPayloadDto, isArray: true })
  data!: DropdownColumnPayloadDto[];

  @ApiProperty({ type: ModuleListMetaDto })
  meta!: ModuleListMetaDto;
}

export class DropdownColumnSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Dropdown column deleted successfully' })
  message!: string;

  @ApiProperty({ type: DropdownColumnDeleteResultDto })
  data!: DropdownColumnDeleteResultDto;
}
