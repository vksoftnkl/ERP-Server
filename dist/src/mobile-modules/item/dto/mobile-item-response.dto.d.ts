declare class MobileCompanyOptionDto {
    id: string;
    name: string;
    place: string | null;
}
declare class MobileSortedOptionDto {
    id: string;
    name: string;
    position: number | null;
}
declare class MobileItemPriceLevelOptionDto {
    id: number;
    name: string;
}
export declare class MobileItemOptionsDto {
    companies: MobileCompanyOptionDto[];
    itemGroups: MobileSortedOptionDto[];
    brands: MobileSortedOptionDto[];
    priceLevels: MobileItemPriceLevelOptionDto[];
}
export declare class MobileItemOptionsSuccessDto {
    success: true;
    message: string;
    data: MobileItemOptionsDto;
}
export declare class MobileItemUnitDto {
    iucId: string;
    unitId: string;
    unitName: string | null;
    factor: number;
    isDefaultUnit: boolean;
    isBaseUnit: boolean;
    weight: number;
    priced: boolean;
    priceA: string | null;
    priceB: string | null;
    priceC: string | null;
    priceD: string | null;
    mrp: string | null;
    minPrice: string | null;
    loadingCharge: string | null;
    freightCharge: string | null;
    priceSource: string | null;
    priceScope: string | null;
    availableQty: number;
}
export declare class MobileItemDto {
    itemId: string;
    itemCode: string | null;
    itemNameEn: string;
    itemNameTa: string | null;
    itemGroupId: string;
    itemGroupName: string | null;
    itemBrandId: string | null;
    itemBrandName: string | null;
    allowLoading: boolean;
    allowFreight: boolean;
    allowPromo: boolean;
    inclTax: boolean;
    hsnCode: string | null;
    taxId: string | null;
    taxPerc: string;
    availableBaseQty: number;
    units: MobileItemUnitDto[];
}
export declare class MobileItemListDto {
    items: MobileItemDto[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    companyId: string;
    branchId: string | null;
    priceDate: string;
}
export declare class MobileItemListSuccessDto {
    success: true;
    message: string;
    data: MobileItemListDto;
}
export {};
