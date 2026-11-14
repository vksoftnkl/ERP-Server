import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { BranchRunRow, ItemRunRow } from './stock-summary.rules';
import type {
  BranchesHead,
  RunKind,
  SummaryHead,
  SummaryTie,
  SummaryTiles,
  TransitOut,
} from './types/stock-summary.types';

/**
 * The run store (plan §5.3, D20): ONE Show = one run, computed once in one
 * snapshot and kept here so paging, sorting, Find, the tile filters, the Group
 * summary and Godown-wise tabs, Excel and print read it with no SQL.
 *
 * PROCESS MEMORY, on purpose: Redis is optional on this stack (redis.enabled
 * may be false) and the house rule keeps stock and money out of it. A run is
 * not a cache — it is one Show's result cursor, owned by one user, never
 * served to a new Show.
 *
 *  - life: 15 min idle, every read renews;
 *  - caps: 4 runs per user (the oldest goes), 40 runs and 100,000 rows in all
 *    (least recently used first) — ~0.6 KB a row keeps it near 60 MB under
 *    PM2's max_memory_restart 512M;
 *  - owner: a run answers only its own user (and, when the caller names one,
 *    its own company); anything else reads as gone (410), so no one sees
 *    another user's report;
 *  - a process restart loses every run (410 → the screen re-runs Show).
 *
 * One API process today (ecosystem.config.js: one fork). If the API is ever
 * clustered, runs need sticky routing or a shared store (module README).
 */

export const RUN_IDLE_MS = 15 * 60_000;
export const RUN_CAP_PER_USER = 4;
export const RUN_CAP_TOTAL = 40;
export const RUN_ROW_CAP_TOTAL = 100_000;

export interface ItemRunData {
  kind: 'ITEMS';
  head: SummaryHead;
  tiles: SummaryTiles;
  tie: SummaryTie;
  transitOut: TransitOut;
  rows: readonly ItemRunRow[];
  /** The branch's live godowns in screen order (the Godown-wise columns). */
  branchGodowns: readonly { godownId: string; name: string }[];
}

export interface BranchRunData {
  kind: 'BRANCHES';
  head: BranchesHead;
  rows: readonly BranchRunRow[];
  branches: readonly { branchId: string; name: string }[];
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

@Injectable()
export class StockSummaryRunStore {
  private readonly runs = new Map<string, StoredRun>();
  /** The clock, swappable by the specs. */
  now: () => number = () => Date.now();
  idleMs = RUN_IDLE_MS;

  /** Keep a new run; returns it with its id. Evicts by the caps first. */
  put(userId: string, companyId: string, data: RunData): StoredRun {
    this.sweep();
    const t = this.now();
    const run = {
      ...data,
      runId: randomUUID(),
      userId,
      companyId,
      createdAt: t,
      lastUsed: t,
    } as StoredRun;
    this.runs.set(run.runId, run);
    this.enforceCaps(userId);
    return run;
  }

  /**
   * The caller's run, renewed; null when it is gone, expired, someone else's,
   * of another company (when `companyId` is named) or of another kind.
   */
  get(
    runId: string,
    userId: string,
    opts: { companyId?: string | null; kind?: RunKind } = {},
  ): StoredRun | null {
    const run = this.runs.get(runId);
    if (!run) return null;
    if (this.now() - run.lastUsed > this.idleMs) {
      this.runs.delete(runId);
      return null;
    }
    if (run.userId !== userId) return null;
    if (opts.companyId && opts.companyId !== run.companyId) return null;
    if (opts.kind && opts.kind !== run.kind) return null;
    run.lastUsed = this.now();
    return run;
  }

  /** When the run expires if it is not read again (IST text is the caller's). */
  expiresAt(run: StoredRun): number {
    return run.lastUsed + this.idleMs;
  }

  /** For the specs and the README's sizing. */
  size(): { runs: number; rows: number } {
    let rows = 0;
    for (const r of this.runs.values()) rows += r.rows.length;
    return { runs: this.runs.size, rows };
  }

  private sweep(): void {
    const t = this.now();
    for (const [id, r] of this.runs) {
      if (t - r.lastUsed > this.idleMs) this.runs.delete(id);
    }
  }

  private enforceCaps(userId: string): void {
    const byAge = (a: StoredRun, b: StoredRun) =>
      a.lastUsed - b.lastUsed || a.createdAt - b.createdAt;
    const mine = [...this.runs.values()].filter((r) => r.userId === userId).sort(byAge);
    while (mine.length > RUN_CAP_PER_USER) {
      const gone = mine.shift();
      if (gone) this.runs.delete(gone.runId);
    }
    const all = [...this.runs.values()].sort(byAge);
    let rows = all.reduce((s, r) => s + r.rows.length, 0);
    // The newest run always stays, even alone over the row cap (one Show is ≤ 50,000 items).
    while (all.length > 1 && (all.length > RUN_CAP_TOTAL || rows > RUN_ROW_CAP_TOTAL)) {
      const gone = all.shift();
      if (!gone) break;
      rows -= gone.rows.length;
      this.runs.delete(gone.runId);
    }
  }
}
