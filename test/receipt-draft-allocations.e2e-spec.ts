// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * A DRAFT now remembers its bill-wise settlement (2026-09-18).
 *
 * The acceptance, in the words it was asked in: save a draft with two
 * allocations; reopen it; /get returns both in allocations[].
 * `acc_bill_adjustment` has no row for that voucher and the bills'
 * `abl_pending_amount` is unchanged. Post it and the allocations that take
 * effect are the ones in the /post payload.
 *
 * **R10 is the thing under test as much as the feature is.** Every case here
 * checks that nothing reached a bill: the allocation is remembered, not
 * applied, and a draft that touches a bill would break the two properties R10
 * exists for — two people holding drafts against the same party, and an
 * abandoned draft needing no cleanup.
 *
 * This suite WRITES: it creates drafts and deletes them, and posts exactly one
 * receipt which it then cancels. It never touches a receipt it did not create.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const CREATE = '/api/v1/receipts/create';
const GET = '/api/v1/receipts/get';
const POST = '/api/v1/receipts/post';
const CANCEL = '/api/v1/receipts/cancel';
const DELETE = '/api/v1/receipts/delete';
const BEARER = 'Bearer dummy-test-token';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab'; // Acme Foods - Coimbatore Branch
const ACC_YEAR = '2026-2027';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1 (SUPER ADMIN)

const prisma = new PrismaClient();

interface Bill {
  billId: string;
  billAccYear: string;
  docRefno: string;
}

interface Fixtures {
  partyId: string;
  tenderId: string;
  tenderTypeId: number;
  tenderLedgerId: string | null;
  /** Two open bills of ONE party — the acceptance asks for two allocations. */
  bills: Bill[];
}

jest.setTimeout(180_000);

describe('a DRAFT remembers its bill allocation (e2e, live DB)', () => {
  let app: INestApplication;
  let fx: Fixtures;
  const created: string[] = [];

  const pendingOf = async (bill: Bill): Promise<number> => {
    const [row] = await prisma.$queryRawUnsafe<Array<{ pending: string }>>(
      `SELECT abl_pending_amount::text AS pending
         FROM accounts.acc_bill_balance
        WHERE abl_id = $1::uuid AND abl_acc_year = $2::bpchar`,
      bill.billId,
      bill.billAccYear,
    );
    return Number(row.pending);
  };

  const adjustmentRowsFor = async (voucherId: string): Promise<number> => {
    const [row] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM accounts.acc_bill_adjustment WHERE abj_voucher_id = $1::uuid`,
      voucherId,
    );
    return Number(row.n);
  };

  beforeAll(async () => {
    // CASH deliberately — every other tender type needs a reference, and a
    // cheque needs an instrument date and a bank. None of that is under test.
    const [tender] = await prisma.$queryRawUnsafe<
      Array<{ tnd_id: string; tnd_type_id: number; tnd_ledger_id: string | null }>
    >(
      `SELECT t.tnd_id, t.tnd_type_id, t.tnd_ledger_id
         FROM accounts.acc_tender_master t
         JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
        WHERE t.tnd_is_deleted = false AND t.tnd_is_active = true
          AND y.ttm_is_cash = true
          AND (t.tnd_company_id IS NULL OR t.tnd_company_id = $1::uuid)
        ORDER BY t.tnd_is_default DESC
        LIMIT 1`,
      COMPANY,
    );

    // One party holding at least two open receivables, taken from the database
    // so the suite survives the dev data moving on.
    const bills = await prisma.$queryRawUnsafe<
      Array<{ abl_party_id: string; abl_id: string; abl_acc_year: string; abl_doc_refno: string }>
    >(
      `SELECT b.abl_party_id, b.abl_id, b.abl_acc_year, b.abl_doc_refno
         FROM accounts.acc_bill_balance b
        WHERE b.abl_company_id = $1::uuid
          AND b.abl_dr_cr = 'DR'
          AND b.abl_is_deleted = false AND b.abl_is_active = true
          AND b.abl_pending_amount >= 1000
          AND b.abl_bill_type IN ('SALES','OPENING','INTEREST','JOURNAL','PURCHASE_RETURN')
          AND b.abl_party_id = (
                SELECT x.abl_party_id
                  FROM accounts.acc_bill_balance x
                 WHERE x.abl_company_id = $1::uuid AND x.abl_dr_cr = 'DR'
                   AND x.abl_is_deleted = false AND x.abl_is_active = true
                   AND x.abl_pending_amount >= 1000
                 GROUP BY x.abl_party_id HAVING count(*) >= 2 LIMIT 1)
        ORDER BY b.abl_doc_refno
        LIMIT 2`,
      COMPANY,
    );

    fx = {
      partyId: bills[0].abl_party_id,
      tenderId: tender.tnd_id,
      tenderTypeId: tender.tnd_type_id,
      tenderLedgerId: tender.tnd_ledger_id,
      bills: bills.map((row) => ({
        billId: row.abl_id,
        billAccYear: row.abl_acc_year,
        docRefno: row.abl_doc_refno,
      })),
    };

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-test-session',
      user_type: 'SUPER ADMIN',
      company_id: COMPANY,
      branch_id: BRANCH,
      device_id: null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (_t: string): AccessTokenPayload => claims })
      .overrideProvider(AuthSessionService)
      .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror src/main.ts so the route, validation and errors behave as live.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: process.env.API_VERSION ?? '1',
    });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
  });

  afterAll(async () => {
    // Every draft this suite made, thrown away. A draft took no number and
    // touched no bill, so this leaves nothing behind.
    for (const voucherId of created) {
      await request(app.getHttpServer()).post(DELETE).set('Authorization', BEARER).send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
      });
    }
    await app?.close();
    await prisma.$disconnect();
  });

  const today = (): string => new Date().toISOString().slice(0, 10);

  const saveDraft = async (
    body: Record<string, unknown>,
    voucherId?: string,
    tenderAmount = 300,
  ): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send({
        ...(voucherId ? { avhVoucherId: voucherId } : {}),
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        avhVoucherDate: today(),
        avhPartyId: fx.partyId,
        avhUserId: ACTOR,
        tenders: [
          {
            tdRowNo: 1,
            tdTenderId: fx.tenderId,
            tdTenderTypeId: fx.tenderTypeId,
            ...(fx.tenderLedgerId ? { tdTenderLedgerId: fx.tenderLedgerId } : {}),
            tdAmount: tenderAmount,
            // ck_td_cash_change: received − change must equal tdAmount.
            tdReceivedAmt: tenderAmount,
            tdChangeAmt: 0,
          },
        ],
        ...body,
      });

    expect(response.status).toBe(201);
    const id = response.body.data.header.avhVoucherId as string;
    if (!created.includes(id)) {
      created.push(id);
    }
    return id;
  };

  const getReceipt = async (voucherId: string) =>
    request(app.getHttpServer()).get(GET).set('Authorization', BEARER).query({
      avhVoucherId: voucherId,
      avhCompanyId: COMPANY,
      avhBranchId: BRANCH,
      avhAccYear: ACC_YEAR,
    });

  // ── The acceptance, as written ──────────────────────────────────────────

  it('returns both allocations on reopen, and moves no bill', async () => {
    const [first, second] = fx.bills;
    const pendingBefore = [await pendingOf(first), await pendingOf(second)];

    const voucherId = await saveDraft({
      allocations: [
        { billId: first.billId, billAccYear: first.billAccYear, amount: 200 },
        { billId: second.billId, billAccYear: second.billAccYear, amount: 100 },
      ],
    });

    const reopened = await getReceipt(voucherId);
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.header.avhVoucherStatus).toBe('DRAFT');

    const allocations = reopened.body.data.allocations as Array<{
      billId: string;
      billAccYear: string;
      amount: number;
      docRefno: string;
      abjId: string | null;
    }>;

    expect(allocations).toHaveLength(2);
    expect(allocations.map((row) => [row.billId, row.amount])).toEqual([
      [first.billId, 200],
      [second.billId, 100],
    ]);
    // The bill is looked up so the row can label itself — a convenience, not a
    // validation.
    expect(allocations[0].docRefno).toBe(first.docRefno);
    // No adjustment row exists, and that null is the signal.
    expect(allocations.every((row) => row.abjId === null)).toBe(true);

    // R10, which is as much under test as the feature: nothing reached a bill.
    expect(await adjustmentRowsFor(voucherId)).toBe(0);
    expect([await pendingOf(first), await pendingOf(second)]).toEqual(pendingBefore);
  });

  it('expands a discount and a write-off into their own rows, as a post would', async () => {
    const [first] = fx.bills;
    const voucherId = await saveDraft({
      allocations: [
        {
          billId: first.billId,
          billAccYear: first.billAccYear,
          amount: 200,
          discount: 25,
          writeoff: 10,
          writeoffApprovedBy: ACTOR,
        },
      ],
    });

    const reopened = await getReceipt(voucherId);
    const rows = reopened.body.data.allocations as Array<{
      adjType: string;
      amount: number;
      approvedBy: string | null;
    }>;

    expect(rows.map((row) => [row.adjType, row.amount])).toEqual([
      ['ALLOCATION', 200],
      ['DISCOUNT', 25],
      ['WRITEOFF', 10],
    ]);
    // Remembered as the operator left it; the approver rule bites at POST.
    expect(rows[2].approvedBy).toBe(ACTOR);
    expect(await adjustmentRowsFor(voucherId)).toBe(0);
  });

  it('remembers a stale figure rather than refusing the draft', async () => {
    const [first] = fx.bills;
    const pending = await pendingOf(first);
    const absurd = pending + 1_000_000;

    // Far more than the bill can take, and a write-off with no approver —
    // both of which /post refuses. Neither may cost the operator the draft.
    const voucherId = await saveDraft({
      allocations: [
        {
          billId: first.billId,
          billAccYear: first.billAccYear,
          amount: absurd,
          writeoff: 50,
        },
      ],
    });

    const reopened = await getReceipt(voucherId);
    const rows = reopened.body.data.allocations as Array<{ amount: number; adjType: string }>;
    expect(rows[0].amount).toBe(absurd);
    expect(await pendingOf(first)).toBe(pending);
  });

  it('leaves the remembered rows alone when the key is omitted, and clears them on []', async () => {
    const [first] = fx.bills;
    const voucherId = await saveDraft({
      allocations: [{ billId: first.billId, billAccYear: first.billAccYear, amount: 150 }],
    });

    // An ordinary save from a client that has never heard of the field must
    // not wipe what the operator arranged.
    await saveDraft({ avhRemarks: 'no allocations key at all' }, voucherId);
    let reopened = await getReceipt(voucherId);
    expect(reopened.body.data.allocations).toHaveLength(1);
    expect(reopened.body.data.header.avhRemarks).toBe('no allocations key at all');

    // An explicit empty array is the way to clear them.
    await saveDraft({ allocations: [] }, voucherId);
    reopened = await getReceipt(voucherId);
    expect(reopened.body.data.allocations).toHaveLength(0);
  });

  it('remembers ticked credits, naming the credit itself', async () => {
    const [credit] = await prisma.$queryRawUnsafe<
      Array<{ abl_id: string; abl_acc_year: string; abl_party_id: string; abl_bill_type: string }>
    >(
      `SELECT abl_id, abl_acc_year, abl_party_id, abl_bill_type
         FROM accounts.acc_bill_balance
        WHERE abl_company_id = $1::uuid AND abl_dr_cr = 'CR'
          AND abl_is_deleted = false AND abl_is_active = true AND abl_pending_amount > 0
          AND abl_bill_type IN ('ADVANCE','SALES_RETURN','OPENING','JOURNAL')
        LIMIT 1`,
      COMPANY,
    );
    if (!credit) {
      // eslint-disable-next-line no-console
      console.warn('[draft allocations] no open credit in this database — nothing to check');
      return;
    }

    const voucherId = await saveDraft({
      avhPartyId: credit.abl_party_id,
      creditsApplied: [{ billId: credit.abl_id, billAccYear: credit.abl_acc_year, amount: 50 }],
    });

    const reopened = await getReceipt(voucherId);
    const rows = reopened.body.data.creditsApplied as Array<{
      billId: string;
      againstBillId: string | null;
      amount: number;
      abjId: string | null;
    }>;

    expect(rows).toHaveLength(1);
    // On a DRAFT the row names the CREDIT, because which invoices it settles is
    // the allocation engine's decision at post.
    expect(rows[0].billId).toBe(credit.abl_id);
    expect(rows[0].againstBillId).toBeNull();
    expect(rows[0].abjId).toBeNull();
    expect(await adjustmentRowsFor(voucherId)).toBe(0);
  });

  // ── The other half of the acceptance ────────────────────────────────────

  it('posts the /post payload, not the remembered one', async () => {
    const [first, second] = fx.bills;
    const firstBefore = await pendingOf(first);
    const secondBefore = await pendingOf(second);

    // A token amount on purpose. These bills carry four figures of pending and
    // the sibling suites move 100 at a time against the same party, so a
    // concurrent settle cannot make this overshoot and turn the post into the
    // 409 it correctly gives when a bill has less left than the payload claims.
    const AMOUNT = 5;

    // The draft remembers the whole amount against the FIRST bill...
    const voucherId = await saveDraft(
      { allocations: [{ billId: first.billId, billAccYear: first.billAccYear, amount: AMOUNT }] },
      undefined,
      AMOUNT,
    );

    // ...and the post says the whole amount against the SECOND. The post
    // payload is the instruction; the draft copy is a note to the screen.
    const posted = await request(app.getHttpServer())
      .post(POST)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        allocations: [{ billId: second.billId, billAccYear: second.billAccYear, amount: AMOUNT }],
        onAccount: 0,
      });
    expect(posted.status).toBe(201);

    // Deltas, not absolutes: another suite may settle and reopen 100 against
    // the same party while this runs, and that is not this test's business.
    expect(await pendingOf(first)).toBeCloseTo(firstBefore, 2);
    expect(await pendingOf(second)).toBeCloseTo(secondBefore - AMOUNT, 2);

    // And a POSTED receipt answers from its real adjustment rows, with real ids.
    const reopened = await getReceipt(voucherId);
    const rows = reopened.body.data.allocations as Array<{
      billId: string;
      abjId: string | null;
    }>;
    expect(rows.every((row) => row.abjId !== null)).toBe(true);
    expect(rows.some((row) => row.billId === second.billId)).toBe(true);

    const cancelled = await request(app.getHttpServer())
      .post(CANCEL)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        reason: 'E2E — draft allocation suite tidy up',
      });
    expect(cancelled.status).toBe(201);
    expect(await pendingOf(second)).toBeCloseTo(secondBefore, 2);

    // It is posted-then-cancelled, so /delete cannot take it: drop it from the
    // teardown list rather than letting that fail noisily.
    created.splice(created.indexOf(voucherId), 1);
  });
});
