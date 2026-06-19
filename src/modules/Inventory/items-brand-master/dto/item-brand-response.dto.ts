import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as ItemBrandErrorFieldDto };
export { InventoryErrorResponseDto as ItemBrandErrorResponseDto };
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

export class ItemBrandDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  brand_id!: string;

  @ApiProperty({
    example: true,
    description: 'true when the item brand was soft deleted, false when it was restored',
  })
  deleted!: boolean;
}

export class ItemBrandSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item brand fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemBrandPayloadDto })
  data!: ItemBrandPayloadDto;
}
export class ItemBrandSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item brand deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemBrandDeleteResultDto })
  data!: ItemBrandDeleteResultDto;
}
