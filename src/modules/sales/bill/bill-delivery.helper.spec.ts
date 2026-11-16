import { Prisma } from '@prisma/client';
import type { BillLineFacts } from '../delivery/core/delivery-pending.service';
import {
  assertAmendKeepsDelivery,
  assertNothingGiven,
  assertPosDeliveryMode,
  istDateText,
  posDeliveryModeRefusal,
  resolveBillDeliveryMode,
} from './bill-delivery.helper';

const D = (v: number) => new Prisma.Decimal(v);

/** A tx answering the voucher type's (own, base) modes and an order's mode. */
const tx = (typeOwn: string | null, typeBase: string | null, orderMode: string | null = null) => ({
  $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('acc_voucher_types')) return [{ own: typeOwn, base: typeBase }];
    if (sql.includes('sale_order')) return orderMode === undefined ? [] : [{ so_delivery_mode: orderMode }];
    return [];
  }),
});

describe('posDeliveryModeRefusal / assertPosDeliveryMode (decision 42, round 2: before the number is drawn)', () => {
  it('a POS bill asking for Pickup / Dispatch is refused; INSTANT, none or a non-POS bill pass', () => {
    expect(posDeliveryModeRefusal('POS', 'PICKUP')).toEqual({
      code: 'BILL_DELIVERY_MODE_POS',
      message: 'A counter (POS) bill is always INSTANT; PICKUP was asked for',
      field: 'sbDeliveryMode',
    });
    expect(posDeliveryModeRefusal('pos', 'DISPATCH')?.code).toBe('BILL_DELIVERY_MODE_POS');
    expect(posDeliveryModeRefusal('POS', 'INSTANT')).toBeNull();
    expect(posDeliveryModeRefusal('POS', null)).toBeNull();
    expect(posDeliveryModeRefusal('POS', 'NONSENSE')).toBeNull();
    expect(posDeliveryModeRefusal('WHOLESALE', 'PICKUP')).toBeNull();
    expect(posDeliveryModeRefusal(undefined, 'PICKUP')).toBeNull();
  });

  it('assertPosDeliveryMode throws the same refusal as a 422 and reads nothing', () => {
    expect(() => assertPosDeliveryMode('POS', 'PICKUP')).toThrow(
      expect.objectContaining({
        status: 422,
        response: expect.objectContaining({
          errors: [expect.objectContaining({ code: 'BILL_DELIVERY_MODE_POS', field: 'sbDeliveryMode' })],
        }),
      }),
    );
    expect(() => assertPosDeliveryMode('POS', 'INSTANT')).not.toThrow();
    expect(() => assertPosDeliveryMode('WHOLESALE', 'DISPATCH')).not.toThrow();
  });
});

describe('resolveBillDeliveryMode (§8.4 item 1, Q3, decision 42, N5)', () => {
  it('a POS bill is always INSTANT; another mode → 422 BILL_DELIVERY_MODE_POS', async () => {
    expect(await resolveBillDeliveryMode(tx('PICKUP', null) as never, { billMode: 'POS', vchrTypeId: 3, requested: null })).toBe(
      'INSTANT',
    );
    expect(
      await resolveBillDeliveryMode(tx(null, null) as never, { billMode: 'pos', vchrTypeId: 3, requested: 'INSTANT' }),
    ).toBe('INSTANT');
    await expect(
      resolveBillDeliveryMode(tx(null, null) as never, { billMode: 'POS', vchrTypeId: 3, requested: 'PICKUP' }),
    ).rejects.toMatchObject({ status: 422, response: { errors: [expect.objectContaining({ code: 'BILL_DELIVERY_MODE_POS' })] } });
  });

  it('a mode asked for wins', async () => {
    expect(
      await resolveBillDeliveryMode(tx('INSTANT', null) as never, { billMode: 'WHOLESALE', vchrTypeId: 3, requested: 'DISPATCH' }),
    ).toBe('DISPATCH');
  });

  it('else the type\'s own mode, else its base\'s, else INSTANT', async () => {
    const run = (own: string | null, base: string | null) =>
      resolveBillDeliveryMode(tx(own, base) as never, { billMode: 'WHOLESALE', vchrTypeId: 70, requested: undefined });
    expect(await run('PICKUP', 'INSTANT')).toBe('PICKUP');
    expect(await run(null, 'DISPATCH')).toBe('DISPATCH');
    expect(await run(null, null)).toBe('INSTANT');
  });

  it('N5: a bill from a Sales Order follows the order unless the type is Instant', async () => {
    const run = (typeMode: string, order: string | null) =>
      resolveBillDeliveryMode(tx(typeMode, null, order) as never, {
        billMode: 'WHOLESALE',
        vchrTypeId: 70,
        requested: null,
        items: [{ sbiSrcDocType: 'SALES_ORDER', sbiSrcDocId: '01a1e000-0000-7000-8000-000000000009' }],
      });
    expect(await run('PICKUP', 'HOME_DELIVERY')).toBe('DISPATCH');
    expect(await run('DISPATCH', 'STORE_PICKUP')).toBe('PICKUP');
    expect(await run('INSTANT', 'HOME_DELIVERY')).toBe('INSTANT');
    expect(await run('PICKUP', null)).toBe('PICKUP');
  });
});

const fact = (over: Partial<BillLineFacts>): BillLineFacts =>
  ({
    billItemId: 'sbi-1',
    lineNo: 1,
    itemId: 'item',
    unitId: 'unit',
    godownId: 'g1',
    lotId: 'lot-a',
    bucket: 'SALEABLE',
    billedQty: D(10),
    settledQty: D(4),
    givenQty: D(4),
    pendingQty: D(6),
    ...over,
  }) as BillLineFacts;

const names = new Map([['sbi-1', { itemName: 'ZT rice', unitName: 'Bag' }]]);
const kept = { sbiId: 'sbi-1', sbiItemId: 'item', sbiItemUnitId: 'unit', sbiGodownId: 'g1', sbiLotId: 'lot-a', sbiBillQty: 6 };
const bill = { sbDeliveryMode: 'PICKUP', sbBillRefno: 'bil00042' };

describe('assertAmendKeepsDelivery (D6, §8.4 item 4)', () => {
  it('a line kept at or above what is settled passes', () => {
    expect(() => assertAmendKeepsDelivery(bill, undefined, [fact({})], [kept], names)).not.toThrow();
    expect(() => assertAmendKeepsDelivery(bill, 'PICKUP', [fact({})], [{ ...kept, sbiBillQty: 4 }], names)).not.toThrow();
  });

  it.each([
    ['below what is given', [{ ...kept, sbiBillQty: 3 }]],
    ['the line dropped', []],
    ['another godown', [{ ...kept, sbiGodownId: 'g2' }]],
    ['another lot', [{ ...kept, sbiLotId: 'lot-c' }]],
    ['another item', [{ ...kept, sbiItemId: 'other' }]],
    ['another unit', [{ ...kept, sbiItemUnitId: 'other' }]],
  ])('%s → 409 BILL_DELIVERED_AMEND with the line figures', (_n, items) => {
    expect(() => assertAmendKeepsDelivery(bill, undefined, [fact({})], items as never, names)).toThrow(
      expect.objectContaining({
        status: 409,
        response: expect.objectContaining({
          errors: [expect.objectContaining({ code: 'BILL_DELIVERED_AMEND', params: expect.objectContaining({ n: 1, given: '4', unit: 'Bag' }) })],
        }),
      }),
    );
  });

  it('a line whose events net to nothing is free', () => {
    expect(() =>
      assertAmendKeepsDelivery(bill, undefined, [fact({ settledQty: D(0), givenQty: D(0) })], [], names),
    ).not.toThrow();
  });

  it('a mode change → 409 BILL_DELIVERY_MODE_LOCKED', () => {
    expect(() => assertAmendKeepsDelivery(bill, 'DISPATCH', [], [], names)).toThrow(
      expect.objectContaining({ status: 409, response: expect.objectContaining({ errors: [expect.objectContaining({ code: 'BILL_DELIVERY_MODE_LOCKED' })] }) }),
    );
  });
});

describe('assertNothingGiven (D6, §8.4 item 3)', () => {
  it('passes when nothing left the godown (given then cancelled nets to 0)', () => {
    expect(() => assertNothingGiven({ sbBillRefno: 'b' }, [fact({ givenQty: D(0) })], null)).not.toThrow();
  });
  it('refuses with the last note', () => {
    expect(() =>
      assertNothingGiven({ sbBillRefno: 'bil00042' }, [fact({})], { refno: 'DN/2026-2027/D3/00042', date: '15-11-2026' }),
    ).toThrow(
      expect.objectContaining({
        status: 409,
        response: expect.objectContaining({
          errors: [expect.objectContaining({ code: 'BILL_DELIVERED_CANCEL', params: expect.objectContaining({ dn: 'DN/2026-2027/D3/00042' }) })],
        }),
      }),
    );
  });
  it('istDateText reads the IST day', () => {
    expect(istDateText(new Date('2026-11-14T19:00:00Z'))).toBe('15-11-2026');
  });
});
