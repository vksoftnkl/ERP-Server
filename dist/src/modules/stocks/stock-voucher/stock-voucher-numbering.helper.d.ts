import { Prisma } from '@prisma/client';
import type { StockVoucherType } from './types/stock-voucher.types';
export interface StockVoucherNumberScope {
    companyId: string;
    branchId: string;
    accYear: string;
    voucherType: StockVoucherType;
    deviceId: string;
}
export interface AllocatedStockVoucherNumber {
    slno: bigint;
    refno: string;
}
export declare function resolveDeviceCode(tx: Prisma.TransactionClient, deviceId: string): Promise<string>;
export declare function nextStockVoucherSlno(tx: Prisma.TransactionClient, scope: StockVoucherNumberScope): Promise<bigint>;
export declare function buildStockVoucherRefno(typeCode: string, accYear: string, deviceCode: string, slno: bigint): string;
export declare function allocateStockVoucherNumber(tx: Prisma.TransactionClient, scope: StockVoucherNumberScope, typeCode: string, supplied?: {
    slno?: string | number | bigint | null;
    refno?: string | null;
}, refnoVchrTypeId?: number): Promise<AllocatedStockVoucherNumber>;
