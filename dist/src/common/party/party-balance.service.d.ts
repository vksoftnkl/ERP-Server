import { Prisma } from '@prisma/client';
import { type UserWording } from '../error-wording/error-wording';
import type { PartyRole } from './party-detail.map';
type PartyClient = Prisma.TransactionClient;
export interface PartyCompanyBalance {
    companyId: string;
    companyName: string | null;
    amount: Prisma.Decimal;
}
export interface PartyDeleteCheck {
    partyId: string;
    role: PartyRole;
    otherRoleLive: boolean;
    ledgerWouldBeDeleted: boolean;
    canDelete: boolean;
    refusalCode: string | null;
    balances: {
        companyId: string;
        companyName: string | null;
        amount: string;
        drCr: 'DR' | 'CR';
    }[];
    warnings: {
        draftDocs: number;
        openBills: number;
        chequesInHand: number;
    };
    refusals: PartyRefusal[];
}
export interface PartyRefusal {
    field: string;
    code: string;
    message: string;
    user?: UserWording;
}
export interface PartyDeleteCodes {
    hasBalance: string;
    hasChequeInHand: string;
}
export declare class PartyBalanceService {
    lockLedger(tx: PartyClient, ledId: string): Promise<{
        ledCompanyId: string | null;
        ledIsDeleted: boolean;
    } | undefined>;
    balances(tx: PartyClient, ledId: string): Promise<PartyCompanyBalance[]>;
    chequesInHand(tx: PartyClient, ledId: string): Promise<number>;
    warnings(tx: PartyClient, ledId: string): Promise<{
        draftDocs: number;
        openBills: number;
    }>;
    companyWithBooks(tx: PartyClient, ledId: string, currentCompanyId: string | null, nextCompanyId: string | null): Promise<{
        companyId: string;
        companyName: string | null;
    } | null>;
    deleteCheck(tx: PartyClient, input: {
        partyId: string;
        role: PartyRole;
        otherRoleLive: boolean;
        codes: PartyDeleteCodes;
    }): Promise<PartyDeleteCheck>;
}
export declare function withFigures(refusal: PartyRefusal, line: string | null): PartyRefusal;
export declare function formatRupees(value: Prisma.Decimal): string;
export {};
