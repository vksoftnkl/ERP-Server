export declare const ITEM_LEDGER_MENU_ID = 301;
export declare const ITEM_LEDGER_CODE_PREFIX = "ITEM_LEDGER";
export declare const ITEM_LEDGER_ERROR: {
    readonly RIGHT_VIEW: "ITEM_LEDGER_RIGHT_VIEW";
    readonly BRANCH_NOT_IN_COMPANY: "ITEM_LEDGER_BRANCH_NOT_IN_COMPANY";
    readonly ITEM_NOT_FOUND: "ITEM_LEDGER_ITEM_NOT_FOUND";
    readonly RANGE_REVERSED: "ITEM_LEDGER_RANGE_REVERSED";
    readonly GODOWN_NOT_IN_BRANCH: "ITEM_LEDGER_GODOWN_NOT_IN_BRANCH";
    readonly LOT_NOT_OF_ITEM: "ITEM_LEDGER_LOT_NOT_OF_ITEM";
    readonly UNIT_NOT_OF_ITEM: "ITEM_LEDGER_UNIT_NOT_OF_ITEM";
    readonly NO_FISCAL_YEAR: "ITEM_LEDGER_NO_FISCAL_YEAR";
    readonly TOO_MANY_ROWS: "ITEM_LEDGER_TOO_MANY_ROWS";
};
export type RowKind = 'IN' | 'OUT' | 'INTERNAL' | 'VALUE';
export type RowState = 'LIVE' | 'CANCELLED' | 'AMENDED' | 'REVERSAL';
export type PairClass = 'LIVE' | 'CANCELLED' | 'AMENDED';
export type DocKind = 'SALE_BILL' | 'DELIVERY_CHALLAN' | 'SALE_RETURN' | 'DC_RETURN' | 'GRN' | 'PURCHASE_BILL' | 'SHORTAGE_RECEIPT' | 'PURCHASE_RETURN' | 'OPENING' | 'PHYSICAL' | 'ADJUSTMENT' | 'ISSUE' | 'GODOWN_TRANSFER' | 'BRANCH_OUTWARD' | 'BRANCH_INWARD';
export interface UnitRef {
    unitId: string | null;
    name: string;
    factor: string;
    isBase: boolean;
}
export interface ReportRights {
    print: boolean;
    export: boolean;
}
export interface OptionsPayload {
    item: {
        itemId: string;
        code: string | null;
        name: string;
        group: string | null;
        brand: string | null;
        hsn: string | null;
        gstRate: string | null;
        trackedAs: string;
        isService: boolean;
        baseUnit: {
            unitId: string | null;
            name: string;
        };
        units: {
            unitId: string;
            name: string;
            factor: string;
            isBase: boolean;
        }[];
        reorderLevel: string | null;
    };
    godowns: {
        godownId: string;
        name: string;
        short: string | null;
    }[];
    lots: {
        lotId: string;
        batchNo: string | null;
        expiry: string | null;
        mrp: string | null;
        onHand: string;
    }[];
    types: {
        type: string;
        label: string;
        kind: RowKind | 'MIXED';
    }[];
    lastCountDate: string | null;
    fy: FyRef | null;
    rights: ReportRights;
}
export interface FyRef {
    name: string;
    begin: string;
    end: string;
}
export interface ReportHead {
    companyId: string;
    companyName: string | null;
    branchId: string;
    branchName: string | null;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    from: string;
    to: string;
    godownId: string | null;
    godownName: string | null;
    bucket: string;
    lotId: string | null;
    batchNo: string | null;
    unit: UnitRef;
    valueAt: 'WITHOUT_TAX' | 'WITH_TAX';
    order: 'asc' | 'desc';
    showReversed: boolean;
    types: string[];
    revaluationsLeftOut: number;
    rights: ReportRights;
}
export interface OpeningBlock {
    date: string;
    closingOf: string;
    qty: string;
    value: string;
    rate: string | null;
    lots: number;
}
export interface ClosingBlock {
    date: string;
    qty: string;
    value: string;
    rate: string | null;
}
export interface LedgerTotals {
    receivedQty: string;
    issuedQty: string;
    valueIn: string;
    valueOut: string;
    rows: number;
    rowsShown: number;
    docs: number;
    internalMoves: number;
    reversedPairs: number;
    revaluations: number;
}
export interface DocRef {
    kind: DocKind | null;
    id: string;
    accYear: string | null;
    branchId: string | null;
}
export interface PartyRef {
    id: string | null;
    label: string;
    walkIn: boolean;
}
export interface ReversalInfo {
    kind: 'CANCELLED' | 'AMENDED';
    at: string | null;
    user: string | null;
    reason: string | null;
}
export interface ReversesInfo {
    kind: 'CANCELLED' | 'AMENDED';
    docNo: string | null;
    postedAt: string | null;
    reason: string | null;
}
export interface LedgerRow {
    rowId: string;
    seq: number;
    date: string;
    time: string | null;
    postedAt: string | null;
    type: string;
    typeLabel: string;
    kind: RowKind;
    state: RowState;
    docNo: string | null;
    revision: number | null;
    doc: DocRef;
    party: PartyRef | null;
    detail: string;
    godownId: string | null;
    godownName: string | null;
    toGodownName: string | null;
    bucket: string | null;
    toBucket: string | null;
    lotId: string | null;
    batchNo: string | null;
    expiry: string | null;
    receivedQty: string | null;
    issuedQty: string | null;
    movedQty: string | null;
    freeQty: string | null;
    balanceQty: string;
    balanceValue: string;
    costRate: string | null;
    costValue: string;
    docRate: string | null;
    user: string | null;
    reversal: ReversalInfo | null;
    reverses: ReversesInfo | null;
}
export interface ByTypeRow {
    type: string;
    label: string;
    kind: RowKind | 'MIXED';
    pairClass: PairClass;
    docs: number;
    qtyIn: string | null;
    qtyOut: string | null;
    valueIn: string | null;
    valueOut: string | null;
    movedQty: string | null;
    pairQty: string | null;
    netsToZero: boolean;
}
export interface TileDocs {
    type: string;
    label: string;
    count: number;
}
export interface LedgerTiles {
    receivedDocs: TileDocs[];
    issuedDocs: TileDocs[];
    cancelled: {
        count: number;
        docNos: string[];
    };
    amended: {
        count: number;
        docNos: string[];
    };
}
export interface TieCheck {
    checked: boolean;
    ledgerQty: string | null;
    stockNowQty: string | null;
    equal: boolean | null;
    difference: string | null;
}
export interface PeriodTie {
    qtyEqual: boolean | null;
    valueEqual: boolean | null;
}
export interface StockNowRow {
    godownId: string;
    godownName: string | null;
    bucket: string;
    lotId: string;
    batchNo: string | null;
    expiry: string | null;
    onHand: string;
    reserved: string;
    inTransitIn: string;
    costRate: string;
    value: string;
    inScope: boolean;
}
export interface StockNowBlock {
    asOf: string;
    rows: StockNowRow[];
    totalInScope: {
        onHand: string;
        reserved: string;
        inTransitIn: string;
        value: string;
    };
}
export interface LedgerPayload {
    head: ReportHead;
    opening: OpeningBlock;
    closing: ClosingBlock;
    totals: LedgerTotals;
    tiles: LedgerTiles;
    tie: TieCheck;
    periodTie: PeriodTie;
    rows: LedgerRow[];
    page: {
        page: number;
        limit: number;
        totalRows: number;
        hasMore: boolean;
    };
    byType: ByTypeRow[];
    stockNow: StockNowBlock;
}
export interface DayRow {
    date: string;
    docs: number;
    openingQty: string;
    receivedQty: string;
    issuedQty: string;
    closingQty: string;
    valueIn: string;
    valueOut: string;
    closingValue: string;
}
export interface DaysPayload {
    head: ReportHead;
    opening: OpeningBlock;
    closing: ClosingBlock;
    days: DayRow[];
    totals: LedgerTotals;
    periodTie: PeriodTie;
}
export interface MonthRow {
    month: string;
    label: string;
    docs: number;
    openingQty: string;
    inwardQty: string;
    outwardQty: string;
    closingQty: string;
    valueIn: string;
    valueOut: string;
    closingValue: string;
    partial: boolean;
}
export interface MonthsPayload {
    head: ReportHead;
    fy: FyRef;
    opening: OpeningBlock;
    months: MonthRow[];
    yearToDate: {
        docs: number;
        inwardQty: string;
        outwardQty: string;
        closingQty: string;
        closingValue: string;
    };
}
export interface ExportPayload {
    head: ReportHead;
    printedAs: string;
    opening: OpeningBlock;
    closing: ClosingBlock;
    totals: LedgerTotals;
    rows: LedgerRow[];
    totalRows: number;
}
