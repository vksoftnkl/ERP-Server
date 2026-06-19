import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as ItemSectionErrorFieldDto };
export { InventoryErrorResponseDto as ItemSectionErrorResponseDto };
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
export class ItemSectionDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  sec_id!: string;

  @ApiProperty({
    example: true,
    description: 'true when the item section was soft deleted, false when it was restored',
  })
  deleted!: boolean;
}

export class ItemSectionSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item section fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemSectionPayloadDto })
  data!: ItemSectionPayloadDto;
}
export class ItemSectionSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item section deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemSectionDeleteResultDto })
  data!: ItemSectionDeleteResultDto;
}
