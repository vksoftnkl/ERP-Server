import type { Prisma } from '@prisma/client';
export declare const PRICE_TABLES: readonly ["IPM", "IQP"];
export type PriceTable = (typeof PRICE_TABLES)[number];
export declare const PRICE_CHANGE_ACTIONS: readonly ["CREATE", "UPDATE", "DELETE", "RESTORE", "REKEY"];
export type PriceChangeAction = (typeof PRICE_CHANGE_ACTIONS)[number];
export declare const PRICE_CHANGE_SOURCES: readonly ["ITEM_CARD", "CHANGE_SELLING_PRICE", "QTY_PRICE", "BUCKET_REKEY", "IMPORT", "PURCHASE"];
export type PriceChangeSource = (typeof PRICE_CHANGE_SOURCES)[number];
export type PriceChangeApp = 'DESKTOP' | 'WEB' | 'API' | 'SYSTEM';
export type PriceRowSnapshot = Prisma.JsonObject;
export interface PriceWriteOrigin {
    source: PriceChangeSource;
    menuId: number | null;
    reason?: string | null;
}
export declare const PRICE_MENU_ID: {
    readonly ITEM_MASTER: 29;
    readonly CHANGE_SELLING_PRICE: 30;
    readonly QTY_PRICE: 244;
    readonly PRICE_CHANGE_LOG: 290;
    readonly PURCHASE_ENTRY: 24;
};
export declare const PRICE_ORIGIN: {
    readonly ITEM_CARD: {
        readonly source: "ITEM_CARD";
        readonly menuId: 29;
    };
    readonly CHANGE_SELLING_PRICE: {
        readonly source: "CHANGE_SELLING_PRICE";
        readonly menuId: 30;
    };
    readonly QTY_PRICE: {
        readonly source: "QTY_PRICE";
        readonly menuId: 244;
    };
    readonly BUCKET_REKEY: {
        readonly source: "BUCKET_REKEY";
        readonly menuId: 29;
    };
};
export interface PriceChangeEntry {
    table: PriceTable;
    rowId: string;
    origin: PriceWriteOrigin;
    before: PriceRowSnapshot | null;
    after: PriceRowSnapshot | null;
    action?: 'REKEY';
}
export interface PriceChangeScope {
    companyId: string | null;
    branchId: string | null;
    itemId: string | null;
    unitId: string | null;
    godownId: string | null;
    partyId: string | null;
    priceLevel: number | null;
    bucketMrp: number | null;
    bucketSp: number | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
}
