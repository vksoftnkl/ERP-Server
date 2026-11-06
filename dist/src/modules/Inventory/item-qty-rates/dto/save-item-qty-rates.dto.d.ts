import { SaveSellingPriceRowDto } from '../../../stocks/selling-price-bulk/dto/save-selling-price-bulk.dto';
import { SaveItemQtyPriceDto } from '../../items-qty-price-master/dto/save-item-qty-price.dto';
declare const SaveQtyRatesCardRowDto_base: import("@nestjs/common").Type<Omit<SaveSellingPriceRowDto, "itemId">>;
export declare class SaveQtyRatesCardRowDto extends SaveQtyRatesCardRowDto_base {
}
export declare class SaveQtyRatesCardDto {
    rows: SaveQtyRatesCardRowDto[];
}
export declare class SaveItemQtyRatesDto {
    companyId: string;
    branchId: string;
    itemId: string;
    confirmed?: boolean;
    rates?: SaveQtyRatesCardDto | null;
    slabs?: SaveItemQtyPriceDto[];
    deleteSlabIds?: string[];
}
export {};
