export interface MobileItemOptions {
    companies: MobileCompanyOption[];
    branches: MobileBranchOption[];
    itemGroups: MobileSortedOption[];
    brands: MobileSortedOption[];
    priceLevels: MobilePriceLevelOption[];
}
export interface MobileCompanyOption {
    id: string;
    name: string;
    place: string | null;
}
export interface MobileBranchOption {
    id: string;
    name: string;
    companyId: string;
    isDefault: boolean;
}
export interface MobileSortedOption {
    id: string;
    name: string;
    position: number | null;
}
export interface MobilePriceLevelOption {
    id: number;
    name: string;
}
export interface MobileItemUnit {
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
    priceSource: 'MASTER' | 'BUCKET' | null;
    priceScope: 'BRANCH' | 'CHAIN' | null;
    availableQty: number;
}
export interface MobileItem {
    itemId: string;
    itemCode: string | null;
    itemNameEn: string;
    itemNameTa: string | null;
    itemGroupId: string;
    itemGroupName: string | null;
    itemBrandId: string | null;
    itemBrandName: string | null;
    categoryId: string | null;
    sectionId: string | null;
    allowLoading: boolean;
    allowFreight: boolean;
    allowPromo: boolean;
    inclTax: boolean;
    hsnCode: string | null;
    taxId: string | null;
    taxPerc: string;
    availableBaseQty: number;
    units: MobileItemUnit[];
}
export interface MobileItemListPayload {
    items: MobileItem[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    companyId: string;
    branchId: string | null;
    priceDate: string;
}
