import {
  HttpException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OpenBillFacts } from '../../modules/sales/sale-return/sale-return-bill-reader';
import {
  billDaysOf,
  billReturnStatus,
  isHeldCode,
  outcomeOf,
  phoneApprovalStatus,
  phoneCondition,
  phoneSettleDefault,
  refusalsOf,
  replanAdjust,
} from './mobile-return-plan';

const D = (v: string | number) => new Prisma.Decimal(v);
const Y = '2026-2027';

const bill = (id: string, pending: string, refno = id.toUpperCase()): OpenBillFacts => ({
  ablId: id,
  ablAccYear: Y,
  billType: 'SALES',
  refno,
  docDate: '2026-11-01',
  dueDate: null,
  billAmount: D(pending),
  pending: D(pending),
  alloc: D(0),
  srcDocType: 'SALE_BILL',
  srcDocId: id,
  srcAccYear: Y,
});

const row = (billId: string, amount: string | number) => ({
  billId,
  billAccYear: Y,
  amount: D(amount),
});
const amounts = (asks: { ablId: string; amount: Prisma.Decimal }[]) =>
  asks.map((a) => `${a.ablId}:${a.amount.toFixed(2)}`);

describe('replanAdjust (D6)', () => {
  it('keeps a split that still fits, and reports nothing', () => {
    const out = replanAdjust({
      rows: [row('a', 100), row('b', 50)],
      bills: [bill('a', '300'), bill('b', '80')],
      adjustable: D('500'),
    });
    expect(amounts(out.asks)).toEqual(['a:100.00', 'b:50.00']);
    expect(out.asks.map((a) => a.index)).toEqual([0, 1]);
    expect(out.asks.every((a) => a.dueNow === null)).toBe(true);
    expect(out.replanned).toEqual([]);
  });

  it('drops a bill that is no longer open (BILL_SETTLED) and refills the open bills in order', () => {
    const out = replanAdjust({
      rows: [row('gone', 120), row('a', 30)],
      bills: [bill('a', '100'), bill('b', '500')],
      adjustable: D('150'),
    });
    expect(amounts(out.asks)).toEqual(['a:100.00', 'b:50.00']);
    expect(out.replanned).toEqual([
      {
        billId: 'gone',
        billAccYear: Y,
        refno: null,
        from: '120.00',
        to: '0.00',
        reason: 'BILL_SETTLED',
      },
      {
        billId: 'a',
        billAccYear: Y,
        refno: 'A',
        from: '30.00',
        to: '100.00',
        reason: 'FREED_MONEY',
      },
      { billId: 'b', billAccYear: Y, refno: 'B', from: '0.00', to: '50.00', reason: 'FREED_MONEY' },
    ]);
  });

  it('caps a bill that owes less now (BILL_REDUCED); the freed part fills the next bill', () => {
    const out = replanAdjust({
      rows: [row('a', 200)],
      bills: [bill('a', '150'), bill('b', '100')],
      adjustable: D('200'),
    });
    expect(amounts(out.asks)).toEqual(['a:150.00', 'b:50.00']);
    expect(out.replanned.map((r) => `${r.billId}:${r.reason}:${r.from}->${r.to}`)).toEqual([
      'a:BILL_REDUCED:200.00->150.00',
      'b:FREED_MONEY:0.00->50.00',
    ]);
  });

  it('cuts the split from the last bill back when the note is smaller (NOTE_SMALLER), no refill', () => {
    const out = replanAdjust({
      rows: [row('a', 100), row('b', 100)],
      bills: [bill('a', '100'), bill('b', '100'), bill('c', '100')],
      adjustable: D('130'),
    });
    expect(amounts(out.asks)).toEqual(['a:100.00', 'b:30.00']);
    expect(out.replanned).toEqual([
      {
        billId: 'b',
        billAccYear: Y,
        refno: 'B',
        from: '100.00',
        to: '30.00',
        reason: 'NOTE_SMALLER',
      },
    ]);
  });

  it('never refills past what the note can adjust; what is left stays as credit', () => {
    const out = replanAdjust({
      rows: [row('gone', 500)],
      bills: [bill('a', '40')],
      adjustable: D('500'),
    });
    expect(amounts(out.asks)).toEqual(['a:40.00']);
    expect(out.replanned.map((r) => r.reason)).toEqual(['BILL_SETTLED', 'FREED_MONEY']);
  });

  it('merges two rows of one bill, skips 0 rows, and [] adjusts nothing', () => {
    const merged = replanAdjust({
      rows: [row('a', 20), row('a', '30.004'), row('b', 0)],
      bills: [bill('a', '100'), bill('b', '100')],
      adjustable: D('100'),
    });
    expect(amounts(merged.asks)).toEqual(['a:50.00']);
    expect(merged.replanned).toEqual([]);
    expect(replanAdjust({ rows: [], bills: [bill('a', '10')], adjustable: D(10) })).toEqual({
      asks: [],
      replanned: [],
    });
  });

  it('a zero or negative note adjusts nothing', () => {
    const out = replanAdjust({ rows: [row('a', 10)], bills: [bill('a', '10')], adjustable: D(-5) });
    expect(out.asks).toEqual([]);
    expect(out.replanned[0]).toMatchObject({ reason: 'NOTE_SMALLER', from: '10.00', to: '0.00' });
  });
});

describe('refusalsOf / outcomeOf (D7)', () => {
  const refused = (...codes: string[]) =>
    new UnprocessableEntityException({
      errors: codes.map((code, i) => ({
        code,
        message: `m${i}`,
        field: 'f',
        line: i + 1,
        params: { qty: '2' },
      })),
    });

  it('reads every coded refusal of a 4xx, keeping the desktop detail keys', () => {
    const notes = refusalsOf(refused('SALES_RETURN_OVER_QTY', 'SALES_RETURN_NOT_ON_BILL'));
    expect(notes).toEqual([
      { code: 'SALES_RETURN_OVER_QTY', message: 'm0', field: 'f', line: 1, params: { qty: '2' } },
      {
        code: 'SALES_RETURN_NOT_ON_BILL',
        message: 'm1',
        field: 'f',
        line: 2,
        params: { qty: '2' },
      },
    ]);
  });

  it('keeps the approval event (the wording variant reads it)', () => {
    const e = new HttpException(
      {
        errors: [
          {
            code: 'TILL_APPROVAL_REQUIRED',
            message: 'x',
            field: 'approvalIds',
            event: 'RETURN_NO_RECEIPT',
          },
        ],
      },
      428,
    );
    expect(refusalsOf(e)).toEqual([
      {
        code: 'TILL_APPROVAL_REQUIRED',
        message: 'x',
        field: 'approvalIds',
        line: null,
        event: 'RETURN_NO_RECEIPT',
      },
    ]);
  });

  it('is null for a 5xx, a plain Error and an uncoded body', () => {
    expect(refusalsOf(new InternalServerErrorException({ errors: [{ code: 'X' }] }))).toBeNull();
    expect(refusalsOf(new Error('db down'))).toBeNull();
    expect(
      refusalsOf(new UnprocessableEntityException({ errors: [{ message: 'no code' }] })),
    ).toBeNull();
  });

  it('HELD only when every refusal is the office’s; SENT_BACK names the first the phone must fix', () => {
    const held = outcomeOf(refusalsOf(refused('SALES_RETURN_WINDOW', 'GST_CREDIT_NOTE_CUTOFF'))!);
    expect(held.status).toBe('HELD');
    expect(held.first.code).toBe('SALES_RETURN_WINDOW');
    const mixed = outcomeOf(refusalsOf(refused('SALES_RETURN_WINDOW', 'SALES_RETURN_OVER_QTY'))!);
    expect(mixed.status).toBe('SENT_BACK');
    expect(mixed.first.code).toBe('SALES_RETURN_OVER_QTY');
  });

  it('the held codes', () => {
    for (const code of [
      'TILL_APPROVAL_REQUIRED',
      'SALES_RETURN_WINDOW',
      'GST_CREDIT_NOTE_CUTOFF',
      'SALES_RETURN_LOT_EXPIRED',
      'SALES_RETURN_NO_PRICE',
      'SALES_RETURN_SCHEME_SHORT',
      'SALES_RIGHT_POST',
      'TILL_SESSION_NOT_OPEN',
    ]) {
      expect(isHeldCode(code)).toBe(true);
    }
    for (const code of [
      'SALES_RETURN_OVER_QTY',
      'SALES_DAY_CLOSED',
      'VCH_YEAR_CLOSED',
      'SALES_BACKDATE',
    ]) {
      expect(isHeldCode(code)).toBe(false);
    }
  });
});

describe('small mappings', () => {
  it('approval status in the phone’s words', () => {
    expect(phoneApprovalStatus('PENDING')).toBe('PENDING');
    expect(phoneApprovalStatus('APPROVED')).toBe('APPROVED');
    expect(phoneApprovalStatus('REJECTED')).toBe('REJECTED');
    expect(phoneApprovalStatus('EXPIRED')).toBe('REJECTED');
    expect(phoneApprovalStatus('CANCELLED')).toBeNull();
  });

  it('bill return status, bill days, condition, settle default', () => {
    expect(billReturnStatus(null)).toBe('NONE');
    expect(billReturnStatus('PARTIAL')).toBe('PARTIAL');
    expect(billReturnStatus('FULL')).toBe('FULL');
    expect(billDaysOf(0)).toBe(90);
    expect(billDaysOf(30)).toBe(30);
    expect(phoneCondition('restock')).toBe('RESTOCK');
    expect(phoneCondition('SALEABLE')).toBeNull();
    expect(phoneCondition(null)).toBeNull();
    expect(phoneSettleDefault(null)).toBeNull();
    expect(phoneSettleDefault('ADVANCE')).toBe('ADVANCE');
    expect(phoneSettleDefault('ADJUST')).toBe('ADJUST');
    expect(phoneSettleDefault('CASH')).toBe('ADJUST');
  });
});
