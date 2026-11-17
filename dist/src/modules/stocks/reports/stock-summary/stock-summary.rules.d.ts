import { Prisma } from '@prisma/client';
import type { BranchRow, Chip, GodownRow, GroupBy, GroupRow, PageInfo, SummaryRow, SummaryTie, SummaryTiles, UnitShown, ValueTotals, ViewEcho } from './types/stock-summary.types';
type Dec = Prisma.Decimal;
type Num = Dec | string | number;
export declare const D0: Prisma.Decimal;
export declare function dec(v: Num | null | undefined): Dec;
export declare const SUMMARY_BUCKETS: readonly ["SALEABLE", "DAMAGED", "QUARANTINE", "EXPIRED", "SAMPLE"];
export declare const SUMMARY_BUCKET_CHOICES: readonly ["SALEABLE", "DAMAGED", "QUARANTINE", "EXPIRED", "SAMPLE", "ALL"];
export type SummaryBucket = (typeof SUMMARY_BUCKET_CHOICES)[number];
export declare const QTY_IN: readonly ["BASE", "DEFAULT"];
export type QtyIn = (typeof QTY_IN)[number];
export declare const SORT_KEYS: readonly ["name", "code", "group", "brand", "opening", "inward", "outward", "closing", "reserved", "available", "inTransit", "rate", "value", "lastSale", "notDelivered", "physical"];
export type SortKey = (typeof SORT_KEYS)[number];
export declare const SHOW_CHOICES: readonly ["ALL", "NEGATIVE", "NON_SALEABLE", "IN_TRANSIT", "RESERVED", "NO_SALE", "NOT_TIED"];
export type ShowChoice = (typeof SHOW_CHOICES)[number];
export declare const GROUP_BY: readonly ["GROUP", "BRAND", "SECTION", "CATEGORY"];
export declare const EXPORT_TABS: readonly ["ITEMS", "GROUPS", "GODOWNS", "BRANCHES"];
export declare const NO_KEY = "NONE";
export declare const DEFAULT_NO_SALE_DAYS = 60;
export declare const DEFAULT_LIMIT = 500;
export declare const MAX_LIMIT = 5000;
export declare const EXPORT_ROW_CAP = 20000;
export declare const ITEM_CAP = 50000;
export declare const EXPIRY_RED_DAYS = 3;
export declare function qty(base: Num, factor: Num): string;
export declare function money(v: Num): string;
export declare function rateText(value: Num, baseQty: Num, factor: Num): string;
export declare function daysBetween(a: string, b: string): number;
export declare function istInstant(ms: number): string;
export declare function monthStart(iso: string): string;
export interface PassRow {
    item: string;
    lot: string;
    godown: string;
    bucket: string;
    oq: Dec;
    pq: Dec;
    iq: Dec;
    xq: Dec;
    iv: Dec;
    xv: Dec;
    n: number;
    ov_engine: Dec;
    cv_engine: Dec;
    vm: string;
}
export declare function mergePass(parts: readonly {
    part: 'H' | 'O' | 'C';
    item: string;
    lot: string;
    godown: string;
    bucket: string;
    oq: Num | null;
    pq: Num | null;
    iq: Num | null;
    xq: Num | null;
    iv: Num | null;
    xv: Num | null;
    n: number | null;
    value: Num | null;
    vm: string | null;
}[]): PassRow[];
export interface FactRow {
    item_id: string;
    code: string | null;
    name: string | null;
    barcode: string | null;
    sku: string | null;
    group_id: string | null;
    group_name: string | null;
    brand_id: string | null;
    brand_name: string | null;
    section_id: string | null;
    section_name: string | null;
    category_id: string | null;
    category_name: string | null;
    company_id: string | null;
    warn_days: number | null;
    base_unit: string | null;
    default_iuc_id: string | null;
    default_factor: Dec | null;
    default_unit: string | null;
    default_is_base: boolean | null;
}
export interface BalanceRow {
    item: string;
    lot: string;
    godown: string;
    bucket: string;
    on_hand: Dec;
    reserved: Dec;
    available: Dec;
    transit_in: Dec;
    value: Dec;
    rate: Dec;
    expiry: string | null;
}
export interface AfterRow {
    item: string;
    godown: string;
    bucket: string;
    q: Dec;
    n: number;
}
export interface BndRow {
    item: string;
    godown: string;
    bucket: string;
    bnd: Dec;
}
export interface TransitDbRow {
    out_id: string;
    doc_no: string | null;
    from_branch: string;
    from_branch_name: string | null;
    to_branch: string;
    to_branch_name: string | null;
    to_godown: string | null;
    item: string;
    bucket: string | null;
    q: Dec;
    v: Dec;
}
export interface BuildScope {
    companyId: string;
    godownId: string | null;
    bucket: string | null;
    qtyIn: QtyIn;
    to: string;
    today: string;
    todayOnly: boolean;
    noSaleDays: number;
}
export declare function holdingInScope(h: {
    godown: string;
    bucket: string;
}, s: Pick<BuildScope, 'godownId' | 'bucket'>): boolean;
export declare function isNonSaleable(h: {
    godown: string;
    bucket: string;
}, s: Pick<BuildScope, 'godownId' | 'bucket'>): boolean;
export interface GroupKeys {
    GROUP: string | null;
    BRAND: string | null;
    SECTION: string | null;
    CATEGORY: string | null;
}
export interface ItemRunRow {
    readonly wire: SummaryRow;
    readonly itemId: string;
    readonly nameKey: string;
    readonly codeKey: string;
    readonly groupNameKey: string;
    readonly brandNameKey: string;
    readonly findText: string;
    readonly keys: GroupKeys;
    readonly names: Record<GroupBy, string | null>;
    readonly factor: Dec;
    readonly num: {
        opening: Dec;
        inward: Dec;
        outward: Dec;
        closing: Dec;
        reserved: Dec | null;
        available: Dec | null;
        inTransit: Dec | null;
        rate: Dec;
        value: Dec;
        notDelivered: Dec | null;
        physical: Dec | null;
    };
    readonly vals: {
        openingValue: Dec;
        inwardValue: Dec;
        outwardValue: Dec;
        costAdj: Dec;
        value: Dec;
        nonSaleable: Dec;
    };
    readonly lastSale: string | null;
    readonly flags: {
        zero: boolean;
        negative: boolean;
        nonSaleable: boolean;
        inTransit: boolean;
        reserved: boolean;
        noSale: boolean;
        notTied: boolean;
    };
    readonly godowns: readonly {
        godownId: string;
        qty: Dec;
        value: Dec;
        bnd: Dec | null;
    }[];
    readonly nonSaleableByBucket: readonly {
        bucket: string;
        value: Dec;
    }[];
    readonly reservedValue: Dec | null;
    readonly inTransitValue: Dec | null;
    readonly inTransitFrom: readonly string[];
}
export interface BuildInput {
    scope: BuildScope;
    pass: readonly PassRow[];
    facts: readonly FactRow[];
    lastSale: ReadonlyMap<string, string | null>;
    balance: readonly BalanceRow[];
    after: readonly AfterRow[];
    transitIn: readonly TransitDbRow[];
    bnd?: readonly BndRow[];
}
export declare function unitOf(f: FactRow | undefined, qtyIn: QtyIn): {
    unit: UnitShown;
    factor: Dec;
};
export declare function buildItemRows(input: BuildInput): ItemRunRow[];
export declare function sumValues(rows: readonly ItemRunRow[]): ValueTotals;
export declare function tilesOf(rows: readonly ItemRunRow[], todayOnly: boolean, hideZero: boolean): SummaryTiles;
export declare function tieOfRun(rows: readonly ItemRunRow[], todayOnly: boolean): SummaryTie;
export interface ViewSpec {
    sort: SortKey;
    dir: 'asc' | 'desc';
    page: number;
    limit: number;
    hideZero: boolean;
    onlyNegative: boolean;
    show: ShowChoice;
    find: string;
    groupBy: GroupBy | null;
    groupKey: string | null;
}
export declare function viewOf(q: {
    sort?: string;
    dir?: string;
    page?: number;
    limit?: number;
    hideZero?: boolean;
    onlyNegative?: boolean;
    show?: string;
    find?: string;
    groupBy?: string;
    groupKey?: string;
}): ViewSpec;
export declare function viewEcho(v: ViewSpec): ViewEcho;
type SortValue = Dec | string | null;
export declare function sortRows<T extends {
    nameKey: string;
    itemId: string;
}>(rows: readonly T[], key: (r: T) => SortValue, dir: 'asc' | 'desc'): T[];
export declare function itemSortValue(r: ItemRunRow, key: SortKey): SortValue;
export declare function filterItemRows(rows: readonly ItemRunRow[], v: Pick<ViewSpec, 'hideZero' | 'onlyNegative' | 'show' | 'find' | 'groupBy' | 'groupKey'>): ItemRunRow[];
export declare function itemView(rows: readonly ItemRunRow[], v: ViewSpec): ItemRunRow[];
export declare function pageOf<T>(rows: readonly T[], v: Pick<ViewSpec, 'page' | 'limit'>): {
    slice: T[];
    page: PageInfo;
};
export declare function drillText(rows: readonly ItemRunRow[], by: GroupBy | null, key: string | null): string | null;
export declare function groupRows(rows: readonly ItemRunRow[], by: GroupBy): {
    rows: GroupRow[];
    total: ValueTotals & {
        items: number;
    };
};
export declare function godownColumns(rows: readonly ItemRunRow[], branchGodowns: readonly {
    godownId: string;
    name: string;
}[]): {
    godownId: string;
    name: string;
}[];
export declare function godownRow(r: ItemRunRow, columns: readonly {
    godownId: string;
}[]): GodownRow;
export declare function godownTotals(rows: readonly ItemRunRow[], columns: readonly {
    godownId: string;
}[]): {
    byGodown: {
        godownId: string;
        value: string;
    }[];
    value: string;
};
export interface BranchRunRow {
    readonly wire: BranchRow;
    readonly itemId: string;
    readonly nameKey: string;
    readonly codeKey: string;
    readonly groupNameKey: string;
    readonly brandNameKey: string;
    readonly findText: string;
    readonly chainQty: Dec;
    readonly chainValue: Dec;
    readonly transitQty: Dec;
    readonly transitValue: Dec;
    readonly cells: readonly {
        branchId: string;
        qty: Dec;
        value: Dec;
    }[];
    readonly flags: {
        zero: boolean;
        negative: boolean;
        inTransit: boolean;
    };
}
export interface BranchCellDb {
    branch: string;
    item: string;
    q: Dec;
    v: Dec;
}
export declare function buildBranchRows(input: {
    cells: readonly BranchCellDb[];
    transit: readonly TransitDbRow[];
    facts: readonly FactRow[];
    columns: readonly {
        branchId: string;
    }[];
    qtyIn: QtyIn;
    companyId: string;
}): BranchRunRow[];
export declare function branchView(rows: readonly BranchRunRow[], v: ViewSpec): BranchRunRow[];
export declare function branchTotals(rows: readonly BranchRunRow[], columns: readonly {
    branchId: string;
}[], transfers: number): {
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
};
export declare function printedAsOf(p: {
    branchName: string | null;
    from: string;
    to: string;
    godownName: string | null;
    groupName: string | null;
    brandName: string | null;
    bucket: string;
    valueAt: string;
    qtyIn: string;
    hideZero: boolean;
    onlyNegative: boolean;
    show: string;
    find: string;
    tab?: string;
    drill?: string | null;
}): string;
export declare function chipsText(chips: readonly Chip[]): string;
export {};
