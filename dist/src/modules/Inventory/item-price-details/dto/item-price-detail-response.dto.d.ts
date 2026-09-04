import { ItemPayloadDto } from '../../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import { ItemTaxPayloadDto } from '../../items-tax-master/dto/item-tax-response.dto';
import { ItemUnitConversionPayloadDto } from '../../item-unit-conversion/dto/item-unit-conversion-response.dto';
import { InventoryErrorFieldDto, InventoryErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemPriceDetailErrorFieldDto };
export { InventoryErrorResponseDto as ItemPriceDetailErrorResponseDto };
export declare class ItemPriceDetailPayloadDto {
    item: ItemPayloadDto;
    item_prices: ItemPricePayloadDto[];
    item_unit_conversions: ItemUnitConversionPayloadDto[];
    item_tax: ItemTaxPayloadDto | null;
}
export declare class ItemPriceDetailSuccessSingleDto {
    success: true;
    message: string;
    data: ItemPriceDetailPayloadDto;
}
