import { Prisma } from '@prisma/client';
import { type AccountsWriteClient } from "../../../common/utils/module-service.utils";
import { OpeningStaleReason } from './types/opening-balance-enum';
export type OpeningWriteClient = AccountsWriteClient;
export interface VisibleLedger {
    ledId: string;
    ledName: string;
    ledCompanyId: string | null;
    ledIsBillByBill: boolean;
    groupName: string | null;
    groupNature: string | null;
}
export declare function assertAccYearWritable(client: OpeningWriteClient, companyId: string, accYear: string, field: string): Promise<void>;
export declare function loadVisibleLedgers(client: OpeningWriteClient, companyId: string): Promise<Map<string, VisibleLedger>>;
export declare function isBalanceSheetNature(nature: string | null): boolean;
export declare function staleLaterYears(client: OpeningWriteClient, params: {
    companyId: string;
    branchId: string | null;
    accYear: string;
    reason: OpeningStaleReason;
    refId: string | null;
}): Promise<string[]>;
export declare function countBillsByOpening(client: OpeningWriteClient, accYear: string, opIds: readonly string[]): Promise<Map<string, number>>;
export type { Prisma };
