import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  ACC_YEAR,
  BEARER,
  BRANCH,
  COMPANY,
  bankTender,
  bootApp,
  chequeTender,
  createAndPost,
  data,
  draftBody,
  expectStatus,
  ISSUED_CHEQUES_MENU,
  loadMasters,
  PAYMENT_MENU,
  PaymentFixtures,
  prisma,
  today,
  type Masters,
} from './helpers/payment-e2e';

/**
 * notes (64) — an issued cheque whose money went ON ACCOUNT, unwound on the
 * Issued Cheques screen (menu 52).
 *
 * A `/payments/post` remainder settles no bill: it is an ADVANCE (DR) bill,
 * and the cheque has no `acc_bill_adjustment` row for it. The unwind used to
 * reverse only those rows, so the ChqBnc voucher put the ledger back while the
 * ADVANCE still said the supplier held our money, and the books check refused
 * the stop. Now the cheque's on-account share comes off the ADVANCE:
 *
 *   · wholly on account — the ADVANCE is settled in full by the ChqBnc
 *     voucher's credit to the party, and the party reconciles;
 *   · the ADVANCE already spent by a later payment — refused, naming it, and
 *     the cheque stays HELD;
 *   · part to a bill, part on account — the bill reopens by its part and the
 *     ADVANCE by the rest.
 *
 * `/returned` shares the unwind, so every case runs for both routes. The
 * routes are the real ones: the suite grants tester1 menu 52 as well as 100.
 */

jest.setTimeout(240_000);

let app: INestApplication;
let masters: Masters;
const fixtures = new PaymentFixtures();

const api = () => request(app.getHttpServer());

beforeAll(async () => {
  await fixtures.grantRights([PAYMENT_MENU, ISSUED_CHEQUES_MENU]);
  masters = await loadMasters();
  app = await bootApp();
});

afterAll(async () => {
  await fixtures.teardown();
  await app?.close();
  await prisma.$disconnect();
});

interface PostedCheque {
  apdId: string;
  apdAccYear: string;
  leaf: string;
}

interface IssuedCheque {
  status: string;
  reversalVoucherId: string | null;
  reversalAccYear: string | null;
}

/** `accounts.fn_party_bill_reconcile` — the ledger and the open bills, side by side. */
async function reconcile(
  partyId: string,
): Promise<{ ledger: number; bills: number; diff: number }> {
  const [row] = await prisma.$queryRawUnsafe<
    Array<{ ledger_bal: string; bills_bal: string; diff: string }>
  >(
    `SELECT ledger_bal::text, bills_bal::text, diff::text
       FROM accounts.fn_party_bill_reconcile($1::uuid, $2::uuid, $3::char(9))`,
    COMPANY,
    partyId,
    ACC_YEAR,
  );
  return { ledger: Number(row.ledger_bal), bills: Number(row.bills_bal), diff: Number(row.diff) };
}

async function pending(billId: string): Promise<number> {
  return Number((await fixtures.billRow(billId)).ablPendingAmount);
}

/** A payment by one cheque, from a fresh book. */
async function payByCheque(
  partyId: string,
  amount: number,
  post: {
    allocations: Array<{ billId: string; billAccYear: string; amount: number }>;
    onAccount: number;
  },
) {
  const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);
  const { voucherId, posted } = await createAndPost(
    app,
    fixtures,
    draftBody(partyId, [chequeTender(masters, amount, book.chequeBookId)]),
    post,
  );
  expectStatus(posted, 201);
  const body = data<{
    header: { avhVoucherRefno: string };
    cheques: PostedCheque[];
    advanceBills: Array<{ billId: string }>;
  }>(posted);
  return {
    voucherId,
    refno: body.header.avhVoucherRefno,
    cheque: body.cheques[0],
    advanceId: body.advanceBills[0]?.billId ?? null,
  };
}

describe.each([
  { verb: 'stop' as const, landsIn: 'CANCELLED' },
  { verb: 'returned' as const, landsIn: 'BOUNCED' },
])('/issued-cheques/$verb on a cheque paid on account (notes 64)', ({ verb, landsIn }) => {
  const unwind = (cheque: PostedCheque) =>
    api()
      .post(`/api/v1/issued-cheques/${verb}`)
      .set('Authorization', BEARER)
      .send({
        apdId: cheque.apdId,
        apdAccYear: cheque.apdAccYear,
        companyId: COMPANY,
        branchId: BRANCH,
        date: today(),
        reason: `E2E notes 64 — ${verb}`,
      });

  /** The reversal voucher, kept for the teardown, and its bill rows. */
  async function reversalOf(res: request.Response) {
    const issued = data<IssuedCheque>(res);
    expect(issued.status).toBe(landsIn);
    expect(issued.reversalVoucherId).not.toBeNull();
    fixtures.vouchers.push(issued.reversalVoucherId as string);
    return {
      voucherId: issued.reversalVoucherId as string,
      legs: await fixtures.legsOf(issued.reversalVoucherId as string),
      adjustments: await fixtures.adjustmentsOf(issued.reversalVoucherId as string),
    };
  }

  it('wholly on account: the ADVANCE is taken back and the party reconciles', async () => {
    const partyId = await fixtures.createParty(`OA-${verb}`);
    const paid = await payByCheque(partyId, 10, { allocations: [], onAccount: 10 });
    expect(paid.advanceId).not.toBeNull();
    expect(await pending(paid.advanceId!)).toBe(10);
    expect(
      await prisma.accBillAdjustment.count({ where: { abjChequeId: paid.cheque.apdId } }),
    ).toBe(0);
    expect(await reconcile(partyId)).toMatchObject({ ledger: 10, bills: 10, diff: 0 });

    const res = await unwind(paid.cheque);
    expectStatus(res, 200);
    const reversal = await reversalOf(res);

    // DR bank / CR party, the whole cheque.
    expect(reversal.legs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ drCr: 'DR', ledgerId: masters.bankLedgerId, amount: 10 }),
        expect.objectContaining({ drCr: 'CR', ledgerId: partyId, amount: 10 }),
      ]),
    );
    // The credit settles the ADVANCE: one ALLOCATION row, CR, on the ChqBnc voucher.
    expect(reversal.adjustments).toEqual([
      expect.objectContaining({
        billId: paid.advanceId,
        adjType: 'ALLOCATION',
        mode: 'CHEQUE',
        drCr: 'CR',
        amount: 10,
        reversalOfId: null,
      }),
    ]);
    const advance = await fixtures.billRow(paid.advanceId!);
    expect(Number(advance.ablPendingAmount)).toBe(0);
    expect(advance.ablIsDeleted).toBe(false);
    expect(await reconcile(partyId)).toMatchObject({ ledger: 0, bills: 0, diff: 0 });
  });

  it('refuses once another payment has spent the ADVANCE, naming it; the cheque stays HELD', async () => {
    const partyId = await fixtures.createParty(`OA-SPENT-${verb}`);
    const paid = await payByCheque(partyId, 10, { allocations: [], onAccount: 10 });
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 15);
    const spender = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 5)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 15 }],
        creditsApplied: [{ billId: paid.advanceId, billAccYear: ACC_YEAR, amount: 10 }],
        onAccount: 0,
      },
    );
    expectStatus(spender.posted, 201);
    const spenderRefno = data<{ header: { avhVoucherRefno: string } }>(spender.posted).header
      .avhVoucherRefno;
    expect(await pending(paid.advanceId!)).toBe(0);
    const before = await reconcile(partyId);
    expect(before.diff).toBe(0);

    const res = await unwind(paid.cheque);
    expectStatus(res, 409);
    const body = JSON.stringify(res.body);
    expect(body).toContain('VCH_ADVANCE_SPENT');
    expect(body).toContain(paid.cheque.leaf);
    expect(body).toContain(spenderRefno);

    // Nothing moved.
    const leaf = await prisma.accPdcRegister.findFirstOrThrow({
      where: { apdId: paid.cheque.apdId },
      select: { apdStatus: true, apdBounceVoucherId: true },
    });
    expect(leaf).toEqual({ apdStatus: 'HELD', apdBounceVoucherId: null });
    expect(await reconcile(partyId)).toEqual(before);
  });

  it('part to a bill, part on account: the bill reopens by 10, the ADVANCE by 5', async () => {
    const partyId = await fixtures.createParty(`OA-MIXED-${verb}`);
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10);
    const paid = await payByCheque(partyId, 15, {
      allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10 }],
      onAccount: 5,
    });
    expect(await pending(bill.billId)).toBe(0);
    expect(await pending(paid.advanceId!)).toBe(5);
    expect((await reconcile(partyId)).diff).toBe(0);

    const res = await unwind(paid.cheque);
    expectStatus(res, 200);
    const reversal = await reversalOf(res);

    expect(reversal.legs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ drCr: 'DR', ledgerId: masters.bankLedgerId, amount: 15 }),
        expect.objectContaining({ drCr: 'CR', ledgerId: partyId, amount: 15 }),
      ]),
    );
    // The bill's allocation reversed (a negative row), the ADVANCE settled (a positive one).
    expect(reversal.adjustments).toHaveLength(2);
    expect(reversal.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ billId: bill.billId, amount: -10 }),
        expect.objectContaining({
          billId: paid.advanceId,
          adjType: 'ALLOCATION',
          drCr: 'CR',
          amount: 5,
          reversalOfId: null,
        }),
      ]),
    );
    expect(await pending(bill.billId)).toBe(10);
    expect(await pending(paid.advanceId!)).toBe(0);
    expect(await reconcile(partyId)).toMatchObject({ ledger: -10, bills: -10, diff: 0 });
  });
});
