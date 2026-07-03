import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
  InventoryListMetaDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as ItemUnitConversionErrorFieldDto };
export { InventoryErrorResponseDto as ItemUnitConversionErrorResponseDto };
export { InventoryListMetaDto as ItemUnitConversionListMetaDto };
export class ItemUnitConversionPayloadDto {
  @ApiProperty({ format: 'uuid' })
  iuc_id!: string;
  @ApiProperty({ format: 'uuid' })
  iuc_company_id!: string;
  @ApiProperty({ format: 'uuid' })
  iuc_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  iuc_unit_id!: string;
  @ApiProperty({ format: 'uuid' })
  iuc_base_unit_id!: string;
  @ApiProperty({ example: 1 })
  iuc_to_base_factor!: number;
  @ApiProperty({ example: 0 })
  iuc_unit_slno!: number;
  @ApiProperty({ example: 1 })
  iuc_unit_factor!: number;
  @ApiProperty({ example: false })
  iuc_is_default_unit!: boolean;
  @ApiProperty({ example: false })
  iuc_is_base_unit!: boolean;
  @ApiProperty({ example: false })
  iuc_is_big_unit!: boolean;
  @ApiProperty({ example: 0 })
  iuc_uom_weight!: number;
  @ApiPropertyOptional({ nullable: true })
  iuc_uom_remarks!: string | null;
  @ApiProperty({ example: true })
  iuc_is_active!: boolean;
  @ApiProperty({ example: false })
  iuc_is_deleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  iuc_sync_date!: string | null;
  @ApiProperty()
  iuc_created_on!: string;
  @ApiPropertyOptional({ nullable: true })
  iuc_created_by!: string | null;
  @ApiPropertyOptional({ nullable: true })
  iuc_updated_on!: string | null;
  @ApiPropertyOptional({ nullable: true })
  iuc_updated_by!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked company (resolved on the item composite get endpoint)' })
  iuc_company_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked unit (resolved on the item composite get endpoint)' })
  iuc_unit_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked base unit (resolved on the item composite get endpoint)' })
  iuc_base_unit_name?: string | null;
}
export class ItemUnitConversionDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  iuc_id!: string;
  @ApiProperty({
    example: true,
    description: 'true when the item unit conversion was soft deleted, false when it was restored',
  })
  deleted!: boolean;
}
export class ItemUnitConversionSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item unit conversion fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemUnitConversionPayloadDto })
  data!: ItemUnitConversionPayloadDto;
}
@ApiExtraModels(ItemUnitConversionPayloadDto, ItemUnitConversionDeleteResultDto)
export class ItemUnitConversionSuccessSaveDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item unit conversion created successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemUnitConversionPayloadDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemUnitConversionPayloadDto) },
      },
    ],
  })
  data!: ItemUnitConversionPayloadDto | ItemUnitConversionPayloadDto[];
}
@ApiExtraModels(ItemUnitConversionPayloadDto)
export class ItemUnitConversionSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item unit conversions fetched successfully' })
  message!: string;

  @ApiProperty({ type: [ItemUnitConversionPayloadDto] })
  data!: ItemUnitConversionPayloadDto[];

  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;
}

export class ItemUnitConversionSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item unit conversion deleted successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemUnitConversionDeleteResultDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemUnitConversionDeleteResultDto) },
      },
    ],
  })
  data!: ItemUnitConversionDeleteResultDto | ItemUnitConversionDeleteResultDto[];
}
