import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as ItemGstUnitErrorFieldDto };
export { InventoryErrorResponseDto as ItemGstUnitErrorResponseDto };

export class ItemGstUnitPayloadDto {
  @ApiProperty({ example: 1 })
  item_gst_unit_id!: number;

  @ApiPropertyOptional({ nullable: true, example: 'NOS' })
  item_gst_unit_code!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Numbers' })
  item_gst_unit_name!: string | null;

  @ApiProperty({ format: 'date-time' })
  item_gst_unit_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  item_gst_unit_created_by!: string | null;

  @ApiProperty({ format: 'date-time' })
  item_gst_unit_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  item_gst_unit_modified_by!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  item_gst_unit_sync_date!: string | null;
}

export class ItemGstUnitSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item GST units fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemGstUnitPayloadDto, isArray: true })
  data!: ItemGstUnitPayloadDto[];
}
