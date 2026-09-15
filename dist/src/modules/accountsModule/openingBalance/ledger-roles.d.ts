import { Prisma } from '@prisma/client';
import { resolveRoleLedger, type ResolvedRoleLedger } from '../ledgerRole/ledger-map.helper';
type LedgerMapClient = Parameters<typeof resolveRoleLedger>[0];
export declare function resolveOpeningDifferenceLedger(client: LedgerMapClient, companyId: string, branchId: string | null): Promise<ResolvedRoleLedger | null>;
export declare function resolveRetainedEarningsLedger(client: LedgerMapClient, companyId: string, branchId: string | null): Promise<ResolvedRoleLedger | null>;
export type { ResolvedRoleLedger };
export type OpeningLedgerMapClient = LedgerMapClient;
export type { Prisma };
