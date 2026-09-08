export interface OpeningStockItemLookup {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    barcode: string | null;
    uomId: string;
    unitName: string;
    toBaseFactor: number;
    baseUomId: string;
    taxPerc: number;
    cessPerc: number;
    cessUnit: number;
    trackSignature: string;
    mrp: number;
    salePrice: number;
    alreadyOpened: boolean;
}
export interface OpeningStockItemLookupArgs {
    companyId?: string | null;
    branchId?: string | null;
    itemId: string;
    uomId?: string;
    onDate: string;
}
