import { Prisma } from '@prisma/client';
import { PurchaseSupplierDuesService } from '../dues/purchase-supplier-dues';
import { claimLockOrder, RETURN_CLAIM_LOCK, SHORTAGE_CLAIM_LOCK } from './purchase-claim-locks';

/**
 * A multi-row /purchase/supplier-dues/settle takes every row's claim lock first, in one canonical order,
 * so two settles naming the same claims in opposite orders queue instead of deadlocking.
 */
const A = '01a00000-0000-7000-8000-00000000000a';
const B = '01a00000-0000-7000-8000-00000000000b';
const C = '01a00000-0000-7000-8000-00000000000c';
const S1 = '01a00000-0000-7000-8000-0000000000f1';
const D0 = new Prisma.Decimal(0);

describe('claimLockOrder', () => {
  it('sorts by (namespace, id), drops repeats, lower-cases the uuid text, shortageCloseId wins as the dispatch does', () => {
    expect(claimLockOrder([
      { returnItemId: C }, { shortageCloseId: S1 }, { returnItemId: A.toUpperCase() }, { returnItemId: B }, { returnItemId: A },
      { returnItemId: B, shortageCloseId: S1 }, {},
    ])).toEqual([
      { ns: RETURN_CLAIM_LOCK, id: A }, { ns: RETURN_CLAIM_LOCK, id: B }, { ns: RETURN_CLAIM_LOCK, id: C },
      { ns: SHORTAGE_CLAIM_LOCK, id: S1 },
    ]);
  });

  it('is the same for any order of the same rows', () => {
    const rows = [{ returnItemId: A }, { shortageCloseId: S1 }, { returnItemId: C }, { returnItemId: B }];
    expect(claimLockOrder([...rows].reverse())).toEqual(claimLockOrder(rows));
  });
});

describe('PurchaseSupplierDuesService.settle lock order', () => {
  function make() {
    const events: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        if (strings.join('?').includes('pg_advisory_xact_lock')) events.push(`lock ${values[0] as string}:${values[1] as string}`);
        return [{ locked: 1 }];
      }),
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
      $queryRaw: jest.fn(async () => []),
    };
    const step = (id: string, kind: 'R' | 'S') => ({
      ...(kind === 'R' ? { returnItemId: id, lineNo: 1, gstReavailed: D0 } : { shortageCloseId: id }),
      refno: `REF-${id.slice(-2)}`, action: 'CREDIT', receivedAs: 'CN', amount: new Prisma.Decimal(10), open: D0,
      settlementId: null, accYear: '2026-2027', voucherRefno: null, legs: [], dryRun: true, companyId: 'c', branchId: 'b',
    });
    const returns = { settleIn: jest.fn(async (_tx: unknown, d: { returnItemId: string }) => { events.push(`settle R:${d.returnItemId}`); return step(d.returnItemId, 'R'); }) };
    const shortages = { settleClaimIn: jest.fn(async (_tx: unknown, d: { shortageCloseId: string }) => { events.push(`settle S:${d.shortageCloseId}`); return step(d.shortageCloseId, 'S'); }) };
    const service = new PurchaseSupplierDuesService(prisma as never, { getUserId: () => 'u' } as never, returns as never, shortages as never);
    return { service, events };
  }
  const settle = (s: PurchaseSupplierDuesService, rows: object[]) =>
    s.settle({ rows: rows.map((r) => ({ ...r, accYear: '2026-2027' })), deviceId: 'd', action: 'CREDIT', dryRun: true } as never);

  it('takes all the locks first, sorted, then runs the steps in the request order (and answers in it)', async () => {
    const { service, events } = make();
    const out = await settle(service, [{ returnItemId: C }, { shortageCloseId: S1 }, { returnItemId: A }]);
    expect(events).toEqual([
      `lock ${RETURN_CLAIM_LOCK}:${A}`, `lock ${RETURN_CLAIM_LOCK}:${C}`, `lock ${SHORTAGE_CLAIM_LOCK}:${S1}`,
      `settle R:${C}`, `settle S:${S1}`, `settle R:${A}`,
    ]);
    expect((out.steps as { returnItemId: string | null; shortageCloseId: string | null }[]).map((s) => s.returnItemId ?? s.shortageCloseId)).toEqual([C, S1, A]);
  });

  it('two settles listing the same claims in opposite orders lock in the same order', async () => {
    const one = make(), two = make();
    await settle(one.service, [{ returnItemId: A }, { returnItemId: B }]);
    await settle(two.service, [{ returnItemId: B }, { returnItemId: A }]);
    const locks = (e: string[]) => e.filter((x) => x.startsWith('lock'));
    expect(locks(one.events)).toEqual(locks(two.events));
    expect(locks(one.events)).toEqual([`lock ${RETURN_CLAIM_LOCK}:${A}`, `lock ${RETURN_CLAIM_LOCK}:${B}`]);
  });
});
