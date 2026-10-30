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
 * The plan's §9 checklist, for the part of it that can be proved without a
 * database — which is most of it, because the engine is pure.
 *
 * Every case here is a line from §9 or a rule from §5.2, named after the thing
 * it is protecting. A test that just exercises the code would tell us nothing
 * the compiler does not already.
 */

const d = (value: number | string): Prisma.Decimal => new Prisma.Decimal(value);
const DATE = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const RECEIPT_DATE = DATE('2026-09-14');

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

function cash(amount: number, rowNo = 1): AllocationTender {
  return {
    tenderRowNo: rowNo,
    amount: d(amount),
    isCheque: false,
    isPostDated: false,
    instrumentDate: null,
    settlementMode: BillSettlementMode.CASH,
  };
}

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

function deduction(
  lineNo: number,
  amount: number,
  role = 'TDS_RECEIVABLE',
  mode = BillSettlementMode.TDS,
): AllocationOtherLine {
  return {
    lineNo,
    role,
    ledgerId: `ledger-${role}`,
    drCr: DrCr.DR,
    amount: d(amount),
    settlesBill: true,
    settlementMode: mode,
    isInstrumentSplit: false,
  };
}

function credit(refno: string, amount: number, pending: number): AllocationCredit {
  return {
    billId: `credit-${refno}`,
    billAccYear: '2026-2027',
    billType: BillType.ADVANCE,
    docRefno: refno,
    amount: d(amount),
    pendingAmount: d(pending),
    adjType: BillAdjType.ADVANCE_ADJUST,
    settlementMode: BillSettlementMode.ADVANCE,
  };
}

/**
 * The message an operator actually reads is the FIELD error, not the summary —
 * `throwAccountsBadRequest(message, details)` puts the summary on the envelope
 * and the explanation on the field. Tests assert the explanation.
 */
function detailOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof AllocationError) {
      return `${error.kind}: ${error.details.map((detail) => detail.message).join(' | ')}`;
    }
    throw error;
  }
  throw new Error('expected the engine to refuse this receipt');
}

function input(overrides: Partial<AllocationInput>): AllocationInput {
  return {
    receiptDate: RECEIPT_DATE,
    bills: [],
    credits: [],
    otherLines: [],
    tenders: [],
    pins: [],
    claimedOnAccount: d(0),
    ...overrides,
  };
}

describe('allocation engine', () => {
  describe('the identity (§5.2 step 4)', () => {
    it('accepts a receipt that balances exactly', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 5000, 5000)],
          tenders: [cash(5000)],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.adjustments).toHaveLength(1);
      expect(result.adjustments[0].amount.toFixed(2)).toBe('5000.00');
      expect(result.totalOnAccount.toFixed(2)).toBe('0.00');
    });

    it('refuses a receipt out by ONE PAISA', () => {
      expect(() =>
        allocate(
          input({
            bills: [bill('B1', 5000, 5000)],
            tenders: [cash(5000.01)],
            claimedOnAccount: d(0),
          }),
        ),
      ).toThrow(AllocationError);
    });

    it("refuses a client onAccount that disagrees with the server's", () => {
      // The arithmetic below is self-consistent; only the CLAIM is wrong, which
      // is the case this check exists for — a client whose figures went stale.
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('B1', 4000, 5000)],
              tenders: [cash(5000)],
              claimedOnAccount: d(500),
            }),
          ),
        ),
      ).toContain('Received 5000.00');
    });

    it('leaves the MDR half of an instrument out of the identity', () => {
      // 15,000 taken by card, 10 of it kept by the acquirer. The customer paid
      // 15,000, so 15,000 settles the bill — the 10 is our expense, and
      // counting it as extra value would make the receipt 15,010.
      const mdr: AllocationOtherLine = {
        lineNo: 1,
        role: 'BANK_CHARGES',
        ledgerId: 'ledger-BANK_CHARGES',
        drCr: DrCr.DR,
        amount: d(10),
        settlesBill: false,
        settlementMode: BillSettlementMode.JOURNAL,
        isInstrumentSplit: true,
      };

      const result = allocate(
        input({
          bills: [bill('B1', 15000, 15000)],
          tenders: [cash(15000)],
          otherLines: [mdr],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.totalOnAccount.toFixed(2)).toBe('0.00');
      expect(result.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('15000.00');
    });

    it('refuses other income funded by a cheque that has not arrived', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('B1', 9900, 9900)],
              tenders: [cheque(10000, '2026-10-20', 1, true)],
              otherLines: [
                {
                  lineNo: 1,
                  role: 'INTEREST_INCOME',
                  ledgerId: 'ledger-INTEREST_INCOME',
                  drCr: DrCr.CR,
                  amount: d(100),
                  settlesBill: false,
                  settlementMode: BillSettlementMode.JOURNAL,
                  isInstrumentSplit: false,
                },
              ],
              claimedOnAccount: d(0),
            }),
          ),
        ),
      ).toContain('has arrived');
    });
  });

  describe('the row locks (§5.2 step 3)', () => {
    it('refuses settling more than a bill has pending NOW, as a CONFLICT', () => {
      let thrown: AllocationError | null = null;
      try {
        allocate(
          input({
            bills: [bill('B1', 5000, 3000)],
            tenders: [cash(5000)],
          }),
        );
      } catch (error) {
        thrown = error as AllocationError;
      }

      // 409, not 400: nothing is wrong with the request, the world moved under
      // it while the operator was typing.
      expect(thrown?.kind).toBe('CONFLICT');
      expect(thrown?.details[0].message).toContain('3000.00 pending');
    });

    it('counts discount and write-off against what is pending', () => {
      // 4,800 + 300 of discount is 5,100 against a bill with 5,000 left.
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('B1', 4800, 5000, { discount: d(300), writeoff: d(0) })],
              tenders: [cash(4800)],
            }),
          ),
        ),
      ).toContain('CONFLICT');
    });
  });

  describe('deductions', () => {
    it('lands a PINNED deduction on the bill it was withheld from', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 10000, 10000), bill('B2', 10000, 10000)],
          tenders: [cash(19300)],
          otherLines: [deduction(1, 700)],
          pins: [{ lineNo: 1, billId: 'bill-B2', billAccYear: '2026-2027', amount: d(700) }],
          claimedOnAccount: d(0),
        }),
      );

      const tds = result.adjustments.filter((row) => row.settlementMode === BillSettlementMode.TDS);
      expect(tds).toHaveLength(1);
      expect(tds[0].billId).toBe('bill-B2');
      expect(tds[0].amount.toFixed(2)).toBe('700.00');
    });

    it('spreads an UNPINNED deduction pro-rata, summing exactly', () => {
      // 100 across 1/3 and 2/3. Naive rounding gives 33.33 + 66.66 = 99.99 and
      // the identity fails by a paisa; largest-remainder gives 99.99 -> 100.00.
      const result = allocate(
        input({
          bills: [bill('B1', 1000, 1000), bill('B2', 2000, 2000)],
          tenders: [cash(2900)],
          otherLines: [deduction(1, 100)],
          claimedOnAccount: d(0),
        }),
      );

      const tds = result.adjustments.filter((row) => row.settlementMode === BillSettlementMode.TDS);
      expect(tds).toHaveLength(2);
      const total = tds.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
      expect(total.toFixed(2)).toBe('100.00');
    });

    it('refuses a pin whose parts do not add up to the whole line', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('B1', 10000, 10000)],
              tenders: [cash(9300)],
              otherLines: [deduction(1, 700)],
              pins: [{ lineNo: 1, billId: 'bill-B1', billAccYear: '2026-2027', amount: d(500) }],
              claimedOnAccount: d(0),
            }),
          ),
        ),
      ).toContain('Pin all of a line or none of it');
    });
  });

  describe('post-dated cheques (R2)', () => {
    it('gives each post-dated cheque a voucher of its own, dated the cheque', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 5000, 5000), bill('B2', 50000, 50000)],
          tenders: [cash(5000), cheque(50000, '2026-09-20', 2, true)],
          claimedOnAccount: d(0),
        }),
      );

      const pdcRows = result.adjustments.filter((row) => row.isPostDated);
      expect(pdcRows).toHaveLength(1);
      expect(pdcRows[0].voucherKey).toBe(pdcVoucherKey(2));
      // The date is what makes the bill settle on MATURITY rather than at post.
      expect(pdcRows[0].adjDate.toISOString().slice(0, 10)).toBe('2026-09-20');
    });

    it('treats a cheque dated today as ordinary money on the receipt', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 5000, 5000)],
          tenders: [cheque(5000, '2026-09-14', 1, false)],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.adjustments[0].isPostDated).toBe(false);
      expect(result.adjustments[0].voucherKey).toBe(RECEIPT_VOUCHER_KEY);
      expect(result.adjustments[0].settlementMode).toBe(BillSettlementMode.CHEQUE);
    });

    it("puts a post-dated cheque's remainder on ITS voucher, dated the cheque", () => {
      const result = allocate(
        input({
          bills: [bill('B1', 5000, 5000)],
          tenders: [cash(5000), cheque(50000, '2026-09-20', 2, true)],
          claimedOnAccount: d(50000),
        }),
      );

      expect(result.onAccount).toHaveLength(1);
      expect(result.onAccount[0].voucherKey).toBe(pdcVoucherKey(2));
      expect(result.onAccount[0].amount.toFixed(2)).toBe('50000.00');
      expect(result.onAccount[0].onDate.toISOString().slice(0, 10)).toBe('2026-09-20');
    });

    it('fills bills from the earliest-maturing cheque first', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 1000, 1000)],
          tenders: [cheque(1000, '2026-11-01', 1, true), cheque(1000, '2026-10-01', 2, true)],
          claimedOnAccount: d(1000),
        }),
      );

      const settled = result.adjustments.find((row) => row.billId === 'bill-B1')!;
      expect(settled.voucherKey).toBe(pdcVoucherKey(2));
      expect(result.onAccount[0].voucherKey).toBe(pdcVoucherKey(1));
    });
  });

  describe('credits (R4)', () => {
    it('writes a PAIR — one row on the bill, one on the credit', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 5000, 5000)],
          credits: [credit('ADV1', 1000, 1000)],
          tenders: [cash(4000)],
          claimedOnAccount: d(0),
        }),
      );

      const pair = result.adjustments.filter((row) => row.againstBill !== null);
      expect(pair).toHaveLength(2);
      expect(pair[0].billId).toBe('bill-B1');
      expect(pair[0].againstBill?.billId).toBe('credit-ADV1');
      expect(pair[1].billId).toBe('credit-ADV1');
      expect(pair[1].againstBill?.billId).toBe('bill-B1');
      // Opposite sides: the invoice is credited, the advance is debited.
      expect(pair[0].drCr).toBe(DrCr.CR);
      expect(pair[1].drCr).toBe(DrCr.DR);
    });

    it('counts the pair ONCE towards the voucher’s adjust amount', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 5000, 5000)],
          credits: [credit('ADV1', 1000, 1000)],
          tenders: [cash(4000)],
          claimedOnAccount: d(0),
        }),
      );

      // 4,000 of money + 1,000 of credit = 5,000 settled, not 6,000.
      expect(result.adjustAmountByVoucher.get(RECEIPT_VOUCHER_KEY)!.toFixed(2)).toBe('5000.00');
    });

    it('refuses to re-park a credit on account', () => {
      expect(() =>
        allocate(
          input({
            bills: [bill('B1', 500, 500)],
            credits: [credit('ADV1', 1000, 1000)],
            tenders: [cash(0.0)],
            claimedOnAccount: d(500),
          }),
        ),
      ).toThrow();
    });

    it('refuses applying more of a credit than is left', () => {
      let thrown: AllocationError | null = null;
      try {
        allocate(
          input({
            bills: [bill('B1', 1000, 1000)],
            credits: [credit('ADV1', 1000, 400)],
          }),
        );
      } catch (error) {
        thrown = error as AllocationError;
      }
      expect(thrown?.kind).toBe('CONFLICT');
    });
  });

  describe('the ledger and the bill sub-ledger agree', () => {
    /**
     * The property the whole design rests on, and the reason a credit applied
     * posts no voucher leg: whatever the receipt credits to the party's BILLS
     * must equal the party leg on the VOUCHER. If these two ever diverge, the
     * trial balance and the ageing report stop telling the same story.
     */
    it('party CR equals what the bills received, on every voucher', () => {
      const result = allocate(
        input({
          bills: [
            bill('B1', 10000, 12000, {
              discount: d(200),
              writeoff: d(100),
              writeoffApprovedBy: 'approver-1',
            }),
            bill('B2', 5000, 5000),
          ],
          credits: [credit('ADV1', 2000, 2000)],
          tenders: [cash(12300), cheque(4000, '2026-10-20', 2, true)],
          otherLines: [
            deduction(1, 700),
            {
              lineNo: 2,
              role: 'INTEREST_INCOME',
              ledgerId: 'ledger-INTEREST_INCOME',
              drCr: DrCr.CR,
              amount: d(1000),
              settlesBill: false,
              settlementMode: BillSettlementMode.JOURNAL,
              isInstrumentSplit: false,
            },
          ],
          // 16,300 of money + 700 withheld + 2,000 of credit = 19,000, against
          // 15,000 allocated + 1,000 of interest + 3,000 left over.
          claimedOnAccount: d(3000),
        }),
      );

      for (const [voucherKey, partyCredit] of result.partyCreditByVoucher) {
        const fromBills = result.adjustments
          .filter((row) => row.voucherKey === voucherKey)
          .reduce(
            (total, row) =>
              row.drCr === DrCr.CR ? total.plus(row.amount) : total.minus(row.amount),
            new Prisma.Decimal(0),
          )
          .plus(
            result.onAccount
              .filter((entry) => entry.voucherKey === voucherKey)
              .reduce((total, entry) => total.plus(entry.amount), new Prisma.Decimal(0)),
          );

        expect(fromBills.toFixed(2)).toBe(partyCredit.toFixed(2));
      }
    });
  });

  describe('discount and write-off', () => {
    it('refuses a write-off with no approver, before the constraint does', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('B1', 4000, 5000, { writeoff: d(1000) })],
              tenders: [cash(4000)],
              claimedOnAccount: d(0),
            }),
          ),
        ),
      ).toContain('needs an approver');
    });

    it('posts the operator’s discount as it was left, and no other', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 4800, 5000, { discount: d(200), writeoffApprovedBy: null })],
          tenders: [cash(4800)],
          claimedOnAccount: d(0),
        }),
      );

      const discount = result.adjustments.filter((row) => row.adjType === BillAdjType.DISCOUNT);
      expect(discount).toHaveLength(1);
      expect(discount[0].amount.toFixed(2)).toBe('200.00');
    });

    it('treats a cleared discount as zero — the server never re-seeds', () => {
      const result = allocate(
        input({
          bills: [bill('B1', 5000, 5000, { discount: d(0) })],
          tenders: [cash(5000)],
          claimedOnAccount: d(0),
        }),
      );

      expect(result.adjustments.some((row) => row.adjType === BillAdjType.DISCOUNT)).toBe(false);
    });
  });

  describe('rejections that protect the data', () => {
    it('refuses the same bill twice in one receipt', () => {
      expect(
        detailOf(() =>
          allocate(
            input({
              bills: [bill('B1', 1000, 5000), bill('B1', 1000, 5000)],
              tenders: [cash(2000)],
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
              bills: [bill('B1', 0, 5000)],
              tenders: [cash(1)],
              claimedOnAccount: d(1),
            }),
          ),
        ),
      ).toContain('settles nothing');
    });
  });
});
