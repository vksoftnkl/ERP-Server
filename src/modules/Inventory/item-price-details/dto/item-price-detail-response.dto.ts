import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemPayloadDto } from '../../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import { ItemUnitConversionPayloadDto } from '../../item-unit-conversion/dto/item-unit-conversion-response.dto';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';
export { InventoryErrorFieldDto as ItemPriceDetailErrorFieldDto };
export { InventoryErrorResponseDto as ItemPriceDetailErrorResponseDto };
/** Why every `_ledger_id` below is null — a rate carries no ledger columns. */
const NO_LEDGER =
  'Always null: a tax rate carries no ledger columns. A role resolves through accounts.acc_ledger_map, overridden per rate by inventory.tax_rate_ledger (GET /tax-rates/resolve).';
/**
 * The item's default tax, read from inventory.tax_rate_master (where
 * item_default_tax_id has pointed since
 * 20260912110000_repoint_items_to_tax_rate_master). Field names are the old
 * item_tax_master payload's, kept so the client reads the block unchanged.
 */
export class ItemPriceDetailTaxPayloadDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  tax_id!: string;
  @ApiProperty({ maxLength: 100, example: 'GST 18%' })
  tax_name!: string;
  @ApiPropertyOptional({ maxLength: 30, nullable: true, example: 'GST18' })
  tax_code!: string | null;
  @ApiProperty({
    example: 'TAXABLE',
    description: 'tax_taxability: TAXABLE | EXEMPT | NIL_RATED | NON_GST | ZERO_RATED',
  })
  tax_taxability_type!: string;
  @ApiProperty({ example: false })
  tax_is_reverse_charge!: boolean;
  @ApiProperty({ example: 9, description: 'Generated from tax_rate_perc (half of it).' })
  tax_cgst_perc!: number;
  @ApiProperty({ example: 9, description: 'Generated from tax_rate_perc (half of it).' })
  tax_sgst_perc!: number;
  @ApiProperty({ example: 18, description: 'Generated from tax_rate_perc (all of it).' })
  tax_igst_perc!: number;
  @ApiProperty({
    example: 9,
    description: 'Same as tax_cgst_perc — a rate has one percentage for sales and purchase.',
  })
  tax_cgst_pur_perc!: number;
  @ApiProperty({ example: 9, description: 'Same as tax_sgst_perc.' })
  tax_sgst_pur_perc!: number;
  @ApiProperty({ example: 18, description: 'Same as tax_igst_perc.' })
  tax_igst_pur_perc!: number;
  @ApiProperty({
    example: 'NONE',
    enum: ['NONE', 'PERCENT', 'PER_UNIT', 'BOTH'],
    description:
      'tax_cess_basis. The old item_tax_master said UNIT where this says PER_UNIT, and had no BOTH (a percentage AND a per-unit amount).',
  })
  tax_cess_type!: string;
  @ApiProperty({ example: 0, description: 'Non-zero only when the basis is PERCENT or BOTH.' })
  tax_cess_perc!: number;
  @ApiProperty({
    example: 0,
    description: 'tax_cess_per_unit — non-zero only when the basis is PER_UNIT or BOTH.',
  })
  tax_cess_unit!: number;
  @ApiProperty({ example: 0, description: 'Same as tax_cess_perc — one cess for both sides.' })
  tax_cess_pur_perc!: number;
  @ApiProperty({ example: 0, description: 'Same as tax_cess_unit.' })
  tax_cess_pur_unit!: number;
  @ApiProperty({ example: 18, description: 'tax_rate_perc — the total GST rate.' })
  tax_gst_rate_total!: number;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_sales_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_sales_return_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_purchase_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_purchase_return_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_cgst_output_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_sgst_output_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_igst_output_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_cess_output_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_cgst_input_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_sgst_input_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_igst_input_ledger_id!: null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER })
  tax_cess_input_ledger_id!: null;
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
  @ApiPropertyOptional({ nullable: true, description: 'Null on a rate never edited.' })
  tax_modified_on!: string | null;
  @ApiPropertyOptional({ nullable: true })
  tax_modified_by!: string | null;
}
export class ItemPriceDetailPayloadDto {
  @ApiProperty({ type: ItemPayloadDto })
  item!: ItemPayloadDto;
  @ApiProperty({ type: ItemPricePayloadDto, isArray: true })
  item_prices!: ItemPricePayloadDto[];
  @ApiProperty({
    type: ItemUnitConversionPayloadDto,
    isArray: true,
    description:
      "The item's live unit conversions; each price row points at one through ipm_uc_unit_id and carries none of its shape",
  })
  item_unit_conversions!: ItemUnitConversionPayloadDto[];
  @ApiProperty({ type: ItemPriceDetailTaxPayloadDto, nullable: true })
  item_tax!: ItemPriceDetailTaxPayloadDto | null;
}
@ApiExtraModels(
  ItemPayloadDto,
  ItemPricePayloadDto,
  ItemUnitConversionPayloadDto,
  ItemPriceDetailTaxPayloadDto,
)
export class ItemPriceDetailSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price details fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemPriceDetailPayloadDto })
  data!: ItemPriceDetailPayloadDto;
}
