import { Prisma } from '@prisma/client';
import { ModuleErrorDetail } from "../../../common/utils/module-service.utils";
export declare const SUPPLY_NATURES: readonly ["INTRA", "INTER"];
export type SupplyNature = (typeof SUPPLY_NATURES)[number];
export declare function isSupplyNature(value: unknown): value is SupplyNature;
export interface RoleLedgerRequest {
    role: string;
    taxId?: string | null;
    supplyNature?: string | null;
    field?: string;
}
export interface ResolveRoleLedgerOptions {
    companyId?: string | null;
    branchId?: string | null;
    where: string;
    message?: string;
}
export interface ResolvedRoleLedger {
    role: string;
    roleLabel: string;
    ledgerId: string;
    ledgerName: string;
    supplyNature: string | null;
    source: 'TAX_RATE' | 'LEDGER_MAP';
    sourceRowId: string;
}
type LedgerMapClient = Pick<Prisma.TransactionClient, 'accLedgerRole' | 'accLedgerMap' | 'taxRateLedger'>;
export declare function roleLedgerKey(request: RoleLedgerRequest): string;
export declare function resolveRoleLedgers(client: LedgerMapClient, requests: readonly RoleLedgerRequest[], options: ResolveRoleLedgerOptions): Promise<Map<string, ResolvedRoleLedger | null>>;
export declare function resolveRoleLedger(client: LedgerMapClient, request: RoleLedgerRequest, options: ResolveRoleLedgerOptions): Promise<ResolvedRoleLedger | null>;
export declare function requireRoleLedgers(client: LedgerMapClient, requests: readonly RoleLedgerRequest[], options: ResolveRoleLedgerOptions): Promise<Map<string, ResolvedRoleLedger>>;
export declare function collectRoleLedgerGapErrors(client: LedgerMapClient, requests: readonly RoleLedgerRequest[], options: ResolveRoleLedgerOptions): Promise<ModuleErrorDetail[]>;
export {};
