import { Prisma } from '@prisma/client';
import { TxnStatusDocType, TxnStatusEvent } from "../../../common/txn-status-log/txn-status-log.helper";
import type { StockPostingService } from "../../stocks/posting/stock-posting.service";
import type { StockVoucherTypeRules } from "../../stocks/stock-voucher/types/stock-voucher.types";
export type Tx = Prisma.TransactionClient;
export declare const D: (v: Prisma.Decimal.Value | null | undefined) => Prisma.Decimal;
export declare const ZERO: Prisma.Decimal;
export declare const r2: (v: Prisma.Decimal) => Prisma.Decimal;
export declare const num2: (v: Prisma.Decimal) => number;
export declare const isoDate: (d: Date) => string;
export declare const dateOf: (iso: string | null | undefined) => Date | null;
export declare const SRC_MODULE = "PURCHASE";
declare const NUMBER_TABLES: {
    readonly PO: {
        readonly table: "purchase.pur_order";
        readonly p: "po";
    };
    readonly GRN: {
        readonly table: "purchase.pur_grn";
        readonly p: "grn";
    };
    readonly PRN: {
        readonly table: "purchase.pur_return";
        readonly p: "pr";
    };
    readonly SHR: {
        readonly table: "purchase.pur_shortage_receipt";
        readonly p: "psr";
    };
};
export type NumberKind = keyof typeof NUMBER_TABLES;
export declare function allocateDocNumber(tx: Tx, kind: NumberKind, companyId: string, branchId: string, accYear: string, deviceId: string): Promise<{
    slno: bigint;
    refno: string;
}>;
export interface UnitRow {
    iuc_id: string;
    iuc_item_id: string;
    iuc_to_base_factor: Prisma.Decimal;
    base_iuc_id: string;
    item_default_tax_id: string | null;
    item_hsn_code: string | null;
    item_name: string | null;
}
export declare function loadUnits(tx: Tx, uomIds: string[]): Promise<Map<string, UnitRow>>;
export declare function loadTaxRates(tx: Tx, taxIds: (string | null | undefined)[]): Promise<Map<string, {
    tax_id: string;
    tax_rate_perc: Prisma.Decimal;
    tax_cess_perc: Prisma.Decimal | null;
    tax_cess_per_unit: Prisma.Decimal | null;
}>>;
export declare function supplierRow(tx: Tx, supplierId: string): Promise<{
    sup_id: string;
    sup_name: string;
    sup_state_code: string | null;
    sup_gst_type: string | null;
    sup_gst_no: string | null;
    sup_credit_days: number | null;
}>;
export declare function payeeLedgers<P extends {
    partyId: string;
}>(tx: Tx, payees: P[], field?: string): Promise<P[]>;
export declare function isInterState(tx: Tx, branchId: string, supplier: {
    sup_state_code: string | null;
    sup_gst_no: string | null;
}): Promise<boolean>;
export declare function voucherTypeId(tx: Tx, code: 'GRN' | 'PUR' | 'PRN' | 'SHR' | 'PCL'): Promise<number>;
export interface StockRow {
    itemId: string;
    uomId: string;
    baseUomId: string;
    factor: Prisma.Decimal;
    godownId: string;
    bucket: string;
    lotId?: string | null;
    batchNo?: string | null;
    mfgDate?: Date | null;
    expiryDate?: Date | null;
    mrp?: Prisma.Decimal | null;
    salePrice?: Prisma.Decimal | null;
    serialNo?: string | null;
    supplierId?: string | null;
    sizeId?: string | null;
    colourId?: string | null;
    model?: string | null;
    qty: Prisma.Decimal;
    freeQty: Prisma.Decimal;
    costRate: Prisma.Decimal;
}
export declare function stockRules(direction: 'IN' | 'OUT', typeCode: string, display: string, txnType: string, statusDocType: TxnStatusDocType): StockVoucherTypeRules;
export declare function postShadowStock(tx: Tx, stockPosting: StockPostingService, doc: {
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string;
    sessionId: string | null;
    docType: string;
    docId: string;
    refno: string;
    revision: number;
    usrRefno: string | null;
    docDate: string;
    supplierId: string | null;
    remarks: string;
}, rules: StockVoucherTypeRules, rows: StockRow[], actor: string, postedOn: Date): Promise<{
    svhId: string | null;
    perRow: {
        lotId: string | null;
        sviId: string;
        cost: Prisma.Decimal;
        batchNo: string | null;
    }[];
}>;
export interface TextileRow {
    itemId: string;
    batchNo?: string | null;
    sizeId?: string | null;
    colourId?: string | null;
    model?: string | null;
}
export declare function numberTextileBatches(tx: Tx, scope: {
    companyId: string;
    branchId: string;
    accYear: string;
    docDate: string;
}, rows: TextileRow[]): Promise<{
    batchNos: (string | null)[];
    numbered: Set<number>;
}>;
export declare function writeTextileDetails(tx: Tx, a: {
    companyId: string;
    accYear: string;
    svhId: string;
    actor: string;
}, rows: TextileRow[], numbered: Set<number>): Promise<void>;
export declare function cancelShadowStock(tx: Tx, stockPosting: StockPostingService, docType: string, docId: string, accYear: string, companyId: string, branchId: string, rules: StockVoucherTypeRules, actor: string, reason: string): Promise<void>;
export declare function raiseBillRow(tx: Tx, a: {
    companyId: string;
    branchId: string;
    accYear: string;
    partyId: string;
    billType: string;
    drCr: 'DR' | 'CR';
    amount: Prisma.Decimal;
    docType: string;
    docId: string;
    voucherId: string;
    voucherTypeId: number;
    voucherNo: bigint;
    voucherDate: string;
    refno: string;
    refSuffix?: string | null;
    docDate: Date;
    dueDate?: Date | null;
    creditDays?: number | null;
    narration: string;
    actor: string;
}): Promise<void>;
export declare function assertBillsUnsettled(tx: Tx, docType: string, docId: string, refno: string): Promise<void>;
export declare function assertNoLiveReturns(tx: Tx, srcDocId: string, refno: string): Promise<void>;
export declare function assertShortagesUntouched(tx: Tx, srcDocId: string, refno: string): Promise<void>;
export declare function withdrawBillRows(tx: Tx, docType: string, docId: string, actor: string): Promise<void>;
export declare function statusLog(tx: Tx, a: {
    companyId: string;
    branchId: string;
    accYear: string;
    docType: TxnStatusDocType;
    docId: string;
    refno: string;
    event: TxnStatusEvent;
    from: string | null;
    to: string;
    actor: string;
    deviceId?: string | null;
    remarks?: string | null;
}): Promise<void>;
export declare function unitNames(db: {
    $queryRaw: Tx['$queryRaw'];
}, uomIds: string[]): Promise<Map<string, {
    itemName: string;
    unitName: string;
}>>;
export declare function jsonSafe<T>(v: T): T;
export { TxnStatusDocType, TxnStatusEvent };
