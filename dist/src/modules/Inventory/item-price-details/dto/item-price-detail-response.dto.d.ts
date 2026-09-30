import { ItemPayloadDto } from '../../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import { ItemUnitConversionPayloadDto } from '../../item-unit-conversion/dto/item-unit-conversion-response.dto';
import { InventoryErrorFieldDto, InventoryErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemPriceDetailErrorFieldDto };
export { InventoryErrorResponseDto as ItemPriceDetailErrorResponseDto };
export declare class ItemPriceDetailTaxPayloadDto {
    tax_id: string;
    tax_name: string;
    tax_code: string | null;
    tax_taxability_type: string;
    tax_is_reverse_charge: boolean;
    tax_cgst_perc: number;
    tax_sgst_perc: number;
    tax_igst_perc: number;
    tax_cgst_pur_perc: number;
    tax_sgst_pur_perc: number;
    tax_igst_pur_perc: number;
    tax_cess_type: string;
    tax_cess_perc: number;
    tax_cess_unit: number;
    tax_cess_pur_perc: number;
    tax_cess_pur_unit: number;
    tax_gst_rate_total: number;
    tax_sales_ledger_id: null;
    tax_sales_return_ledger_id: null;
    tax_purchase_ledger_id: null;
    tax_purchase_return_ledger_id: null;
    tax_cgst_output_ledger_id: null;
    tax_sgst_output_ledger_id: null;
    tax_igst_output_ledger_id: null;
    tax_cess_output_ledger_id: null;
    tax_cgst_input_ledger_id: null;
    tax_sgst_input_ledger_id: null;
    tax_igst_input_ledger_id: null;
    tax_cess_input_ledger_id: null;
    tax_is_active: boolean;
    tax_is_deleted: boolean;
    tax_sync_date: string | null;
    tax_created_on: string;
    tax_created_by: string | null;
    tax_modified_on: string | null;
    tax_modified_by: string | null;
}
export declare class ItemPriceDetailPayloadDto {
    item: ItemPayloadDto;
    item_prices: ItemPricePayloadDto[];
    item_unit_conversions: ItemUnitConversionPayloadDto[];
    item_tax: ItemPriceDetailTaxPayloadDto | null;
}
export declare class ItemPriceDetailSuccessSingleDto {
    success: true;
    message: string;
    data: ItemPriceDetailPayloadDto;
}
