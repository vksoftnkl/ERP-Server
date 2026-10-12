import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  ACC_YEAR,
  ACTOR,
  BEARER,
  BRANCH,
  CASH_TENDER_TYPE,
  COMPANY,
  PAYMENT_MENU,
  PaymentFixtures,
  RECEIPT_MENU,
  ROUTES,
  bankTender,
  bootApp,
  data,
  draftBody,
  expectStatus,
  loadMasters,
  prisma,
  stamp,
  today,
  type Masters,
} from './helpers/payment-e2e';

/**
 * Notes 94 A + B / 106 — `/payments/create` and `/receipts/create` with
 * `post: true`: the draft and the post in ONE transaction, judged on the Post
 * right alone.
 *
 * The proof that matters is the refusal: a party that has never had a header
 * written for it, because the save rolled back with the post.
 */

jest.setTimeout(240_000);

const SUNDRY_DEBTORS_GROUP = '019eee86-f34b-7ddc-91e2-efca49e5e8e8';

class Fixtures extends PaymentFixtures {
  async createDebtor(tag: string): Promise<string> {
    const ledger = await prisma.accLedgerMaster.create({
      data: {
        ledCompanyId: COMPANY,
        ledGroupId: SUNDRY_DEBTORS_GROUP,
        ledName: `E2E-SP-RCT-${tag}-${stamp()}`,
        ledLedgerType: 'PARTY',
        ledIsBillByBill: true,
        ledIsActive: true,
        ledCreatedBy: ACTOR,
      },
      select: { ledId: true },
    });
    this.parties.push(ledger.ledId);
    return ledger.ledId;
  }
}

let app: INestApplication;
let masters: Masters;
const fixtures = new Fixtures();
const api = () => request(app.getHttpServer());

const headersOf = (partyId: string) =>
  prisma.accVoucherHeader.count({ where: { avhPartyId: partyId } });

beforeAll(async () => {
  await fixtures.grantRights([PAYMENT_MENU, RECEIPT_MENU]);
  masters = await loadMasters();
  app = await bootApp();
});

afterAll(async () => {
  await fixtures.teardown();
  await app?.close();
  await prisma.$disconnect();
});

describe('POST /payments/create with post: true (notes 94 B / 106)', () => {
  it('saves and posts in one call — DR party / CR bank, the bill closed', async () => {
    const partyId = await fixtures.createParty('ONECALL');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);
    const res = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [bankTender(masters, 10_000)], {
          post: true,
          allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
          onAccount: 0,
        }),
      );
    expectStatus(res, 201);
    const payload = data<{
      header: { avhVoucherId: string; avhVoucherStatus: string; avhVoucherRefno: string | null };
      numberedVouchers: unknown[];
      billsAfter: Array<{ billId: string; pendingAmount: number }>;
    }>(res);
    fixtures.vouchers.push(payload.header.avhVoucherId);
    expect(res.body.message).toMatch(/^Payment pmt\d+ posted$/i);
    expect(payload.header.avhVoucherStatus).toBe('POSTED');
    expect(payload.header.avhVoucherRefno).toMatch(/^pmt/i);
    expect(payload.numberedVouchers).toHaveLength(1);
    expect(payload.billsAfter).toEqual([
      expect.objectContaining({ billId: bill.billId, pendingAmount: 0 }),
    ]);
    const legs = await fixtures.legsOf(payload.header.avhVoucherId);
    expect(legs).toHaveLength(2);
    expect(await headersOf(partyId)).toBe(1);
  });

  it('a refused one-call leaves no header at all', async () => {
    const partyId = await fixtures.createParty('ONECALL-REFUSED');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);
    // onAccount disagrees with the allocation: the post's own identity check.
    const res = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [bankTender(masters, 10_000)], {
          post: true,
          allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
          onAccount: 5_000,
        }),
      );
    expect([400, 409, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(await headersOf(partyId)).toBe(0);
  });

  it('post: true without onAccount is a 400 naming the field, and nothing is saved', async () => {
    const partyId = await fixtures.createParty('ONECALL-NOONACC');
    const res = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(draftBody(partyId, [bankTender(masters, 1_000)], { post: true, allocations: [] }));
    expectStatus(res, 400);
    expect(res.body.errors?.[0]?.field).toBe('onAccount');
    expect(await headersOf(partyId)).toBe(0);
  });

  it('notes 94 A — a user with Post but not Create may raise a payment this way', async () => {
    const partyId = await fixtures.createParty('POST-ONLY');
    await prisma.$executeRaw`
      UPDATE public.user_menus SET um_can_create = false
       WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = ${PAYMENT_MENU}::int AND um_is_deleted = false`;
    try {
      const draft = await api()
        .post(ROUTES.create)
        .set('Authorization', BEARER)
        .send(draftBody(partyId, [bankTender(masters, 1_000)]));
      expectStatus(draft, 403);
      expect(draft.body.errors?.[0]?.code).toBe('PMT_RIGHT_CREATE');

      const res = await api()
        .post(ROUTES.create)
        .set('Authorization', BEARER)
        .send(
          draftBody(partyId, [bankTender(masters, 1_000)], {
            post: true,
            allocations: [],
            onAccount: 1_000,
          }),
        );
      expectStatus(res, 201);
      const payload = data<{ header: { avhVoucherId: string; avhVoucherStatus: string } }>(res);
      fixtures.vouchers.push(payload.header.avhVoucherId);
      expect(payload.header.avhVoucherStatus).toBe('POSTED');
    } finally {
      await prisma.$executeRaw`
        UPDATE public.user_menus SET um_can_create = true
         WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = ${PAYMENT_MENU}::int AND um_is_deleted = false`;
    }
  });
});

describe('POST /receipts/create with post: true (notes 94 B / 106)', () => {
  const RECEIPT_CREATE = '/api/v1/receipts/create';

  const cashTender = (amount: number) => ({
    tdRowNo: 1,
    tdTenderId: masters.cashTenderId,
    tdTenderTypeId: CASH_TENDER_TYPE,
    ...(masters.cashLedgerId ? { tdTenderLedgerId: masters.cashLedgerId } : {}),
    tdAmount: amount,
    tdReceivedAmt: amount,
    tdChangeAmt: 0,
  });

  it('saves and posts a cash receipt in one call, the bill closed', async () => {
    const partyId = await fixtures.createDebtor('ONECALL');
    const bill = await fixtures.createOpeningBill(partyId, 'DR', 2_500);
    const res = await api()
      .post(RECEIPT_CREATE)
      .set('Authorization', BEARER)
      .send({
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        avhVoucherDate: today(),
        avhPartyId: partyId,
        avhRemarks: 'E2E notes 106 one-call',
        avhUserId: ACTOR,
        tenders: [cashTender(2_500)],
        post: true,
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 2_500 }],
        onAccount: 0,
      });
    expectStatus(res, 201);
    const payload = data<{
      header: { avhVoucherId: string; avhVoucherStatus: string; avhVoucherRefno: string | null };
      billsAfter: Array<{ billId: string; pendingAmount: number }>;
    }>(res);
    fixtures.vouchers.push(payload.header.avhVoucherId);
    expect(res.body.message).toMatch(/^Receipt rct\d+ posted$/i);
    expect(payload.header.avhVoucherStatus).toBe('POSTED');
    expect(payload.billsAfter).toEqual([
      expect.objectContaining({ billId: bill.billId, pendingAmount: 0 }),
    ]);
    expect(await headersOf(partyId)).toBe(1);
  });

  it('a refused receipt one-call leaves no header', async () => {
    const partyId = await fixtures.createDebtor('ONECALL-REFUSED');
    const bill = await fixtures.createOpeningBill(partyId, 'DR', 2_500);
    const res = await api()
      .post(RECEIPT_CREATE)
      .set('Authorization', BEARER)
      .send({
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        avhVoucherDate: today(),
        avhPartyId: partyId,
        avhUserId: ACTOR,
        tenders: [cashTender(2_500)],
        post: true,
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 2_500 }],
        onAccount: 1_000,
      });
    expect([400, 409, 422]).toContain(res.status);
    expect(await headersOf(partyId)).toBe(0);
  });
});
