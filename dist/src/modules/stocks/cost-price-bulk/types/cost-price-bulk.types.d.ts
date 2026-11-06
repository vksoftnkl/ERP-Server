export declare const COST_BULK_MENU_ID = 298;
export declare const COST_BULK_RIGHT_PREFIX = "COST_BULK";
export declare const COST_BULK: {
    readonly NOT_PLAIN_STOCK: "COST_BULK_NOT_PLAIN_STOCK";
    readonly INACTIVE: "COST_BULK_INACTIVE";
    readonly NO_PRICE_ROW: "COST_BULK_NO_PRICE_ROW";
    readonly ROW_NOT_CURRENT: "COST_BULK_ROW_NOT_CURRENT";
    readonly ROW_CHANGED: "COST_BULK_ROW_CHANGED";
    readonly ABOVE_MRP: "COST_BULK_ABOVE_MRP";
    readonly BELOW_MIN: "COST_BULK_BELOW_MIN";
    readonly BELOW_COST: "COST_BULK_BELOW_COST";
    readonly BY_USER_PRICES_KEPT: "COST_BULK_BY_USER_PRICES_KEPT";
    readonly TOO_MANY_ROWS: "COST_BULK_TOO_MANY_ROWS";
    readonly CHAIN_NEEDS_HQ: "COST_BULK_CHAIN_NEEDS_HQ";
    readonly COST_TOO_LOW: "COST_BULK_COST_TOO_LOW";
};
export type CostBulkCode = (typeof COST_BULK)[keyof typeof COST_BULK];
export declare const COST_BULK_ITEM_NOT_FOUND = "LOOKUP_ITEM_NOT_FOUND";
export declare const OVERRIDABLE_CODES: readonly string[];
export declare const MAX_COST_BULK_ROWS = 1000;
export declare const MAX_COST_BULK_PAGE = 1000;
export declare const DEFAULT_COST_BULK_PAGE = 1000;
export declare const MAX_LEFT_OUT = 1000;
export declare const PROFIT_TYPES: readonly ["By %", "By Rs", "By User"];
export type ProfitType = (typeof PROFIT_TYPES)[number];
export declare const BY_USER: ProfitType;
export declare const LEFT_OUT_REASONS: readonly ["NOT_PLAIN_STOCK", "OLD_BATCH_TICK", "NO_PRICE_ROW", "INACTIVE"];
export type LeftOutReason = (typeof LEFT_OUT_REASONS)[number];
export declare const LEFT_OUT_CODE: Readonly<Record<LeftOutReason, CostBulkCode>>;
export type CostBulkScope = 'BRANCH' | 'CHAIN';
export interface CostBulkRights {
    view: boolean;
    edit: boolean;
    override: boolean;
}
export interface CostBulkLevel {
    level: 1 | 2 | 3 | 4;
    price: number;
    priceWot: number;
    markupPerc: number;
    active: boolean;
}
export interface CostBulkRow {
    lineNo: number;
    ipmId: string;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    barcode: string | null;
    uomId: string;
    unitName: string | null;
    unitSlno: number;
    parentUomId: string | null;
    parentUnitName: string | null;
    unitsPerParent: number | null;
    toBaseFactor: number;
    unitFactor: number;
    factorsAgree: boolean;
    priceScope: CostBulkScope;
    companyShared: boolean;
    profitType: string;
    roundOff: number;
    taxPerc: number;
    costPrice: number;
    costWot: number;
    mrp: number;
    minPrice: number;
    levels: CostBulkLevel[];
    scheduledFrom: string | null;
    hasQtySlabs: boolean;
    updatedOn: string | null;
    rowToken: string;
}
export interface CostBulkLeftOut {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    unitName: string | null;
    uomId: string | null;
    trackedAs: string;
    reasonCode: LeftOutReason;
    reason: string;
}
export interface CostBulkListResult {
    items: CostBulkRow[];
    total: number;
    totalItems: number;
    page: number;
    limit: number;
    leftOut: CostBulkLeftOut[];
    leftOutTotal: number;
    leftOutCounts: Record<LeftOutReason, number>;
    today: string;
    belowCostPolicy: string;
    rights: CostBulkRights;
}
export interface CostBulkNote {
    code: string;
    level: 'REFUSE' | 'WARN';
    message: string;
    field: string;
    line: number;
    ipmId: string;
    overridable: boolean;
}
export interface CostBulkCounts {
    rows: number;
    changed: number;
    unchanged: number;
    refused: number;
    warned: number;
}
export interface CostBulkValidateResult {
    ok: boolean;
    refusals: CostBulkNote[];
    warnings: CostBulkNote[];
    rights: CostBulkRights;
    counts: CostBulkCounts;
    belowCostPolicy: string;
}
export interface CostBulkSavedRow extends CostBulkRow {
    written: boolean;
    sourceIpmId: string;
    companyCopy: boolean;
}
export interface CostBulkSaveResult {
    saved: number;
    unchanged: number;
    rows: CostBulkSavedRow[];
    warnings: CostBulkNote[];
    refusals: CostBulkNote[];
    rights: CostBulkRights;
    counts: CostBulkCounts;
    belowCostPolicy: string;
}
