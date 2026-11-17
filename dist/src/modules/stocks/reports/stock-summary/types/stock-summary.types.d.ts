export declare const STOCK_SUMMARY_MENU_ID = 302;
export declare const STOCK_SUMMARY_CODE_PREFIX = "STOCK_SUMMARY";
export declare const STOCK_SUMMARY_ERROR: {
    readonly RIGHT_VIEW: "STOCK_SUMMARY_RIGHT_VIEW";
    readonly RIGHT_EXPORT: "STOCK_SUMMARY_RIGHT_EXPORT";
    readonly RIGHT_PRINT: "STOCK_SUMMARY_RIGHT_PRINT";
    readonly RANGE_REVERSED: "STOCK_SUMMARY_RANGE_REVERSED";
    readonly BRANCH_NOT_IN_COMPANY: "STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY";
    readonly GODOWN_NOT_IN_BRANCH: "STOCK_SUMMARY_GODOWN_NOT_IN_BRANCH";
    readonly GROUP_NOT_FOUND: "STOCK_SUMMARY_GROUP_NOT_FOUND";
    readonly BRAND_NOT_FOUND: "STOCK_SUMMARY_BRAND_NOT_FOUND";
    readonly ITEM_NOT_FOUND: "STOCK_SUMMARY_ITEM_NOT_FOUND";
    readonly RUN_EXPIRED: "STOCK_SUMMARY_RUN_EXPIRED";
    readonly TOO_MANY_ROWS: "STOCK_SUMMARY_TOO_MANY_ROWS";
    readonly TOO_MANY_ITEMS: "STOCK_SUMMARY_TOO_MANY_ITEMS";
};
export type RunKind = 'ITEMS' | 'BRANCHES';
export interface SummaryRights {
    print: boolean;
    export: boolean;
}
export interface UnitShown {
    name: string;
    factor: string;
    isBase: boolean;
}
export interface SummaryDefaults {
    from: string;
    to: string;
    bucket: string;
    valueAt: string;
    qtyIn: string;
    hideZero: boolean;
    onlyNegative: boolean;
    noSaleDays: number;
}
export interface OptionsPayload {
    company: {
        companyId: string;
        name: string | null;
    };
    branch: {
        branchId: string;
        name: string | null;
    };
    godowns: {
        godownId: string;
        name: string;
        short: string | null;
    }[];
    buckets: string[];
    today: string;
    fy: {
        name: string;
        begin: string;
        end: string;
    } | null;
    defaults: SummaryDefaults;
    rights: SummaryRights;
}
export interface SummaryHead {
    runId: string;
    kind: RunKind;
    asOf: string;
    expiresAt: string;
    companyId: string;
    companyName: string | null;
    branchId: string;
    branchName: string | null;
    from: string;
    to: string;
    todayOnly: boolean;
    godownId: string | null;
    godownName: string | null;
    groupId: string | null;
    groupName: string | null;
    brandId: string | null;
    brandName: string | null;
    bucket: string;
    valueAt: string;
    qtyIn: string;
    noSaleDays: number;
    rights: SummaryRights;
}
export type ChipKind = 'NEGATIVE' | 'EXPIRY' | 'NO_SALE' | 'NEVER_SOLD' | 'OTHER_COMPANY' | 'NOT_TIED';
export interface Chip {
    kind: ChipKind;
    date?: string;
    days?: number;
    tone?: 'RED' | 'AMBER';
}
export interface RowTie {
    equal: boolean;
    qtyEqual: boolean;
    valueEqual: boolean | null;
    stockNowQty: string;
    stockNowValue: string;
}
export interface SummaryRow {
    itemId: string;
    code: string | null;
    name: string;
    barcode: string | null;
    sku: string | null;
    groupId: string | null;
    groupName: string | null;
    brandId: string | null;
    brandName: string | null;
    sectionId: string | null;
    sectionName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    unit: UnitShown;
    defaultUnitId: string | null;
    valuation: string;
    otherCompany: boolean;
    opening: string;
    inward: string;
    outward: string;
    closing: string;
    reserved: string | null;
    available: string | null;
    inTransit: string | null;
    notDelivered: string | null;
    physical: string | null;
    rate: string;
    value: string;
    openingValue: string;
    inwardValue: string;
    outwardValue: string;
    costAdj: string;
    nonSaleableValue: string;
    lastSale: string | null;
    chips: Chip[];
    tie: RowTie | null;
}
export interface ValueTotals {
    openingValue: string;
    inwardValue: string;
    outwardValue: string;
    costAdj: string;
    closingValue: string;
}
export interface SummaryTotals extends ValueTotals {
    rows: number;
    rowsShown: number;
}
export interface SummaryTiles {
    closingValue: string;
    items: {
        listed: number;
        inStock: number;
        hiddenZero: number;
    };
    negative: {
        count: number;
        value: string;
        first: {
            itemId: string;
            name: string;
            closing: string;
            unit: string;
        } | null;
    };
    nonSaleable: {
        value: string;
        items: number;
        byBucket: {
            bucket: string;
            value: string;
            items: number;
        }[];
    };
    inTransitIn: {
        value: string;
        items: number;
        fromBranches: string[];
    } | null;
    reserved: {
        value: string;
        items: number;
    } | null;
}
export interface SummaryTie {
    checked: boolean;
    items: number;
    equal: number;
    differ: number;
    valueChecked: boolean;
}
export interface TransitOut {
    checked: boolean;
    source: 'STOCK_TRANSIT' | 'LEDGER';
    transfers: number;
    items: number;
    value: string;
    docs: {
        docNo: string | null;
        toBranch: string | null;
    }[];
}
export interface PageInfo {
    page: number;
    limit: number;
    totalRows: number;
    hasMore: boolean;
}
export interface ViewEcho {
    sort: string;
    dir: 'asc' | 'desc';
    hideZero: boolean;
    onlyNegative: boolean;
    show: string;
    find: string;
    groupBy: string | null;
    groupKey: string | null;
}
export interface SummaryPayload {
    head: SummaryHead;
    tiles: SummaryTiles;
    totals: SummaryTotals;
    totalsShown: ValueTotals & {
        rows: number;
    };
    tie: SummaryTie;
    transitOut: TransitOut;
    rows: SummaryRow[];
    page: PageInfo;
    view: ViewEcho;
}
export interface RowsPayload {
    runId: string;
    kind: RunKind;
    expiresAt: string;
    rows: SummaryRow[] | BranchRow[];
    page: PageInfo;
    view: ViewEcho;
    totalsShown: ValueTotals & {
        rows: number;
    };
}
export type GroupBy = 'GROUP' | 'BRAND' | 'SECTION' | 'CATEGORY';
export interface GroupRow extends ValueTotals {
    key: string | null;
    name: string;
    items: number;
    share: string;
}
export interface GroupsPayload {
    runId: string;
    groupBy: GroupBy;
    rows: GroupRow[];
    total: ValueTotals & {
        items: number;
    };
}
export interface GodownCell {
    godownId: string;
    qty: string;
    value: string;
    physical: string | null;
}
export interface GodownRow {
    itemId: string;
    code: string | null;
    name: string;
    otherCompany: boolean;
    defaultUnitId: string | null;
    unit: UnitShown;
    cells: GodownCell[];
    qty: string;
    value: string;
    physical: string | null;
}
export interface GodownsPayload {
    runId: string;
    godowns: {
        godownId: string;
        name: string;
    }[];
    rows: GodownRow[];
    totals: {
        byGodown: {
            godownId: string;
            value: string;
        }[];
        value: string;
    };
    page: PageInfo;
    view: ViewEcho;
}
export interface BranchCell {
    branchId: string;
    qty: string;
    value: string;
}
export interface BranchRow {
    itemId: string;
    code: string | null;
    name: string;
    groupName: string | null;
    brandName: string | null;
    unit: UnitShown;
    otherCompany: boolean;
    defaultUnitId: string | null;
    cells: BranchCell[];
    inTransit: {
        qty: string;
        value: string;
    };
    chain: {
        qty: string;
        value: string;
    };
}
export interface BranchesHead extends SummaryHead {
    source: 'STOCK_BALANCE' | 'LEDGER';
}
export interface BranchesTotals {
    byBranch: {
        branchId: string;
        value: string;
    }[];
    inTransit: {
        value: string;
        transfers: number;
    };
    chain: {
        value: string;
    };
}
export interface BranchesPayload {
    head: BranchesHead;
    branches: {
        branchId: string;
        name: string;
    }[];
    leftOut: string[];
    rows: BranchRow[];
    totals: BranchesTotals;
    page: PageInfo;
    view: ViewEcho;
}
export interface LotRow {
    godownId: string;
    godownName: string | null;
    bucket: string;
    lotId: string;
    batchNo: string | null;
    mrp: string | null;
    expiry: string | null;
    supplier: string | null;
    onHand: string;
    reserved: string | null;
    available: string | null;
    costRate: string;
    value: string;
    inScope: boolean;
}
export interface MovementLine {
    type: string;
    label: string;
    kind: string;
    pairClass: string;
    docs: number;
    qtyIn: string | null;
    qtyOut: string | null;
    valueIn: string | null;
    valueOut: string | null;
    movedQty: string | null;
    pairQty: string | null;
    netsToZero: boolean;
    detail: string;
}
export interface ItemPayload {
    item: {
        itemId: string;
        code: string | null;
        name: string;
        group: string | null;
        brand: string | null;
        hsn: string | null;
        gstRate: string | null;
        trackedAs: string;
        valuation: string;
        baseUnit: string;
        unit: UnitShown;
        reorderLevel: string | null;
        belowReorder: boolean | null;
        lastPurchase: {
            date: string;
            docNo: string | null;
            rate: string;
        } | null;
        lastSale: string | null;
    };
    lots: {
        source: 'STOCK_BALANCE' | 'LEDGER';
        asOf: string;
        rows: LotRow[];
        totalInScope: {
            onHand: string;
            reserved: string | null;
            available: string | null;
            value: string;
        };
    };
    movement: {
        opening: {
            date: string;
            qty: string;
            value: string;
        };
        byType: MovementLine[];
        totals: {
            qtyIn: string;
            qtyOut: string;
            valueIn: string;
            valueOut: string;
        };
        costAdj: string;
        closing: {
            date: string;
            qty: string;
            value: string;
        };
        ties: {
            qtyEqual: boolean;
            valueEqual: boolean;
            row: boolean | null;
        };
    };
}
export type ExportTab = 'ITEMS' | 'GROUPS' | 'GODOWNS' | 'BRANCHES';
export interface ExportPayload {
    head: SummaryHead | BranchesHead;
    printedAs: string;
    tab: ExportTab;
    rows: SummaryRow[] | GroupRow[] | GodownRow[] | BranchRow[];
    totals: unknown;
    transitOut: TransitOut | null;
    tie: SummaryTie | null;
    godowns?: {
        godownId: string;
        name: string;
    }[];
    branches?: {
        branchId: string;
        name: string;
    }[];
    totalRows: number;
}
