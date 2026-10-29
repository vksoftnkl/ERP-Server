import { resolveRoleLedgers, type ResolvedRoleLedger } from '../ledgerRole/ledger-map.helper';
type LedgerMapClient = Parameters<typeof resolveRoleLedgers>[0];
export type PaymentRoleLedgers = Map<string, ResolvedRoleLedger>;
export declare function requirePaymentRoleLedgers(client: LedgerMapClient, roles: readonly string[], scope: {
    companyId: string;
    branchId: string | null;
}): Promise<PaymentRoleLedgers>;
export declare function describePaymentRoleLedgers(client: LedgerMapClient, roles: readonly string[], scope: {
    companyId: string;
    branchId: string | null;
}): Promise<Map<string, ResolvedRoleLedger | null>>;
export declare function ledgerForRole(resolved: ReadonlyMap<string, ResolvedRoleLedger | null>, role: string): ResolvedRoleLedger | null;
export type { ResolvedRoleLedger };
