import { resolveRoleLedgers, type ResolvedRoleLedger } from '../ledgerRole/ledger-map.helper';
import { ChequeLedgerRole } from './types/cheque-enum';
type LedgerMapClient = Parameters<typeof resolveRoleLedgers>[0];
export type ChequeRoleLedgers = Map<string, ResolvedRoleLedger>;
export declare function requireChequeRoleLedgers(client: LedgerMapClient, roles: readonly ChequeLedgerRole[], scope: {
    companyId: string;
    branchId: string | null;
}): Promise<ChequeRoleLedgers>;
export declare function ledgerForRole(resolved: ReadonlyMap<string, ResolvedRoleLedger | null>, role: ChequeLedgerRole): ResolvedRoleLedger | null;
export type { ResolvedRoleLedger };
