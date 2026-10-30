import { Prisma } from '@prisma/client';
import { PurchaseShortageService } from './purchase-shortage';
import { PurchaseReturnService } from '../return/purchase-return';

/**
 * Review 2026-10-29 item 1: the "already undone / already settled" checks must run while the claim's advisory lock is
 * held, or two transactions can both pass them and both commit. Each test plays two transactions on a fake READ COMMITTED
 * database whose pg_advisory_xact_lock is a real mutex: A pauses right after its first check query until B has asked
 * for a lock (or finished). Writes become visible to the other transaction at commit only.
 */
jest.mock('../common/purchase-doc.helpers', () => ({
  ...jest.requireActual('../common/purchase-doc.helpers'),
  assertBillsUnsettled: jest.fn(async () => undefined),
  withdrawBillRows: jest.fn(async () => undefined),
  raiseBillRow: jest.fn(async () => undefined),
  statusLog: jest.fn(async () => undefined),
  voucherTypeId: jest.fn(async () => 1),
}));

const D = (n: number) => new Prisma.Decimal(n);
const Y = '2026-2027';

type Owner = 'A' | 'B';
class FakeDb {
  undoneCloses = 0;                                             // committed reversal rows of close c1
  settlements: { id: string; amount: Prisma.Decimal; reversalOf: string | null }[] = [];
  private held = new Map<string, Owner>();
  private waiters = new Map<string, (() => void)[]>();
  // scheduling: B starts once A has run its first check; A then waits until B asks for a lock or ends
  private aChecked!: () => void; readonly aCheckedP = new Promise<void>((r) => (this.aChecked = r));
  private bMoved!: () => void; readonly bMovedP = new Promise<void>((r) => (this.bMoved = r));
  private aPaused = false;
  bDone() { this.bMoved(); }

  private async lock(owner: Owner, key: string, mine: Set<string>) {
    if (owner === 'B') this.bMoved();
    while (this.held.has(key) && this.held.get(key) !== owner) await new Promise<void>((r) => this.waiters.set(key, [...(this.waiters.get(key) ?? []), r]));
    this.held.set(key, owner); mine.add(key);
  }
  private release(mine: Set<string>) {
    for (const k of mine) { this.held.delete(k); const w = this.waiters.get(k) ?? []; this.waiters.delete(k); w.forEach((f) => f()); }
  }
  private async afterCheck(owner: Owner) {
    if (owner !== 'A' || this.aPaused) return;
    this.aPaused = true; this.aChecked(); await this.bMovedP;
  }

  async transaction<T>(owner: Owner, fn: (tx: any) => Promise<T>): Promise<T> {
    const mine = new Set<string>(); const pending: (() => void)[] = [];
    const tx = {
      $queryRaw: async (s: TemplateStringsArray, ...v: unknown[]) => {
        const sql = s.join('?');
        if (sql.includes('pg_advisory_xact_lock')) { await this.lock(owner, `${s[0]}|${String(v[0])}`, mine); return [{ locked: 1 }]; }
        if (sql.includes('FROM purchase.pur_shortage_close WHERE psc_reversal_of_id')) { const n = this.undoneCloses; await this.afterCheck(owner); return [{ n: BigInt(n) }]; }
        if (sql.includes('FROM purchase.pur_claim_settlement WHERE pcs_reversal_of_id')) {
          const n = this.settlements.filter((x) => x.reversalOf === v[0]).length; await this.afterCheck(owner); return [{ n: BigInt(n) }];
        }
        if (sql.includes('FROM purchase.pur_claim_settlement s')) {
          return this.settlements.map((x) => ({ close_id: 'c1', id: x.id, acc_year: Y, amount: x.amount, action: 'REJECTED', received_as: null, reason: null,
                                                cn_no: null, cn_date: null, on_date: new Date(), refno: null, standing: !x.reversalOf }));
        }
        if (sql.includes('count(*) + 1')) return [{ n: 1n }];
        return [];
      },
      purShortageClose: {
        findFirst: async () => ({ pscId: 'c1', pscAccYear: Y, pscKind: 'CLAIM', pscReversalOfId: null, pscPartyId: 'p1', pscShortageId: 's1', pscShortageAccYear: Y,
                                  pscAmount: D(100), pscQtyBase: D(1), pscVoucherId: null, pscCompanyId: 'co', pscBranchId: 'br', pscCnNo: null, pscCnDate: null }),
        create: async () => { pending.push(() => this.undoneCloses++); return { pscId: `rev-${owner}` }; },
      },
      purClaimSettlement: {
        findFirst: async () => ({ pcsId: 'set0', pcsAccYear: Y, pcsReversalOfId: null, pcsReturnItemId: 'ri1', pcsReturnItemAccYear: Y, pcsShortageCloseId: null,
                                  pcsCompanyId: 'co', pcsBranchId: 'br', pcsDeviceId: 'dv', pcsAction: 'REJECTED', pcsReceivedAs: null, pcsAmount: D(40),
                                  pcsGstReavailed: D(0), pcsCnNo: null, pcsCnDate: null, pcsVoucherId: null }),
        create: async (a: { data: { pcsAmount: Prisma.Decimal; pcsReversalOfId?: string } }) => {
          const id = `pcs-${owner}`;
          pending.push(() => this.settlements.push({ id, amount: a.data.pcsAmount, reversalOf: a.data.pcsReversalOfId ?? null }));
          return { pcsId: id };
        },
        update: async () => ({}),
      },
    };
    try {
      const out = await fn(tx);
      pending.forEach((f) => f());                              // commit
      return out;
    } finally { this.release(mine); if (owner === 'B') this.bMoved(); }
  }
}

const vouchers = { postLegs: async () => ({ voucherId: 'v1', voucherSlno: 1, voucherRefno: 'R1' }), reverseLegs: async () => undefined };
const ctx = { getUserId: () => 'u1' };

function shortageSvc(db: FakeDb, owner: Owner) {
  const prisma = { $transaction: (fn: (tx: any) => Promise<unknown>) => db.transaction(owner, fn) };
  return new PurchaseShortageService(prisma as never, ctx as never, vouchers as never, {} as never);
}
function returnSvc(db: FakeDb, owner: Owner) {
  const prisma = { $transaction: (fn: (tx: any) => Promise<unknown>) => db.transaction(owner, fn) };
  return new PurchaseReturnService(prisma as never, ctx as never, vouchers as never, {} as never, {} as never, {} as never);
}

async function race(db: FakeDb, a: () => Promise<unknown>, b: () => Promise<unknown>) {
  const pa = a();
  const pb = db.aCheckedP.then(b).finally(() => db.bDone());
  return Promise.allSettled([pa, pb]);
}
const ok = (r: PromiseSettledResult<unknown>[]) => r.filter((x) => x.status === 'fulfilled').length;

describe('shortage claim: settle vs undo-close (review 2026-10-29 item 1)', () => {
  it('a settle that checked "not undone" first, then an undo-close: only one of the two commits', async () => {
    const db = new FakeDb();
    const settle = () => db.transaction('A', (tx) => shortageSvc(db, 'A').settleClaimIn(tx, { shortageCloseId: 'c1', accYear: Y, deviceId: 'dv', action: 'REJECTED' }, 'u1'));
    const undo = () => shortageSvc(db, 'B').closeUndo({ closeId: 'c1', accYear: Y, reason: 'x' } as never);
    const r = await race(db, settle, undo);
    expect(ok(r)).toBe(1);
    // never both: a claim that no longer exists must not carry a settlement
    expect(db.undoneCloses > 0 && db.settlements.length > 0).toBe(false);
  });

  it('an undo-close that checked first, then a settle: only one of the two commits', async () => {
    const db = new FakeDb();
    const undo = () => shortageSvc(db, 'A').closeUndo({ closeId: 'c1', accYear: Y, reason: 'x' } as never);
    const settle = () => db.transaction('B', (tx) => shortageSvc(db, 'B').settleClaimIn(tx, { shortageCloseId: 'c1', accYear: Y, deviceId: 'dv', action: 'REJECTED' }, 'u1'));
    const r = await race(db, undo, settle);
    expect(ok(r)).toBe(1);
    expect(db.undoneCloses > 0 && db.settlements.length > 0).toBe(false);
  });

  it('two undo-closes of one close: the second is refused', async () => {
    const db = new FakeDb();
    const undo = (o: Owner) => () => shortageSvc(db, o).closeUndo({ closeId: 'c1', accYear: Y, reason: 'x' } as never);
    const r = await race(db, undo('A'), undo('B'));
    expect(ok(r)).toBe(1);
    expect(db.undoneCloses).toBe(1);
  });
});

describe('return claim: double settlement undo (review 2026-10-29 item 1)', () => {
  it('two undos of one settlement: the second is refused', async () => {
    const db = new FakeDb();
    const undo = (o: Owner) => () => returnSvc(db, o).settleUndo({ settlementId: 'set0', accYear: Y, reason: 'x' } as never);
    const r = await race(db, undo('A'), undo('B'));
    expect(ok(r)).toBe(1);
    expect(db.settlements.filter((s) => s.reversalOf === 'set0')).toHaveLength(1);
  });
});
