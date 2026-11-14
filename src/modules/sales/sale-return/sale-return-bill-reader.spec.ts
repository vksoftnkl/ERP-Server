import { Prisma } from '@prisma/client';
import { SaleReturnBillReader } from './sale-return-bill-reader';

/**
 * The amend preview's add-back (UnwindAddBack): what an amend's unwind gives
 * back, read before it runs, and how openBills / billDue apply it.
 */

const D = (v: number | string) => new Prisma.Decimal(v);
const SR_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46e005';
const NOTE_ABL = '019c6f6c-be87-7a11-8905-36092c46e00f';
const BILL_A = '019c6f6c-be87-7a11-8905-36092c46e010';
const BILL_B = '019c6f6c-be87-7a11-8905-36092c46e017';
const BILL_C = '019c6f6c-be87-7a11-8905-36092c46e018';
const ACC_YEAR = '2026-2027';

/** A client whose raw queries answer by the SQL they run; each call is kept with its bound values. */
function clientOf(answer: (sql: string, values: unknown[]) => unknown[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const c = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      calls.push({ sql, values });
      return answer(sql, values);
    }),
  };
  return { c: c as unknown as Prisma.TransactionClient, calls };
}

const ablRow = (id: string, pending: number, alloc: number, refno: string) => ({
  abl_id: id,
  abl_acc_year: ACC_YEAR,
  abl_bill_type: 'SALES',
  abl_doc_refno: refno,
  abl_doc_date: new Date('2026-11-01T00:00:00.000Z'),
  abl_due_date: null,
  abl_bill_amount: D(pending + alloc),
  pending: D(pending),
  abl_alloc_amount: D(alloc),
  abl_src_doc_type: 'SALE_BILL',
  abl_src_doc_id: `sb-${refno}`,
  abl_src_acc_year: ACC_YEAR,
});

describe('SaleReturnBillReader — the amend preview add-back', () => {
  const reader = new SaleReturnBillReader();
  const q = {
    companyId: 'co',
    branchId: 'br',
    partyId: CUST_ID,
    firstSbId: 'sb-bil00640',
    sort: null,
  };

  describe('openBills', () => {
    it('owes each bill its pending plus the add-back, lists a bill the return cleared in full, and drops a bill still at 0', async () => {
      // Bill A: 2,059.00, the return set 468.00 off it (1,591.00 live).
      // Bill B: 300.00, the return cleared it (0 live) — only its id brings it back.
      // Bill C: 0 live and not this return's: the TS filter keeps it out too.
      const { c, calls } = clientOf(() => [
        ablRow(BILL_A, 1591, 468, 'bil00640'),
        ablRow(BILL_B, 0, 300, 'bil00641'),
        ablRow(BILL_C, 0, 100, 'bil00642'),
      ]);
      const addBack = new Map([
        [BILL_A, D(468)],
        [BILL_B, D(300)],
      ]);

      const bills = await reader.openBills(c, { ...q, addBack });

      expect(bills.map((b) => [b.ablId, b.pending.toString(), b.alloc.toString()])).toEqual([
        [BILL_A, '2059', '0'],
        [BILL_B, '300', '0'],
      ]);
      // The SQL lets a cleared bill through by its id, and only then.
      expect(calls).toHaveLength(1);
      expect(calls[0].sql).toContain('COALESCE(abl_pending_amount, 0) > 0 OR abl_id = ANY(');
      expect(calls[0].values).toContainEqual([BILL_A, BILL_B]);
    });

    it('reads the live figures with no add-back (a draft, a first post, the amend after its unwind)', async () => {
      const { c, calls } = clientOf(() => [ablRow(BILL_A, 2059, 0, 'bil00640')]);

      const bills = await reader.openBills(c, { ...q, lock: true });

      expect(bills.map((b) => b.pending.toString())).toEqual(['2059']);
      // The lock and the read both bind an empty id list: nothing extra comes in.
      expect(calls).toHaveLength(2);
      expect(calls[0].sql).toContain('FOR UPDATE');
      for (const call of calls) {
        expect(call.values).toContainEqual([]);
      }
    });
  });

  describe('unwindAddBack', () => {
    it('is null with no return, or for one that is not POSTED (nothing to unwind)', async () => {
      const draft = clientOf(() => [{ sr_status: 'DRAFT', note_id: null }]);

      expect(await reader.unwindAddBack(draft.c, null)).toBeNull();
      expect(await reader.unwindAddBack(draft.c, 'srt00009')).toBeNull();
      expect(await reader.unwindAddBack(draft.c, SR_ID)).toBeNull();
      expect(draft.calls).toHaveLength(1);

      const gone = clientOf(() => []);
      expect(await reader.unwindAddBack(gone.c, SR_ID)).toBeNull();
    });

    it('gives back the note’s own Adjust-at-Post set-offs per bill, and the balance its unwind restores', async () => {
      const { c, calls } = clientOf((sql) =>
        sql.includes('FROM sales.sale_return r')
          ? [
              {
                sr_status: 'POSTED',
                note_id: NOTE_ABL,
                note_year: ACC_YEAR,
                // 1,000.00 note: 468 + 300 set off at post, 232 still credit.
                note_pending: D(232),
                note_active: true,
                note_party: CUST_ID,
              },
            ]
          : [
              { abl_id: BILL_A, active: true, amt: D(468) },
              { abl_id: BILL_B, active: true, amt: D(300) },
            ],
      );

      const back = await reader.unwindAddBack(c, SR_ID);

      expect(back).not.toBeNull();
      expect([...back!.bills].map(([id, amt]) => [id, amt.toString()])).toEqual([
        [BILL_A, '468'],
        [BILL_B, '300'],
      ]);
      // The note (a CR of 232.00) is retired and both bills owe again: +1,000.00.
      expect(back!.balance.toString()).toBe('1000');
      expect(back!.partyId).toBe(CUST_ID);
      // The set-offs follow the unwind: its own (voucher-less NOTE_ADJUST on a
      // bill older than the note), live and not reversed.
      const setOffs = calls[1].sql;
      expect(setOffs).toContain("j.abj_adj_type = 'NOTE_ADJUST'");
      expect(setOffs).toContain('j.abj_voucher_id IS NULL');
      expect(setOffs).toContain('j.abj_reversal_of_id IS NULL');
      expect(setOffs).toContain('x.abj_reversal_of_id = j.abj_id');
      expect(setOffs).toContain('k.abl_created_on < n.abl_created_on');
      expect(calls[1].values).toEqual([NOTE_ABL, ACC_YEAR]);
    });

    it('gives nothing back for a posted return with no note row', async () => {
      const { c } = clientOf(() => [{ sr_status: 'POSTED', note_id: null, note_year: null }]);

      const back = await reader.unwindAddBack(c, SR_ID);

      expect(back).toEqual({ bills: new Map(), balance: D(0), partyId: null });
    });
  });

  describe('billDue', () => {
    it('adds what the amended return gave back on the bill’s own receivable', async () => {
      const { c } = clientOf(() => [{ abl_id: BILL_A, due: D(1591) }]);
      const bill = { sbId: 'sb-bil00640', accYear: ACC_YEAR };

      expect((await reader.billDue(c, bill)).toString()).toBe('1591');
      expect((await reader.billDue(c, bill, new Map([[BILL_A, D(468)]]))).toString()).toBe(
        '2059',
      );
      expect((await reader.billDue(c, bill, new Map([[BILL_B, D(300)]]))).toString()).toBe(
        '1591',
      );

      const none = clientOf(() => []);
      expect((await reader.billDue(none.c, bill, new Map([[BILL_A, D(468)]]))).toString()).toBe(
        '0',
      );
    });
  });
});
