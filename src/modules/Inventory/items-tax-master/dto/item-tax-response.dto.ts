import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from 'src/common/configured-grid-sql/dto/configured-grid-style.dto';
import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from '../../utils/inventory-response.dto';

export { InventoryErrorFieldDto as ItemTaxErrorFieldDto };
export { InventoryErrorResponseDto as ItemTaxErrorResponseDto };
export { InventoryListMetaDto as ItemTaxListMetaDto };

export class ItemTaxPayloadDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  tax_id!: string;
  @ApiProperty({ maxLength: 100, example: 'GST 18%' })
  tax_name!: string;
  @ApiPropertyOptional({ maxLength: 30, nullable: true, example: 'GST18' })
  tax_code!: string | null;
  @ApiProperty({ maxLength: 30, example: 'TAXABLE' })
  tax_taxability_type!: string;
  @ApiProperty({ example: false })
  tax_is_reverse_charge!: boolean;
  @ApiProperty({ example: 9 })
  tax_cgst_perc!: number;
  @ApiProperty({ example: 9 })
  tax_sgst_perc!: number;
  @ApiProperty({ example: 18 })
  tax_igst_perc!: number;
  @ApiProperty({ example: 9 })
  tax_cgst_pur_perc!: number;
  @ApiProperty({ example: 9 })
  tax_sgst_pur_perc!: number;
  @ApiProperty({ example: 18 })
  tax_igst_pur_perc!: number;
  @ApiProperty({ maxLength: 20, example: 'NONE' })
  tax_cess_type!: string;
  @ApiProperty({ example: 0 })
  tax_cess_perc!: number;
  @ApiProperty({ example: 0 })
  tax_cess_unit!: number;
  @ApiProperty({ example: 0 })
  tax_cess_pur_perc!: number;
  @ApiProperty({ example: 0 })
  tax_cess_pur_unit!: number;
  @ApiProperty({ example: 18 })
  tax_gst_rate_total!: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_sales_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_sales_return_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_purchase_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_purchase_return_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_cgst_output_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_sgst_output_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_igst_output_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_cess_output_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_cgst_input_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_sgst_input_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_igst_input_ledger_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_cess_input_ledger_id!: string | null;
  @ApiProperty({ example: true })
  tax_is_active!: boolean;
  @ApiProperty({ example: false })
  tax_is_deleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  tax_sync_date!: string | null;
  @ApiProperty()
  tax_created_on!: string;
  @ApiPropertyOptional({ nullable: true })
  tax_created_by!: string | null;
  @ApiProperty()
  tax_modified_on!: string;
  @ApiPropertyOptional({ nullable: true })
  tax_modified_by!: string | null;
}

export class ItemTaxDeleteResultDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  tax_id!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemTaxSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item tax fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemTaxPayloadDto })
  data!: ItemTaxPayloadDto;
}

export class ItemTaxSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item taxes fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemTaxPayloadDto, isArray: true })
  data!: ItemTaxPayloadDto[];
  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class ItemTaxSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item tax deleted successfully' })
  message!: string;
  @ApiProperty({ type: ItemTaxDeleteResultDto })
  data!: ItemTaxDeleteResultDto;
}
