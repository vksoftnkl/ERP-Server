import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class OpeningStockErrorFieldDto {
  @ApiProperty({ example: 'avh_voucher_id' })
  field!: string;

  @ApiProperty({ example: 'Opening stock document not found' })
  message!: string;
}
export class OpeningStockErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: OpeningStockErrorFieldDto, isArray: true })
  errors!: OpeningStockErrorFieldDto[];
}
export class OpeningStockHeaderPayloadDto {
  @ApiProperty({ format: 'uuid' })
  avh_voucher_id!: string;
  @ApiProperty()
  avh_voucher_refno!: string;
  @ApiProperty()
  avh_voucher_type_id!: number;
  @ApiProperty()
  avh_bill_refno!: string;
  @ApiPropertyOptional({ nullable: true })
  avh_user_refno!: string | null;
  @ApiPropertyOptional({ nullable: true })
  avh_user_name!: string | null;
  @ApiPropertyOptional({ nullable: true })
  avh_bill_date!: string | null;
  @ApiProperty({ format: 'uuid' })
  avh_party_id!: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  avh_opposite_ledger_id!: string | null;
  @ApiProperty({ type: [String] })
  avh_employee_id!: string[];
  @ApiPropertyOptional({ nullable: true })
  avh_pay_notes!: string | null;
  @ApiPropertyOptional({ nullable: true })
  avh_remarks!: string | null;
  @ApiProperty()
  avh_voucher_status!: string;
  @ApiProperty({ format: 'uuid' })
  avh_user_id!: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  avh_session_id!: string | null;
  @ApiProperty()
  avh_device_type!: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  avh_device_id!: string | null;
  @ApiProperty()
  avh_counter_id!: string;
  @ApiProperty({ format: 'uuid' })
  osh_id!: string;
  @ApiProperty()
  osh_acc_year!: string;
  @ApiProperty({ format: 'uuid' })
  osh_company_id!: string;
  @ApiProperty({ format: 'uuid' })
  osh_branch_id!: string;
  @ApiProperty()
  osh_voucher_no!: string;
  @ApiProperty()
  osh_voucher_date!: string;
  @ApiPropertyOptional({ nullable: true })
  osh_ref_no!: string | null;
  @ApiPropertyOptional({ nullable: true })
  osh_narration!: string | null;
  @ApiProperty()
  osh_total_lines!: number;
  @ApiProperty()
  osh_total_qty!: number;
  @ApiProperty()
  osh_total_value!: number;
  @ApiProperty()
  osh_status!: string;
  @ApiPropertyOptional({ nullable: true })
  osh_user_name!: string | null;
  @ApiProperty({ format: 'uuid' })
  osh_user_id!: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  osh_session_id!: string | null;
  @ApiProperty()
  osh_device_type!: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  osh_device_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osh_counter_id!: string | null;

  @ApiProperty()
  osh_is_active!: boolean;

  @ApiProperty()
  osh_is_deleted!: boolean;

  @ApiProperty()
  osh_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  osh_created_by!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osh_updated_on!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osh_updated_by!: string | null;
}

export class OpeningStockDetailPayloadDto {
  @ApiProperty({ format: 'uuid' })
  osl_id!: string;

  @ApiProperty({ format: 'uuid' })
  osl_voucher_id!: string;

  @ApiProperty({ format: 'uuid' })
  osl_opening_id!: string;

  @ApiProperty()
  osl_line_no!: number;

  @ApiProperty({ format: 'uuid' })
  osl_item_id!: string;

  @ApiPropertyOptional({ nullable: true })
  osl_item_code!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osl_item_name!: string | null;

  @ApiProperty({ format: 'uuid' })
  osl_unit_id!: string;

  @ApiPropertyOptional({ nullable: true })
  osl_unit_name!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  osl_base_uom_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osl_base_uom_name!: string | null;

  @ApiProperty({ format: 'uuid' })
  osl_godown_id!: string;

  @ApiPropertyOptional({ nullable: true })
  osl_godown_name!: string | null;

  @ApiProperty()
  osl_tracking_type!: string;

  @ApiPropertyOptional({ nullable: true })
  osl_barcode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osl_batch_no!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  osl_batch_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osl_batch_date!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osl_mfg_date!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osl_expiry_date!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osl_serial_no!: string | null;

  @ApiProperty()
  osl_qty!: number;

  @ApiProperty()
  osl_base_qty!: number;

  @ApiProperty()
  osl_free_qty!: number;

  @ApiProperty()
  osl_free_base_qty!: number;

  @ApiProperty()
  osl_conv_factor!: number;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  osl_tax_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  osl_tax_name!: string | null;

  @ApiProperty()
  osl_tax_perc!: number;

  @ApiProperty()
  osl_cess_type!: string;

  @ApiProperty()
  osl_cess_perc!: number;

  @ApiProperty()
  osl_cess_per_unit!: number;

  @ApiProperty()
  osl_cost_rate!: number;

  @ApiProperty()
  osl_cost_rate_wot!: number;

  @ApiProperty()
  osl_stock_value!: number;

  @ApiProperty()
  osl_stock_value_wot!: number;

  @ApiProperty()
  osl_sale_rate_a!: number;

  @ApiProperty()
  osl_sale_rate_b!: number;

  @ApiProperty()
  osl_sale_rate_c!: number;

  @ApiProperty()
  osl_sale_rate_d!: number;

  @ApiProperty()
  osl_sale_rate_a_wot!: number;

  @ApiProperty()
  osl_sale_rate_b_wot!: number;

  @ApiProperty()
  osl_sale_rate_c_wot!: number;

  @ApiProperty()
  osl_sale_rate_d_wot!: number;

  @ApiProperty()
  osl_markup_perc_a!: number;

  @ApiProperty()
  osl_markup_perc_b!: number;

  @ApiProperty()
  osl_markup_perc_c!: number;

  @ApiProperty()
  osl_markup_perc_d!: number;

  @ApiProperty()
  osl_mrp_rate!: number;

  @ApiProperty()
  osl_min_rate!: number;

  @ApiPropertyOptional({ nullable: true })
  osl_remarks!: string | null;
}

export class OpeningStockDocumentPayloadDto {
  @ApiProperty({ type: OpeningStockHeaderPayloadDto })
  header!: OpeningStockHeaderPayloadDto;

  @ApiProperty({ type: OpeningStockDetailPayloadDto, isArray: true })
  details!: OpeningStockDetailPayloadDto[];
}

export class OpeningStockListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class OpeningStockDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  avh_voucher_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class OpeningStockSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockDocumentPayloadDto })
  data!: OpeningStockDocumentPayloadDto;
}

export class OpeningStockSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock documents fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockHeaderPayloadDto, isArray: true })
  data!: OpeningStockHeaderPayloadDto[];

  @ApiProperty({ type: OpeningStockListMetaDto })
  meta!: OpeningStockListMetaDto;
}

export class OpeningStockSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock deleted successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockDeleteResultDto })
  data!: OpeningStockDeleteResultDto;
}
