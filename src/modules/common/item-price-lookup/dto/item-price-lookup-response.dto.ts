import { ApiProperty } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';
export { InventoryErrorFieldDto as ItemPriceLookupErrorFieldDto };
export { InventoryErrorResponseDto as ItemPriceLookupErrorResponseDto };

export class ItemPriceLookupQtyWiseRateDto {
  @ApiProperty({ example: 1 })
  price_level!: number;
  @ApiProperty({ example: 0 })
  start_qty!: number;
  @ApiProperty({ example: 100.5 })
  sales_price!: number;
  @ApiProperty({ example: 0 })
  disc_perc!: number;
  @ApiProperty({ example: 0 })
  disc_qty!: number;
}

export class ItemPriceLookupPayloadDto {
  @ApiProperty({ format: 'uuid' })
  item_id!: string;
  @ApiProperty({ format: 'uuid' })
  unit_id!: string;
  @ApiProperty({ format: 'uuid', description: 'item_price_master PK (ipm_id) the rate was taken from' })
  unit_rate_id!: string;
  @ApiProperty({ format: 'uuid' })
  godown_id!: string;
  @ApiProperty()
  godown_name!: string;

  @ApiProperty({ nullable: true })
  item_code!: string | null;
  @ApiProperty({ description: 'Regional name (item_name_ta) when regional=true, else the English name.' })
  item_name!: string;
  @ApiProperty({ nullable: true })
  item_com_code!: string | null;
  @ApiProperty({ nullable: true })
  barcode!: string | null;

  @ApiProperty()
  allow_promo!: boolean;
  @ApiProperty()
  add_freight!: boolean;
  @ApiProperty({ format: 'uuid' })
  item_group_id!: string;
  @ApiProperty({ format: 'uuid', nullable: true })
  item_category_id!: string | null;
  @ApiProperty()
  weigh_scale!: boolean;
  @ApiProperty({ example: 0 })
  batch_config!: number;
  @ApiProperty({ enum: ['Y', 'N'] })
  service_item!: 'Y' | 'N';
  @ApiProperty()
  allow_negative_stock!: boolean;

  @ApiProperty({
    enum: [1, 2, 3, 4, 5, 6, 7],
    description: '1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost',
  })
  price_level!: number;
  @ApiProperty({ example: 100.5 })
  sales_price!: number;
  @ApiProperty({ example: 80 })
  cost_price!: number;
  @ApiProperty({ example: 78 })
  cost_wot!: number;
  @ApiProperty({ example: 90 })
  min_price!: number;
  @ApiProperty({ example: 120 })
  max_price!: number;
  @ApiProperty({ example: 0 })
  disc_perc!: number;
  @ApiProperty({ example: 0 })
  disc_qty!: number;
  @ApiProperty({ nullable: true, description: 'Legacy group scheme discount — no column in current schema, always null' })
  sch_discount!: number | null;
  @ApiProperty({ example: 0 })
  addl_cess!: number;

  @ApiProperty({ nullable: true })
  unit_desc!: string | null;
  @ApiProperty({ example: 0 })
  unit_weight!: number;
  @ApiProperty({ example: 0 })
  unit_loading!: number;
  @ApiProperty({ example: 2 })
  decimal_count!: number;

  @ApiProperty({ example: 0 })
  loyalty_pv!: number;

  @ApiProperty({ nullable: true, example: 0 })
  stock!: number | null;
  @ApiProperty({ nullable: true, example: 0 })
  reorder_qty!: number | null;

  @ApiProperty({ example: 0 })
  gst_rate!: number;
  @ApiProperty({ example: 0 })
  cess_perc!: number;
  @ApiProperty({ example: 0 })
  cess_unit!: number;
  @ApiProperty({ example: 0 })
  sgst_perc!: number;
  @ApiProperty({ example: 0 })
  cgst_perc!: number;
  @ApiProperty({ example: 0 })
  igst_perc!: number;
  @ApiProperty({ format: 'uuid', nullable: true })
  sales_ledger_id!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  sgst_output_ledger_id!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  cgst_output_ledger_id!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  igst_output_ledger_id!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  cess_output_ledger_id!: string | null;

  @ApiProperty({ type: ItemPriceLookupQtyWiseRateDto, isArray: true, nullable: true })
  json_qws!: ItemPriceLookupQtyWiseRateDto[] | null;
}

export class ItemPriceLookupSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price lookup fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemPriceLookupPayloadDto })
  data!: ItemPriceLookupPayloadDto;
}
