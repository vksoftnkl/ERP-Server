export declare const GODOWN_POSITION_MENU_ID = 306;
export declare const GODOWN_POSITION_CODE_PREFIX = "GODOWN_POSITION";
export declare const GODOWN_POSITION_ERROR: {
    readonly RIGHT_VIEW: "GODOWN_POSITION_RIGHT_VIEW";
    readonly RIGHT_PRINT: "GODOWN_POSITION_RIGHT_PRINT";
    readonly RIGHT_EXPORT: "GODOWN_POSITION_RIGHT_EXPORT";
    readonly GODOWN_NOT_IN_BRANCH: "GODOWN_POSITION_GODOWN_NOT_IN_BRANCH";
    readonly BRANCH_NOT_IN_COMPANY: "STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY";
    readonly GROUP_NOT_FOUND: "STOCK_SUMMARY_GROUP_NOT_FOUND";
    readonly BRAND_NOT_FOUND: "STOCK_SUMMARY_BRAND_NOT_FOUND";
    readonly ITEM_NOT_FOUND: "STOCK_SUMMARY_ITEM_NOT_FOUND";
};
export declare const POSITION_QTY_IN: readonly ["SELLING", "BASE"];
export type PositionQtyIn = (typeof POSITION_QTY_IN)[number];
export declare const POSITION_BUCKETS: readonly ["SALEABLE", "DAMAGED", "QUARANTINE", "EXPIRED", "SAMPLE", "ALL"];
export type PositionBucket = (typeof POSITION_BUCKETS)[number];
export declare const BEHIND_KINDS: readonly ["BND", "CHALLAN"];
export type BehindKind = (typeof BEHIND_KINDS)[number];
export interface PositionRights {
    view: boolean;
    print: boolean;
    export: boolean;
}
export interface PositionHead {
    companyId: string;
    companyName: string | null;
    branchId: string;
    branchName: string | null;
    godownId: string | null;
    godownName: string | null;
    groupId: string | null;
    groupName: string | null;
    brandId: string | null;
    brandName: string | null;
    asOf: string;
    today: string;
    qtyIn: PositionQtyIn;
    bucket: PositionBucket;
    onlyToGive: boolean;
    hideZero: boolean;
    find: string;
}
export interface KgPkgs {
    kg: string;
    pkgs: string;
}
export interface PositionTiles {
    physical: KgPkgs & {
        rows: number;
    };
    billedNotDelivered: KgPkgs & {
        bills: number;
    };
    owned: KgPkgs;
    reserved: KgPkgs & {
        items: number;
    };
    short: {
        items: number;
        first: {
            itemId: string;
            itemName: string;
            godownId: string;
            godownName: string | null;
            unitName: string;
            physical: string;
            billedNotDelivered: string;
        } | null;
    };
    challanOut: KgPkgs & {
        challans: number;
    };
}
export interface LastGiven {
    refno: string | null;
    date: string;
    sdnId: string | null;
    accYear: string | null;
}
export interface PositionRow {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    godownId: string;
    godownName: string | null;
    unitName: string;
    unitFactor: string;
    physical: string;
    billedNotDelivered: string;
    owned: string;
    reserved: string;
    freeToSell: string;
    onVehicle: string | null;
    challanOut: string;
    physicalKg: string;
    lastGiven: LastGiven | null;
    short: string;
    overGiven: string;
    tie: boolean;
}
export interface PositionTotals {
    physicalKg: string;
    bndKg: string;
    ownedKg: string;
    reservedKg: string;
    freeKg: string;
    challanKg: string;
    rows: number;
    tie: boolean;
}
export interface PositionPayload {
    head: PositionHead;
    tiles: PositionTiles;
    rows: PositionRow[];
    totals: PositionTotals;
    rights: PositionRights;
}
export interface BehindBillRow {
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    billDate: string | null;
    days: number | null;
    custId: string | null;
    custName: string | null;
    areaName: string | null;
    mode: string;
    billItemId: string;
    lineNo: number;
    lotId: string | null;
    lotNo: string | null;
    billed: string;
    given: string;
    pending: string;
    lastGiven: LastGiven | null;
}
export interface BehindChallanRow {
    dcId: string;
    dcAccYear: string;
    dcRefno: string | null;
    dcDate: string | null;
    days: number | null;
    custId: string | null;
    custName: string | null;
    open: string;
    total: string;
}
export interface BehindLot {
    lotId: string | null;
    lotNo: string | null;
    owned: string;
    notDelivered: string;
    physical: string;
}
export interface BehindPayload {
    kind: BehindKind;
    itemId: string;
    itemName: string;
    godownId: string;
    godownName: string | null;
    unitName: string;
    unitFactor: string;
    rows: BehindBillRow[] | BehindChallanRow[];
    total: string;
    byLot: BehindLot[];
    sum: {
        owned: string;
        billedNotDelivered: string;
        physical: string;
        reserved: string;
        freeToSell: string;
    };
}
export interface PositionExportPayload {
    head: PositionHead;
    printedAs: string;
    tiles: PositionTiles;
    rows: PositionRow[];
    totals: PositionTotals;
    totalRows: number;
}
