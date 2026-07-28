import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as ItemErrorFieldDto };
export { InventoryErrorResponseDto as ItemErrorResponseDto };
export class ItemPayloadDto {
  @ApiProperty({ format: 'uuid' })
  item_id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_company_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_branch_id!: string | null;
  @ApiPropertyOptional({ nullable: true })
  item_code!: string | null;
  @ApiPropertyOptional({ nullable: true })
  item_sku!: string | null;
  @ApiProperty()
  item_name_en!: string;
  @ApiPropertyOptional({ nullable: true })
  item_name_ta!: string | null;
  @ApiPropertyOptional({ nullable: true })
  item_alias!: string | null;
  @ApiProperty()
  item_stock_type!: string;
  @ApiPropertyOptional({ nullable: true })
  item_default_barcode!: string | null;
  @ApiProperty({ format: 'uuid' })
  item_group_id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_category_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_brand_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_section_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_company_category_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_mfgr_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_supplier_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_cust_group!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_base_unit_id!: string | null;
  @ApiProperty()
  item_is_service!: boolean;
  @ApiProperty()
  item_is_batch_based!: boolean;
  @ApiProperty()
  item_is_expiry_item!: boolean;
  @ApiPropertyOptional({ nullable: true })
  item_expiry_days!: number | null;
  @ApiPropertyOptional({ nullable: true })
  item_intimate_before_days!: number | null;
  @ApiProperty()
  item_allow_sales!: boolean;
  @ApiProperty()
  item_allow_sales_return!: boolean;
  @ApiProperty()
  item_allow_purchase!: boolean;
  @ApiProperty()
  item_allow_po!: boolean;
  @ApiProperty()
  item_allow_so!: boolean;
  @ApiProperty()
  item_allow_neg_stock!: boolean;
  @ApiProperty()
  item_allow_negative_so!: boolean;
  @ApiProperty()
  item_price_list!: boolean;
  @ApiProperty()
  item_weigh_scale!: boolean;
  @ApiProperty()
  item_retail_item!: boolean;
  @ApiProperty()
  item_is_kit!: boolean;
  @ApiProperty()
  item_auto_break!: boolean;
  @ApiProperty()
  item_auto_make!: boolean;
  @ApiProperty()
  item_allow_loyalty!: boolean;
  @ApiProperty()
  item_allow_promo!: boolean;
  @ApiProperty()
  item_has_offer!: boolean;
  @ApiProperty()
  item_damagable_product!: boolean;
  @ApiProperty()
  item_is_demand!: boolean;
  @ApiProperty()
  item_allow_loading!: boolean;
  @ApiProperty()
  item_allow_freight!: boolean;
  @ApiProperty()
  item_random_stock!: boolean;
  @ApiProperty()
  item_barcode_sticker!: boolean;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_barcode_sticker_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  item_default_tax_id!: string | null;
  @ApiPropertyOptional({ nullable: true })
  item_hsn_code!: string | null;
  @ApiProperty()
  item_batch_config!: number;
  @ApiPropertyOptional({ nullable: true })
  item_sort_order!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Base64-encoded image bytes' })
  item_photo!: string | null;
  @ApiPropertyOptional({ nullable: true })
  item_image_url!: string | null;
  @ApiPropertyOptional({ nullable: true })
  item_notes!: string | null;
  @ApiPropertyOptional({ nullable: true })
  item_storage_location!: string | null;
  @ApiProperty({ type: [String] })
  item_packing_item_ids!: string[];
  @ApiProperty()
  item_incl_tax!: boolean;
  @ApiProperty()
  item_is_active!: boolean;
  @ApiProperty()
  item_is_deleted!: boolean;
  @ApiProperty()
  item_created_on!: string;
  @ApiPropertyOptional({ nullable: true })
  item_created_by!: string | null;
  @ApiProperty()
  item_modified_on!: string;
  @ApiPropertyOptional({ nullable: true })
  item_modified_by!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked company (resolved on the composite get endpoint)' })
  item_company_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked branch (resolved on the composite get endpoint)' })
  item_branch_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked item group (resolved on the composite get endpoint)' })
  item_group_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked category (resolved on the composite get endpoint)' })
  item_category_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked brand (resolved on the composite get endpoint)' })
  item_brand_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked section (resolved on the composite get endpoint)' })
  item_section_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked supplier (resolved on the composite get endpoint)' })
  item_supplier_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked customer group (resolved on the composite get endpoint)' })
  item_cust_group_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked base unit (resolved on the composite get endpoint)' })
  item_base_unit_name?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the linked default tax (resolved on the composite get endpoint)' })
  item_default_tax_name?: string | null;
}

export class ItemDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  item_id!: string;
  @ApiProperty({
    example: true,
    description: 'true when the item was soft deleted, false when it was restored',
  })
  deleted!: boolean;
}
export class ItemSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemPayloadDto })
  data!: ItemPayloadDto;
}
export class ItemSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item deleted successfully' })
  message!: string;
  @ApiProperty({ type: ItemDeleteResultDto })
  data!: ItemDeleteResultDto;
}
