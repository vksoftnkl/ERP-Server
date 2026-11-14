import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  addBillAdjustment,
  BillAdjustmentContext,
  reverseBillAdjustmentsWith,
  syncBillAdjustments,
} from './bill-adjustment.helper';
import { SaveBillAdjustmentDto } from '../../modules/sales/bill/dto/save-bill-adjustment.dto';

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
const makeTx = (
  options: {
    credits?: CreditRow[];
    live?: Record<string, unknown>[];
    reversed?: { abjReversalOfId: string }[];
  } = {},
): Harness => {
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
    it('writes nothing when the key is omitted and nothing is posted', async () => {
      const { tx, created, balanceUpdates } = makeTx();
      const result = await syncBillAdjustments(tx, makeContext(), undefined, ACTOR, NOW);
      expect(result.action).toBe('unchanged');
      expect(created).toHaveLength(0);
      // No live pairs means the posting code still owns the allocation.
      expect(balanceUpdates).toHaveLength(0);
    });

    it('re-settles the invoice when the key is omitted but pairs are posted', async () => {
      const { tx, created, balanceUpdates } = makeTx({ live: [makeLiveRow()] });
      const result = await syncBillAdjustments(tx, makeContext(), undefined, ACTOR, NOW);
      expect(result.action).toBe('unchanged');
      expect(created).toHaveLength(0);
      // The pairs stay, but sbPaidAmt may have changed on this save: 1,500
      // tendered + 2,000 already adjusted.
      expect(balanceUpdates).toHaveLength(1);
      const invoice = balanceUpdates[0];
      expect((invoice.where.ablId_ablAccYear as { ablId: string }).ablId).toBe(BILL_ID);
      expect((invoice.data.ablAllocAmount as Prisma.Decimal).toString()).toBe('3500');
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
        [
          adjust({
            billType: 'SALES_RETURN',
            adjType: 'NOTE_ADJUST',
            settlementMode: 'CREDIT_NOTE',
          }),
        ],
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

    it('caps the allocation at the bill when sbPaidAmt also counts the adjusted money', async () => {
      const { tx, balanceUpdates } = makeTx();
      // 4,500 tendered + 2,000 adjusted on a 5,000 bill: the credit note was
      // folded into sbPaidAmt as well. The sum overshoots, so the invoice's
      // allocation is capped at the bill amount — ck_abl_settled would reject
      // anything larger.
      await syncBillAdjustments(
        tx,
        makeContext({ paidAmount: new Prisma.Decimal(4500) }),
        [adjust()],
        ACTOR,
        NOW,
      );
      const invoice = balanceUpdates.find(
        (update) => (update.where.ablId_ablAccYear as { ablId: string }).ablId === BILL_ID,
      );
      expect((invoice?.data.ablAllocAmount as Prisma.Decimal).toString()).toBe('5000');
    });
  });

  describe('re-saving', () => {
    it('writes no adjustment rows when the payload asks for what is already posted', async () => {
      const { tx, created, balanceUpdates } = makeTx({ live: [makeLiveRow()] });
      const result = await syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW);
      expect(result.action).toBe('unchanged');
      expect(created).toHaveLength(0);
      // The credit is left alone, but the invoice is re-settled: 1,500 tendered
      // + 2,000 already adjusted, in case sbPaidAmt changed on this save.
      expect(balanceUpdates).toHaveLength(1);
      const invoice = balanceUpdates[0];
      expect((invoice.where.ablId_ablAccYear as { ablId: string }).ablId).toBe(BILL_ID);
      expect((invoice.data.ablAllocAmount as Prisma.Decimal).toString()).toBe('3500');
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
        reversed: [{ abjReversalOfId: live.abjId }],
      });
      // The live read discounts it too, so this is a first post, not a replace.
      const result = await syncBillAdjustments(tx, makeContext(), [adjust()], ACTOR, NOW);
      expect(result.action).toBe('posted');
      expect(created.every((row) => row.abjReversalOfId === undefined)).toBe(true);
    });
  });
});

// ─── the per-pair writers (Sale Return S2) ──────────────────────────────────
//
// A bill already carrying set-offs from other documents: an order advance and
// ANOTHER sale-return note. A return's post / cancel must add or take back
// only its own pair; re-syncing the whole list (syncBillAdjustments) reversed
// and re-posted the others, re-stamping another note's Adjust at Post as new.
//
// These run against an in-memory book: findMany really filters on the where
// the helper sends, so a query that selected too much would reverse too much.

const OTHER_NOTE_ID = '019f0000-0000-7000-8000-0000000000a3';
const RECEIPT_VOUCHER_ID = '019f0000-0000-7000-8000-0000000000a4';
const EARLIER = new Date('2026-08-01T09:00:00.000Z');

type BookRow = Record<string, unknown> & { abjId: string };

// Prisma's where, for the operators the helper uses: equality, null, { in },
// { not }, and OR.
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') {
      return (cond as Record<string, unknown>[]).some((w) => matchesWhere(row, w));
    }
    const value = row[key] ?? null;
    if (cond === null) {
      return value === null;
    }
    if (typeof cond === 'object' && cond !== null && 'in' in cond) {
      return (cond as { in: unknown[] }).in.includes(value);
    }
    if (typeof cond === 'object' && cond !== null && 'not' in cond) {
      return value !== cond.not;
    }
    return value === cond;
  });
}

// Both rows of one pair, as posted: the invoice row (CR) and the credit row (DR).
const pairRows = (
  firstNo: number,
  creditId: string,
  amount: number,
  overrides: Record<string, unknown> = {},
): BookRow[] => {
  const common = {
    abjAccYear: ACC_YEAR,
    abjIsDeleted: false,
    abjReversalOfId: null,
    abjVoucherId: null,
    abjAmount: new Prisma.Decimal(amount),
    abjAdjType: creditId === ADVANCE_ID ? 'ADVANCE_ADJUST' : 'NOTE_ADJUST',
    abjSettlementMode: creditId === ADVANCE_ID ? 'ADVANCE' : 'CREDIT_NOTE',
    abjSettlementLedgerId: null,
    abjCreatedOn: EARLIER,
    abjCreatedBy: 'someone-else',
    ...overrides,
  };
  return [
    {
      ...common,
      abjId: `row-${firstNo}`,
      abjRowNo: firstNo,
      abjBillId: BILL_ID,
      abjBillAccYear: ACC_YEAR,
      abjAgainstBillId: creditId,
      abjAgainstBillAccYear: ACC_YEAR,
      abjDrCr: 'CR',
    },
    {
      ...common,
      abjId: `row-${firstNo + 1}`,
      abjRowNo: firstNo + 1,
      abjBillId: creditId,
      abjBillAccYear: ACC_YEAR,
      abjAgainstBillId: BILL_ID,
      abjAgainstBillAccYear: ACC_YEAR,
      abjDrCr: 'DR',
    },
  ];
};

const makeBook = (rows: BookRow[], credits: CreditRow[] = []) => {
  const book: BookRow[] = rows.map((row) => ({ ...row }));
  const before = book.map((row) => ({ ...row }));
  const created: Record<string, unknown>[] = [];
  const balanceUpdates: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  let next = 0;
  const tx = {
    $queryRaw: jest.fn((_strings: TemplateStringsArray, ...values: unknown[]) =>
      Promise.resolve(credits.filter((credit) => credit.abl_id === values[0])),
    ),
    accBillAdjustment: {
      findMany: jest.fn((args: { where: Record<string, unknown> }) =>
        Promise.resolve(
          book
            .filter((row) => matchesWhere(row, args.where))
            .sort((a, b) => (a.abjRowNo as number) - (b.abjRowNo as number)),
        ),
      ),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        book.push({
          abjIsDeleted: false,
          abjReversalOfId: null,
          abjVoucherId: null,
          ...args.data,
          abjId: `new-${++next}`,
        });
        return Promise.resolve(args.data);
      }),
      aggregate: jest.fn((args: { where: { abjBillId: string } }) =>
        Promise.resolve({
          _max: {
            abjRowNo: book
              .filter((row) => row.abjBillId === args.where.abjBillId)
              .reduce<
                number | null
              >((max, row) => Math.max(max ?? 0, row.abjRowNo as number), null),
          },
        }),
      ),
    },
    accBillBalance: {
      update: jest.fn((args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        balanceUpdates.push(args);
        return Promise.resolve({});
      }),
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, book, before, created, balanceUpdates };
};

const noteCredit = (overrides: Partial<CreditRow> = {}): CreditRow =>
  makeCredit({
    abl_id: NOTE_ID,
    abl_acc_year: ACC_YEAR,
    abl_bill_type: 'SALES_RETURN',
    abl_doc_refno: 'SRT/2026-2027/D7/00058',
    abl_pending_amount: new Prisma.Decimal(590),
    ...overrides,
  });

const updateOf = (
  updates: { where: Record<string, unknown>; data: Record<string, unknown> }[],
  ablId: string,
) =>
  updates.filter((update) => (update.where.ablId_ablAccYear as { ablId: string }).ablId === ablId);

// The bill as Sale Return S2 left it: an advance, then another note set off.
const carriedSetOffs = (): BookRow[] => [
  ...pairRows(1, ADVANCE_ID, 1000),
  ...pairRows(3, OTHER_NOTE_ID, 360),
];

describe('addBillAdjustment', () => {
  it('adds one pair for the credit and leaves every set-off the bill already carries', async () => {
    const { tx, book, before, created, balanceUpdates } = makeBook(carriedSetOffs(), [
      noteCredit(),
    ]);

    const posted = await addBillAdjustment(
      tx,
      makeContext(),
      {
        againstBillId: NOTE_ID,
        againstBillAccYear: ACC_YEAR,
        amount: 590,
        remarks: 'Adjusted at post of return SRT/2026-2027/D7/00058',
      },
      ACTOR,
      NOW,
    );

    expect(posted).toEqual({
      againstBillId: NOTE_ID,
      againstBillAccYear: ACC_YEAR,
      amount: new Prisma.Decimal(590),
      adjType: 'NOTE_ADJUST',
      settlementMode: 'CREDIT_NOTE',
    });
    // Exactly the two rows of the new pair, numbered after the invoice's, and
    // no reversal of anything.
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      abjBillId: BILL_ID,
      abjAgainstBillId: NOTE_ID,
      abjDrCr: 'CR',
      // abj_row_no runs per abj_bill_id: the invoice's own rows are 1 and 3.
      abjRowNo: 4,
      abjAdjType: 'NOTE_ADJUST',
      abjSettlementMode: 'CREDIT_NOTE',
      abjAccYear: ACC_YEAR,
      abjPartyId: PARTY_ID,
      abjSessionId: SESSION_ID,
      abjCreatedOn: NOW,
      abjRemarks: 'Adjusted at post of return SRT/2026-2027/D7/00058',
    });
    expect(created[1]).toMatchObject({
      abjBillId: NOTE_ID,
      abjAgainstBillId: BILL_ID,
      abjDrCr: 'DR',
      abjRowNo: 5,
    });
    expect(created.every((row) => row.abjReversalOfId === undefined)).toBe(true);
    expect((created[0].abjAmount as Prisma.Decimal).toString()).toBe('590');
    // The advance's and the other note's rows are exactly as they were: same
    // moment, same author — nothing re-stamped.
    expect(book.slice(0, before.length)).toEqual(before);
    // Both balances MOVE by the pair (incremented): the invoice's allocation,
    // which already holds the earlier set-offs, is never rewritten wholesale.
    expect(balanceUpdates).toHaveLength(2);
    expect(updateOf(balanceUpdates, NOTE_ID)[0].data.ablAllocAmount).toEqual({
      increment: new Prisma.Decimal(590),
    });
    expect(updateOf(balanceUpdates, BILL_ID)[0].data.ablAllocAmount).toEqual({
      increment: new Prisma.Decimal(590),
    });
    expect(updateOf(balanceUpdates, OTHER_NOTE_ID)).toHaveLength(0);
    expect(updateOf(balanceUpdates, ADVANCE_ID)).toHaveLength(0);
  });

  it('writes a Decimal amount as given, to the paisa (no float on the way)', async () => {
    const { tx, created, balanceUpdates } = makeBook([], [noteCredit()]);
    const amount = new Prisma.Decimal('147.35');

    const posted = await addBillAdjustment(
      tx,
      makeContext(),
      { againstBillId: NOTE_ID, againstBillAccYear: ACC_YEAR, amount },
      ACTOR,
      NOW,
    );

    expect(created.map((row) => (row.abjAmount as Prisma.Decimal).toString())).toEqual([
      '147.35',
      '147.35',
    ]);
    expect(posted.amount.toString()).toBe('147.35');
    expect(
      balanceUpdates.map((u) =>
        (u.data.ablAllocAmount as { increment: Prisma.Decimal }).increment.toString(),
      ),
    ).toEqual(['147.35', '147.35']);
  });

  it('starts the row numbers at 1 on a bill with no set-offs yet', async () => {
    const { tx, created } = makeBook([], [noteCredit()]);
    await addBillAdjustment(
      tx,
      makeContext(),
      { againstBillId: NOTE_ID, againstBillAccYear: ACC_YEAR, amount: 100 },
      ACTOR,
      NOW,
    );
    expect(created.map((row) => row.abjRowNo)).toEqual([1, 2]);
    expect(created[0].abjRemarks).toBeNull();
  });

  it('refuses what a set-off may never be, before writing anything', async () => {
    const cases: [CreditRow[], number, unknown][] = [
      // the note was spent since the plan was drawn
      [[noteCredit({ abl_pending_amount: new Prisma.Decimal(100) })], 590, ConflictException],
      // somebody else's note
      [[noteCredit({ abl_party_id: OTHER_PARTY_ID })], 590, BadRequestException],
      // a DR balance is owed, not held
      [[noteCredit({ abl_dr_cr: 'DR' })], 590, BadRequestException],
      // gone
      [[], 590, BadRequestException],
      // nothing to set off
      [[noteCredit()], 0, BadRequestException],
    ];
    for (const [credits, amount, refusal] of cases) {
      const { tx, created, balanceUpdates } = makeBook(carriedSetOffs(), credits);
      await expect(
        addBillAdjustment(
          tx,
          makeContext(),
          { againstBillId: NOTE_ID, againstBillAccYear: ACC_YEAR, amount },
          ACTOR,
          NOW,
        ),
      ).rejects.toBeInstanceOf(refusal);
      expect(created).toHaveLength(0);
      expect(balanceUpdates).toHaveLength(0);
    }
  });
});

describe('reverseBillAdjustmentsWith', () => {
  const NOTE = { ablId: NOTE_ID, ablAccYear: ACC_YEAR };
  const REASON = 'Sale return SRT/2026-2027/D7/00058 cancelled';

  it("takes back only this credit's pair; the advance and the other note keep theirs", async () => {
    const { tx, book, before, created, balanceUpdates } = makeBook([
      ...carriedSetOffs(),
      ...pairRows(5, NOTE_ID, 590),
      // the other note set off AFTER this one: must survive too
      ...pairRows(7, OTHER_NOTE_ID, 40),
    ]);

    const off = await reverseBillAdjustmentsWith(tx, makeContext(), NOTE, REASON, ACTOR, NOW);

    expect(off.toString()).toBe('590');
    // Two reversal rows, one per row of the pair: same type and side, the
    // amount negated, pointing at the row they undo (ck_abj_reversal_sign).
    expect(created).toHaveLength(2);
    expect(created.map((row) => row.abjReversalOfId)).toEqual(['row-5', 'row-6']);
    expect(created[0]).toMatchObject({
      abjBillId: BILL_ID,
      abjAgainstBillId: NOTE_ID,
      abjDrCr: 'CR',
      abjAdjType: 'NOTE_ADJUST',
      abjSettlementMode: 'CREDIT_NOTE',
      abjReversalReason: REASON,
      abjAccYear: ACC_YEAR,
      // after the invoice's own rows 1, 3, 5 and 7
      abjRowNo: 8,
      abjCreatedOn: NOW,
      abjCreatedBy: ACTOR,
    });
    expect(created[1]).toMatchObject({ abjBillId: NOTE_ID, abjDrCr: 'DR', abjRowNo: 9 });
    expect(created.map((row) => (row.abjAmount as Prisma.Decimal).toString())).toEqual([
      '-590',
      '-590',
    ]);
    // Nothing else was reversed or touched.
    expect(book.slice(0, before.length)).toEqual(before);
    // The note gets its 590 back and the invoice gives it up; nobody else moves.
    expect(balanceUpdates).toHaveLength(2);
    expect(updateOf(balanceUpdates, NOTE_ID)[0].data.ablAllocAmount).toEqual({
      increment: new Prisma.Decimal(-590),
    });
    expect(updateOf(balanceUpdates, BILL_ID)[0].data.ablAllocAmount).toEqual({
      increment: new Prisma.Decimal(-590),
    });
  });

  it('is a no-op the second time (a re-cancel reverses nothing again)', async () => {
    const { tx, created, balanceUpdates } = makeBook([
      ...carriedSetOffs(),
      ...pairRows(5, NOTE_ID, 590),
    ]);
    await reverseBillAdjustmentsWith(tx, makeContext(), NOTE, REASON, ACTOR, NOW);
    created.length = 0;
    balanceUpdates.length = 0;

    const again = await reverseBillAdjustmentsWith(tx, makeContext(), NOTE, REASON, ACTOR, NOW);

    expect(again.toString()).toBe('0');
    expect(created).toHaveLength(0);
    expect(balanceUpdates).toHaveLength(0);
  });

  it("leaves a receipt's set-off of the note (it carries the receipt's voucher) alone", async () => {
    const { tx, created, balanceUpdates } = makeBook([
      ...carriedSetOffs(),
      ...pairRows(5, NOTE_ID, 200, { abjVoucherId: RECEIPT_VOUCHER_ID }),
    ]);

    const off = await reverseBillAdjustmentsWith(tx, makeContext(), NOTE, REASON, ACTOR, NOW);

    expect(off.toString()).toBe('0');
    expect(created).toHaveLength(0);
    expect(balanceUpdates).toHaveLength(0);
  });

  it('skips a row reversed already in another year (ux_abj_reversal is per partition)', async () => {
    const pair = pairRows(5, NOTE_ID, 590);
    const { tx, created, balanceUpdates } = makeBook([
      ...pair,
      // only the credit-side row was reversed by an earlier run
      {
        ...pair[1],
        abjId: 'rev-6',
        abjRowNo: 7,
        abjAmount: new Prisma.Decimal(-590),
        abjReversalOfId: 'row-6',
      },
    ]);

    const off = await reverseBillAdjustmentsWith(tx, makeContext(), NOTE, REASON, ACTOR, NOW);

    expect(off.toString()).toBe('590');
    expect(created.map((row) => row.abjReversalOfId)).toEqual(['row-5']);
    expect(updateOf(balanceUpdates, BILL_ID)).toHaveLength(1);
    expect(updateOf(balanceUpdates, NOTE_ID)).toHaveLength(0);
  });

  it('clips the reason to the column (250)', async () => {
    const { tx, created } = makeBook(pairRows(1, NOTE_ID, 10));
    await reverseBillAdjustmentsWith(tx, makeContext(), NOTE, 'x'.repeat(300), ACTOR, NOW);
    expect((created[0].abjReversalReason as string).length).toBe(250);
  });
});
