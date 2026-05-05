import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from 'src/common/configured-grid-sql/dto/configured-grid-style.dto';
export class ItemGroupErrorFieldDto {
  @ApiProperty({ example: 'itg_name' })
  field!: string;

  @ApiProperty({ example: 'Duplicate itg_name is not allowed' })
  message!: string;
}

export class ItemGroupErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemGroupErrorFieldDto, isArray: true })
  errors!: ItemGroupErrorFieldDto[];
}

export class ItemGroupPayloadDto {
  @ApiProperty({ format: 'uuid' })
  itg_id!: string;

  @ApiProperty({ maxLength: 150 })
  itg_name!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  itg_alias!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  itg_short!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  itg_description!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  itg_parent_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  itg_sort!: number | null;

  @ApiPropertyOptional({ nullable: true })
  itg_level!: number | null;

  @ApiProperty({ type: [String], example: [] })
  itg_path_ids_cache!: string[];

  @ApiPropertyOptional({ nullable: true })
  itg_tax_claim!: boolean | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  itg_default_tax_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  itg_default_hsn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  itg_default_uom_id!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Base64 encoded image' })
  itg_photo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  itg_photo_url!: string | null;

  @ApiPropertyOptional({ nullable: true })
  itg_sync_date!: string | null;

  @ApiProperty()
  itg_is_active!: boolean;

  @ApiProperty()
  itg_is_deleted!: boolean;

  @ApiProperty()
  itg_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  itg_created_by!: string | null;

  @ApiProperty()
  itg_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  itg_modified_by!: string | null;
}

export class ItemGroupListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemGroupDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  itg_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemGroupSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item group fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemGroupPayloadDto })
  data!: ItemGroupPayloadDto;
}

export class ItemGroupSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item groups fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemGroupPayloadDto, isArray: true })
  data!: ItemGroupPayloadDto[];

  @ApiProperty({ type: ItemGroupListMetaDto })
  meta!: ItemGroupListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class ItemGroupSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item group deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemGroupDeleteResultDto })
  data!: ItemGroupDeleteResultDto;
}
