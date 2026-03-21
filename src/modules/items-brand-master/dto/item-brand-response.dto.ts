import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class ItemBrandErrorFieldDto {
  @ApiProperty({ example: 'brand_name' })
  field!: string;

  @ApiProperty({ example: 'Duplicate brand_name is not allowed' })
  message!: string;
}

export class ItemBrandErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemBrandErrorFieldDto, isArray: true })
  errors!: ItemBrandErrorFieldDto[];
}

export class ItemBrandPayloadDto {
  @ApiProperty({ format: 'uuid' })
  brand_id!: string;

  @ApiProperty({ maxLength: 150 })
  brand_name!: string;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  brand_alias!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  brand_short!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  brand_description!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Base64 encoded image' })
  brand_photo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brand_photo_url!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  brand_parent_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brand_sort!: number | null;

  @ApiPropertyOptional({ nullable: true })
  brand_level!: number | null;

  @ApiProperty({ type: [String], example: [] })
  brand_path_ids!: string[];

  @ApiProperty()
  brand_is_active!: boolean;

  @ApiProperty()
  brand_is_deleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  brand_sync_date!: string | null;

  @ApiProperty()
  brand_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  brand_created_by!: string | null;

  @ApiProperty()
  brand_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  brand_modified_by!: string | null;
}

export class ItemBrandListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemBrandDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  brand_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemBrandSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item brand fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemBrandPayloadDto })
  data!: ItemBrandPayloadDto;
}

export class ItemBrandSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item brands fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemBrandPayloadDto, isArray: true })
  data!: ItemBrandPayloadDto[];

  @ApiProperty({ type: ItemBrandListMetaDto })
  meta!: ItemBrandListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class ItemBrandSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item brand deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemBrandDeleteResultDto })
  data!: ItemBrandDeleteResultDto;
}
