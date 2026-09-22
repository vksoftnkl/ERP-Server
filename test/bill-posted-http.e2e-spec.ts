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
 * HTTP-level test for POSTING a sale bill — the DRAFT -> POSTED transition and
 * a bill created straight into the books — proving what reaches accounts:
 * accounts.acc_voucher_header, accounts.acc_bill_balance, the status trail, and
 * the abl_alloc_amount seeding that makes posting effectively one-way for a
 * bill that was paid.
 *
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard. See memory: erp-server-http-testing-without-credentials.
 *
 * Drives the SAME database the live server uses. There is no route that deletes
 * a bill, so every fixture is permanent; all are labelled E2E-POST* in
 * sb_usr_refno. Nothing pre-existing is ever posted, unposted or cancelled —
 * this suite only ever touches bills it created itself.
 */

const CREATE = '/api/v1/bills/create';
const BEARER = 'Bearer dummy-test-token';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const ACC_YEAR = '2026-2027';
const CUSTOMER = '019f659c-3942-7237-89b0-c4899603dd7a'; // MADHAVAN
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const DEVICE_ID = '019e4e4c-9f08-7211-afe0-409b88a62180';
const ITEM = '019fa296-42f8-758d-bbe4-f07c7305b077';
const ITEM_UNIT = '019fa296-4321-720d-b3bf-55121479c180';
const GODOWN = '019e9c9d-74c6-703c-8d34-e3bc78e03d95';
const TENDER_CASH = '019fbbd0-9a8e-73db-b762-175dda2e1762';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1 (SUPER ADMIN)

const BILL_VCHR_TYPE_ID = 3;

const prisma = new PrismaClient();

// 10 @ 100 = 1000 taxable + 18% GST = 1180 total.
function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sbCompanyId: COMPANY,
    sbBranchId: BRANCH,
    sbAccYear: ACC_YEAR,
    sbDeviceType: 'PC',
    sbDeviceId: DEVICE_ID,
    sbPriceLevel: 1,
    sbCustId: CUSTOMER,
    sbCustName: 'MADHAVAN',
    sbCustStcd: '33',
    sbPosStcd: '33',
    sbUserId: USER,
    sbBillDate: '2026-09-11',
    sbDueDays: 30,
    sbDueDate: '2026-10-11',
    sbTotItems: 1,
    sbGrossAmt: 1000,
    sbTaxableAmt: 1000,
    sbCgstAmt: 90,
    sbSgstAmt: 90,
    sbTaxAmt: 180,
    sbBillAmt: 1180,
    sbBillType: 'CASH',
    sbDocType: 'TAX_INVOICE',
    items: [
      {
        sbiItemId: ITEM,
        sbiItemUnitId: ITEM_UNIT,
        sbiGodownId: GODOWN,
        sbiBillQty: 10,
        sbiNetQty: 10,
        sbiRate: 100,
        sbiGrossAmt: 1000,
        sbiTaxableAmt: 1000,
        sbiTaxPerc: 18,
        sbiCgstPerc: 9,
        sbiCgstAmt: 90,
        sbiSgstPerc: 9,
        sbiSgstAmt: 90,
        sbiTaxAmt: 180,
        sbiNetAmt: 1180,
      },
    ],
    ...overrides,
  };
}

// A fully-tendered cash bill: sbPaidAmt seeds abl_alloc_amount at post time.
function paidBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return body({
    sbPayStatus: 'PAID',
    sbTenderAmt: 1180,
    sbPaidAmt: 1180,
    sbBalanceAmt: 0,
    tenders: [{ tdTenderId: TENDER_CASH, tdAmount: 1180 }],
    ...overrides,
  });
}

// A credit bill: nothing tendered, so the whole amount stays outstanding.
function creditBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return body({
    sbBillType: 'CREDIT',
    sbPayStatus: 'UNPAID',
    sbPaidAmt: 0,
    sbBalanceAmt: 1180,
    ...overrides,
  });
}

async function one<T extends Record<string, unknown>>(
  sql: string,
  ...p: unknown[]
): Promise<T | undefined> {
  return (await prisma.$queryRawUnsafe<T[]>(sql, ...p))[0];
}
async function all<T extends Record<string, unknown>>(sql: string, ...p: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...p);
}

function voucherOf(sbId: string) {
  return all<Record<string, any>>(
    `SELECT * FROM accounts.acc_voucher_header
      WHERE avh_src_module = 'SALES' AND avh_src_doc_type = 'BILL'
        AND avh_src_doc_id = $1::uuid AND avh_is_deleted = false`,
    sbId,
  );
}
function receivableOf(sbId: string) {
  return all<Record<string, any>>(
    `SELECT * FROM accounts.acc_bill_balance
      WHERE abl_src_module = 'SALES' AND abl_src_doc_type = 'BILL'
        AND abl_src_doc_id = $1::uuid AND abl_is_deleted = false`,
    sbId,
  );
}
function trailOf(sbId: string) {
  return all<Record<string, any>>(
    `SELECT tsl_seq_no, tsl_event, tsl_from_status, tsl_to_status
       FROM public.txn_status_log WHERE tsl_src_doc_id = $1::uuid ORDER BY tsl_seq_no`,
    sbId,
  );
}
async function seqLastNo(): Promise<bigint> {
  const row = await one<{ seq_last_no: bigint }>(
    `SELECT seq_last_no FROM accounts.acc_voucher_seq
      WHERE seq_vchr_type_id = $1 AND seq_company_id = $2::uuid
        AND seq_branch_id = $3::uuid AND seq_acc_year = $4 AND seq_device_code = 'MAIN'`,
    BILL_VCHR_TYPE_ID,
    COMPANY,
    BRANCH,
    ACC_YEAR,
  );
  return row!.seq_last_no;
}

async function post(payload: Record<string, unknown>, app: INestApplication) {
  const res = await request(app.getHttpServer())
    .post(CREATE)
    .set('Authorization', BEARER)
    .send(payload);
  if (res.status !== 201) {
    // eslint-disable-next-line no-console
    console.error('[bill post e2e] save failed:', res.status, JSON.stringify(res.body, null, 2));
  }
  return res;
}

describe('POST /bills/create — posting to accounts (e2e, live DB)', () => {
  let app: INestApplication;
  // Fixture A: created DRAFT, then posted. Fully paid cash bill.
  let draftThenPosted: Record<string, any>;
  // Fixture B: created straight into POSTED.
  let bornPosted: Record<string, any>;
  // Fixture C: credit bill, nothing paid — the only one that can be unposted.
  let creditPosted: Record<string, any>;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-bill-post-session',
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
    await app?.close();
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------- DRAFT -> POSTED

  it('creates a DRAFT with no accounting effect', async () => {
    const res = await post(paidBody({ sbUsrRefno: 'E2E-POST-A' }), app);
    expect(res.status).toBe(201);
    draftThenPosted = res.body.data;

    expect(draftThenPosted.sbStatus).toBe('DRAFT');
    expect(await voucherOf(draftThenPosted.sbId)).toHaveLength(0);
    expect(await receivableOf(draftThenPosted.sbId)).toHaveLength(0);
  });

  it('posts that draft — same sbId, same bill number, no sequence movement', async () => {
    const seqBefore = await seqLastNo();

    const res = await post(
      paidBody({
        sbId: draftThenPosted.sbId,
        sbUsrRefno: 'E2E-POST-A',
        sbStatus: 'POSTED',
      }),
      app,
    );
    expect(res.status).toBe(201);
    const posted = res.body.data;

    expect(posted.sbId).toBe(draftThenPosted.sbId);
    expect(posted.sbStatus).toBe('POSTED');
    // An update never renumbers and never draws from the sequence.
    expect(posted.sbBillRefno).toBe(draftThenPosted.sbBillRefno);
    expect(String(await seqLastNo())).toBe(String(seqBefore));

    draftThenPosted = posted;

    // eslint-disable-next-line no-console
    console.log(`\n[bill post e2e] posted ${posted.sbBillRefno} (${posted.sbId})\n`);
  });

  it('wrote accounts.acc_voucher_header reusing the bill number', async () => {
    const vouchers = await voucherOf(draftThenPosted.sbId);
    expect(vouchers).toHaveLength(1);
    const v = vouchers[0];

    expect(v.avh_voucher_status.trim()).toBe('POSTED');
    expect(v.avh_voucher_type_id).toBe(BILL_VCHR_TYPE_ID);
    // The voucher IS the invoice: same number, same refno.
    expect(String(v.avh_voucher_no)).toBe(String(draftThenPosted.sbBillSlno));
    expect(v.avh_voucher_refno).toBe(draftThenPosted.sbBillRefno);
    // Balanced: bill total on both sides.
    expect(Number(v.avh_total_debit)).toBe(1180);
    expect(Number(v.avh_total_credit)).toBe(1180);
    expect(Number(v.avh_doc_amount)).toBe(1180);
    // Party is the customer — customer and ledger share one primary key.
    expect(v.avh_party_id).toBe(CUSTOMER);
    // Deliberately NULL: the sales ledger is per line, so no single contra.
    expect(v.avh_opposite_ledger_id).toBeNull();
    expect(v.avh_posted_on).not.toBeNull();
    // avh_voucher_slno is the company-wide serial, separate from avh_voucher_no.
    expect(Number(v.avh_voucher_slno)).toBeGreaterThan(0);
  });

  it('wrote accounts.acc_bill_balance, seeding abl_alloc_amount from sbPaidAmt', async () => {
    const rows = await receivableOf(draftThenPosted.sbId);
    expect(rows).toHaveLength(1);
    const r = rows[0];

    expect(r.abl_bill_type.trim()).toBe('SALES');
    expect(r.abl_dr_cr.trim()).toBe('DR');
    expect(r.abl_party_id).toBe(CUSTOMER);
    expect(Number(r.abl_bill_amount)).toBe(1180);
    // Seeded with min(sbPaidAmt, sbBillAmt) — a fully paid cash bill.
    expect(Number(r.abl_alloc_amount)).toBe(1180);
    // GENERATED: bill - alloc - disc - writeoff.
    expect(Number(r.abl_pending_amount)).toBe(0);
    expect(Number(r.abl_credit_days)).toBe(30);
    expect(r.abl_doc_refno).toBe(draftThenPosted.sbBillRefno);
  });

  it('wrote sb_posted_voucher_id / sb_posted_on back onto the bill', async () => {
    const row = await one<Record<string, any>>(
      `SELECT sb_status, sb_posted_voucher_id, sb_posted_on FROM sales.sale_bill
        WHERE sb_id = $1::uuid AND sb_acc_year = $2`,
      draftThenPosted.sbId,
      ACC_YEAR,
    );
    const vouchers = await voucherOf(draftThenPosted.sbId);
    expect(row!.sb_status).toBe('POSTED');
    expect(row!.sb_posted_voucher_id).toBe(vouchers[0].avh_voucher_id);
    expect(row!.sb_posted_on).not.toBeNull();
  });

  it('appended a POSTED step to the status trail', async () => {
    const trail = await trailOf(draftThenPosted.sbId);
    expect(trail).toHaveLength(2);
    expect(trail[0].tsl_event.trim()).toBe('CREATED');
    expect(trail[0].tsl_to_status.trim()).toBe('DRAFT');
    expect(trail[1].tsl_seq_no).toBe(2);
    expect(trail[1].tsl_event.trim()).toBe('POSTED');
    expect(trail[1].tsl_from_status.trim()).toBe('DRAFT');
    expect(trail[1].tsl_to_status.trim()).toBe('POSTED');
  });

  it('did NOT write accounts.acc_vouchers — the per-ledger split is absent', async () => {
    const vouchers = await voucherOf(draftThenPosted.sbId);
    const lines = await all(
      `SELECT av_id FROM accounts.acc_vouchers WHERE av_voucher_id = $1::uuid`,
      vouchers[0].avh_voucher_id,
    );
    expect(lines).toHaveLength(0);
  });

  it('re-saving a POSTED bill updates the voucher in place — no second voucher', async () => {
    const before = (await voucherOf(draftThenPosted.sbId))[0];

    const res = await post(
      paidBody({
        sbId: draftThenPosted.sbId,
        sbUsrRefno: 'E2E-POST-A',
        sbStatus: 'POSTED',
        sbRemarks: 'E2E-POST re-saved',
      }),
      app,
    );
    expect(res.status).toBe(201);

    const after = await voucherOf(draftThenPosted.sbId);
    expect(after).toHaveLength(1);
    expect(after[0].avh_voucher_id).toBe(before.avh_voucher_id);
    expect(after[0].avh_remarks).toBe('E2E-POST re-saved');
    expect(after[0].avh_modified_on).not.toBeNull();
    // No extra trail row: the status did not move.
    expect(await trailOf(draftThenPosted.sbId)).toHaveLength(2);
  });

  it('refuses to unpost a bill that was paid — 400 on sbBillAmt', async () => {
    const res = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send(paidBody({ sbId: draftThenPosted.sbId, sbUsrRefno: 'E2E-POST-A', sbStatus: 'DRAFT' }));

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.field).toBe('sbBillAmt');
    // eslint-disable-next-line no-console
    console.log(`\n[bill post e2e] unpost refusal: ${res.body.errors?.[0]?.message}\n`);

    // Nothing moved: still POSTED, still one live voucher.
    expect(await voucherOf(draftThenPosted.sbId)).toHaveLength(1);
  });

  // ------------------------------------------------------- created straight into POSTED

  it('creates a bill straight into POSTED — trail opens at NULL -> POSTED', async () => {
    const res = await post(paidBody({ sbUsrRefno: 'E2E-POST-B', sbStatus: 'POSTED' }), app);
    expect(res.status).toBe(201);
    bornPosted = res.body.data;

    expect(bornPosted.sbStatus).toBe('POSTED');
    expect(bornPosted.sbPostedVoucherId).toBeTruthy();
    expect(await voucherOf(bornPosted.sbId)).toHaveLength(1);
    expect(await receivableOf(bornPosted.sbId)).toHaveLength(1);

    const trail = await trailOf(bornPosted.sbId);
    expect(trail).toHaveLength(1);
    expect(trail[0].tsl_event.trim()).toBe('CREATED');
    expect(trail[0].tsl_from_status).toBeNull();
    expect(trail[0].tsl_to_status.trim()).toBe('POSTED');
  });

  // ------------------------------------------------------------ credit bill / unposting

  it('an unpaid CREDIT bill leaves the full amount outstanding', async () => {
    const res = await post(creditBody({ sbUsrRefno: 'E2E-POST-C', sbStatus: 'POSTED' }), app);
    expect(res.status).toBe(201);
    creditPosted = res.body.data;

    const r = (await receivableOf(creditPosted.sbId))[0];
    expect(Number(r.abl_bill_amount)).toBe(1180);
    expect(Number(r.abl_alloc_amount)).toBe(0);
    expect(Number(r.abl_pending_amount)).toBe(1180);
  });

  it('unposts the unpaid credit bill — voucher CANCELLED, receivable retired', async () => {
    const res = await post(
      creditBody({
        sbId: creditPosted.sbId,
        sbUsrRefno: 'E2E-POST-C',
        sbStatus: 'DRAFT',
        sbCancelReason: 'E2E-POST unpost check',
      }),
      app,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.sbStatus).toBe('DRAFT');
    // Posting columns cleared on the way out.
    expect(res.body.data.sbPostedVoucherId).toBeNull();

    // No LIVE voucher and no LIVE receivable any more...
    expect(await receivableOf(creditPosted.sbId)).toHaveLength(0);
    const cancelled = await all<Record<string, any>>(
      `SELECT avh_voucher_status, avh_cancel_reason FROM accounts.acc_voucher_header
        WHERE avh_src_doc_id = $1::uuid AND avh_is_deleted = false`,
      creditPosted.sbId,
    );
    // ...but the voucher row survives, CANCELLED, with a reason.
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].avh_voucher_status.trim()).toBe('CANCELLED');
    expect(cancelled[0].avh_cancel_reason).toBe('E2E-POST unpost check');

    const trail = await trailOf(creditPosted.sbId);
    expect(trail[trail.length - 1].tsl_event.trim()).toBe('UNPOSTED');
    expect(trail[trail.length - 1].tsl_to_status.trim()).toBe('DRAFT');
  });

  it('refuses to re-post a bill whose voucher was cancelled — 400 on sbStatus', async () => {
    const res = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send(creditBody({ sbId: creditPosted.sbId, sbUsrRefno: 'E2E-POST-C', sbStatus: 'POSTED' }));

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.field).toBe('sbStatus');
    // eslint-disable-next-line no-console
    console.log(`\n[bill post e2e] re-post refusal: ${res.body.errors?.[0]?.message}\n`);
  });
});
