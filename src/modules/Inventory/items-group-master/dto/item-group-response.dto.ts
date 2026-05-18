import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from 'src/common/configured-grid-sql/dto/configured-grid-style.dto';
import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as ItemGroupErrorFieldDto };
export { InventoryErrorResponseDto as ItemGroupErrorResponseDto };
export { InventoryListMetaDto as ItemGroupListMetaDto };

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

  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;

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
