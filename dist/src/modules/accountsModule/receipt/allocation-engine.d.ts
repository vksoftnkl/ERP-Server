import { Prisma } from '@prisma/client';
import type { ModuleErrorDetail } from "../../../common/utils/module-service.utils";
import { BillAdjType, BillSettlementMode, BillType, DrCr } from './types/receipt-enum';
export declare class AllocationError extends Error {
    readonly kind: 'CONFLICT' | 'VALIDATION';
    readonly details: ModuleErrorDetail[];
    constructor(kind: 'CONFLICT' | 'VALIDATION', message: string, details: ModuleErrorDetail[]);
}
export type VoucherKey = string;
export declare const RECEIPT_VOUCHER_KEY: VoucherKey;
export declare const pdcVoucherKey: (tenderRowNo: number) => VoucherKey;
export interface AllocationBill {
    billId: string;
    billAccYear: string;
    docRefno: string;
    amount: Prisma.Decimal;
    discount: Prisma.Decimal;
    writeoff: Prisma.Decimal;
    roundoff: Prisma.Decimal;
    pendingAmount: Prisma.Decimal;
    writeoffApprovedBy: string | null;
}
export interface AllocationCredit {
    billId: string;
    billAccYear: string;
    billType: BillType;
    docRefno: string;
    amount: Prisma.Decimal;
    pendingAmount: Prisma.Decimal;
    adjType: BillAdjType;
    settlementMode: BillSettlementMode;
}
export interface AllocationOtherLine {
    lineNo: number;
    role: string | null;
    ledgerId: string;
    drCr: DrCr;
    amount: Prisma.Decimal;
    settlesBill: boolean;
    settlementMode: BillSettlementMode;
    isInstrumentSplit: boolean;
}
export interface AllocationTender {
    tenderRowNo: number;
    amount: Prisma.Decimal;
    isCheque: boolean;
    isPostDated: boolean;
    instrumentDate: Date | null;
    settlementMode: BillSettlementMode;
}
export interface AllocationPin {
    lineNo: number;
    billId: string;
    billAccYear: string;
    amount: Prisma.Decimal;
}
export interface AllocationInput {
    receiptDate: Date;
    bills: readonly AllocationBill[];
    credits: readonly AllocationCredit[];
    otherLines: readonly AllocationOtherLine[];
    tenders: readonly AllocationTender[];
    pins: readonly AllocationPin[];
    claimedOnAccount: Prisma.Decimal;
}
export interface AllocationAdjustment {
    billId: string;
    billAccYear: string;
    adjType: BillAdjType;
    settlementMode: BillSettlementMode;
    drCr: DrCr;
    amount: Prisma.Decimal;
    adjDate: Date;
    isPostDated: boolean;
    voucherKey: VoucherKey;
    tenderRowNo: number | null;
    otherLineNo: number | null;
    againstBill: {
        billId: string;
        billAccYear: string;
    } | null;
    approvedBy: string | null;
    countsToAdjustAmount: boolean;
    remarks: string | null;
}
export interface AllocationOnAccount {
    voucherKey: VoucherKey;
    amount: Prisma.Decimal;
    onDate: Date;
}
export interface AllocationResult {
    adjustments: AllocationAdjustment[];
    onAccount: AllocationOnAccount[];
    totalOnAccount: Prisma.Decimal;
    adjustAmountByVoucher: Map<VoucherKey, Prisma.Decimal>;
    partyCreditByVoucher: Map<VoucherKey, Prisma.Decimal>;
}
export declare function allocate(input: AllocationInput): AllocationResult;
