import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemBatchStockErrorFieldDto {
  @ApiProperty({ example: 'ibs_item_id' })
  field!: string;

  @ApiProperty({ example: 'Item batch stock not found' })
  message!: string;
}

export class ItemBatchStockErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemBatchStockErrorFieldDto, isArray: true })
  errors!: ItemBatchStockErrorFieldDto[];
}

export class ItemBatchStockPayloadDto {
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
  ibs_serial_no!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ibs_mfg_date!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ibs_expiry_date!: string | null;

  @ApiProperty()
  ibs_mrp!: number;

  @ApiPropertyOptional({ nullable: true })
  ibs_barcode!: string | null;

  @ApiProperty()
  ibs_stock_bucket!: string;

  @ApiProperty()
  ibs_opening_qty!: number;

  @ApiProperty()
  ibs_in_qty!: number;

  @ApiProperty()
  ibs_out_qty!: number;

  @ApiProperty()
  ibs_closing_qty!: number;

  @ApiProperty()
  ibs_opening_free_qty!: number;

  @ApiProperty()
  ibs_free_in_qty!: number;

  @ApiProperty()
  ibs_free_out_qty!: number;

  @ApiProperty()
  ibs_free_closing_qty!: number;

  @ApiProperty()
  ibs_reserved_qty!: number;

  @ApiProperty()
  ibs_available_qty!: number;

  @ApiProperty()
  book_qty!: number;

  @ApiProperty()
  book_base_qty!: number;

  @ApiProperty()
  book_free_qty!: number;

  @ApiProperty()
  book_free_base_qty!: number;

  @ApiProperty()
  book_reserved_qty!: number;

  @ApiProperty()
  book_reserved_base_qty!: number;

  @ApiProperty()
  book_available_qty!: number;

  @ApiProperty()
  book_available_base_qty!: number;

  @ApiProperty()
  ibs_opening_avg_rate!: number;

  @ApiProperty()
  ibs_avg_stock_rate!: number;

  @ApiProperty()
  ibs_opening_value!: number;

  @ApiProperty()
  ibs_stock_value!: number;

  @ApiPropertyOptional({ nullable: true })
  ibs_last_in_date!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ibs_last_out_date!: string | null;

  @ApiProperty()
  ibs_is_active!: boolean;

  @ApiProperty()
  ibs_is_deleted!: boolean;

  @ApiProperty({ example: '1', description: 'BigInt row version serialized as string' })
  ibs_row_version!: string;

  @ApiProperty()
  ibs_created_on!: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  ibs_created_by!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ibs_updated_on!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  ibs_updated_by!: string | null;
}

export class ItemBatchStockSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item batch stock fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemBatchStockPayloadDto, isArray: true })
  data!: ItemBatchStockPayloadDto[];
}
