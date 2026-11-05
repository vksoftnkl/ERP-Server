import type { Prisma } from '@prisma/client';
import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
export type StockSrcModule = 'SALES' | 'STOCK' | 'PURCHASE';
export type StockSrcDocType = 'DELIVERY_CHALLAN' | 'SALE_BILL' | 'SALE_RETURN' | 'DC_RETURN' | 'STOCK_VOUCHER';
export type StockTxnType = 'DC_ISSUE' | 'SALE' | 'SALE_RETURN' | 'DC_RETURN' | 'OPENING' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'COUNT' | 'REPACK_OUT' | 'REPACK_IN';
export interface StockLine {
    lineId: string;
    lineNo: number;
    splitNo: number;
    itemId: string;
    godownId: string;
    lotId?: string | null;
    bucket: string;
    unitId: string | null;
    factor: number;
    qty: number;
    baseQty: number;
    freeQty: number;
    freeBaseQty: number;
    batchNo?: string | null;
    batchDate?: string | null;
    expiryDate?: string | null;
    serialNo?: string | null;
    mrp?: number | null;
    salePrice?: number | null;
    supplierId?: string | null;
    docRate?: number | null;
    docRateWot?: number | null;
    isService?: boolean;
}
export interface StockLineSource {
    srcModule: StockSrcModule;
    srcDocType: StockSrcDocType;
    srcDocId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    docDate: string;
    docDatetime: string;
    refno: string;
    partyId?: string | null;
    reasonId?: string | null;
    txnType: StockTxnType;
    direction: 1 | -1;
    lines(tx: Prisma.TransactionClient): Promise<StockLine[]>;
    attachLot(tx: Prisma.TransactionClient, lineId: string, lotId: string, costRate: number, costRateWot: number): Promise<void>;
    godownIds?(tx: Prisma.TransactionClient): Promise<string[]>;
}
export interface StockVoucherSourceInput {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    rules: StockVoucherTypeRules;
}
