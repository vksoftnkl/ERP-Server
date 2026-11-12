import { Prisma } from '@prisma/client';
import type { DocKind, PartyRef, RowKind } from './types/item-ledger.types';
type Dec = Prisma.Decimal;
type Num = Dec | string | number;
export declare const STOCK_BUCKETS: readonly ["SALEABLE", "DAMAGED", "QUARANTINE", "EXPIRED", "SAMPLE"];
export declare const BUCKET_CHOICES: readonly ["SALEABLE", "DAMAGED", "QUARANTINE", "EXPIRED", "SAMPLE", "ALL"];
export type BucketChoice = (typeof BUCKET_CHOICES)[number];
export declare const VALUE_AT: readonly ["WITHOUT_TAX", "WITH_TAX"];
export type ValueAt = (typeof VALUE_AT)[number];
export declare const ORDERS: readonly ["asc", "desc"];
export type Order = (typeof ORDERS)[number];
export declare const BUCKET_LABEL: Readonly<Record<string, string>>;
export declare function bucketLabel(bucket: string | null | undefined): string;
export declare const REPORT_TYPES: {
    readonly OPENING: {
        readonly label: "Opening stock";
        readonly kind: "IN";
        readonly tile: "opening";
    };
    readonly GRN: {
        readonly label: "GRN";
        readonly kind: "IN";
        readonly tile: "GRNs";
    };
    readonly PURCHASE: {
        readonly label: "Purchase";
        readonly kind: "IN";
        readonly tile: "purchases";
    };
    readonly SHORTAGE_RECEIPT: {
        readonly label: "Shortage receipt";
        readonly kind: "IN";
        readonly tile: "shortage receipts";
    };
    readonly PURCHASE_RETURN: {
        readonly label: "Purchase return";
        readonly kind: "OUT";
        readonly tile: "purchase returns";
    };
    readonly SALE: {
        readonly label: "Sale";
        readonly kind: "OUT";
        readonly tile: "sales";
    };
    readonly SALE_RETURN: {
        readonly label: "Sale return";
        readonly kind: "IN";
        readonly tile: "sale returns";
    };
    readonly DC: {
        readonly label: "Delivery challan";
        readonly kind: "OUT";
        readonly tile: "challans";
    };
    readonly DC_RETURN: {
        readonly label: "Challan return";
        readonly kind: "IN";
        readonly tile: "challan returns";
    };
    readonly GODOWN_TRANSFER: {
        readonly label: "Godown transfer";
        readonly kind: "INTERNAL";
        readonly tile: "godown transfers";
    };
    readonly BRANCH_OUT: {
        readonly label: "Branch outward";
        readonly kind: "OUT";
        readonly tile: "branch out";
    };
    readonly BRANCH_IN: {
        readonly label: "Branch inward";
        readonly kind: "IN";
        readonly tile: "branch in";
    };
    readonly ADJUST_PLUS: {
        readonly label: "Adjustment +";
        readonly kind: "IN";
        readonly tile: "adjustments +";
    };
    readonly ADJUST_MINUS: {
        readonly label: "Adjustment −";
        readonly kind: "OUT";
        readonly tile: "adjustments −";
    };
    readonly COUNT_EXCESS: {
        readonly label: "Count excess";
        readonly kind: "IN";
        readonly tile: "count excess";
    };
    readonly COUNT_SHORT: {
        readonly label: "Count shortage";
        readonly kind: "OUT";
        readonly tile: "count shortage";
    };
    readonly DAMAGE: {
        readonly label: "Damage";
        readonly kind: "OUT";
        readonly tile: "damage";
    };
    readonly EXPIRED: {
        readonly label: "Expired";
        readonly kind: "OUT";
        readonly tile: "expired";
    };
    readonly SAMPLE: {
        readonly label: "Sample";
        readonly kind: "OUT";
        readonly tile: "samples";
    };
    readonly GIFT: {
        readonly label: "Gift";
        readonly kind: "OUT";
        readonly tile: "gifts";
    };
    readonly BUCKET_MOVE: {
        readonly label: "Bucket move";
        readonly kind: "INTERNAL";
        readonly tile: "bucket moves";
    };
    readonly REPACK: {
        readonly label: "Repack";
        readonly kind: "MIXED";
        readonly tile: "repacks";
    };
    readonly REVALUED: {
        readonly label: "Revalued";
        readonly kind: "VALUE";
        readonly tile: "revaluations";
    };
};
export type ReportType = keyof typeof REPORT_TYPES;
export declare const REPORT_TYPE_CODES: ReportType[];
export declare function reportTypeOrder(type: string): number;
export declare function reportTypeOf(txnType: string, srcDocType: string | null, opts?: {
    internal?: boolean;
    toOtherBranch?: boolean;
}): string;
export declare function rowTypeLabel(type: string, kind: RowKind, otherBucket?: string | null): string;
export declare function tileLabel(type: string, kind: RowKind, otherBucket: string | null): string;
export declare function byTypeLabel(type: string, pairClass: 'LIVE' | 'CANCELLED' | 'AMENDED'): string;
export declare const SHADOW_DOC_TYPES: readonly ["SALE_BILL", "DELIVERY_CHALLAN", "SALE_RETURN", "DC_RETURN", "GRN", "PURCHASE_BILL", "SHORTAGE_RECEIPT", "PURCHASE_RETURN"];
export declare const SALES_DOC_TYPES: string[];
export declare const PURCHASE_DOC_TYPES: string[];
export declare function docKindOf(input: {
    linkDocType: string | null;
    voucherType: string | null;
    toBranchId: string | null;
    srcDocType: string | null;
}): DocKind | null;
export declare const COUNTER_CASH = "Counter (cash)";
export declare function partyOf(input: {
    docKind: DocKind | null;
    srcModule: string | null;
    partyId: string | null;
    ledgerName: string | null;
    billCustomerId: string | null;
    billCustomerName: string | null;
    walkInId: string | null;
    walkInName: string | null;
}): PartyRef | null;
export declare function sameId(a: string | null | undefined, b: string | null | undefined): boolean;
export declare function revisionOf(voucherRefno: string | null | undefined): number | null;
export declare function dmy(iso: string | null | undefined): string;
export declare function dayBefore(iso: string): string;
export declare function monthLabel(month: string): string;
export declare function monthsBetween(from: string, to: string): string[];
export declare function monthEnd(month: string): string;
export declare function isRealIsoDate(value: string | null | undefined): value is string;
export declare function transitText(status: string | null, receivedOn: string | null): string | null;
export declare function qtyIn(base: Num, factor: Num): string;
export declare function rateIn(baseRate: Num, factor: Num): string;
export declare function rateOf(value: Num, baseQty: Num, factor: Num): string | null;
export declare function money(value: Num): string;
export declare function dec(value: Num | null | undefined): Dec;
export declare function printedAsOf(parts: {
    itemName: string;
    branchName: string | null;
    from: string;
    to: string;
    godownName: string | null;
    bucket: string;
    batchNo: string | null;
    unitName: string;
    valueAt: ValueAt;
    types: string[];
    showReversed: boolean;
}): string;
export {};
