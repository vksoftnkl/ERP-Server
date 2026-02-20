import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemCategoryErrorFieldDto {
  @ApiProperty({ example: 'category_name' })
  field!: string;

  @ApiProperty({ example: 'Duplicate category_name is not allowed' })
  message!: string;
}

export class ItemCategoryErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemCategoryErrorFieldDto, isArray: true })
  errors!: ItemCategoryErrorFieldDto[];
}

export class ItemCategoryPayloadDto {
  @ApiProperty({ format: 'uuid' })
  category_id!: string;

  @ApiProperty({ maxLength: 150 })
  category_name!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  category_alias!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  category_short!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  category_description!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  category_parent_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  category_sort!: number | null;

  @ApiPropertyOptional({ nullable: true })
  category_level!: number | null;

  @ApiProperty({ type: [String], example: [] })
  category_path_ids_cache!: string[];

  @ApiPropertyOptional({ nullable: true })
  category_tax_claim!: boolean | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  category_default_tax_id!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  category_default_hsn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  category_default_uom_id!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Base64 encoded image' })
  category_photo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  category_photo_url!: string | null;

  @ApiPropertyOptional({ nullable: true })
  category_sync_date!: string | null;

  @ApiProperty()
  category_is_active!: boolean;

  @ApiProperty()
  category_is_deleted!: boolean;

  @ApiProperty()
  category_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  category_created_by!: string | null;

  @ApiProperty()
  category_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  category_modified_by!: string | null;
}

export class ItemCategoryListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemCategoryDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  category_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemCategorySuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item category fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemCategoryPayloadDto })
  data!: ItemCategoryPayloadDto;
}

export class ItemCategorySuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item categories fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemCategoryPayloadDto, isArray: true })
  data!: ItemCategoryPayloadDto[];

  @ApiProperty({ type: ItemCategoryListMetaDto })
  meta!: ItemCategoryListMetaDto;
}

export class ItemCategorySuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item category deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemCategoryDeleteResultDto })
  data!: ItemCategoryDeleteResultDto;
}
