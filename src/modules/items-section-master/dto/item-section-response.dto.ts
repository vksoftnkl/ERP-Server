import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemSectionErrorFieldDto {
  @ApiProperty({ example: 'sec_name' })
  field!: string;

  @ApiProperty({ example: 'Duplicate sec_name is not allowed' })
  message!: string;
}

export class ItemSectionErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemSectionErrorFieldDto, isArray: true })
  errors!: ItemSectionErrorFieldDto[];
}

export class ItemSectionPayloadDto {
  @ApiProperty({ format: 'uuid' })
  sec_id!: string;

  @ApiProperty({ maxLength: 150 })
  sec_name!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sec_alias!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  sec_short!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sec_description!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sec_parent_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sec_sort!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sec_level!: number | null;

  @ApiProperty({ type: [String], example: [] })
  sec_path_ids!: string[];

  @ApiPropertyOptional({ nullable: true })
  sec_position!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sec_color_code!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sec_icon!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Base64 encoded image' })
  sec_photo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sec_photo_url!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sec_sync_date!: string | null;

  @ApiProperty()
  sec_is_active!: boolean;

  @ApiProperty()
  sec_is_deleted!: boolean;

  @ApiProperty()
  sec_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  sec_created_by!: string | null;

  @ApiProperty()
  sec_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  sec_modified_by!: string | null;
}

export class ItemSectionListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemSectionDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  sec_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemSectionSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item section fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemSectionPayloadDto })
  data!: ItemSectionPayloadDto;
}

export class ItemSectionSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item sections fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemSectionPayloadDto, isArray: true })
  data!: ItemSectionPayloadDto[];

  @ApiProperty({ type: ItemSectionListMetaDto })
  meta!: ItemSectionListMetaDto;
}

export class ItemSectionSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item section deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemSectionDeleteResultDto })
  data!: ItemSectionDeleteResultDto;
}
