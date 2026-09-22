import { Prisma } from '@prisma/client';
import { assertAccYearWritable, assertVoucherPartitionExists } from '../../accountsModule/receipt/receipt.guards';
import { type SalesGuardContext } from './types/posting.types';
import type { SalesSettings } from './sales.settings';
export { assertAccYearWritable, assertVoucherPartitionExists };
export type SalesWriteClient = Prisma.TransactionClient;
export declare function warn(ctx: SalesGuardContext, code: string, message: string, opts?: {
    field?: string;
    line?: number;
    overridable?: boolean;
    statutory?: SalesGuardContext['warnings'][number]['statutory'];
}): void;
export declare function refuse(ctx: SalesGuardContext, code: string, message: string, opts?: {
    field?: string;
    line?: number;
    statutory?: SalesGuardContext['refusals'][number]['statutory'];
}): void;
export type SalesRight = 'post' | 'cancel' | 'amend' | 'override' | 'retender';
export declare function loadRights(client: SalesWriteClient, userId: string, menuId: number): Promise<Record<SalesRight, boolean>>;
export declare function assertRight(client: SalesWriteClient, userId: string, menuId: number, right: SalesRight): Promise<Record<SalesRight, boolean>>;
export declare function assertBackdate(ctx: SalesGuardContext, docDate: string, settings: SalesSettings, today?: string, field?: string): void;
export declare function loadDayClosed(client: SalesWriteClient, companyId: string, branchId: string, docDate: string): Promise<boolean>;
export declare function assertDayOpen(client: SalesWriteClient, companyId: string, branchId: string, docDate: string, field?: string): Promise<void>;
export declare function assertCreditLimit(client: SalesWriteClient, ctx: SalesGuardContext, party: {
    custId: string;
    partyLedgerId: string;
}, companyId: string, billAmount: number, settings: SalesSettings, docDate?: string): Promise<void>;
export declare function assertSalesmen(client: SalesWriteClient, companyId: string, ids: string[] | null | undefined, opts?: {
    field?: string;
    requirePrimary?: boolean;
}): Promise<void>;
export declare function assertBillAdds(ctx: SalesGuardContext, computed: number, declared: number, field?: string): void;
export declare function assertTenderTotal(ctx: SalesGuardContext, tendered: number, billAmount: number, settings: SalesSettings, field?: string): void;
export declare function loadDeclaredLocks(client: SalesWriteClient, gdrId: string | null): Promise<{
    irnLive: boolean;
    ewbLive: boolean;
}>;
export declare function assertAmendable(client: SalesWriteClient, gdrId: string | null): Promise<void>;
export declare function assertBandWritable(client: SalesWriteClient, gdrId: string | null): Promise<void>;
export declare function assertCancellable(client: SalesWriteClient, bill: {
    billId: string;
    accYear: string;
    companyId: string;
}): Promise<void>;
