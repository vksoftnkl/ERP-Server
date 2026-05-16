import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from 'src/common/configured-grid-sql/dto/configured-grid-style.dto';
import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from '../../utils/inventory-response.dto';

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
  @ApiProperty({ format: 'uuid' })
  ipm_unit_id!: string;
  @ApiProperty({ format: 'uuid' })
  ipm_godown_id!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  ipm_base_unit_id!: string | null;
  @ApiProperty({ example: 1 })
  ipm_to_base_factor!: number;
  @ApiProperty({ example: 0 })
  ipm_unit_slno!: number;
  @ApiProperty({ example: 1 })
  ipm_unit_factor!: number;
  @ApiProperty({ example: false })
  ipm_is_default_unit!: boolean;
  @ApiProperty({ example: false })
  ipm_is_big_unit!: boolean;
  @ApiProperty({ example: false })
  ipm_is_base_unit!: boolean;
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
}
export class ItemPriceDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ipm_id!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
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
}
export class ItemUnitConversionDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  iuc_id!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class ItemPriceSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price fetched successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemPricePayloadDto) },
      { $ref: getSchemaPath(ItemUnitConversionPayloadDto) },
    ],
  })
  data!: ItemPricePayloadDto | ItemUnitConversionPayloadDto;
}
@ApiExtraModels(
  ItemPricePayloadDto,
  ItemUnitConversionPayloadDto,
  ItemPriceDeleteResultDto,
  ItemUnitConversionDeleteResultDto,
)
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
      { $ref: getSchemaPath(ItemUnitConversionPayloadDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemUnitConversionPayloadDto) },
      },
    ],
  })
  data!:
    | ItemPricePayloadDto
    | ItemPricePayloadDto[]
    | ItemUnitConversionPayloadDto
    | ItemUnitConversionPayloadDto[];
}
export class ItemPriceSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item prices fetched successfully' })
  message!: string;
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(ItemPricePayloadDto) },
        { $ref: getSchemaPath(ItemUnitConversionPayloadDto) },
      ],
    },
  })
  data!: Array<ItemPricePayloadDto | ItemUnitConversionPayloadDto>;
  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;
  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
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
      { $ref: getSchemaPath(ItemUnitConversionDeleteResultDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemUnitConversionDeleteResultDto) },
      },
    ],
  })
  data!:
    | ItemPriceDeleteResultDto
    | ItemPriceDeleteResultDto[]
    | ItemUnitConversionDeleteResultDto
    | ItemUnitConversionDeleteResultDto[];
}
