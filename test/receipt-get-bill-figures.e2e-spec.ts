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
 * N36 §3 — a loaded receipt carries the BILL's own figures (2026-09-19).
 *
 * The defect, in the words it was reported in: a posted receipt painted
 * `Bill amount 0.00 / Paid 0.00 / Pending 0.00`, and an "After" column of
 * `pending − settled` therefore read minus the settlement on every line. The
 * screen deliberately does NOT call `/receipts/open-items` for a posted
 * receipt — what a receipt shows is what it DID, not what the party owes today
 * — so `allocations[]` was the only place those figures could come from, and
 * it carried none of them.
 *
 * Also under test, from §1 of the same note: `reversalOfId` / `isReversed`,
 * which are what let a history view SHOW which correction undid which line.
 * `acc_bill_adjustment` never rewrites a row and never soft-deletes one, so an
 * amended receipt answers with the original row, its negative AND the
 * replacement.
 *
 * **This suite WRITES.** It posts its own receipt, amends it and cancels it,
 * leaving it CANCELLED — a clean terminal state — and it asserts the bill it
 * settles is back at the pending amount it started with.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const CREATE = '/api/v1/receipts/create';
const GET = '/api/v1/receipts/get';
const POST = '/api/v1/receipts/post';
const AMEND = '/api/v1/receipts/amend';
const CANCEL = '/api/v1/receipts/cancel';
const DELETE = '/api/v1/receipts/delete';
const BEARER = 'Bearer dummy-test-token';

// Real master rows on the dev database.
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab'; // Acme Foods - Coimbatore Branch
const ACC_YEAR = '2026-2027';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1 (SUPER ADMIN)

/** Settled by the first post; the amend drops it to AMENDED. */
const AMOUNT = 100;
const AMENDED = 60;

const prisma = new PrismaClient();

interface Bill {
  billId: string;
  billAccYear: string;
  partyId: string;
  docRefno: string;
}

interface StoredBill {
  billAmount: number;
  pendingAmount: number;
  dueDate: string | null;
  billType: string;
  status: string;
}

interface Allocation {
  abjId: string | null;
  billId: string;
  adjType: string;
  amount: number;
  billAmount: number | null;
  pendingAmount: number | null;
  dueDate: string | null;
  billType: string | null;
  status: string | null;
  reversalOfId: string | null;
  isReversed: boolean;
}

interface Fixtures {
  tenderId: string;
  tenderTypeId: number;
  tenderLedgerId: string | null;
  bill: Bill;
}

jest.setTimeout(180_000);

describe('GET /receipts/get — allocations carry the bill (e2e, live DB, writes)', () => {
  let app: INestApplication;
  let fx: Fixtures;
  let amendAllowed = false;

  /** The bill as the DATABASE has it, to check the payload against. */
  const storedBill = async (bill: Bill): Promise<StoredBill> => {
    const [row] = await prisma.$queryRawUnsafe<
      Array<{
        amount: string;
        pending: string;
        due: Date | null;
        bill_type: string;
        status: string;
      }>
    >(
      `SELECT abl_bill_amount::text     AS amount,
              abl_pending_amount::text  AS pending,
              abl_due_date              AS due,
              abl_bill_type             AS bill_type,
              abl_status                AS status
         FROM accounts.acc_bill_balance
        WHERE abl_id = $1::uuid AND abl_acc_year = $2::bpchar`,
      bill.billId,
      bill.billAccYear,
    );
    return {
      billAmount: Number(row.amount),
      pendingAmount: Number(row.pending),
      dueDate: row.due === null ? null : row.due.toISOString().slice(0, 10),
      billType: row.bill_type,
      status: row.status,
    };
  };

  beforeAll(async () => {
    // CASH deliberately: every other tender type needs a reference, and a
    // cheque additionally needs an instrument date and a bank. None of that is
    // what this suite is about.
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

    // Taken from the database rather than hard-coded so the suite survives the
    // dev data moving on.
    const [bill] = await prisma.$queryRawUnsafe<
      Array<{ abl_id: string; abl_acc_year: string; abl_party_id: string; abl_doc_refno: string }>
    >(
      `SELECT b.abl_id, b.abl_acc_year, b.abl_party_id, b.abl_doc_refno
         FROM accounts.acc_bill_balance b
         JOIN accounts.acc_ledger_master l ON l.led_id = b.abl_party_id
        WHERE b.abl_company_id = $1::uuid
          AND b.abl_dr_cr = 'DR'
          AND b.abl_is_deleted = false AND b.abl_is_active = true
          AND b.abl_pending_amount >= $2
          AND b.abl_bill_type IN ('SALES','OPENING','INTEREST','JOURNAL','PURCHASE_RETURN')
          AND l.led_is_active = true AND l.led_is_deleted = false
        ORDER BY b.abl_pending_amount DESC
        LIMIT 1`,
      COMPANY,
      AMOUNT,
    );

    fx = {
      tenderId: tender.tnd_id,
      tenderTypeId: tender.tnd_type_id,
      tenderLedgerId: tender.tnd_ledger_id,
      bill: {
        billId: bill.abl_id,
        billAccYear: bill.abl_acc_year,
        partyId: bill.abl_party_id,
        docRefno: bill.abl_doc_refno,
      },
    };

    // `/amend` is gated by a company setting. With it off every call is a 409
    // naming the key, so the history case says so rather than passing falsely.
    const [setting] = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT COALESCE(v.asv_value, d.asd_default_value) AS value
         FROM public.app_setting_def d
         LEFT JOIN public.app_setting_value v
                ON v.asv_setting_key = d.asd_key AND v.asv_company_id = $1::uuid
        WHERE d.asd_key = 'accounts.allow_posted_amend'
        LIMIT 1`,
      COMPANY,
    );
    amendAllowed = setting?.value === 'true';

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

    if (!amendAllowed) {
      // eslint-disable-next-line no-console
      console.warn(
        '[get bill figures e2e] accounts.allow_posted_amend is OFF for this company — the ' +
          'amend-history case cannot be reached.',
      );
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  // ── Building one receipt, the ordinary way ──────────────────────────────

  const today = (): string => new Date().toISOString().slice(0, 10);

  const draftBody = (amount: number, remark: string) => ({
    avhCompanyId: COMPANY,
    avhBranchId: BRANCH,
    avhAccYear: ACC_YEAR,
    avhVoucherDate: today(),
    avhPartyId: fx.bill.partyId,
    avhRemarks: remark,
    avhUserId: ACTOR,
    tenders: [
      {
        tdRowNo: 1,
        tdTenderId: fx.tenderId,
        tdTenderTypeId: fx.tenderTypeId,
        ...(fx.tenderLedgerId ? { tdTenderLedgerId: fx.tenderLedgerId } : {}),
        tdAmount: amount,
        // ck_td_cash_change: received − change must equal tdAmount.
        tdReceivedAmt: amount,
        tdChangeAmt: 0,
      },
    ],
  });

  const allocationFor = (amount: number) => ({
    billId: fx.bill.billId,
    billAccYear: fx.bill.billAccYear,
    amount,
  });

  const getReceipt = async (voucherId: string): Promise<Allocation[]> => {
    const response = await request(app.getHttpServer())
      .get(GET)
      .set('Authorization', BEARER)
      .query({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
      });
    expect(response.status).toBe(200);
    return response.body.data.allocations as Allocation[];
  };

  const createDraft = async (amount: number, remark: string): Promise<string> => {
    const draft = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send(draftBody(amount, remark));
    expect(draft.status).toBe(201);
    return draft.body.data.header.avhVoucherId as string;
  };

  const postReceipt = async (voucherId: string, amount: number) => {
    const posted = await request(app.getHttpServer())
      .post(POST)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        allocations: [allocationFor(amount)],
        onAccount: 0,
      });
    expect(posted.status).toBe(201);
  };

  const cancelReceipt = async (voucherId: string, reason: string) =>
    request(app.getHttpServer()).post(CANCEL).set('Authorization', BEARER).send({
      avhVoucherId: voucherId,
      avhCompanyId: COMPANY,
      avhBranchId: BRANCH,
      avhAccYear: ACC_YEAR,
      reason,
    });

  // ── §3 — the bill's own figures ─────────────────────────────────────────

  it('a POSTED receipt answers with the bill amount, the pending amount, the due date, the type and the status', async () => {
    const before = await storedBill(fx.bill);

    const voucherId = await createDraft(AMOUNT, 'E2E-N36 — bill figures on a posted receipt');
    await postReceipt(voucherId, AMOUNT);

    try {
      const rows = await getReceipt(voucherId);
      const settlement = rows.find((row) => row.adjType === 'ALLOCATION');
      expect(settlement).toBeDefined();

      const after = await storedBill(fx.bill);
      // The whole defect: these five were absent, so the grid painted 0.00.
      expect(settlement!.billAmount).toBeCloseTo(after.billAmount, 2);
      expect(settlement!.pendingAmount).toBeCloseTo(after.pendingAmount, 2);
      expect(settlement!.dueDate).toBe(after.dueDate);
      expect(settlement!.billType).toBe(after.billType);
      expect(settlement!.status).toBe(after.status);

      // `pendingAmount` is the bill AS IT STANDS NOW — after this receipt.
      // That is what makes the client's "After" column true, and what lets it
      // derive the before figure by adding this receipt's settlement back.
      expect(settlement!.pendingAmount).toBeCloseTo(before.pendingAmount - AMOUNT, 2);
      expect(settlement!.pendingAmount! + settlement!.amount).toBeCloseTo(before.pendingAmount, 2);

      // Nothing has retracted this row.
      expect(settlement!.reversalOfId).toBeNull();
      expect(settlement!.isReversed).toBe(false);
    } finally {
      const cancelled = await cancelReceipt(voucherId, 'E2E-N36 — tidy up');
      expect(cancelled.status).toBe(201);
      expect(await storedBill(fx.bill)).toEqual(before);
    }
  });

  it('a DRAFT carries them too, on the settlement it REMEMBERED', async () => {
    const before = await storedBill(fx.bill);

    const voucherId = await createDraft(AMOUNT, 'E2E-N36 — bill figures on a draft');
    try {
      // Remember a settlement without posting it — R10: a draft writes no
      // acc_bill_adjustment row and touches no bill.
      const saved = await request(app.getHttpServer())
        .post(CREATE)
        .set('Authorization', BEARER)
        .send({
          ...draftBody(AMOUNT, 'E2E-N36 — bill figures on a draft'),
          avhVoucherId: voucherId,
          allocations: [allocationFor(AMOUNT)],
        });
      expect(saved.status).toBe(201);

      const rows = await getReceipt(voucherId);
      const settlement = rows.find((row) => row.adjType === 'ALLOCATION');
      expect(settlement).toBeDefined();
      // A remembered row is not written, so it has no id — and the bill behind
      // it is untouched, which is what R10 promises.
      expect(settlement!.abjId).toBeNull();
      expect(settlement!.reversalOfId).toBeNull();
      expect(settlement!.isReversed).toBe(false);
      expect(settlement!.billAmount).toBeCloseTo(before.billAmount, 2);
      expect(settlement!.pendingAmount).toBeCloseTo(before.pendingAmount, 2);
      expect(settlement!.dueDate).toBe(before.dueDate);
      expect(settlement!.billType).toBe(before.billType);
      expect(settlement!.status).toBe(before.status);
    } finally {
      const deleted = await request(app.getHttpServer())
        .post(DELETE)
        .set('Authorization', BEARER)
        .send({
          avhVoucherId: voucherId,
          avhCompanyId: COMPANY,
          avhBranchId: BRANCH,
          avhAccYear: ACC_YEAR,
        });
      expect(deleted.status).toBe(201);
      expect(await storedBill(fx.bill)).toEqual(before);
    }
  });

  // ── §1 — the history an amend leaves behind ─────────────────────────────

  it('an AMENDED receipt says which row retracted which, and its rows net to the live figure', async () => {
    if (!amendAllowed) {
      return;
    }
    const before = await storedBill(fx.bill);

    const voucherId = await createDraft(AMOUNT, 'E2E-N36 — amend history');
    await postReceipt(voucherId, AMOUNT);
    const originalId = (await getReceipt(voucherId)).find(
      (row) => row.adjType === 'ALLOCATION',
    )!.abjId;
    expect(originalId).not.toBeNull();

    try {
      const amended = await request(app.getHttpServer())
        .post(AMEND)
        .set('Authorization', BEARER)
        .send({
          ...draftBody(AMENDED, 'E2E-N36 — amended down'),
          avhVoucherId: voucherId,
          allocations: [allocationFor(AMENDED)],
          onAccount: 0,
          baseRevision: 0,
          editRemark: 'E2E — correcting the amount',
        });
      expect(amended.status).toBe(201);

      const rows = (await getReceipt(voucherId)).filter(
        (row) => row.adjType === 'ALLOCATION' && row.billId === fx.bill.billId,
      );

      // The voucher's HISTORY, not its current state: the original, its
      // negative and the replacement all sit on one voucher.
      expect(rows).toHaveLength(3);

      const original = rows.find((row) => row.abjId === originalId)!;
      const reversal = rows.find((row) => row.reversalOfId === originalId)!;
      const replacement = rows.find(
        (row) => row.abjId !== originalId && row.reversalOfId === null,
      )!;

      expect(original.isReversed).toBe(true);
      expect(original.amount).toBeCloseTo(AMOUNT, 2);

      // ck_abj_reversal_sign makes a reversal the exact negative of its target,
      // which is why netting per bill is exact and needs no pairing up.
      expect(reversal.amount).toBeCloseTo(-AMOUNT, 2);
      expect(reversal.isReversed).toBe(false);

      expect(replacement.amount).toBeCloseTo(AMENDED, 2);
      expect(replacement.isReversed).toBe(false);

      // What the client paints: one line per bill, netted.
      const net = rows.reduce((sum, row) => sum + row.amount, 0);
      expect(net).toBeCloseTo(AMENDED, 2);

      // And every row carries the SAME live bill figures, so netting the
      // amounts and reading the bill off any one of them agrees.
      const after = await storedBill(fx.bill);
      for (const row of rows) {
        expect(row.pendingAmount).toBeCloseTo(after.pendingAmount, 2);
        expect(row.billAmount).toBeCloseTo(after.billAmount, 2);
      }
      expect(after.pendingAmount).toBeCloseTo(before.pendingAmount - AMENDED, 2);
      expect(after.pendingAmount + net).toBeCloseTo(before.pendingAmount, 2);
    } finally {
      const cancelled = await cancelReceipt(voucherId, 'E2E-N36 — tidy up after amend');
      expect(cancelled.status).toBe(201);
      expect(await storedBill(fx.bill)).toEqual(before);
    }
  });
});
