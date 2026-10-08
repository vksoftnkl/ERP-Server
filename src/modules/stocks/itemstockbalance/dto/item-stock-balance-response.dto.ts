import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ItemStockBalanceErrorFieldDto {
  @ApiProperty({ example: 'isb_item_id' })
  field!: string;
  @ApiProperty({ example: 'Item stock balance not found' })
  message!: string;
}
export class ItemStockBalanceErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: ItemStockBalanceErrorFieldDto, isArray: true })
  errors!: ItemStockBalanceErrorFieldDto[];
}
export class ItemStockBalancePayloadDto {
  @ApiProperty({ format: 'uuid' })
  isb_id!: string;
  @ApiProperty()
  isb_acc_year!: string;
  @ApiProperty({ format: 'uuid' })
  isb_company_id!: string;
  @ApiProperty({ format: 'uuid' })
  isb_branch_id!: string;
  @ApiProperty({ format: 'uuid' })
  isb_godown_id!: string;
  @ApiProperty({ format: 'uuid' })
  isb_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  isb_unit_id!: string;
  @ApiProperty()
  isb_tracking_type!: string;
  @ApiProperty()
  isb_stock_bucket!: string;
  @ApiProperty()
  isb_opening_qty!: number;
  @ApiProperty()
  isb_in_qty!: number;
  @ApiProperty()
  isb_out_qty!: number;
  @ApiProperty()
  isb_closing_qty!: number;
  @ApiProperty()
  isb_opening_free_qty!: number;
  @ApiProperty()
  isb_free_in_qty!: number;
  @ApiProperty()
  isb_free_out_qty!: number;
  @ApiProperty()
  isb_free_closing_qty!: number;
  @ApiProperty()
  isb_reserved_qty!: number;
  @ApiProperty()
  isb_transit_qty!: number;
  @ApiProperty()
  isb_available_qty!: number;
  @ApiProperty()
  book_qty!: number;
  @ApiProperty()
  book_base_qty!: number;
  @ApiProperty()
  isb_opening_avg_rate!: number;
  @ApiProperty()
  isb_avg_stock_rate!: number;
  @ApiProperty()
  isb_opening_value!: number;
  @ApiProperty()
  isb_stock_value!: number;
  @ApiProperty()
  isb_opening_avg_rate_wot!: number;
  @ApiProperty()
  isb_avg_stock_rate_wot!: number;
  @ApiProperty()
  isb_opening_value_wot!: number;
  @ApiProperty()
  isb_stock_value_wot!: number;
  @ApiPropertyOptional({ nullable: true })
  isb_last_in_date!: string | null;
  @ApiPropertyOptional({ nullable: true })
  isb_last_out_date!: string | null;
  @ApiPropertyOptional({ nullable: true })
  isb_sync_date!: string | null;
  @ApiProperty()
  isb_created_on!: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  isb_created_by!: string | null;
  @ApiPropertyOptional({ nullable: true })
  isb_updated_on!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  isb_updated_by!: string | null;
}
export class ItemStockBalanceSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item stock balance fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemStockBalancePayloadDto, isArray: true })
  data!: ItemStockBalancePayloadDto[];
}

export class ItemBatchStockOptionPayloadDto {
  @ApiProperty({ format: 'uuid' })
  ibs_id!: string;
  @ApiProperty()
  ibs_acc_year!: string;
  @ApiProperty({ format: 'uuid' })
  ibs_company_id!: string;
  @ApiProperty({ format: 'uuid' })
  ibs_branch_id!: string;
  @ApiProperty({ format: 'uuid' })
  ibs_godown_id!: string;
  @ApiProperty({ format: 'uuid' })
  ibs_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  ibs_unit_id!: string;
  @ApiProperty({ format: 'uuid' })
  ibs_batch_id!: string;
  @ApiPropertyOptional({ nullable: true })
  ibs_batch_no!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ibs_mfg_batch_no!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ibs_batch_date!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ibs_mfg_date!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ibs_expiry_date!: string | null;
  @ApiProperty()
  ibs_mrp!: number;
  @ApiPropertyOptional({ nullable: true })
  ibs_barcode!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ibs_serial_no!: string | null;
  @ApiProperty()
  ibs_stock_bucket!: string;
  @ApiProperty()
  ibs_closing_qty!: number;
  @ApiProperty()
  ibs_free_closing_qty!: number;
  @ApiProperty()
  book_qty!: number;
  @ApiProperty()
  book_base_qty!: number;
  @ApiProperty()
  book_free_qty!: number;
  @ApiProperty()
  book_free_base_qty!: number;
  @ApiProperty()
  ibs_avg_stock_rate!: number;
  @ApiProperty()
  ibs_avg_stock_rate_wot!: number;
}

export class ItemBatchStockOptionSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item batch stock options fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemBatchStockOptionPayloadDto, isArray: true })
  data!: ItemBatchStockOptionPayloadDto[];
}
