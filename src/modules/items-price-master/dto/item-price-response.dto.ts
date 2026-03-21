import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class ItemPriceErrorFieldDto {
  @ApiProperty({ example: 'ipm_item_id' })
  field!: string;

  @ApiProperty({ example: 'ipm_item_id is required' })
  message!: string;
}

export class ItemPriceErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemPriceErrorFieldDto, isArray: true })
  errors!: ItemPriceErrorFieldDto[];
}

export class ItemPricePayloadDto {
  @ApiProperty({ format: 'uuid' })
  ipm_unit_rate_id!: string;

  @ApiProperty({ format: 'uuid' })
  ipm_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  ipm_unit_id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ipm_godown_id!: string | null;

  @ApiProperty({ example: 0 })
  ipm_unit_slno!: number;

  @ApiProperty({ example: 1 })
  ipm_conversion_factor!: number;

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
  ipm_price_a_margin!: number;

  @ApiProperty({ example: 0 })
  ipm_price_b_margin!: number;

  @ApiProperty({ example: 0 })
  ipm_price_c_margin!: number;

  @ApiProperty({ example: 0 })
  ipm_price_d_margin!: number;

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

  @ApiProperty({ maxLength: 20, example: 'BY %' })
  ipm_profit_type!: string;

  @ApiProperty({ example: 0 })
  ipm_round_off!: number;

  @ApiProperty({ example: false })
  ipm_big_unit!: boolean;

  @ApiProperty({ example: 0 })
  ipm_uom_weight!: number;

  @ApiProperty({ example: 0 })
  ipm_loading_charge!: number;

  @ApiProperty({ example: 0 })
  ipm_freight_charge!: number;

  @ApiProperty({ example: 0 })
  ipm_points!: number;

  @ApiPropertyOptional({ nullable: true })
  ipm_remarks!: string | null;

  @ApiProperty({ example: true })
  ipm_is_active!: boolean;

  @ApiProperty()
  ipm_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  ipm_created_by!: string | null;

  @ApiProperty()
  ipm_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  ipm_modified_by!: string | null;
}

export class ItemPriceListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemPriceDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ipm_unit_rate_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemPriceSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item price fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemPricePayloadDto })
  data!: ItemPricePayloadDto;
}

@ApiExtraModels(ItemPricePayloadDto)
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

export class ItemPriceSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item prices fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemPricePayloadDto, isArray: true })
  data!: ItemPricePayloadDto[];

  @ApiProperty({ type: ItemPriceListMetaDto })
  meta!: ItemPriceListMetaDto;

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
    ],
  })
  data!: ItemPriceDeleteResultDto | ItemPriceDeleteResultDto[];
}
