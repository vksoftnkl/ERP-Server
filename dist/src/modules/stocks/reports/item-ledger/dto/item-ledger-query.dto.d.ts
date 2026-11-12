import { type BucketChoice, type Order, type ValueAt } from '../item-ledger.rules';
export declare const ITEM_LEDGER_MAX_LIMIT = 5000;
export declare const ITEM_LEDGER_DEFAULT_LIMIT = 1000;
export declare class ItemLedgerOptionsDto {
    companyId: string;
    branchId: string;
    itemId: string;
}
export declare class ItemLedgerMonthsDto extends ItemLedgerOptionsDto {
    to: string;
    godownId?: string;
    bucket?: BucketChoice;
    lotId?: string;
    unitId?: string;
    valueAt?: ValueAt;
    types?: string[];
    showReversed?: boolean;
}
export declare class ItemLedgerScopeDto extends ItemLedgerMonthsDto {
    from: string;
}
export declare class ItemLedgerExportDto extends ItemLedgerScopeDto {
    order?: Order;
}
export declare class ItemLedgerQueryDto extends ItemLedgerExportDto {
    page?: number;
    limit?: number;
}
