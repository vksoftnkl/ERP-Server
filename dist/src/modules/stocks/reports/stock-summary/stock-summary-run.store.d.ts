import type { BranchRunRow, ItemRunRow } from './stock-summary.rules';
import type { BranchesHead, RunKind, SummaryHead, SummaryTie, SummaryTiles, TransitOut } from './types/stock-summary.types';
export declare const RUN_IDLE_MS: number;
export declare const RUN_CAP_PER_USER = 4;
export declare const RUN_CAP_TOTAL = 40;
export declare const RUN_ROW_CAP_TOTAL = 100000;
export interface ItemRunData {
    kind: 'ITEMS';
    head: SummaryHead;
    tiles: SummaryTiles;
    tie: SummaryTie;
    transitOut: TransitOut;
    rows: readonly ItemRunRow[];
    branchGodowns: readonly {
        godownId: string;
        name: string;
    }[];
}
export interface BranchRunData {
    kind: 'BRANCHES';
    head: BranchesHead;
    rows: readonly BranchRunRow[];
    branches: readonly {
        branchId: string;
        name: string;
    }[];
    leftOut: readonly string[];
    transfers: number;
}
export type RunData = ItemRunData | BranchRunData;
export type StoredRun = RunData & {
    readonly runId: string;
    readonly userId: string;
    readonly companyId: string;
    readonly createdAt: number;
    lastUsed: number;
};
export declare class StockSummaryRunStore {
    private readonly runs;
    now: () => number;
    idleMs: number;
    put(userId: string, companyId: string, data: RunData): StoredRun;
    get(runId: string, userId: string, opts?: {
        companyId?: string | null;
        kind?: RunKind;
    }): StoredRun | null;
    expiresAt(run: StoredRun): number;
    size(): {
        runs: number;
        rows: number;
    };
    private sweep;
    private enforceCaps;
}
