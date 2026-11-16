import { Prisma } from '@prisma/client';
import {
  amendLockIssues,
  deliveryStatusOf,
  notTakenRowsOf,
  resolveNotTaken,
  withKeptNotTaken,
  type NotTakenBillLine,
  type NotTakenRow,
} from './sale-return-delivery';

/**
 * Delivery tracking (plan 2026-11-15 §8.4 item 9, addendum 1 §5.2 / §5.4):
 * the Sale Return's "Not taken" — the default and its order over split rows,
 * the five refusals in their order, the amend lock, the status after.
 */

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const G1 = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const G2 = '019d2e48-7af3-7d5c-82a7-2eb57fdabf1c';
const LOT_A = '01a00000-0000-7000-8000-00000000000a';
const LOT_B = '01a00000-0000-7000-8000-00000000000b';
const BL1 = '01a00000-0000-7000-8000-000000000101';
const BL2 = '01a00000-0000-7000-8000-000000000102';
const YEAR = '2026-2027';

const billLine = (over: Partial<NotTakenBillLine> = {}): NotTakenBillLine => ({
  billItemId: BL1,
  billAccYear: YEAR,
  billId: '01a00000-0000-7000-8000-000000000001',
  billRefno: 'ZT/0001',
  lineNo: 1,
  itemId: '01a00000-0000-7000-8000-0000000000f1',
  eligible: true,
  godownId: G1,
  lotId: LOT_A,
  factor: D(1),
  pendingBase: D(10),
  givenBase: D(6),
  takenBeforeBase: D(0),
  unitName: 'Bag',
  godownName: 'Coimbatore',
  lotNo: 'A-1',
  ...over,
});

const row = (over: Partial<NotTakenRow> = {}): NotTakenRow => ({
  index: 0,
  lineNo: 1,
  sriId: null,
  billItemId: BL1,
  billAccYear: YEAR,
  godownId: G1,
  lotId: LOT_A,
  condition: 'RESTOCK',
  qty: D(4),
  factor: D(1),
  typed: null,
  unitName: 'Bag',
  ...over,
});

const linesOf = (...l: NotTakenBillLine[]) =>
  new Map(l.map((x) => [`${x.billItemId}|${x.billAccYear}`, x]));
const codes = (v: ReturnType<typeof resolveNotTaken>) => v.issues.map((i) => i.code);

describe('resolveNotTaken — the default (decision 64)', () => {
  it('is the smaller of the qty and what is still to give', () => {
    const v = resolveNotTaken([row({ qty: D(4) })], linesOf(billLine({ pendingBase: D(10) })), false);
    expect(v.rows[0].defaultQty.toString()).toBe('4');
    expect(v.rows[0].resolvedQty.toString()).toBe('4');
    expect(v.rows[0].billPendingQty.toString()).toBe('10');
    expect(codes(v)).toEqual([]);
    expect(v.delivery[0]).toMatchObject({ billLineNo: 1, unitName: 'Bag' });
    expect(v.delivery[0].pendingBefore.toString()).toBe('10');
    expect(v.delivery[0].pendingAfter.toString()).toBe('6');
  });

  it('fills split rows of one bill line in row order, sharing its To give', () => {
    const v = resolveNotTaken(
      [row({ index: 0, lineNo: 1, qty: D(6) }), row({ index: 1, lineNo: 2, qty: D(8) })],
      linesOf(billLine({ pendingBase: D(10), givenBase: D(8) })),
      false,
    );
    expect(v.rows.map((r) => r.defaultQty.toString())).toEqual(['6', '4']);
    expect(v.rows.map((r) => r.billPendingQty.toString())).toEqual(['10', '10']);
    expect(codes(v)).toEqual([]);
  });

  it('a typed (lower) figure is kept and still counts against the later rows', () => {
    const v = resolveNotTaken(
      [row({ index: 0, qty: D(8), typed: D(2) }), row({ index: 1, lineNo: 2, qty: D(9) })],
      linesOf(billLine({ pendingBase: D(10), givenBase: D(20) })),
      false,
    );
    expect(v.rows.map((r) => r.resolvedQty.toString())).toEqual(['2', '8']);
    expect(v.rows[0].defaultQty.toString()).toBe('8');
  });

  it('is 0 on a claim, on SCRAP, in another godown or lot, and on a line not eligible', () => {
    const l = linesOf(billLine());
    expect(resolveNotTaken([row()], l, true).rows[0].defaultQty.toString()).toBe('0');
    expect(resolveNotTaken([row({ condition: 'SCRAP' })], l, false).rows[0].defaultQty.toString()).toBe('0');
    expect(resolveNotTaken([row({ godownId: G2 })], l, false).rows[0].defaultQty.toString()).toBe('0');
    expect(resolveNotTaken([row({ lotId: LOT_B })], l, false).rows[0].defaultQty.toString()).toBe('0');
    const instant = linesOf(billLine({ eligible: false }));
    const v = resolveNotTaken([row()], instant, false);
    expect(v.rows[0].defaultQty.toString()).toBe('0');
    expect(v.rows[0].billPendingQty.toString()).toBe('0');
    expect(v.delivery).toEqual([]);
  });

  it('a Damaged or Expired row still defaults (A3: same godown and lot)', () => {
    const l = linesOf(billLine());
    expect(resolveNotTaken([row({ condition: 'DAMAGED' })], l, false).rows[0].defaultQty.toString()).toBe('4');
    expect(resolveNotTaken([row({ condition: 'EXPIRED' })], l, false).rows[0].defaultQty.toString()).toBe('4');
  });

  it('compares in base units: a row in kg against a 25 kg bag line', () => {
    const v = resolveNotTaken(
      [row({ qty: D(30), factor: D(1), unitName: 'Kg' })],
      linesOf(billLine({ factor: D(25), pendingBase: D(50), givenBase: D(0) })),
      false,
    );
    expect(v.rows[0].defaultQty.toString()).toBe('30');
    expect(v.rows[0].billPendingQty.toString()).toBe('50');
    expect(v.delivery[0].pendingBefore.toString()).toBe('2');
    expect(v.delivery[0].pendingAfter.toString()).toBe('0.8');
    expect(v.delivery[0].settleQty.toString()).toBe('1.2');
    expect(v.delivery[0].settleBase.toString()).toBe('30');
  });
});

describe('resolveNotTaken — the refusals, in order (addendum §5.2)', () => {
  it('DELIVERY_RETURN_OVER_QTY: typed above the row qty', () => {
    const v = resolveNotTaken([row({ qty: D(4), typed: D(5) })], linesOf(billLine()), false);
    expect(codes(v)[0]).toBe('DELIVERY_RETURN_OVER_QTY');
    expect(v.issues[0]).toMatchObject({ line: 1, params: { n: 1, u: '5', unit: 'Bag', qty: '4' } });
  });

  it('DELIVERY_RETURN_CLAIM: a claim with a value', () => {
    const v = resolveNotTaken([row({ typed: D(1) })], linesOf(billLine()), true);
    expect(codes(v)).toEqual(['DELIVERY_RETURN_CLAIM']);
  });

  it('DELIVERY_RETURN_OVER: more not taken than is still to give (split rows summed)', () => {
    const v = resolveNotTaken(
      [row({ index: 0, qty: D(4), typed: D(4) }), row({ index: 1, lineNo: 2, qty: D(4), typed: D(3) })],
      linesOf(billLine({ pendingBase: D(6), givenBase: D(10) })),
      false,
    );
    expect(codes(v)).toEqual(['DELIVERY_RETURN_OVER']);
    expect(v.issues[0].params).toMatchObject({ n: 1, qty: '7', pending: '6', bill: 'ZT/0001' });
  });

  it('DELIVERY_RETURN_OVER: a value on a line with nothing to give (Instant bill, no bill line)', () => {
    const v = resolveNotTaken([row({ typed: D(1) })], linesOf(billLine({ eligible: false })), false);
    expect(codes(v)).toEqual(['DELIVERY_RETURN_OVER']);
    const nb = resolveNotTaken([row({ billItemId: null, billAccYear: null, typed: D(1) })], new Map(), false);
    expect(codes(nb)).toEqual(['DELIVERY_RETURN_OVER']);
  });

  it('DELIVERY_RETURN_NOT_GIVEN: the taken part is more than left the godown', () => {
    // 10 billed, 3 given, 7 pending: a return of 5 with 1 not taken = 4 taken > 3 given.
    const v = resolveNotTaken(
      [row({ qty: D(5), typed: D(1) })],
      linesOf(billLine({ pendingBase: D(7), givenBase: D(3) })),
      false,
    );
    expect(codes(v)).toEqual(['DELIVERY_RETURN_NOT_GIVEN']);
    expect(v.issues[0].params).toMatchObject({ given: '3', min: '1' });
  });

  it('NOT_GIVEN counts what earlier returns took back', () => {
    const v = resolveNotTaken(
      [row({ qty: D(3), typed: D(0) })],
      linesOf(billLine({ pendingBase: D(4), givenBase: D(6), takenBeforeBase: D(4) })),
      false,
    );
    expect(codes(v)).toEqual(['DELIVERY_RETURN_NOT_GIVEN']);
  });

  it('DELIVERY_RETURN_GODOWN: a value in another godown or lot, or on SCRAP', () => {
    const l = linesOf(billLine());
    expect(codes(resolveNotTaken([row({ godownId: G2, typed: D(1) })], l, false))).toEqual([
      'DELIVERY_RETURN_GODOWN',
    ]);
    expect(codes(resolveNotTaken([row({ lotId: LOT_B, typed: D(1) })], l, false))).toEqual([
      'DELIVERY_RETURN_GODOWN',
    ]);
    const scrap = resolveNotTaken([row({ condition: 'SCRAP', typed: D(1) })], l, false);
    expect(codes(scrap)).toEqual(['DELIVERY_RETURN_GODOWN']);
    expect(scrap.issues[0]).toMatchObject({
      field: 'sriCondition',
      params: { godown: 'Coimbatore', lot: 'A-1' },
    });
  });

  it('lists the refusals in rule order, whatever the row order', () => {
    const v = resolveNotTaken(
      [
        row({ index: 0, lineNo: 1, condition: 'SCRAP', typed: D(1), billItemId: BL2 }),
        row({ index: 1, lineNo: 2, qty: D(2), typed: D(3) }),
      ],
      linesOf(billLine({ pendingBase: D(1), givenBase: D(0) }), billLine({ billItemId: BL2, lineNo: 2 })),
      true,
    );
    expect(codes(v)).toEqual([
      'DELIVERY_RETURN_OVER_QTY',
      'DELIVERY_RETURN_CLAIM',
      'DELIVERY_RETURN_CLAIM',
      'DELIVERY_RETURN_OVER',
      'DELIVERY_RETURN_GODOWN',
    ]);
  });
});

describe('amendLockIssues — one RETURN per return line, ever', () => {
  const SRI = '01a00000-0000-7000-8000-0000000000e1';
  const verdictOf = (typed: string) =>
    resolveNotTaken([row({ sriId: SRI, typed: D(typed) })], linesOf(billLine()), false);

  it('keeps an unchanged figure, or clears it to 0', () => {
    const ev = { live: new Map([[SRI, { settleBase: D(3) }]]), ever: new Set([SRI]) };
    expect(amendLockIssues([row({ sriId: SRI })], verdictOf('3'), ev)).toEqual([]);
    expect(amendLockIssues([row({ sriId: SRI })], verdictOf('0'), ev)).toEqual([]);
  });

  it('refuses a changed figure (DELIVERY_RETURN_AMEND_LOCKED)', () => {
    const ev = { live: new Map([[SRI, { settleBase: D(3) }]]), ever: new Set([SRI]) };
    const issues = amendLockIssues([row({ sriId: SRI })], verdictOf('2'), ev);
    expect(issues.map((i) => i.code)).toEqual(['DELIVERY_RETURN_AMEND_LOCKED']);
    expect(issues[0].params).toMatchObject({ n: 1, was: '3', unit: 'Bag' });
  });

  it('refuses a new figure on a line whose RETURN was already reversed', () => {
    const ev = { live: new Map(), ever: new Set([SRI]) };
    expect(amendLockIssues([row({ sriId: SRI })], verdictOf('1'), ev).map((i) => i.code)).toEqual([
      'DELIVERY_RETURN_AMEND_LOCKED',
    ]);
  });

  it('lets a line that never had a RETURN take one', () => {
    const ev = { live: new Map(), ever: new Set<string>() };
    expect(amendLockIssues([row({ sriId: SRI })], verdictOf('2'), ev)).toEqual([]);
  });
});

describe('deliveryStatusOf (plan §5.2 for the preview)', () => {
  const l = (pending: string, settled: string, given: string, eligible = true) => ({
    eligible,
    pending: D(pending),
    settled: D(settled),
    given: D(given),
  });
  it('answers every status', () => {
    expect(deliveryStatusOf([l('10', '0', '0')], true)).toBe('PENDING');
    expect(deliveryStatusOf([l('6', '4', '0')], true)).toBe('PART');
    expect(deliveryStatusOf([l('-2', '12', '12')], true)).toBe('PART');
    expect(deliveryStatusOf([l('0', '10', '6')], true)).toBe('DELIVERED');
    expect(deliveryStatusOf([l('0', '10', '0')], true)).toBe('RETURNED');
    expect(deliveryStatusOf([l('10', '0', '0', false)], true)).toBe('NA');
    expect(deliveryStatusOf([l('10', '0', '0')], false)).toBe('NA');
  });
});

describe('notTakenRowsOf', () => {
  it('reads the typed figure (absent / null = default) and the money’s qty and factor', () => {
    const rows = notTakenRowsOf(
      [
        { sriLineNo: 1, sriItemUnitId: 'u1', sriGodownId: G1, sriUndeliveredQty: null },
        { sriLineNo: 2, sriItemUnitId: 'u1', sriGodownId: G1, sriUndeliveredQty: '2.5' },
      ],
      {
        lines: [
          { qty: D(4), factor: D(25), billItemId: BL1, billAccYear: YEAR },
          { qty: D(3), factor: D(1), billItemId: BL1, billAccYear: '2026-2027 ' },
        ],
      },
      new Map([['u1', 'Bag']]),
    );
    expect(rows[0].typed).toBeNull();
    expect(rows[0].factor.toString()).toBe('25');
    expect(rows[1].typed?.toString()).toBe('2.5');
    expect(rows[1].billAccYear).toBe(YEAR);
    expect(rows[1].unitName).toBe('Bag');
  });
});

describe('withKeptNotTaken — review N7 (an amend keeps every posted Not taken)', () => {
  const SRI = '01a00000-0000-7000-8000-0000000000c1';
  const SRI0 = '01a00000-0000-7000-8000-0000000000c2';
  const posted = new Map([
    [SRI, { qty: D(2), factor: D(1) }],
    [SRI0, { qty: D(0), factor: D(1) }],
  ]);

  it('a row naming a posted line with nothing typed keeps the posted figure, not today’s default', () => {
    // pending rose to 10 since the post (a goods back): the default would be 4.
    const rows = withKeptNotTaken([row({ sriId: SRI, qty: D(4) })], posted);
    const v = resolveNotTaken(rows, linesOf(billLine({ pendingBase: D(10) })), false);
    expect(v.rows[0].defaultQty.toString()).toBe('2');
    expect(v.rows[0].resolvedQty.toString()).toBe('2');
    expect(codes(v)).toEqual([]);
  });

  it('a line posted with 0 (no RETURN) keeps 0 even though pending is now open', () => {
    const rows = withKeptNotTaken([row({ sriId: SRI0, qty: D(4) })], posted);
    const v = resolveNotTaken(rows, linesOf(billLine({ pendingBase: D(10) })), false);
    expect(v.rows[0].resolvedQty.toString()).toBe('0');
    expect(v.delivery[0].settleQty.toString()).toBe('0');
  });

  it('a typed value still wins (a number changes it, 0 clears)', () => {
    const rows = withKeptNotTaken(
      [row({ sriId: SRI, qty: D(4), typed: D(0) }), row({ index: 1, lineNo: 2, sriId: SRI0, qty: D(4), typed: D(3) })],
      posted,
    );
    const v = resolveNotTaken(rows, linesOf(billLine()), false);
    expect(v.rows.map((r) => r.resolvedQty.toString())).toEqual(['0', '3']);
  });

  it('the kept figure moves into the row’s unit (posted 1 Bag of 25 → 25 in a base-unit row)', () => {
    const rows = withKeptNotTaken([row({ sriId: SRI, qty: D(30), factor: D(1) })], new Map([[SRI, { qty: D(1), factor: D(25) }]]));
    expect(rows[0].kept?.toString()).toBe('25');
  });

  it('a row added by the amend (no posted line) takes the default', () => {
    const rows = withKeptNotTaken([row({ sriId: null }), row({ sriId: '01a00000-0000-7000-8000-0000000000c9' })], posted);
    expect(rows.map((r) => r.kept ?? null)).toEqual([null, null]);
  });

  it('an amend that cuts the qty below the kept figure is refused (DELIVERY_RETURN_OVER_QTY), never silently changed', () => {
    const rows = withKeptNotTaken([row({ sriId: SRI, qty: D(1) })], posted);
    const v = resolveNotTaken(rows, linesOf(billLine()), false);
    expect(codes(v)).toContain('DELIVERY_RETURN_OVER_QTY');
    expect(v.issues[0].params).toMatchObject({ u: '2', qty: '1' });
  });
});
