import { Prisma } from '@prisma/client';
import {
  allocate,
  AllocationError,
  pdcVoucherKey,
  RECEIPT_VOUCHER_KEY,
  type AllocationBill,
  type AllocationCredit,
  type AllocationInput,
  type AllocationOtherLine,
  type AllocationTender,
} from './allocation-engine';
import { BillAdjType, BillSettlementMode, BillType, DrCr } from './types/receipt-enum';

/**
 * The OUT twin of `allocation-engine.spec.ts` — plan-backend-payment rev 2 §3:
 * "add `direction: 'IN' | 'OUT'` to `AllocationInput` … Its spec gets an OUT
 * twin of every case."
 *
 * Every case below is a case from the receipt's spec with the money going the
 * other way: the TARGETS are the party's CR bills (what we owe), a settlement
 * row DEBITS the party, a settling deduction is a CR other-line (TDS we
 * withhold, a balance written back), an extra is a DR other-line (interest
 * paid, the bank's charge), and the held items being spent are the DR side —
 * an advance we paid, a supplier's debit note.
 *
 * A separate file rather than cases appended to the receipt's, so the
 * receipt's spec stays the receipt's and this one can be read as one document
 * about one direction.
 */

const d = (value: number | string): Prisma.Decimal => new Prisma.Decimal(value);
const DATE = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const PAYMENT_DATE = DATE('2026-09-28');

function bill(
  refno: string,
  amount: number,
  pending: number,
  extra: Partial<AllocationBill> = {},
): AllocationBill {
  return {
    billId: `bill-${refno}`,
    billAccYear: '2026-2027',
    docRefno: refno,
    amount: d(amount),
    discount: d(0),
    writeoff: d(0),
    roundoff: d(0),
    pendingAmount: d(pending),
    writeoffApprovedBy: null,
    ...extra,
  };
}

/** A transfer out of the bank — NEFT, RTGS — instant money on a payment. */
function bank(amount: number, rowNo = 1): AllocationTender {
  return {
    tenderRowNo: rowNo,
    amount: d(amount),
    isCheque: false,
    isPostDated: false,
    instrumentDate: null,
    settlementMode: BillSettlementMode.BANK,
  };
}

/** One of OUR cheques, dated `on`; post-dated when `on` is after the payment. */
function cheque(amount: number, on: string, rowNo: number, postDated: boolean): AllocationTender {
  return {
    tenderRowNo: rowNo,
    amount: d(amount),
    isCheque: true,
    isPostDated: postDated,
    instrumentDate: DATE(on),
    settlementMode: BillSettlementMode.CHEQUE,
  };
}

/** A settling deduction on a payment is a CR line: TDS withheld, a balance written back. */
function deduction(
  lineNo: number,
  amount: number,
  role = 'TDS_PAYABLE',
  mode = BillSettlementMode.TDS,
): AllocationOtherLine {
  return {
    lineNo,
    role,
    ledgerId: `ledger-${role}`,
    drCr: DrCr.CR,
    amount: d(amount),
    settlesBill: true,
    settlementMode: mode,
    isInstrumentSplit: false,
  };
}

/** An extra on a payment is a DR line: money that went out ON TOP of the bills. */
function extra(
  lineNo: number,
  amount: number,
  role = 'INTEREST_PAID',
  isInstrumentSplit = false,
): AllocationOtherLine {
  return {
    lineNo,
    role,
    ledgerId: `ledger-${role}`,
    drCr: DrCr.DR,
    amount: d(amount),
    settlesBill: false,
    settlementMode: BillSettlementMode.JOURNAL,
    isInstrumentSplit,
  };
}

/** A debit we hold on the party — an advance we paid — being spent. */
function debit(refno: string, amount: number, pending: number): AllocationCredit {
  return {
    billId: `debit-${refno}`,
    billAccYear: '2026-2027',
    billType: BillType.ADVANCE,
    docRefno: refno,
    amount: d(amount),
    pendingAmount: d(pending),
    adjType: BillAdjType.ADVANCE_ADJUST,
    settlementMode: BillSettlementMode.ADVANCE,
  };
}

function detailOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof AllocationError) {
      return `${error.kind}: ${error.details.map((detail) => detail.message).join(' | ')}`;
    }
    throw error;
  }
  throw new Error('expected the engine to refuse this payment');
}

/** Every input here is a PAYMENT unless a case says otherwise. */
function input(overrides: Partial<AllocationInput>): AllocationInput {
  return {
    direction: 'OUT',
    receiptDate: PAYMENT_DATE,
    bills: [],
    credits: [],
    otherLines: [],
    tenders: [],
    pins: [],
    claimedOnAccount: d(0),
    ...overrides,
  };
}

describe('allocation engine — direction OUT (the payment)', () => {
  describe('the sides', () => {
    it('debits the party on a payment and credits them on a receipt', () => {
      const out = allocate(input({ bills: [bill('P1', 5000, 5000)], tenders: [bank(5000)] }));
      expect(out.partyLegSide).toBe(DrCr.DR);
      expect(out.adjustments[0].drCr).toBe(DrCr.DR);

      // The default is IN, and nothing about the receipt changed.
      const back = allocate(
        input({ direction: undefined, bills: [bill('B1', 5000, 5000)], tenders: [bank(5000)] }),
      );
      expect(back.partyLegSide).toBe(DrCr.CR);
      expect(back.adjustments[0].drCr).toBe(DrCr.CR);
    });
  });

  describe('the identity (§5.2 step 4)', () => {
    it('accepts a payment that balances exactly', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000)],
          tenders: [bank(5000)],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.adjustments).toHaveLength(1);
      expect(result.adjustments[0].amount.toFixed(2)).toBe('5000.00');
      expect(result.adjustments[0].adjType).toBe(BillAdjType.ALLOCATION);
      expect(result.totalOnAccount.toFixed(2)).toBe('0.00');
      expect(result.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('5000.00');
    });

    it('refuses a payment out by ONE PAISA', () => {
      expect(() =>
        allocate(
          input({
            bills: [bill('P1', 5000, 5000)],
            tenders: [bank(5000.01)],
            claimedOnAccount: d(0),
          }),
        ),
      ).toThrow(AllocationError);
    });

    it("refuses a client onAccount that disagrees with the server's, in the payment's words", () => {
      let thrown: AllocationError | null = null;
      try {
        allocate(
          input({
            bills: [bill('P1', 4000, 5000)],
            tenders: [bank(5000)],
            claimedOnAccount: d(500),
          }),
        );
      } catch (error) {
        thrown = error as AllocationError;
      }
      // The envelope names the document and the detail speaks of money PAID,
      // not received — the words an operator on the payment screen reads.
      expect(thrown?.message).toBe('The payment does not balance');
      expect(thrown?.details[0].message).toContain('Paid 5000.00');
      expect(thrown?.details[0].message).toContain('other charges');
    });

    it("keeps the bank's charge IN the identity — the bank is credited gross of it", () => {
      // 10,000 to the supplier by NEFT and 10 of bank charge: 10,010 leaves the
      // bank, the supplier's bill is settled by 10,000, and the 10 is an extra
      // the money paid for. On a receipt the MDR split is left OUT (it is a
      // slice of money already counted); on a payment it is money that went
      // out on top, so it stays in.
      const result = allocate(
        input({
          bills: [bill('P1', 10000, 10000)],
          tenders: [bank(10010)],
          otherLines: [extra(1, 10, 'BANK_CHARGES', true)],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.totalOnAccount.toFixed(2)).toBe('0.00');
      expect(result.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('10000.00');
    });

    it('refuses other charges funded by a cheque that has not left', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('P1', 9900, 9900)],
              tenders: [cheque(10000, '2026-10-20', 1, true)],
              otherLines: [extra(1, 100, 'INTEREST_PAID')],
              claimedOnAccount: d(0),
            }),
          ),
        ),
      ).toContain('has left');
    });
  });

  describe('the row locks (§5.2 step 3)', () => {
    it('refuses settling more than a bill has pending NOW, as a CONFLICT', () => {
      let thrown: AllocationError | null = null;
      try {
        allocate(
          input({
            bills: [bill('P1', 5000, 3000)],
            tenders: [bank(5000)],
          }),
        );
      } catch (error) {
        thrown = error as AllocationError;
      }

      expect(thrown?.kind).toBe('CONFLICT');
      expect(thrown?.message).toContain('payment');
      expect(thrown?.details[0].message).toContain('3000.00 pending');
      expect(thrown?.details[0].message).toContain('payment settles');
    });

    it('counts discount and write-off against what is pending', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('P1', 4800, 5000, { discount: d(300), writeoff: d(0) })],
              tenders: [bank(4800)],
            }),
          ),
        ),
      ).toContain('CONFLICT');
    });
  });

  describe('deductions — the CR side on a payment', () => {
    it('lands a PINNED TDS deduction on the bill it was withheld from, as a DEBIT to the party', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 10000, 10000), bill('P2', 10000, 10000)],
          tenders: [bank(19300)],
          otherLines: [deduction(1, 700)],
          pins: [{ lineNo: 1, billId: 'bill-P2', billAccYear: '2026-2027', amount: d(700) }],
          claimedOnAccount: d(0),
        }),
      );

      const tds = result.adjustments.filter((row) => row.settlementMode === BillSettlementMode.TDS);
      expect(tds).toHaveLength(1);
      expect(tds[0].billId).toBe('bill-P2');
      expect(tds[0].amount.toFixed(2)).toBe('700.00');
      expect(tds[0].drCr).toBe(DrCr.DR);
      expect(tds[0].otherLineNo).toBe(1);
    });

    it('spreads an UNPINNED deduction pro-rata, summing exactly', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 1000, 1000), bill('P2', 2000, 2000)],
          tenders: [bank(2900)],
          otherLines: [deduction(1, 100)],
          claimedOnAccount: d(0),
        }),
      );

      const tds = result.adjustments.filter((row) => row.settlementMode === BillSettlementMode.TDS);
      expect(tds).toHaveLength(2);
      const total = tds.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
      expect(total.toFixed(2)).toBe('100.00');
    });

    it('settles a balance written back the same way, under its own mode', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000)],
          tenders: [bank(4900)],
          otherLines: [deduction(1, 100, 'BALANCES_WRITTEN_BACK', BillSettlementMode.WRITEOFF)],
          claimedOnAccount: d(0),
        }),
      );

      const written = result.adjustments.find(
        (row) => row.settlementMode === BillSettlementMode.WRITEOFF,
      );
      expect(written).toBeDefined();
      expect(written!.adjType).toBe(BillAdjType.ALLOCATION);
      expect(written!.drCr).toBe(DrCr.DR);
      expect(written!.amount.toFixed(2)).toBe('100.00');
    });

    it('refuses a pin whose parts do not add up to the whole line', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('P1', 10000, 10000)],
              tenders: [bank(9300)],
              otherLines: [deduction(1, 700)],
              pins: [{ lineNo: 1, billId: 'bill-P1', billAccYear: '2026-2027', amount: d(500) }],
              claimedOnAccount: d(0),
            }),
          ),
        ),
      ).toContain('Pin all of a line or none of it');
    });

    it('refuses to pin a DR line — on a payment only a CR line is a deduction', () => {
      // On a payment a DR line is an EXTRA whatever its flag says, so the
      // identity must carry it — 10,000 of bills plus the 700 — or the engine
      // refuses on the balance before it ever reads the pin.
      const drSettling: AllocationOtherLine = { ...extra(1, 700), settlesBill: true };
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('P1', 10000, 10000)],
              tenders: [bank(10700)],
              otherLines: [drSettling],
              pins: [{ lineNo: 1, billId: 'bill-P1', billAccYear: '2026-2027', amount: d(700) }],
              claimedOnAccount: d(0),
            }),
          ),
        ),
      ).toContain('Only a CR other-ledger line with settlesBill can be pinned');
    });

    it('holds a CR line that settles nothing on account, on the payment voucher', () => {
      // A written-back balance the operator did not aim at any bill still
      // discharges the party; the only place left for it is the advance.
      const floating: AllocationOtherLine = {
        ...deduction(1, 1000, 'BALANCES_WRITTEN_BACK', BillSettlementMode.WRITEOFF),
        settlesBill: false,
      };
      const result = allocate(
        input({
          bills: [bill('P1', 4000, 5000)],
          tenders: [bank(4000)],
          otherLines: [floating],
          claimedOnAccount: d(1000),
        }),
      );

      expect(result.onAccount).toHaveLength(1);
      expect(result.onAccount[0].voucherKey).toBe(RECEIPT_VOUCHER_KEY);
      expect(result.onAccount[0].amount.toFixed(2)).toBe('1000.00');
      expect(result.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('5000.00');
    });

    it('holds TDS withheld on an ADVANCE on account with the money — no bill at all (notes 62 A1)', () => {
      // 50,000 paid ahead to a 194C supplier: 49,500 leaves the bank, 500 is
      // withheld. The supplier is discharged of the GROSS, all of it ahead.
      const result = allocate(
        input({
          tenders: [bank(49500)],
          otherLines: [deduction(1, 500)],
          claimedOnAccount: d(50000),
        }),
      );

      expect(result.adjustments).toEqual([]);
      expect(result.onAccount).toHaveLength(1);
      expect(result.onAccount[0].amount.toFixed(2)).toBe('50000.00');
      expect(result.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('50000.00');
    });

    it('fills a bill smaller than the tax and holds the rest of the tax on account', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 300, 300)],
          tenders: [bank(49500)],
          otherLines: [deduction(1, 500)],
          claimedOnAccount: d(49700),
        }),
      );

      const tds = result.adjustments.filter((row) => row.settlementMode === BillSettlementMode.TDS);
      expect(tds).toHaveLength(1);
      expect(tds[0].billId).toBe('bill-P1');
      expect(tds[0].amount.toFixed(2)).toBe('300.00');
      // The bill is full; every rupee of money went on account.
      expect(result.adjustments).toHaveLength(1);
      expect(result.totalOnAccount.toFixed(2)).toBe('49700.00');
      expect(result.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('50000.00');
    });

    it('still refuses a PINNED deduction the bill has no room for', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('P1', 300, 300)],
              tenders: [bank(49500)],
              otherLines: [deduction(1, 500)],
              pins: [{ lineNo: 1, billId: 'bill-P1', billAccYear: '2026-2027', amount: d(500) }],
              claimedOnAccount: d(49700),
            }),
          ),
        ),
      ).toContain('has room for 300.00 more');
    });

    it('carries the approver of a written-back balance onto its bill rows (notes 62 E1)', () => {
      const approved: AllocationOtherLine = {
        ...deduction(1, 100, 'BALANCES_WRITTEN_BACK', BillSettlementMode.WRITEOFF),
        approvedBy: 'user-approver',
      };
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000)],
          tenders: [bank(4900)],
          otherLines: [approved],
          claimedOnAccount: d(0),
        }),
      );

      const written = result.adjustments.find((row) => row.otherLineNo === 1);
      expect(written?.approvedBy).toBe('user-approver');
      // A row the line did not produce names nobody.
      expect(result.adjustments.find((row) => row.otherLineNo === null)?.approvedBy).toBeNull();
    });
  });

  describe('post-dated cheques (R2)', () => {
    it('gives each post-dated cheque a voucher of its own, dated the cheque', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000), bill('P2', 50000, 50000)],
          tenders: [bank(5000), cheque(50000, '2026-10-20', 2, true)],
          claimedOnAccount: d(0),
        }),
      );

      const pdcRows = result.adjustments.filter((row) => row.isPostDated);
      expect(pdcRows).toHaveLength(1);
      expect(pdcRows[0].voucherKey).toBe(pdcVoucherKey(2));
      expect(pdcRows[0].drCr).toBe(DrCr.DR);
      expect(pdcRows[0].adjDate.toISOString().slice(0, 10)).toBe('2026-10-20');
    });

    it('treats a cheque dated today as ordinary money on the payment', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000)],
          tenders: [cheque(5000, '2026-09-28', 1, false)],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.adjustments[0].isPostDated).toBe(false);
      expect(result.adjustments[0].voucherKey).toBe(RECEIPT_VOUCHER_KEY);
      expect(result.adjustments[0].settlementMode).toBe(BillSettlementMode.CHEQUE);
      expect(result.adjustments[0].tenderRowNo).toBe(1);
    });

    it("puts a post-dated cheque's remainder on ITS voucher, dated the cheque", () => {
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000)],
          tenders: [bank(5000), cheque(50000, '2026-10-20', 2, true)],
          claimedOnAccount: d(50000),
        }),
      );

      expect(result.onAccount).toHaveLength(1);
      expect(result.onAccount[0].voucherKey).toBe(pdcVoucherKey(2));
      expect(result.onAccount[0].amount.toFixed(2)).toBe('50000.00');
      expect(result.onAccount[0].onDate.toISOString().slice(0, 10)).toBe('2026-10-20');
      // And the cheque's own voucher carries the party DEBIT for it.
      expect(result.partyCreditByVoucher.get(pdcVoucherKey(2))!.toFixed(2)).toBe('50000.00');
    });

    it('fills bills from the earliest-maturing cheque first', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 1000, 1000)],
          tenders: [cheque(1000, '2026-12-01', 1, true), cheque(1000, '2026-11-01', 2, true)],
          claimedOnAccount: d(1000),
        }),
      );

      const settled = result.adjustments.find((row) => row.billId === 'bill-P1')!;
      expect(settled.voucherKey).toBe(pdcVoucherKey(2));
      expect(result.onAccount[0].voucherKey).toBe(pdcVoucherKey(1));
    });
  });

  describe('held debits — an advance paid, a debit note (R4, mirrored)', () => {
    it('writes a PAIR — a DEBIT on the bill, a CREDIT on the advance', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000)],
          credits: [debit('ADV1', 1000, 1000)],
          tenders: [bank(4000)],
          claimedOnAccount: d(0),
        }),
      );

      const pair = result.adjustments.filter((row) => row.againstBill !== null);
      expect(pair).toHaveLength(2);
      expect(pair[0].billId).toBe('bill-P1');
      expect(pair[0].againstBill?.billId).toBe('debit-ADV1');
      expect(pair[1].billId).toBe('debit-ADV1');
      expect(pair[1].againstBill?.billId).toBe('bill-P1');
      // Opposite sides, mirrored: the purchase bill is debited, the advance
      // we paid — a DR bill on the party — is credited back down.
      expect(pair[0].drCr).toBe(DrCr.DR);
      expect(pair[1].drCr).toBe(DrCr.CR);
      expect(pair[0].adjType).toBe(BillAdjType.ADVANCE_ADJUST);
    });

    it('routes a debit note as NOTE_ADJUST / CREDIT_NOTE', () => {
      const note: AllocationCredit = {
        ...debit('DN1', 500, 500),
        billType: BillType.PURCHASE_RETURN,
        adjType: BillAdjType.NOTE_ADJUST,
        settlementMode: BillSettlementMode.CREDIT_NOTE,
      };
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000)],
          credits: [note],
          tenders: [bank(4500)],
          claimedOnAccount: d(0),
        }),
      );

      const pair = result.adjustments.filter((row) => row.againstBill !== null);
      expect(pair.every((row) => row.adjType === BillAdjType.NOTE_ADJUST)).toBe(true);
      expect(pair.every((row) => row.settlementMode === BillSettlementMode.CREDIT_NOTE)).toBe(true);
    });

    it("counts the pair ONCE towards the voucher's adjust amount", () => {
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000)],
          credits: [debit('ADV1', 1000, 1000)],
          tenders: [bank(4000)],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.adjustAmountByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('5000.00');
    });

    it('refuses to re-park a debit on account', () => {
      expect(() =>
        allocate(
          input({
            bills: [bill('P1', 500, 500)],
            credits: [debit('ADV1', 1000, 1000)],
            tenders: [bank(0.0)],
            claimedOnAccount: d(500),
          }),
        ),
      ).toThrow();
    });

    it('refuses applying more of a debit than is left', () => {
      let thrown: AllocationError | null = null;
      try {
        allocate(
          input({
            bills: [bill('P1', 1000, 1000)],
            credits: [debit('ADV1', 1000, 400)],
          }),
        );
      } catch (error) {
        thrown = error as AllocationError;
      }
      expect(thrown?.kind).toBe('CONFLICT');
      expect(thrown?.message).toContain('payment');
    });
  });

  describe('the ledger and the bill sub-ledger agree', () => {
    /**
     * The property the receipt's design rests on, mirrored: whatever the
     * payment DEBITS to the party's bills, plus what it holds as an advance,
     * less the debits of theirs it spends, must equal the party DR leg on the
     * voucher. Read against `partyLegSide`, never against a hard-coded side.
     */
    it('party DR equals what the bills were debited, on every voucher', () => {
      const result = allocate(
        input({
          bills: [
            bill('P1', 10000, 12000, {
              discount: d(200),
              writeoff: d(100),
              writeoffApprovedBy: 'approver-1',
            }),
            bill('P2', 5000, 5000),
          ],
          credits: [debit('ADV1', 2000, 2000)],
          tenders: [bank(12300), cheque(4000, '2026-10-20', 2, true)],
          otherLines: [deduction(1, 700), extra(2, 1000, 'INTEREST_PAID')],
          // 16,300 paid + 700 withheld + 2,000 of advance spent = 19,000,
          // against 15,000 allocated + 1,000 of interest + 3,000 left over.
          claimedOnAccount: d(3000),
        }),
      );

      expect(result.partyLegSide).toBe(DrCr.DR);
      for (const [voucherKey, partyLeg] of result.partyCreditByVoucher) {
        const fromBills = result.adjustments
          .filter((row) => row.voucherKey === voucherKey)
          .reduce(
            (total, row) =>
              row.drCr === result.partyLegSide ? total.plus(row.amount) : total.minus(row.amount),
            new Prisma.Decimal(0),
          )
          .plus(
            result.onAccount
              .filter((entry) => entry.voucherKey === voucherKey)
              .reduce((total, entry) => total.plus(entry.amount), new Prisma.Decimal(0)),
          );

        expect(fromBills.toFixed(2)).toBe(partyLeg.toFixed(2));
      }
      // The payment voucher's party DR is the money it moved: 12,300 paid,
      // less the 1,000 of interest that went out on top, plus the 700
      // withheld and the 300 of discount and write-off. The 1,000 of P2 the
      // bank money could not reach is settled by the post-dated cheque, whose
      // own voucher debits the party 4,000 — 1,000 on the bill and 3,000 held.
      expect(result.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('12300.00');
      expect(result.partyCreditByVoucher.get(pdcVoucherKey(2))!.toFixed(2)).toBe('4000.00');
      expect(result.onAccount).toEqual([expect.objectContaining({ voucherKey: pdcVoucherKey(2) })]);
      expect(result.onAccount[0].amount.toFixed(2)).toBe('3000.00');
    });
  });

  describe('discount, write-off and round-off', () => {
    it('refuses a write-off with no approver, before the constraint does', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('P1', 4000, 5000, { writeoff: d(1000) })],
              tenders: [bank(4000)],
              claimedOnAccount: d(0),
            }),
          ),
        ),
      ).toContain('needs an approver');
    });

    it("posts the operator's discount as it was left, as a DEBIT to the party", () => {
      const result = allocate(
        input({
          bills: [bill('P1', 4800, 5000, { discount: d(200), writeoffApprovedBy: null })],
          tenders: [bank(4800)],
          claimedOnAccount: d(0),
        }),
      );

      const discount = result.adjustments.filter((row) => row.adjType === BillAdjType.DISCOUNT);
      expect(discount).toHaveLength(1);
      expect(discount[0].amount.toFixed(2)).toBe('200.00');
      expect(discount[0].drCr).toBe(DrCr.DR);
      // The party leg carries the discount too: the bill is discharged in full.
      expect(result.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('5000.00');
    });

    it('posts a round-off as its own row, on the same side', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 4999, 4999.6, { roundoff: d(0.6) })],
          tenders: [bank(4999)],
          claimedOnAccount: d(0),
        }),
      );

      const roundoff = result.adjustments.filter((row) => row.adjType === BillAdjType.ROUND_OFF);
      expect(roundoff).toHaveLength(1);
      expect(roundoff[0].drCr).toBe(DrCr.DR);
      expect(roundoff[0].settlementMode).toBe(BillSettlementMode.ROUND_OFF);
    });

    it('treats a cleared discount as zero — the server never re-seeds', () => {
      const result = allocate(
        input({
          bills: [bill('P1', 5000, 5000, { discount: d(0) })],
          tenders: [bank(5000)],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.adjustments.some((row) => row.adjType === BillAdjType.DISCOUNT)).toBe(false);
    });
  });

  describe('rejections that protect the data', () => {
    it('refuses the same bill twice in one payment', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('P1', 1000, 5000), bill('P1', 1000, 5000)],
              tenders: [bank(2000)],
              claimedOnAccount: d(0),
            }),
          ),
        ),
      ).toContain('appears twice');
    });

    it('refuses a zero-value allocation row', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('P1', 0, 5000)],
              tenders: [bank(1)],
              claimedOnAccount: d(1),
            }),
          ),
        ),
      ).toContain('settles nothing');
    });
  });
});
