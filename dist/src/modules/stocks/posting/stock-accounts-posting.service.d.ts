import { Prisma } from '@prisma/client';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import type { SettledShortRow } from '../stock-voucher/stock-voucher-posting.helper';
import type { StockVoucherType } from '../stock-voucher/types/stock-voucher.types';
import { StockCogsModeService, type CogsModeResolver } from './stock-cogs-mode.service';
export declare const STOCK_COGS_MODE: unique symbol;
export declare const STOCK_ACCOUNTS_SRC_MODULE = "STOCK";
export declare const SHORT_SETTLE_SRC_DOC_TYPE = "TRANSFER_SHORT";
export declare const STOCK_LEDGER_ROLES: {
    readonly INVENTORY: "INVENTORY";
    readonly OPENING_DIFFERENCE: "OPENING_DIFFERENCE";
    readonly STOCK_SHORTAGE: "STOCK_SHORTAGE";
    readonly STOCK_EXCESS: "STOCK_EXCESS";
    readonly LOADING_CHARGES: "LOADING_CHARGES";
    readonly LOADING_PAYABLE: "LOADING_PAYABLE";
};
export interface StockAccountsPostInput {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    voucherType: StockVoucherType;
    displayName: string;
    actor: string;
    postedOn: Date;
}
export interface StockAccountsPostResult {
    voucherId: string;
    voucherRefno: string | null;
    amount: number;
    legCount: number;
}
export declare class StockAccountsPostingService {
    private readonly voucherPosting;
    private readonly cogs;
    private readonly logger;
    constructor(voucherPosting: VoucherPostingService, cogs: CogsModeResolver);
    static postsAccounts(voucherType: StockVoucherType): boolean;
    postForVoucher(tx: Prisma.TransactionClient, input: StockAccountsPostInput): Promise<StockAccountsPostResult | null>;
    reverseForVoucher(tx: Prisma.TransactionClient, input: {
        svhId: string;
        accYear: string;
        companyId: string;
        voucherType: StockVoucherType;
        reason: string;
        actor: string;
    }): Promise<{
        voucherId: string;
        legCount: number;
    } | null>;
    postShortSettlement(tx: Prisma.TransactionClient, input: {
        outId: string;
        outAccYear: string;
        companyId: string;
        branchId: string;
        refno: string;
        reasonId: string;
        remarks: string | null;
        rows: SettledShortRow[];
        actor: string;
        settledOn: Date;
    }): Promise<StockAccountsPostResult | null>;
    postTransferCharges(tx: Prisma.TransactionClient, input: StockAccountsPostInput): Promise<StockAccountsPostResult | null>;
    private assertLoadingRolesMapped;
    private openingLegs;
    private voucherTypeIdByCode;
    private varianceLegs;
    private header;
    private userFor;
}
export declare const STOCK_COGS_MODE_PROVIDER: {
    provide: symbol;
    useExisting: typeof StockCogsModeService;
};
