import { resolveRoleLedgers, type ResolvedRoleLedger } from '../ledgerRole/ledger-map.helper';
type LedgerMapClient = Parameters<typeof resolveRoleLedgers>[0];
export type ReceiptRoleLedgers = Map<string, ResolvedRoleLedger>;
export declare function requireReceiptRoleLedgers(client: LedgerMapClient, roles: readonly string[], scope: {
    companyId: string;
    branchId: string | null;
}): Promise<ReceiptRoleLedgers>;
export declare function describeReceiptRoleLedgers(client: LedgerMapClient, roles: readonly string[], scope: {
    companyId: string;
    branchId: string | null;
}): Promise<Map<string, ResolvedRoleLedger | null>>;
export declare function ledgerForRole(resolved: ReadonlyMap<string, ResolvedRoleLedger | null>, role: string): ResolvedRoleLedger | null;
export type { ResolvedRoleLedger };
