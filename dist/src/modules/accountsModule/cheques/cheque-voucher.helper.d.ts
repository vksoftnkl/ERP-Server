import { Prisma } from '@prisma/client';
import { DrCr } from '../receipt/types/receipt-enum';
import type { ChequeVoucherLeg, ChequeVoucherRef } from './types/cheque-api.types';
export interface ChequeVoucherType {
    vchrTypeId: number;
    vchrTypeCode: string;
    vchrTypeName: string;
}
export declare function loadVoucherType(tx: Prisma.TransactionClient, code: string, field: string): Promise<ChequeVoucherType>;
export interface ChequeLegSpec {
    drCr: DrCr;
    ledgerId: string;
    amount: Prisma.Decimal;
    role?: string | null;
    remarks?: string | null;
    reconDate?: Date | null;
}
export interface WriteVoucherParams {
    typeCode: string;
    field: string;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    voucherDate: Date;
    partyId: string;
    employeeId?: string[];
    docAmount: Prisma.Decimal;
    remarks: string | null;
    againstVoucherId?: string | null;
    againstAccYear?: string | null;
    srcDocId?: string | null;
    duplicateMessage?: string;
    userId: string;
    sessionId?: string | null;
    deviceType?: string | null;
    deviceId?: string | null;
    actor: string;
    legs: readonly ChequeLegSpec[];
}
export interface WrittenVoucher {
    ref: ChequeVoucherRef;
    legs: ChequeVoucherLeg[];
    voucherTypeId: number;
    voucherNo: bigint;
}
export declare function writeChequeVoucher(tx: Prisma.TransactionClient, params: WriteVoucherParams): Promise<WrittenVoucher>;
export declare function allocateNumber(tx: Prisma.TransactionClient, scope: {
    companyId: string;
    branchId: string;
    accYear: string;
    voucherTypeId: number;
    voucherDate: Date;
}): Promise<{
    voucherNo: bigint;
    voucherSlno: bigint;
    voucherRefno: string;
}>;
export declare function loadVoucherRef(tx: Prisma.TransactionClient, voucherId: string | null, accYear: string | null): Promise<ChequeVoucherRef | null>;
export declare function loadVoucherLegs(tx: Prisma.TransactionClient, voucherId: string, accYear: string): Promise<ChequeVoucherLeg[]>;
