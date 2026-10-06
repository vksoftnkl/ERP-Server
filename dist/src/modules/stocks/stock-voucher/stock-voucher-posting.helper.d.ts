import { Prisma } from '@prisma/client';
import { type StockVoucherTypeRules } from './types/stock-voucher.types';
import { type BucketKey } from '../../Inventory/items-price-master/price-resolver';
export declare const STOCK_LEDGER_SRC_MODULE = "STOCK";
export interface StockLedgerSourceLabel {
    srcModule: 'SALES' | 'PURCHASE' | 'STOCK';
    srcDocType: string;
    srcRefno?: string | null;
    partyId?: string | null;
}
export interface PostStockVoucherParams {
    rules: StockVoucherTypeRules;
    svhId: string;
    accYear: string;
    ledgerSource?: StockLedgerSourceLabel;
    actor: string;
    postedOn: Date;
}
export interface PostStockVoucherResult {
    rowsPosted: number;
    status: 'POSTED' | 'IN_TRANSIT';
    transitRows: number;
    closedOut: {
        svhId: string;
        accYear: string;
        refno: string;
    } | null;
}
export declare const BUCKET_MOVE_TXN_TYPES: readonly ["BUCKET_OUT", "BUCKET_IN"];
export declare function postStockVoucher(tx: Prisma.TransactionClient, params: PostStockVoucherParams): Promise<PostStockVoucherResult>;
export declare function effectivePolicyLateral(scope: {
    companyId: Prisma.Sql;
    branchId: Prisma.Sql;
    itemId: Prisma.Sql;
    itemGroupId: Prisma.Sql;
    onDate: Prisma.Sql;
}): Prisma.Sql;
export declare function effectivePolicyCte(): Prisma.Sql;
export declare function lotIdentityKeyColumns(): Prisma.Sql;
export interface BucketTrackFlags {
    trackMrp: boolean;
    trackSalePrice: boolean;
}
export declare function bucketKeyFor(policy: BucketTrackFlags | null | undefined, value: {
    mrp?: number | null;
    salePrice?: number | null;
}): BucketKey;
export declare function bucketKeySql(args: {
    trackMrp: Prisma.Sql;
    trackSalePrice: Prisma.Sql;
    mrp: Prisma.Sql;
    salePrice: Prisma.Sql;
}): {
    mrp: Prisma.Sql;
    salePrice: Prisma.Sql;
};
export interface BucketPolicyScope {
    itemId: string;
    companyId: string | null;
    branchId: string | null;
}
export declare function readBucketTrackFlags(client: Pick<Prisma.TransactionClient, '$queryRaw'>, scopes: readonly BucketPolicyScope[], onDate: string): Promise<BucketTrackFlags[]>;
export declare function lineReasonJoin(): Prisma.Sql;
export declare function lineDirectionColumn(rules: StockVoucherTypeRules): Prisma.Sql;
export declare function lotlessOutwardLine(): Prisma.Sql;
export declare function issueNarrowing(lot: string, line: {
    trackBatch: Prisma.Sql;
    trackMrp: Prisma.Sql;
    trackSalePrice: Prisma.Sql;
    trackExpiry: Prisma.Sql;
    trackSerial: Prisma.Sql;
    trackSupplier: Prisma.Sql;
    keyBatch: Prisma.Sql;
    keyMrp: Prisma.Sql;
    keySp: Prisma.Sql;
    keyExpiry: Prisma.Sql;
    keySerial: Prisma.Sql;
    keySupplier: Prisma.Sql;
}): Prisma.Sql;
export declare function unreversedLedgerRow(): Prisma.Sql;
export declare const STOCK_LOT_ID_NAMESPACE = "2f0b7c1e-5d3a-4e8f-9b61-7c4d2a9e0f53";
export declare function lotIdentityUuid(alias: string): Prisma.Sql;
export interface SettleShortParams {
    outId: string;
    outAccYear: string;
    companyId: string;
    branchId: string;
    reasonId: string;
    remarks: string | null;
    actor: string;
    settledOn: Date;
}
export interface SettledShortRow {
    sttId: string;
    itemId: string;
    lotId: string;
    toGodownId: string;
    bucket: string;
    shortQty: Prisma.Decimal;
    costRate: Prisma.Decimal;
    shortValue: Prisma.Decimal;
}
export declare function settleTransitShort(tx: Prisma.TransactionClient, params: SettleShortParams): Promise<{
    refno: string;
    rows: SettledShortRow[];
}>;
export type HoldingSource = Prisma.Sql;
export declare function transitHoldingsOf(outId: string, outAccYear: string): HoldingSource;
export declare function reservationHoldingsOf(srcDocType: string, srcDocId: string): HoldingSource;
export declare function openReservationHoldings(companyId?: string | null): HoldingSource;
export declare function ensureBalanceRows(tx: Prisma.TransactionClient, holdings: HoldingSource, actor: string): Promise<void>;
export declare function refreshReserved(tx: Prisma.TransactionClient, holdings: HoldingSource, actor: string, on: Date): Promise<number>;
export declare function refreshTransitIn(tx: Prisma.TransactionClient, holdings: HoldingSource, actor: string, on: Date): Promise<number>;
export interface StockRebuildScope {
    companyId?: string | null;
    branchId?: string | null;
    itemId?: string | null;
}
export interface StockRebuildOutcome {
    balances: number;
    lotRates: number;
    itemCosts: number;
    stamps: number;
    lotTotals: number;
}
export declare function rebuildStockDerivedFigures(tx: Prisma.TransactionClient, scope: StockRebuildScope, actor: string, on: Date): Promise<StockRebuildOutcome>;
export interface CancelStockVoucherParams {
    rules: StockVoucherTypeRules;
    svhId: string;
    accYear: string;
    actor: string;
    reason: string;
    cancelledOn: Date;
}
export declare function cancelStockVoucher(tx: Prisma.TransactionClient, params: CancelStockVoucherParams): Promise<number>;
export declare function cancelDraftVoucher(tx: Prisma.TransactionClient, params: CancelStockVoucherParams): Promise<number>;
