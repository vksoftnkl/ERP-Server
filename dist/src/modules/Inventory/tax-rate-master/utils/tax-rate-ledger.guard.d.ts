import { Prisma } from '@prisma/client';
import { ModuleErrorDetail } from "../../../../common/utils/module-service.utils";
export interface TaxRateLedgerLineInput {
    trl_role: string;
    trl_supply_nature?: string | null;
    trl_ledger_id: string;
}
export type TaxRateLedgerGuardClient = Pick<Prisma.TransactionClient, 'accLedgerRole' | 'accLedgerMaster'>;
export interface TaxRateLedgerGuardOptions {
    fieldPath?: (index: number, field: string) => string;
    companyId?: string | null;
    message?: string;
}
export declare function assertTaxRateLedgers(client: TaxRateLedgerGuardClient, lines: readonly TaxRateLedgerLineInput[], options?: TaxRateLedgerGuardOptions): Promise<void>;
export declare function collectTaxRateLedgerErrors(client: TaxRateLedgerGuardClient, lines: readonly TaxRateLedgerLineInput[], options?: TaxRateLedgerGuardOptions): Promise<ModuleErrorDetail[]>;
