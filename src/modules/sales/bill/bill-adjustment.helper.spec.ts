import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BillAdjustmentContext, syncBillAdjustments } from './bill-adjustment.helper';
import { SaveBillAdjustmentDto } from './dto/save-bill-adjustment.dto';

const BILL_ID = '019f0000-0000-7000-8000-0000000000b1';
const COMPANY_ID = '019f0000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '019f0000-0000-7000-8000-0000000000c2';
const TENANT_ID = '019f0000-0000-7000-8000-0000000000c3';
const PARTY_ID = '019f0000-0000-7000-8000-0000000000d1';
const OTHER_PARTY_ID = '019f0000-0000-7000-8000-0000000000d2';
const USER_ID = '019f0000-0000-7000-8000-0000000000e1';
const SESSION_ID = '019f0000-0000-7000-8000-0000000000e2';
// The credits the panel offers: an order advance and a sale-return credit note.
const ADVANCE_ID = '019f0000-0000-7000-8000-0000000000a1';
const NOTE_ID = '019f0000-0000-7000-8000-0000000000a2';
const ACC_YEAR = '2026-2027';
// The credit's OWN year, deliberately different from the bill's — a March
// advance settling an April invoice is the case the composite key exists for.
const CREDIT_ACC_YEAR = '2025-2026';
const ACTOR = 'tester';
const NOW = new Date('2026-08-15T10:00:00.000Z');
const BILL_DATE = new Date('2026-08-15T00:00:00.000Z');

// One accounts.acc_bill_balance row as the FOR UPDATE re-read returns it: snake
// case, with numerics already Decimal.
interface CreditRow {
  abl_id: string;
  abl_acc_year: string;
  abl_bill_type: string;
  abl_dr_cr: string;
  abl_party_id: string;
  abl_doc_refno: string | null;
  abl_pending_amount: Prisma.Decimal;
  abl_alloc_amount: Prisma.Decimal;
}
const makeCredit = (overrides: Partial<CreditRow> = {}): CreditRow => ({
  abl_id: ADVANCE_ID,
  abl_acc_year: CREDIT_ACC_YEAR,
  abl_bill_type: 'ADVANCE',
  // char(2) — the column is blank-padded, which is why the helper trims it.
  abl_dr_cr: 'CR',
  abl_party_id: PARTY_ID,
  abl_doc_refno: 'SO-2201',
  abl_pending_amount: new Prisma.Decimal(5000),
  abl_alloc_amount: new Prisma.Decimal(0),
  ...overrides,
});

// A live adjustment row, as readLiveAdjustments / reverseAll select it.
const makeLiveRow = (overrides: Record<string, unknown> = {}) => ({
  abjId: '019f0000-0000-7000-8000-0000000000f1',
  abjAccYear: ACC_YEAR,
  abjBillId: BILL_ID,
  abjBillAccYear: ACC_YEAR,
  abjAgainstBillId: ADVANCE_ID,
  abjAgainstBillAccYear: CREDIT_ACC_YEAR,
  abjAmount: new Prisma.Decimal(2000),
  abjAdjType: 'ADVANCE_ADJUST',
  abjSettlementMode: 'ADVANCE',
  abjSettlementLedgerId: null,
  abjDrCr: 'CR',
  abjRowNo: 1,
  ...overrides,
});

interface Harness {
  tx: Prisma.TransactionClient;
  created: Record<string, unknown>[];
  balanceUpdates: { where: Record<string, unknown>; data: Record<string, unknown> }[];
}
// A transaction client with just the four surfaces the helper touches. The
// adjustment findMany is answered by call order: the helper reads the live rows
// first and the already-reversed set second.
const makeTx = (options: {
  credits?: CreditRow[];
  live?: Record<string, unknown>[];
  reversed?: { abjReversalOfId: string }[];
} = {}): Harness => {
  const credits = options.credits ?? [makeCredit()];
  const live = options.live ?? [];
  const reversed = options.reversed ?? [];
  const created: Record<string, unknown>[] = [];
  const balanceUpdates: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const tx = {
    // Tagged template: values[0] is the credit id the helper is locking.
    $queryRaw: jest.fn((_strings: TemplateStringsArray, ...values: unknown[]) =>
      Promise.resolve(credits.filter((credit) => credit.abl_id === values[0])),
    ),
    accBillAdjustment: {
      // The live queries pin abjReversalOfId to null; the already-reversed
      // lookup passes an { in: [...] } filter. That is what tells them apart —
      // both name the column.
      findMany: jest.fn((args: { where: Record<string, unknown> }) =>
        Promise.resolve(
          args.where.abjReversalOfId !== null && typeof args.where.abjReversalOfId === 'object'
            ? reversed
            : live,
        ),
      ),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return Promise.resolve(args.data);
      }),
      aggregate: jest.fn(() => Promise.resolve({ _max: { abjRowNo: live.length } })),
    },
    accBillBalance: {
      update: jest.fn((args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        balanceUpdates.push(args);
        return Promise.resolve({});
      }),
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, created, balanceUpdates };
};

const makeContext = (overrides: Partial<BillAdjustmentContext> = {}): BillAdjustmentContext => ({
  billId: BILL_ID,
  billAccYear: ACC_YEAR,
  billAmount: new Prisma.Decimal(5000),
  paidAmount: new Prisma.Decimal(1500),
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  tenantId: TENANT_ID,
  accYear: ACC_YEAR,
  partyId: PARTY_ID,
  adjDate: BILL_DATE,
  userId: USER_ID,
  sessionId: SESSION_ID,
  ...overrides,
});

const adjust = (overrides: Partial<SaveBillAdjustmentDto> = {}): SaveBillAdjustmentDto => ({
  againstBillId: ADVANCE_ID,
  againstBillAccYear: CREDIT_ACC_YEAR,
  amount: 2000,
  ...overrides,
});

describe('syncBillAdjustments', () => {
  describe('absent is not empty', () => {
    it('writes nothing when the key is omitted', async () => {
      const { tx, created, balanceUpdates } = makeTx();
      const result = await syncBillAdjustments(tx, makeContext(), undefined, ACTOR, NOW);
      expect(result.action).toBe('unchanged');
      expect(created).toHaveLength(0);
      expect(balanceUpdates).toHaveLength(0);
    });

    it('reverses what is posted when the array is empty', async () => {
      const { tx, created, balanceUpdates } = makeTx({ live: [makeLiveRow()] });
      const result = await syncBillAdjustments(tx, makeContext(), [], ACTOR, NOW);
      expect(result.action).toBe('reversed');
      expect(result.adjustments).toHaveLength(0);
      // One reversal row, carrying the same type and side as the row it undoes
      // and a negative amount — ck_abj_reversal_sign.
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        abjAdjType: 'ADVANCE_ADJUST',
        abjDrCr: 'CR',
        abjReversalOfId: makeLiveRow().abjId,
      });
      expect((created[0].abjAmount as Prisma.Decimal).toString()).toBe('-2000');
      // The invoice falls back to what was merely tendered.
      const invoice = balanceUpdates.find(
        (update) => (update.where.ablId_ablAccYear as { ablId: string }).ablId === BILL_ID,
      );
      expect((invoice?.data.ablAllocAmount as Prisma.Decimal).toString()).toBe('1500');
    });
  });

  describe('posting a credit', () => {
    it('writes two rows, one moving each balance', async () => {
      const { tx, created } = makeTx();
      const result = await syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW);
      expect(result.action).toBe('posted');
      expect(created).toHaveLength(2);
      // Row 1 moves the invoice: a DR bill settled is a CR movement.
      expect(created[0]).toMatchObject({
        abjBillId: BILL_ID,
        abjBillAccYear: ACC_YEAR,
        abjAgainstBillId: ADVANCE_ID,
        abjAgainstBillAccYear: CREDIT_ACC_YEAR,
        abjDrCr: 'CR',
        abjAdjType: 'ADVANCE_ADJUST',
        abjSettlementMode: 'ADVANCE',
        // The FY of the ADJUSTMENT is the bill's year, never the credit's.
        abjAccYear: ACC_YEAR,
        abjPartyId: PARTY_ID,
      });
      // Row 2 moves the credit, in the opposite direction and naming the pair
      // the other way round.
      expect(created[1]).toMatchObject({
        abjBillId: ADVANCE_ID,
        abjBillAccYear: CREDIT_ACC_YEAR,
        abjAgainstBillId: BILL_ID,
        abjAgainstBillAccYear: ACC_YEAR,
        abjDrCr: 'DR',
        abjAdjType: 'ADVANCE_ADJUST',
        abjAccYear: ACC_YEAR,
      });
    });

    it('derives NOTE_ADJUST / CREDIT_NOTE from a sale return', async () => {
      const { tx, created } = makeTx({
        credits: [makeCredit({ abl_id: NOTE_ID, abl_bill_type: 'SALES_RETURN' })],
      });
      await syncBillAdjustments(
        tx,
        makeContext(),
        [adjust({ againstBillId: NOTE_ID })],
        ACTOR,
        NOW,
      );
      expect(created[0]).toMatchObject({
        abjAdjType: 'NOTE_ADJUST',
        abjSettlementMode: 'CREDIT_NOTE',
      });
    });

    it('ignores the payload’s echo fields and reads the credit’s own type', async () => {
      const { tx, created } = makeTx();
      // The client mislabels an advance as a credit note. It must not be able to
      // post one.
      await syncBillAdjustments(
        tx,
        makeContext(),
        [adjust({ billType: 'SALES_RETURN', adjType: 'NOTE_ADJUST', settlementMode: 'CREDIT_NOTE' })],
        ACTOR,
        NOW,
      );
      expect(created[0]).toMatchObject({
        abjAdjType: 'ADVANCE_ADJUST',
        abjSettlementMode: 'ADVANCE',
      });
    });

    it('relieves the credit and sets the invoice to tendered plus adjusted', async () => {
      const { tx, balanceUpdates } = makeTx();
      await syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW);
      const credit = balanceUpdates.find(
        (update) => (update.where.ablId_ablAccYear as { ablId: string }).ablId === ADVANCE_ID,
      );
      // Incremented, because other bills may be adjusting the same credit.
      expect(credit?.data.ablAllocAmount).toEqual({ increment: new Prisma.Decimal(2000) });
      const invoice = balanceUpdates.find(
        (update) => (update.where.ablId_ablAccYear as { ablId: string }).ablId === BILL_ID,
      );
      // Set, not incremented: 1,500 tendered + 2,000 adjusted leaves 1,500
      // outstanding on a 5,000 bill.
      expect((invoice?.data.ablAllocAmount as Prisma.Decimal).toString()).toBe('3500');
    });

    it('merges two lines naming the same credit', async () => {
      const { tx, created } = makeTx();
      await syncBillAdjustments(
        tx,
        makeContext(),
        [adjust({ amount: 1200 }), adjust({ amount: 800 })],
        ACTOR,
        NOW,
      );
      expect(created).toHaveLength(2);
      expect((created[0].abjAmount as Prisma.Decimal).toString()).toBe('2000');
    });
  });

  describe('what it refuses', () => {
    it('rejects a credit belonging to another party', async () => {
      const { tx } = makeTx({ credits: [makeCredit({ abl_party_id: OTHER_PARTY_ID })] });
      await expect(
        syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a DR balance — the party owes it', async () => {
      const { tx } = makeTx({ credits: [makeCredit({ abl_dr_cr: 'DR' })] });
      await expect(
        syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a bill type that has no routing', async () => {
      const { tx } = makeTx({ credits: [makeCredit({ abl_bill_type: 'OPENING' })] });
      await expect(
        syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a credit that no longer exists', async () => {
      const { tx } = makeTx({ credits: [] });
      await expect(
        syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // 409 rather than 400: the payload was valid when the panel was drawn and
    // another counter spent the credit first.
    it('answers 409 when the credit has been spent since the panel was fetched', async () => {
      const { tx } = makeTx({
        credits: [makeCredit({ abl_pending_amount: new Prisma.Decimal(500) })],
      });
      await expect(
        syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects adjusted money that is also counted in sbPaidAmt', async () => {
      const { tx } = makeTx();
      // 4,500 tendered + 2,000 adjusted on a 5,000 bill: the credit note was
      // folded into sbPaidAmt as well, so ck_abl_settled would fail the whole
      // transaction. Caught here with the arithmetic named instead.
      await expect(
        syncBillAdjustments(
          tx,
          makeContext({ paidAmount: new Prisma.Decimal(4500) }),
          [adjust()],
          ACTOR,
          NOW,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('re-saving', () => {
    it('writes nothing when the payload asks for what is already posted', async () => {
      const { tx, created, balanceUpdates } = makeTx({ live: [makeLiveRow()] });
      const result = await syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW);
      expect(result.action).toBe('unchanged');
      expect(created).toHaveLength(0);
      expect(balanceUpdates).toHaveLength(0);
    });

    it('reverses and re-posts when the amount changed', async () => {
      const { tx, created } = makeTx({ live: [makeLiveRow()] });
      const result = await syncBillAdjustments(
        tx,
        makeContext(),
        [adjust({ amount: 3000 })],
        ACTOR,
        NOW,
      );
      expect(result.action).toBe('replaced');
      // One reversal, then the two rows of the new pair.
      expect(created).toHaveLength(3);
      expect((created[0].abjAmount as Prisma.Decimal).toString()).toBe('-2000');
      expect((created[1].abjAmount as Prisma.Decimal).toString()).toBe('3000');
      expect((created[2].abjAmount as Prisma.Decimal).toString()).toBe('3000');
    });

    it('does not reverse a row that already carries a reversal', async () => {
      const live = makeLiveRow();
      const { tx, created } = makeTx({
        live: [live],
        reversed: [{ abjReversalOfId: live.abjId as string }],
      });
      // The live read discounts it too, so this is a first post, not a replace.
      const result = await syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW);
      expect(result.action).toBe('posted');
      expect(created.every((row) => row.abjReversalOfId === undefined)).toBe(true);
    });
  });
});
