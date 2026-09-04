import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
  InventoryListMetaDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as ItemPriceErrorFieldDto };
export { InventoryErrorResponseDto as ItemPriceErrorResponseDto };
export { InventoryListMetaDto as ItemPriceListMetaDto };
export class ItemPricePayloadDto {
  @ApiProperty({ format: 'uuid' })
  ipm_id!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  ipm_company_id!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  ipm_branch_id!: string | null;
  @ApiProperty({ format: 'uuid' })
  ipm_item_id!: string;
  @ApiProperty({ format: 'uuid', description: 'Item unit conversion id (iuc_id) this price applies to' })
  ipm_uc_unit_id!: string;
  @ApiProperty({ format: 'uuid' })
  ipm_godown_id!: string | null;
  @ApiProperty({ example: 0 })
  ipm_sl_no!: number;
  @ApiProperty({ example: 0 })
  ipm_cost_price!: number;
  @ApiProperty({ example: 0 })
  ipm_cost_wot!: number;
  @ApiProperty({ example: 0 })
  ipm_sales_price_a!: number;
  @ApiProperty({ example: 0 })
  ipm_sales_price_b!: number;
  @ApiProperty({ example: 0 })
  ipm_sales_price_c!: number;
  @ApiProperty({ example: 0 })
  ipm_sales_price_d!: number;
  @ApiProperty({ example: 0 })
  ipm_price_a_wot!: number;
  @ApiProperty({ example: 0 })
  ipm_price_b_wot!: number;
  @ApiProperty({ example: 0 })
  ipm_price_c_wot!: number;
  @ApiProperty({ example: 0 })
  ipm_price_d_wot!: number;
  @ApiProperty({ example: 0 })
  ipm_price_a_markup_perc!: number;
  @ApiProperty({ example: 0 })
  ipm_price_b_markup_perc!: number;
  @ApiProperty({ example: 0 })
  ipm_price_c_markup_perc!: number;
  @ApiProperty({ example: 0 })
  ipm_price_d_markup_perc!: number;
  @ApiProperty({ example: 0 })
  ipm_max_price!: number;
  @ApiProperty({ example: 0 })
  ipm_min_price!: number;
  @ApiProperty({ example: 0 })
  ipm_disc_perc!: number;
  @ApiProperty({ example: 0 })
  ipm_disc_qty!: number;
  @ApiProperty({ example: 0 })
  ipm_addl_cess!: number;
  @ApiProperty({ maxLength: 20, example: 'MANUAL' })
  ipm_profit_type!: string;
  @ApiProperty({ example: 0 })
  ipm_round_off!: number;
  @ApiProperty({ example: 0 })
  ipm_loading_charge!: number;
  @ApiProperty({ example: 0 })
  ipm_freight_charge!: number;
  @ApiProperty({ example: 0 })
  ipm_loyalty_points!: number;
  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  ipm_uom_remarks!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  ipm_cost_remarks!: string | null;
  @ApiProperty({ example: true })
  ipm_is_active!: boolean;
  @ApiProperty({ example: false })
  ipm_is_deleted!: boolean;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, example: null })
  ipm_sync_date!: string | null;
  @ApiProperty()
  ipm_created_on!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  ipm_created_by!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, example: null })
  ipm_updated_on!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  ipm_updated_by!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked company (resolved on the item composite get endpoint)' })
  ipm_company_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked branch (resolved on the item composite get endpoint)' })
  ipm_branch_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked unit (resolved on the item composite get endpoint)' })
  ipm_unit_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked godown (resolved on the item composite get endpoint)' })
  ipm_godown_name?: string | null;
}
export class ItemPriceDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ipm_id!: string;
  @ApiProperty({
    example: true,
    description: 'true when the item price was soft deleted, false when it was restored',
  })
  deleted!: boolean;
}
export class ItemPriceSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemPricePayloadDto })
  data!: ItemPricePayloadDto;
}
@ApiExtraModels(ItemPricePayloadDto, ItemPriceDeleteResultDto)
export class ItemPriceSuccessSaveDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price created successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemPricePayloadDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemPricePayloadDto) },
      },
    ],
  })
  data!: ItemPricePayloadDto | ItemPricePayloadDto[];
}
@ApiExtraModels(ItemPricePayloadDto)
export class ItemPriceSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item prices fetched successfully' })
  message!: string;
  @ApiProperty({ type: [ItemPricePayloadDto] })
  data!: ItemPricePayloadDto[];
  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;
}
export class ItemPriceSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price deleted successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemPriceDeleteResultDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemPriceDeleteResultDto) },
      },
    ],
  })
  data!: ItemPriceDeleteResultDto | ItemPriceDeleteResultDto[];
}