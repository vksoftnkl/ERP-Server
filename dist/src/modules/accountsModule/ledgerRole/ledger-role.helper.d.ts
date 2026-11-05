import { Prisma } from '@prisma/client';
import { ModuleErrorDetail } from "../../../common/utils/module-service.utils";
export interface RoleLedgerRef {
    role: string;
    ledgerId: string;
    field: string;
}
export interface CheckRoleLedgersOptions {
    companyId?: string | null;
    where: string;
    message?: string;
}
type LedgerRoleClient = Pick<Prisma.TransactionClient, 'accLedgerRole' | 'accLedgerMaster'>;
export declare function checkRoleLedgers(tx: LedgerRoleClient, refs: readonly RoleLedgerRef[], options: CheckRoleLedgersOptions): Promise<void>;
export declare function collectRoleLedgerErrors(tx: LedgerRoleClient, refs: readonly RoleLedgerRef[], options: CheckRoleLedgersOptions): Promise<ModuleErrorDetail[]>;
export {};
