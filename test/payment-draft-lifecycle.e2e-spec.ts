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
  data,
  expectStatus,
  draftBody,
  keys,
  loadMasters,
  PaymentFixtures,
  prisma,
  ROUTES,
  today,
  type Masters,
  PAYMENT_MENU,
} from './helpers/payment-e2e';
import { TESTER1 } from './helpers/menu-rights';

/**
 * Plan "Payment (menu 100)" rev 2 §7 — the DRAFT half of the receipt's
 * suites, mirrored: a draft is saved, remembered, walked, checked for a
 * double key, edited on the header, and thrown away. Nothing here posts.
 *
 * Plus the one refusal the receipt does not have (§5 step 1, D1): a cash or
 * bank ledger is not a payee — that is a Contra.
 *
 * Writes only its own rows and removes them in `afterAll`.
 */

jest.setTimeout(120_000);

let app: INestApplication;
let masters: Masters;
const fixtures = new PaymentFixtures();
let partyId: string;
let bill: { billId: string; billAccYear: string; docRefno: string };

const api = () => request(app.getHttpServer());

beforeAll(async () => {
  await fixtures.grantRights([PAYMENT_MENU]);
  masters = await loadMasters();
  partyId = await fixtures.createParty('DRAFT');
  bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);
  app = await bootApp();
});

afterAll(async () => {
  await fixtures.teardown();
  await app?.close();
  await prisma.$disconnect();
});

const createDraft = async (
  amount: number,
  extra: Record<string, unknown> = {},
): Promise<{ voucherId: string; body: request.Response['body'] }> => {
  const res = await api()
    .post(ROUTES.create)
    .set('Authorization', BEARER)
    .send(draftBody(partyId, [bankTender(masters, amount)], extra));
  expectStatus(res, 201);
  const voucherId = data<{ header: { avhVoucherId: string } }>(res).header.avhVoucherId;
  fixtures.vouchers.push(voucherId);
  return { voucherId, body: res.body };
};

describe('POST /payments/create — the draft (e2e, live DB)', () => {
  it('saves a DRAFT with no number, tender rows CR, and nothing in the books (R10)', async () => {
    const { voucherId, body } = await createDraft(4_000, {
      avhRemarks: 'E2E payment draft',
    });
    const payload = body.data as {
      header: {
        avhVoucherStatus: string;
        avhVoucherRefno: string | null;
        avhPartyId: string;
        avhDocAmount: number;
      };
      tenders: Array<{ tdAmount: number; tdTenderTypeId: number; beneficiary: unknown }>;
      otherLines: unknown[];
      expectedRoles: string[];
    };

    expect(payload.header.avhVoucherStatus).toBe('DRAFT');
    expect(payload.header.avhVoucherRefno).toBeNull();
    expect(payload.header.avhPartyId).toBe(partyId);
    expect(payload.header.avhDocAmount).toBeCloseTo(4_000, 2);
    expect(payload.tenders).toHaveLength(1);
    expect(payload.tenders[0].tdAmount).toBeCloseTo(4_000, 2);
    // A party with no TDS flag has nothing seeded and nothing expected.
    expect(payload.otherLines).toEqual([]);
    expect(payload.expectedRoles).toEqual([]);

    // The tender row is money OUT and files under the payment's document type.
    const tenders = await prisma.accTenderDetail.findMany({
      where: { tdSrcDocId: voucherId, tdIsDeleted: false },
      select: { tdDrCr: true, tdSrcDocType: true, tdVoucherId: true },
    });
    expect(tenders).toHaveLength(1);
    expect(tenders[0].tdDrCr).toBe('CR');
    expect(tenders[0].tdSrcDocType).toBe('PAYMENT');
    expect(tenders[0].tdVoucherId).toBeNull();

    // R10: no leg, no adjustment row, the bill untouched.
    expect(await prisma.accVoucher.count({ where: { avVoucherId: voucherId } })).toBe(0);
    expect(await prisma.accBillAdjustment.count({ where: { abjVoucherId: voucherId } })).toBe(0);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBeCloseTo(10_000, 2);
  });

  it('refuses a cash or bank ledger as the payee — that is a Contra (D1, §5 step 1)', async () => {
    const res = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(draftBody(masters.aCashLedgerId, [bankTender(masters, 100)]));

    expectStatus(res, 400);
    expect(JSON.stringify(res.body)).toContain('Contra');
  });

  it('remembers the bill-wise settlement (notes 30) and hands it back on /get, applying nothing', async () => {
    const { voucherId } = await createDraft(6_000, {
      allocations: [
        { billId: bill.billId, billAccYear: bill.billAccYear, amount: 5_500, discount: 500 },
      ],
    });

    const res = await api().get(ROUTES.get).query(keys(voucherId)).set('Authorization', BEARER);
    expectStatus(res, 200);
    const payment = data<{
      header: { avhVoucherStatus: string };
      allocations: Array<{ abjId: string | null; billId: string; adjType: string; amount: number }>;
      legs: unknown[];
      chequesIssued: unknown[];
      pdcVouchers: unknown[];
      advanceBills: unknown[];
    }>(res);

    expect(payment.header.avhVoucherStatus).toBe('DRAFT');
    // A remembered row has no adjustment row behind it, and the discount is
    // expanded into its own row exactly as a post would write it.
    expect(payment.allocations.map((row) => [row.adjType, row.amount, row.abjId])).toEqual(
      expect.arrayContaining([
        ['ALLOCATION', 5_500, null],
        ['DISCOUNT', 500, null],
      ]),
    );
    expect(payment.allocations.every((row) => row.billId === bill.billId)).toBe(true);
    expect(payment.legs).toEqual([]);
    expect(payment.chequesIssued).toEqual([]);
    expect(payment.pdcVouchers).toEqual([]);
    expect(payment.advanceBills).toEqual([]);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBeCloseTo(10_000, 2);
  });

  it('refuses DISCOUNT_RECEIVED as an other-line — it rides on allocations[].discount', async () => {
    const res = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [bankTender(masters, 1_000)], {
          otherLines: [{ role: 'DISCOUNT_RECEIVED', drCr: 'CR', amount: 50 }],
        }),
      );
    expectStatus(res, 400);
  });
});

describe('GET /payments/duplicate-check — R-B6, mirrored', () => {
  it('warns about a draft of the same amount to the same party today, unless it is excluded', async () => {
    const amount = 1_234.56;
    const { voucherId } = await createDraft(amount);

    const query = {
      partyId,
      companyId: COMPANY,
      accYear: ACC_YEAR,
      voucherDate: today(),
      amount,
    };
    const hit = await api().get(ROUTES.duplicateCheck).query(query).set('Authorization', BEARER);
    expectStatus(hit, 200);
    const found = data<{ isDuplicate: boolean; matches: Array<{ voucherId: string }> }>(hit);
    expect(found.isDuplicate).toBe(true);
    expect(found.matches.map((row) => row.voucherId)).toContain(voucherId);

    const excluded = await api()
      .get(ROUTES.duplicateCheck)
      .query({ ...query, excludeVoucherId: voucherId })
      .set('Authorization', BEARER);
    expectStatus(excluded, 200);
    expect(data<{ isDuplicate: boolean }>(excluded).isDuplicate).toBe(false);

    // A different amount is a different payment, to the paisa.
    const near = await api()
      .get(ROUTES.duplicateCheck)
      .query({ ...query, amount: amount + 0.01 })
      .set('Authorization', BEARER);
    expect(data<{ isDuplicate: boolean }>(near).isDuplicate).toBe(false);
  });
});

describe('GET /payments/adjacent — R-B4, mirrored', () => {
  it('walks from a draft to the one keyed just before it, and back', async () => {
    const first = await createDraft(11);
    const second = await createDraft(12);

    const prev = await api()
      .get(ROUTES.adjacent)
      .query({
        voucherId: second.voucherId,
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        direction: 'prev',
        status: 'DRAFT',
        fromDate: today(),
        toDate: today(),
      })
      .set('Authorization', BEARER);
    expectStatus(prev, 200);
    const before = data<{
      direction: string;
      fromVoucherId: string;
      voucher: { voucherId: string } | null;
    }>(prev);
    expect(before.direction).toBe('prev');
    expect(before.fromVoucherId).toBe(second.voucherId);
    expect(before.voucher?.voucherId).toBe(first.voucherId);

    const next = await api()
      .get(ROUTES.adjacent)
      .query({
        voucherId: first.voucherId,
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        direction: 'next',
        status: 'DRAFT',
        fromDate: today(),
        toDate: today(),
      })
      .set('Authorization', BEARER);
    expectStatus(next, 200);
    expect(data<{ voucher: { voucherId: string } | null }>(next).voucher?.voucherId).toBe(
      second.voucherId,
    );
  });

  it('is a 404 for a voucher outside the caller’s company / branch', async () => {
    const { voucherId } = await createDraft(13);
    const res = await api()
      .get(ROUTES.adjacent)
      .query({
        voucherId,
        companyId: COMPANY,
        branchId: '00000000-0000-4000-8000-000000000000',
        accYear: ACC_YEAR,
        direction: 'prev',
      })
      .set('Authorization', BEARER);
    expectStatus(res, 404);
  });
});

describe('PUT /payments/update-header — the whitelist (§4.7)', () => {
  it('changes the narration and references, and nothing else', async () => {
    const { voucherId } = await createDraft(21);

    const ok = await api()
      .put(ROUTES.updateHeader)
      .set('Authorization', BEARER)
      .send({
        ...keys(voucherId),
        avhRemarks: 'E2E — narration changed',
        avhDocRefno: 'SUP-INV-77',
        editRemark: 'E2E header edit',
      });
    expectStatus(ok, 200);
    const header = data<{ avhRemarks: string | null; avhDocRefno: string | null }>(ok);
    expect(header.avhRemarks).toBe('E2E — narration changed');
    expect(header.avhDocRefno).toBe('SUP-INV-77');

    // A body carrying money is refused, not silently ignored.
    const money = await api()
      .put(ROUTES.updateHeader)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), tenders: [], editRemark: 'E2E must be refused' });
    expectStatus(money, 400);

    // And the reason is mandatory.
    const noWhy = await api()
      .put(ROUTES.updateHeader)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), avhRemarks: 'no reason given' });
    expectStatus(noWhy, 400);
  });
});

describe('POST /payments/delete — throw a draft away', () => {
  it('soft-deletes a DRAFT with its tender rows, and reports what went', async () => {
    const { voucherId } = await createDraft(31);

    const res = await api().post(ROUTES.delete).set('Authorization', BEARER).send(keys(voucherId));
    expectStatus(res, 201);
    const gone = data<{ status: string; tendersDeleted: number; avhVoucherRefno: string | null }>(
      res,
    );
    expect(gone.status).toBe('DRAFT');
    expect(gone.tendersDeleted).toBe(1);
    expect(gone.avhVoucherRefno).toBeNull();

    const header = await fixtures.headerRow(voucherId);
    expect(header.avhIsDeleted).toBe(true);
    expect(header.avhVoucherStatus).toBe('DRAFT');
    expect(
      await prisma.accTenderDetail.count({ where: { tdSrcDocId: voucherId, tdIsDeleted: false } }),
    ).toBe(0);

    // Gone from every reader.
    const read = await api().get(ROUTES.get).query(keys(voucherId)).set('Authorization', BEARER);
    expectStatus(read, 404);
    const again = await api()
      .post(ROUTES.delete)
      .set('Authorization', BEARER)
      .send(keys(voucherId));
    expectStatus(again, 404);
  });

  it('is a 404 for a voucher outside the caller’s company / branch', async () => {
    const { voucherId } = await createDraft(32);
    const res = await api()
      .post(ROUTES.delete)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), avhBranchId: '00000000-0000-4000-8000-000000000000' });
    expectStatus(res, 404);
  });
});

describe('a reopened cheque draft keeps its book (notes 62 A3)', () => {
  it('answers cheque {} on the row from /create and /get, and saves again with it', async () => {
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);
    const created = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [
          chequeTender(masters, 1_250, book.chequeBookId, {
            cheque: { chequeBookId: book.chequeBookId, favouring: 'E2E FAVOURING', acPayee: false },
          }),
        ]),
      );
    expectStatus(created, 201);
    type Row = {
      tdRowNo: number;
      tdTenderId: string;
      tdTenderTypeId: number;
      tdAmount: number;
      tdBankName: string | null;
      cheque: {
        chequeBookId: string;
        bookNo: string | null;
        favouring: string | null;
        acPayee: boolean;
      } | null;
    };
    const draft = data<{ header: { avhVoucherId: string }; tenders: Row[] }>(created);
    fixtures.vouchers.push(draft.header.avhVoucherId);
    const expected = {
      chequeBookId: book.chequeBookId,
      bookNo: book.bookNo,
      favouring: 'E2E FAVOURING',
      acPayee: false,
    };
    expect(draft.tenders[0].cheque).toMatchObject(expected);

    const got = await api()
      .get(ROUTES.get)
      .query(keys(draft.header.avhVoucherId))
      .set('Authorization', BEARER);
    expectStatus(got, 200);
    const row = data<{ tenders: Row[] }>(got).tenders[0];
    expect(row.cheque).toMatchObject(expected);

    // What a reopened draft does: send back what it was given, book included.
    const { bookNo: _bookNo, ...cheque } = row.cheque!;
    const resaved = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(
          partyId,
          [
            {
              tdRowNo: row.tdRowNo,
              tdTenderId: row.tdTenderId,
              tdTenderTypeId: row.tdTenderTypeId,
              tdAmount: row.tdAmount,
              tdBankName: row.tdBankName,
              cheque: {
                chequeBookId: cheque.chequeBookId,
                favouring: cheque.favouring,
                acPayee: cheque.acPayee,
              },
            },
          ],
          { avhVoucherId: draft.header.avhVoucherId, avhRemarks: 'E2E — reopened and saved' },
        ),
      );
    expectStatus(resaved, 201);
    expect(data<{ tenders: Row[] }>(resaved).tenders[0].cheque).toMatchObject(expected);
  });
});

describe('GET /payments/open-items refuses mobile (notes 62 D3)', () => {
  it('is a 400 — the filter is the receipt’s temporary-credit lookup and has no payment side', async () => {
    const res = await api()
      .get(ROUTES.openItems)
      .query({ partyId, companyId: COMPANY, mobile: '9876543210' })
      .set('Authorization', BEARER);
    expectStatus(res, 400);
    expect(JSON.stringify(res.body)).toContain('mobile');
  });
});

describe('menu 100 rights (notes 62 D2)', () => {
  const setFlag = (flag: string, value: boolean) =>
    prisma.$executeRawUnsafe(
      `UPDATE public.user_menus SET ${flag} = $3
        WHERE um_user_id = $1::uuid AND um_menu_id = $2::int AND um_is_deleted = false`,
      TESTER1,
      PAYMENT_MENU,
      value,
    );

  it('refuses a post without um_can_post, naming the column, and posts once it is granted', async () => {
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 400);
    const { voucherId } = await createDraft(400);
    const post = () =>
      api()
        .post(ROUTES.post)
        .set('Authorization', BEARER)
        .send({
          ...keys(voucherId),
          allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 400 }],
          onAccount: 0,
        });

    await setFlag('um_can_post', false);
    try {
      const refused = await post();
      expectStatus(refused, 403);
      const body = JSON.stringify(refused.body);
      expect(body).toContain('PMT_RIGHT_POST');
      expect(body).toContain('um_can_post');
      expect((await fixtures.headerRow(voucherId)).avhVoucherStatus).toBe('DRAFT');
    } finally {
      await setFlag('um_can_post', true);
    }
    expectStatus(await post(), 201);
  });

  it('refuses every read without um_can_view', async () => {
    await setFlag('um_can_view', false);
    try {
      const res = await api()
        .get(ROUTES.openItems)
        .query({ partyId, companyId: COMPANY })
        .set('Authorization', BEARER);
      expectStatus(res, 403);
      expect(JSON.stringify(res.body)).toContain('PMT_RIGHT_VIEW');
    } finally {
      await setFlag('um_can_view', true);
    }
  });
});
