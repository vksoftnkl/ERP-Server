import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from 'src/common/configured-grid-sql/dto/configured-grid-style.dto';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
  InventoryListMetaDto,
} from 'src/common/utils/module-response.dto';
export { InventoryErrorFieldDto as ItemReorderErrorFieldDto };
export { InventoryErrorResponseDto as ItemReorderErrorResponseDto };
export { InventoryListMetaDto as ItemReorderListMetaDto };
export class ItemReorderPayloadDto {
  @ApiProperty({ format: 'uuid' })
  ir_id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ir_branch_id!: string | null;
  @ApiProperty({ format: 'uuid' })
  ir_item_id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ir_unit_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ir_godown_id!: string | null;
  @ApiProperty({ example: 0 })
  ir_min_level!: number;
  @ApiProperty({ example: 0 })
  ir_max_level!: number;
  @ApiProperty({ example: 0 })
  ir_reorder_level!: number;
  @ApiProperty({ example: 0 })
  ir_reorder_qty!: number;
  @ApiProperty({ example: 0 })
  ir_lead_time_days!: number;
  @ApiProperty({ example: 0 })
  ir_review_cycle_days!: number;
  @ApiProperty({ example: 0 })
  ir_reorder_days!: number;
  @ApiProperty({ example: 0 })
  ir_expiry_buffer_days!: number;
  @ApiProperty({ maxLength: 20, example: 'MIN_MAX' })
  ir_reorder_type!: string;
  @ApiProperty({ example: true })
  ir_is_active!: boolean;
  @ApiProperty({ example: false })
  ir_is_deleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  ir_remarks!: string | null;
  @ApiProperty()
  ir_created_on!: string;
  @ApiPropertyOptional({ nullable: true })
  ir_created_by!: string | null;
  @ApiProperty()
  ir_modified_on!: string;
  @ApiPropertyOptional({ nullable: true })
  ir_modified_by!: string | null;
}
export class ItemReorderDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ir_id!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class ItemReorderSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item reorder fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemReorderPayloadDto })
  data!: ItemReorderPayloadDto;
}
@ApiExtraModels(ItemReorderPayloadDto)
export class ItemReorderSuccessSaveDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item reorder created successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemReorderPayloadDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemReorderPayloadDto) },
      },
    ],
  })
  data!: ItemReorderPayloadDto | ItemReorderPayloadDto[];
}
export class ItemReorderSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item reorders fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemReorderPayloadDto, isArray: true })
  data!: ItemReorderPayloadDto[];
  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;
  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}
export class ItemReorderSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item reorder deleted successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemReorderDeleteResultDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemReorderDeleteResultDto) },
      },
    ],
  })
  data!: ItemReorderDeleteResultDto | ItemReorderDeleteResultDto[];
}