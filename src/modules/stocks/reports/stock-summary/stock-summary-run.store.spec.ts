import {
  RUN_CAP_PER_USER,
  RUN_CAP_TOTAL,
  RUN_IDLE_MS,
  RUN_ROW_CAP_TOTAL,
  StockSummaryRunStore,
  type RunData,
} from './stock-summary-run.store';
import type { ItemRunRow } from './stock-summary.rules';

const U1 = 'user-1';
const U2 = 'user-2';
const CO = 'co-1';

function data(rows = 1, kind: 'ITEMS' | 'BRANCHES' = 'ITEMS'): RunData {
  const r = Array.from({ length: rows }, () => ({}) as ItemRunRow);
  return kind === 'ITEMS'
    ? ({
        kind,
        head: {},
        tiles: {},
        tie: {},
        transitOut: {},
        rows: r,
        branchGodowns: [],
      } as unknown as RunData)
    : ({ kind, head: {}, rows: r, branches: [], leftOut: [], transfers: 0 } as unknown as RunData);
}

function store(): { s: StockSummaryRunStore; tick: (ms: number) => void } {
  const s = new StockSummaryRunStore();
  let t = 1_000_000;
  s.now = () => t;
  return { s, tick: (ms) => (t += ms) };
}

describe('StockSummaryRunStore (D20)', () => {
  it('a run answers its own user only; another user, another company or another kind reads as gone', () => {
    const { s } = store();
    const run = s.put(U1, CO, data());
    expect(s.get(run.runId, U1)?.runId).toBe(run.runId);
    expect(s.get(run.runId, U2)).toBeNull();
    expect(s.get(run.runId, U1, { companyId: 'co-2' })).toBeNull();
    expect(s.get(run.runId, U1, { companyId: CO, kind: 'ITEMS' })).not.toBeNull();
    expect(s.get(run.runId, U1, { kind: 'BRANCHES' })).toBeNull();
    expect(s.get('no-such-run', U1)).toBeNull();
  });

  it('15 minutes idle: each read renews, then it is gone', () => {
    const { s, tick } = store();
    const run = s.put(U1, CO, data());
    tick(RUN_IDLE_MS - 1);
    expect(s.get(run.runId, U1)).not.toBeNull();
    tick(RUN_IDLE_MS - 1);
    expect(s.get(run.runId, U1)).not.toBeNull();
    expect(s.expiresAt(run)).toBe(run.lastUsed + RUN_IDLE_MS);
    tick(RUN_IDLE_MS + 1);
    expect(s.get(run.runId, U1)).toBeNull();
    expect(s.size().runs).toBe(0);
  });

  it(`at most ${RUN_CAP_PER_USER} runs per user: the oldest goes`, () => {
    const { s, tick } = store();
    const ids = Array.from({ length: RUN_CAP_PER_USER + 1 }, () => {
      tick(1);
      return s.put(U1, CO, data()).runId;
    });
    const other = s.put(U2, CO, data()).runId;
    expect(s.get(ids[0], U1)).toBeNull();
    expect(ids.slice(1).every((id) => s.get(id, U1) !== null)).toBe(true);
    expect(s.get(other, U2)).not.toBeNull();
  });

  it(`at most ${RUN_CAP_TOTAL} runs and ${RUN_ROW_CAP_TOTAL} rows in all, least recently used first`, () => {
    const { s, tick } = store();
    const ids: string[] = [];
    for (let i = 0; i < RUN_CAP_TOTAL + 2; i += 1) {
      tick(1);
      ids.push(s.put(`u${i}`, CO, data()).runId);
    }
    expect(s.size().runs).toBe(RUN_CAP_TOTAL);
    expect(s.get(ids[0], 'u0')).toBeNull();
    expect(s.get(ids[1], 'u1')).toBeNull();
    // Rows: two big runs cannot both stay; the newest always does, even alone over the cap.
    const { s: t, tick: tt } = store();
    const a = t.put(U1, CO, data(60_000)).runId;
    tt(1);
    const b = t.put(U2, CO, data(60_000)).runId;
    expect(t.get(a, U1)).toBeNull();
    expect(t.get(b, U2)).not.toBeNull();
    tt(1);
    const c = t.put(U1, CO, data(RUN_ROW_CAP_TOTAL + 1)).runId;
    expect(t.get(c, U1)).not.toBeNull();
    expect(t.size().runs).toBe(1);
  });

  it('a read renews its place in the LRU', () => {
    const { s, tick } = store();
    const ids: string[] = [];
    for (let i = 0; i < RUN_CAP_TOTAL; i += 1) {
      tick(1);
      ids.push(s.put(`u${i}`, CO, data()).runId);
    }
    tick(1);
    expect(s.get(ids[0], 'u0')).not.toBeNull();
    tick(1);
    s.put('late', CO, data());
    expect(s.get(ids[0], 'u0')).not.toBeNull();
    expect(s.get(ids[1], 'u1')).toBeNull();
  });
});
