import { Prisma } from '@prisma/client';
import { type ModuleErrorDetail } from "../../../common/utils/module-service.utils";
export declare const RECONCILE_ON_POST_SETTING = "accounts.reconcile_on_post";
export declare const ACC_PARTY_OUT_OF_BALANCE = "ACC_PARTY_OUT_OF_BALANCE";
export declare const ACC_CHEQUES_OUT_OF_BALANCE = "ACC_CHEQUES_OUT_OF_BALANCE";
export interface BooksReconcileScope {
    companyId: string;
    accYear: string;
    ledgerIds?: readonly (string | null | undefined)[];
    vouchers?: readonly ({
        voucherId: string;
        accYear: string;
    } | null | undefined)[];
    cheques?: readonly ({
        apdId: string;
        apdAccYear: string;
    } | null | undefined)[];
}
export interface PartyOutOfBalanceDetail extends ModuleErrorDetail {
    code: typeof ACC_PARTY_OUT_OF_BALANCE;
    partyId: string;
    partyName: string;
    ledger: number;
    bills: number;
    diff: number;
}
export interface ChequesOutOfBalanceDetail extends ModuleErrorDetail {
    code: typeof ACC_CHEQUES_OUT_OF_BALANCE;
    ledgerId: string;
    ledgerName: string;
    ledger: number;
    register: number;
    diff: number;
}
export declare function assertBooksReconcile(tx: Prisma.TransactionClient, scope: BooksReconcileScope): Promise<void>;
