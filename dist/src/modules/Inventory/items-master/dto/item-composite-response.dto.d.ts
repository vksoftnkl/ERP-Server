import { ItemDeleteResultDto, ItemPayloadDto } from './item-response.dto';
import { ItemUnitConversionDeleteResultDto, ItemUnitConversionPayloadDto } from '../../item-unit-conversion/dto/item-unit-conversion-response.dto';
import { ItemPriceDeleteResultDto, ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import { ItemEanCodeDeleteResultDto, ItemEanCodePayloadDto } from '../../items-ean-code-master/dto/item-ean-code-response.dto';
import { ItemReorderDeleteResultDto, ItemReorderPayloadDto } from '../../items-reorder-master/dto/item-reorder-response.dto';
import { ItemCompositeDeleteResult, ItemCompositePayload, ItemCompositeSuccessResponse } from '../types/item-composite-api.types';
export declare class ItemCompositePayloadDto {
    item: ItemPayloadDto;
    unit_conversions: ItemUnitConversionPayloadDto[];
    prices: ItemPricePayloadDto[];
    ean_codes: ItemEanCodePayloadDto[];
    reorders: ItemReorderPayloadDto[];
}
export declare class ItemCompositeSuccessSingleDto {
    success: true;
    message: string;
    data: ItemCompositePayloadDto;
}
export type ItemCompositeResponse = ItemCompositeSuccessResponse<ItemCompositePayload>;
export declare class ItemCompositeDeleteResultDto {
    item: ItemDeleteResultDto;
    unit_conversions: ItemUnitConversionDeleteResultDto[];
    prices: ItemPriceDeleteResultDto[];
    ean_codes: ItemEanCodeDeleteResultDto[];
    reorders: ItemReorderDeleteResultDto[];
}
export declare class ItemCompositeSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemCompositeDeleteResultDto;
}
export type ItemCompositeDeleteResponse = ItemCompositeSuccessResponse<ItemCompositeDeleteResult>;
