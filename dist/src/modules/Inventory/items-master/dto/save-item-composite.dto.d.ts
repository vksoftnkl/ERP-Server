import { SaveItemDto } from './save-item.dto';
import { SaveItemUnitConversionDto } from '../../item-unit-conversion/dto/save-item-unit-conversion.dto';
import { SaveItemPriceDto } from '../../items-price-master/dto/save-item-price.dto';
import { SaveItemEanCodeDto } from '../../items-ean-code-master/dto/save-item-ean-code.dto';
import { SaveItemReorderDto } from '../../items-reorder-master/dto/save-item-reorder.dto';
declare const CompositeItemUnitConversionDto_base: import("@nestjs/common").Type<Omit<SaveItemUnitConversionDto, "iuc_item_id">>;
export declare class CompositeItemUnitConversionDto extends CompositeItemUnitConversionDto_base {
    iuc_item_id?: string;
}
declare const CompositeItemPriceDto_base: import("@nestjs/common").Type<Omit<SaveItemPriceDto, "ipm_item_id">>;
export declare class CompositeItemPriceDto extends CompositeItemPriceDto_base {
    ipm_item_id?: string;
}
declare const CompositeItemEanCodeDto_base: import("@nestjs/common").Type<Omit<SaveItemEanCodeDto, "ean_item_id">>;
export declare class CompositeItemEanCodeDto extends CompositeItemEanCodeDto_base {
    ean_item_id?: string;
}
declare const CompositeItemReorderDto_base: import("@nestjs/common").Type<Omit<SaveItemReorderDto, "ir_item_id">>;
export declare class CompositeItemReorderDto extends CompositeItemReorderDto_base {
    ir_item_id?: string;
}
export declare class SaveItemCompositeDto extends SaveItemDto {
    unit_conversions?: CompositeItemUnitConversionDto[];
    prices?: CompositeItemPriceDto[];
    ean_codes?: CompositeItemEanCodeDto[];
    reorders?: CompositeItemReorderDto[];
}
export {};
