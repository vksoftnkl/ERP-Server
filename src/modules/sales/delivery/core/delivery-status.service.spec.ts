import { Prisma } from '@prisma/client';
import { DeliveryStatusService, deliveryStatusOf, type DeliveryStatusInput } from './delivery-status.service';

const D = (v: number | string) => new Prisma.Decimal(v);
const base: DeliveryStatusInput = {
  billStatus: 'POSTED',
  deleted: false,
  mode: 'PICKUP',
  lines: 2,
  openLines: 2,
  anySettled: false,
  given: D(0),
};

describe('deliveryStatusOf — plan §5.2', () => {
  it.each([
    ['a draft bill', { billStatus: 'DRAFT' }, 'NA'],
    ['a cancelled bill (row 14)', { billStatus: 'CANCELLED' }, 'NA'],
    ['a deleted bill', { deleted: true }, 'NA'],
    ['an Instant bill (row 3)', { mode: 'INSTANT' }, 'NA'],
    ['no eligible line (services / challan lines only)', { lines: 0, openLines: 0 }, 'NA'],
    ['Pickup, nothing given (row 4)', {}, 'PENDING'],
    ['Dispatch, nothing given', { mode: 'DISPATCH' }, 'PENDING'],
    ['part given (row 5, partial)', { openLines: 1, anySettled: true, given: D(14) }, 'PART'],
    ['an over-given line still open (decision 46)', { openLines: 1, anySettled: true, given: D(22) }, 'PART'],
    ['all given (row 5, last note)', { openLines: 0, anySettled: true, given: D(40) }, 'DELIVERED'],
    ['all settled by a return of goods never taken (row 8)', { openLines: 0, anySettled: true, given: D(0) }, 'RETURNED'],
    ['given then cancelled back to nothing settled (row 6)', { openLines: 2, anySettled: false, given: D(0) }, 'PENDING'],
    ['go-live cleanup (row 16)', { openLines: 0, anySettled: true, given: D(18) }, 'DELIVERED'],
  ] as const)('%s → %s', (_n, patch, want) => {
    expect(deliveryStatusOf({ ...base, ...(patch as Partial<DeliveryStatusInput>) })).toBe(want);
  });
});

describe('DeliveryStatusService.recompute — the single writer (decision 36)', () => {
  const row = (over: Record<string, unknown>) => ({
    sb_id: '01a1e000-0000-7000-8000-000000000001',
    sb_acc_year: '2026-2027',
    sb_bill_refno: 'bil00001',
    cur: 'PENDING',
    cur_on: null,
    sb_status: 'POSTED',
    sb_is_deleted: false,
    sb_delivery_mode: 'PICKUP',
    lines: 1,
    open_lines: 1,
    any_settled: false,
    given: '0',
    last_at: null,
    ...over,
  });

  const make = (rows: unknown[]) => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue(rows), $executeRaw: jest.fn().mockResolvedValue(1) };
    return { svc: new DeliveryStatusService({} as never), tx };
  };

  it('writes nothing when the status is unchanged (no re-dirtying for sync)', async () => {
    const { svc, tx } = make([row({})]);
    const out = await svc.recompute(tx as never, [{ billId: 'x', billAccYear: '2026-2027' }]);
    expect(out[0]).toMatchObject({ statusBefore: 'PENDING', statusAfter: 'PENDING', changed: false });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('writes DELIVERED with the latest given time', async () => {
    const at = new Date('2026-11-15T09:00:00Z');
    const { svc, tx } = make([row({ open_lines: 0, any_settled: true, given: '20', last_at: at })]);
    const out = await svc.recompute(tx as never, [{ billId: 'x', billAccYear: '2026-2027' }]);
    expect(out[0]).toMatchObject({ statusBefore: 'PENDING', statusAfter: 'DELIVERED', changed: true });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const values = (tx.$executeRaw.mock.calls[0] as unknown[]).slice(1);
    expect(values).toEqual(expect.arrayContaining(['DELIVERED', at]));
  });

  it('a cancelled bill goes NA and loses its delivered time', async () => {
    const { svc, tx } = make([row({ sb_status: 'CANCELLED', cur: 'PART', cur_on: new Date() })]);
    const out = await svc.recompute(tx as never, [{ billId: 'x', billAccYear: '2026-2027' }]);
    expect(out[0].statusAfter).toBe('NA');
    const values = (tx.$executeRaw.mock.calls[0] as unknown[]).slice(1);
    expect(values).toEqual(expect.arrayContaining(['NA', null]));
  });

  it('asks nothing for an empty list and de-duplicates bills', async () => {
    const { svc, tx } = make([]);
    expect(await svc.recompute(tx as never, [])).toEqual([]);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    await svc.recompute(tx as never, [
      { billId: 'a', billAccYear: '2026-2027' },
      { billId: 'a', billAccYear: '2026-2027 ' },
    ]);
    const ids = (tx.$queryRaw.mock.calls[0] as unknown[])[1];
    expect(ids).toEqual(['a']);
  });
});
