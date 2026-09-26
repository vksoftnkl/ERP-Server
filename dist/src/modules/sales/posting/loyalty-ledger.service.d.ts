import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { LoyaltyBillSource, LoyaltyConsumeOptions, LoyaltyConsumeType, LoyaltyEarnResult, LoyaltyLot, LoyaltyPreview, LoyaltyScheme, LoyaltySrcDocType } from './types/loyalty.types';
export declare class LoyaltyLedgerService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    private writeLedgerRows;
    private recomputeLots;
    private recomputeMembers;
    lots(memberId: string, onDate: string, tx?: Prisma.TransactionClient): Promise<LoyaltyLot[]>;
    redeemable(memberId: string, onDate: string, tx?: Prisma.TransactionClient): Promise<number>;
    balance(memberId: string, tx?: Prisma.TransactionClient): Promise<number>;
    consume(tx: Prisma.TransactionClient, memberId: string, points: number, txnType: LoyaltyConsumeType, opts: LoyaltyConsumeOptions): Promise<number>;
    resolveMember(tx: Prisma.TransactionClient, bill: LoyaltyBillSource, opts?: {
        autoEnrol: boolean;
        isWalkIn: boolean;
        createdBy?: string;
    }): Promise<string | null>;
    resolveScheme(tx: Prisma.TransactionClient, bill: LoyaltyBillSource, opts?: {
        at?: string;
        forRedeem?: boolean;
    }): Promise<LoyaltyScheme | null>;
    earn(tx: Prisma.TransactionClient, bill: LoyaltyBillSource, opts?: {
        memberId?: string | null;
        scheme?: LoyaltyScheme | null;
        createdBy?: string;
        dryRun?: boolean;
    }): Promise<LoyaltyEarnResult>;
    private computeEarn;
    redeem(tx: Prisma.TransactionClient, bill: LoyaltyBillSource, tender: {
        tenderId: string;
        tenderAccYear: string;
        points: number;
        amount: number;
        masterRate?: number | null;
    }, opts?: {
        memberId?: string | null;
        scheme?: LoyaltyScheme | null;
        createdBy?: string;
    }): Promise<{
        rowsWritten: number;
        points: number;
        amount: number;
        rate: number;
    }>;
    reverseForCancel(tx: Prisma.TransactionClient, doc: {
        docId: string;
        accYear: string;
        docType: LoyaltySrcDocType;
        docRefno?: string | null;
    }, opts?: {
        reason?: string;
        createdBy?: string;
    }): Promise<{
        rowsWritten: number;
        earnReversed: number;
        redeemReversed: number;
    }>;
    reverseRedeemForTender(tx: Prisma.TransactionClient, doc: {
        docId: string;
        accYear: string;
        docType: LoyaltySrcDocType;
        docRefno?: string | null;
        tenderId: string;
    }, opts?: {
        reason?: string;
        createdBy?: string;
    }): Promise<{
        rowsWritten: number;
        pointsRestored: number;
    }>;
    clawbackForReturn(tx: Prisma.TransactionClient, ret: {
        docId: string;
        accYear: string;
        companyId: string;
        branchId: string;
        docDate: string;
        docRefno?: string | null;
        memberId: string;
    }, share: number, opts?: {
        scheme?: LoyaltyScheme | null;
        earnedOnBill?: number;
        createdBy?: string;
    }): Promise<{
        rowsWritten: number;
        clawedBack: number;
        shortfall: number;
    }>;
    preview(bill: LoyaltyBillSource, tx?: Prisma.TransactionClient): Promise<LoyaltyPreview>;
    expiryRun(companyId: string, accYear: string, on?: string, createdBy?: string): Promise<number>;
    couponExpiryRun(companyId: string, accYear: string, on?: string, createdBy?: string): Promise<number>;
    private writeCouponTxnRows;
    private recomputeCoupons;
    private recomputeCouponBatches;
    private schemeItems;
    private schemeSlabs;
    private reversedIds;
    private maxRowNos;
}
