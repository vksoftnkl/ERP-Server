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
 * HTTP-level test for POST /api/v1/bills/create with sbStatus omitted — i.e.
 * "save as draft" — proving exactly which tables a DRAFT fills and which it
 * leaves alone.
 *
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard: the real AccessTokenGuard, the global ValidationPipe,
 * URI versioning, the global prefix and the exception filters all run, so the
 * results match the live server on :3011.
 *
 * This drives the SAME database the live server uses, and there is no route
 * that deletes a bill, so every fixture it creates is permanent. All of them
 * are labelled E2E-DRAFT in sb_usr_refno / sb_remarks.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const CREATE = '/api/v1/bills/create';
const GET = '/api/v1/bills/get';
const BEARER = 'Bearer dummy-test-token';

// Real master rows, taken off the most recent live bill (bil00017).
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab'; // Acme Foods - Coimbatore Branch
const ACC_YEAR = '2026-2027';
const CUSTOMER = '019f659c-3942-7237-89b0-c4899603dd7a'; // MADHAVAN
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const DEVICE_ID = '019e4e4c-9f08-7211-afe0-409b88a62180';
const ITEM = '019fa296-42f8-758d-bbe4-f07c7305b077';
const ITEM_UNIT = '019fa296-4321-720d-b3bf-55121479c180'; // item_unit_conversion.iuc_id
const GODOWN = '019e9c9d-74c6-703c-8d34-e3bc78e03d95'; // Chennai
const TENDER_CASH = '019fbbd0-9a8e-73db-b762-175dda2e1762'; // acc_tender_master CASH
const CHARGE_LOADING = 'd2298ce3-6e27-49b4-b89e-ab3c3c1446dd'; // charge_master LOADING CHARGE
const CHARGE_LEDGER = '019fa1e9-5cda-7c66-b03a-74d8d3081515';
// tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor.
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const BILL_VCHR_TYPE_ID = 3; // accounts.acc_voucher_types 'Bil' / Sales Bill

const prisma = new PrismaClient();

// Line 1: 10 @ 100 = 1000 taxable, 18% GST (9+9) = 180, net 1180.
// Charge: loading 100. Bill total 1280. Tendered 1280 cash.
function draftBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
    sbUsrRefno: 'E2E-DRAFT',
    sbRemarks: 'E2E-DRAFT bill workflow test',
    sbBillDate: '2026-09-11',
    // sbStatus deliberately OMITTED — the service defaults it to DRAFT.
    sbTotItems: 1,
    sbGrossAmt: 1000,
    sbTaxableAmt: 1000,
    sbCgstAmt: 90,
    sbSgstAmt: 90,
    sbTaxAmt: 180,
    sbLoadAmt: 100,
    sbBillAmt: 1280,
    sbTenderAmt: 1280,
    sbPaidAmt: 1280,
    sbBalanceAmt: 0,
    sbPayStatus: 'PAID',
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
    charges: [
      {
        cdChgId: CHARGE_LOADING,
        cdLedgerCode: CHARGE_LEDGER,
        cdAmount: 100,
      },
    ],
    tenders: [
      {
        tdTenderId: TENDER_CASH,
        tdAmount: 1280,
      },
    ],
    ...overrides,
  };
}

async function one<T extends Record<string, unknown>>(
  sql: string,
  ...params: unknown[]
): Promise<T | undefined> {
  const rows = await prisma.$queryRawUnsafe<T[]>(sql, ...params);
  return rows[0];
}

async function all<T extends Record<string, unknown>>(
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}

async function seqLastNo(): Promise<bigint | null> {
  const row = await one<{ seq_last_no: bigint }>(
    `SELECT seq_last_no FROM accounts.acc_voucher_seq
      WHERE seq_vchr_type_id = $1 AND seq_company_id = $2::uuid
        AND seq_branch_id = $3::uuid AND seq_acc_year = $4 AND seq_device_code = 'MAIN'`,
    BILL_VCHR_TYPE_ID,
    COMPANY,
    BRANCH,
    ACC_YEAR,
  );
  return row ? row.seq_last_no : null;
}

describe('POST /bills/create — save as DRAFT (e2e, live DB)', () => {
  let app: INestApplication;
  let created: Record<string, any>;
  let seqBefore: bigint | null;
  let seqAfter: bigint | null;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-bill-draft-session',
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
    // Mirror src/main.ts so routes, validation and errors behave as live.
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

  it('creates the draft and answers 201 with sbStatus DRAFT', async () => {
    seqBefore = await seqLastNo();

    const res = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send(draftBody());

    if (res.status !== 201) {
      // eslint-disable-next-line no-console
      console.error(
        '[bill draft e2e] create failed:',
        res.status,
        JSON.stringify(res.body, null, 2),
      );
    }
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    created = res.body.data;

    seqAfter = await seqLastNo();

    expect(created.sbStatus).toBe('DRAFT');
    expect(created.sbId).toBeTruthy();

    // eslint-disable-next-line no-console
    console.log(
      `\n[bill draft e2e] sbId=${created.sbId} refno=${created.sbBillRefno} slno=${created.sbBillSlno}\n`,
    );
  });

  it('assigned the bill number from the voucher sequence (and burned it)', () => {
    expect(created.sbBillRefno).toMatch(/^bil\d{5}$/);
    expect(String(created.sbBillSlno)).toBe(String(seqAfter));
    expect(Number(seqAfter)).toBe(Number(seqBefore) + 1);
  });

  it('ignores a client-sent sbBillSlno / sbBillRefno', async () => {
    const res = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send(
        draftBody({
          sbBillSlno: 999999,
          sbBillRefno: 'CLIENT-CHOSEN',
          sbUsrRefno: 'E2E-DRAFT-NUM',
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.data.sbBillRefno).not.toBe('CLIENT-CHOSEN');
    expect(String(res.body.data.sbBillSlno)).not.toBe('999999');
  });

  it('wrote sales.sale_bill with sb_status DRAFT and no posting columns', async () => {
    const row = await one<Record<string, any>>(
      `SELECT sb_status, sb_bill_refno, sb_posted_voucher_id, sb_posted_on, sb_bill_amt, sb_is_deleted
         FROM sales.sale_bill WHERE sb_id = $1::uuid AND sb_acc_year = $2`,
      created.sbId,
      ACC_YEAR,
    );
    expect(row).toBeDefined();
    expect(row!.sb_status).toBe('DRAFT');
    expect(row!.sb_is_deleted).toBe(false);
    expect(row!.sb_posted_voucher_id).toBeNull();
    expect(row!.sb_posted_on).toBeNull();
    expect(Number(row!.sb_bill_amt)).toBe(1280);
  });

  it('wrote sales.sale_bill_item', async () => {
    const rows = await all<Record<string, any>>(
      `SELECT sbi_line_no, sbi_item_id, sbi_godown_id, sbi_stock_id, sbi_net_qty, sbi_net_amt
         FROM sales.sale_bill_item
        WHERE sbi_bill_id = $1::uuid AND sbi_is_deleted = false ORDER BY sbi_line_no`,
      created.sbId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sbi_line_no).toBe(1); // defaulted from array position
    expect(rows[0].sbi_item_id).toBe(ITEM);
    expect(Number(rows[0].sbi_net_qty)).toBe(10);
  });

  it('wrote public.txn_charge_detail under cd_doc_type = INVOICE', async () => {
    const rows = await all<Record<string, any>>(
      `SELECT cd_doc_type, cd_slno, cd_chg_id, cd_amount, cd_voucher_no
         FROM public.txn_charge_detail
        WHERE cd_doc_id = $1::uuid AND cd_is_deleted = false`,
      created.sbId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].cd_doc_type).toBe('INVOICE');
    expect(rows[0].cd_chg_id).toBe(CHARGE_LOADING);
    expect(Number(rows[0].cd_amount)).toBe(100);
    // cdVoucherNo is inherited from the bill's own sbBillSlno.
    expect(String(rows[0].cd_voucher_no)).toBe(String(created.sbBillSlno));
  });

  it('wrote accounts.acc_tender_detail — a DRAFT still captures the money', async () => {
    const rows = await all<Record<string, any>>(
      `SELECT td_src_module, td_src_doc_type, td_amount, td_dr_cr, td_party_ledger_id, td_row_no
         FROM accounts.acc_tender_detail
        WHERE td_src_doc_id = $1::uuid AND td_is_deleted = false`,
      created.sbId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].td_src_module.trim()).toBe('SALES');
    expect(rows[0].td_src_doc_type.trim()).toBe('SALE_BILL');
    expect(rows[0].td_dr_cr.trim()).toBe('DR');
    expect(Number(rows[0].td_amount)).toBe(1280);
    // Defaulted from sbCustId — customer and ledger share a primary key.
    expect(rows[0].td_party_ledger_id).toBe(CUSTOMER);
  });

  it('opened the status trail with CREATED, NULL -> DRAFT', async () => {
    const rows = await all<Record<string, any>>(
      `SELECT tsl_seq_no, tsl_event, tsl_from_status, tsl_to_status, tsl_src_module, tsl_src_doc_type, tsl_src_doc_refno
         FROM public.txn_status_log
        WHERE tsl_src_doc_id = $1::uuid ORDER BY tsl_seq_no`,
      created.sbId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tsl_seq_no).toBe(1);
    expect(rows[0].tsl_event.trim()).toBe('CREATED');
    expect(rows[0].tsl_from_status).toBeNull();
    expect(rows[0].tsl_to_status.trim()).toBe('DRAFT');
    expect(rows[0].tsl_src_doc_refno).toBe(created.sbBillRefno);
  });

  it('wrote the audit trail — one row per header, line, charge and tender', async () => {
    const header = await all<Record<string, any>>(
      `SELECT log_action::text AS log_action, log_table_name, log_notes, log_display_name
         FROM audit.audit_log
        WHERE log_pk = $1 AND log_table_name = 'sale_bill'`,
      created.sbId,
    );
    expect(header).toHaveLength(1);
    // The service action 'New' is stored as the audit.audit_log_action enum
    // value 'insert' (the enum has only insert/update/approve/cancel).
    expect(header[0].log_action).toBe('insert');
    expect(header[0].log_notes).toBe('Bill created');
    expect(header[0].log_display_name).toBe(created.sbBillRefno);

    // The children are logged against their own tables, keyed by their own pk,
    // and all four rows commit in the bill's transaction — the header LAST.
    const children = await all<Record<string, any>>(
      `SELECT log_table_name, log_notes FROM audit.audit_log
        WHERE log_pk = ANY($1::text[]) ORDER BY log_date`,
      [created.items[0].sbiId, created.charges[0].cdId, created.tenders[0].tdId],
    );
    expect(children.map((r) => r.log_table_name).sort()).toEqual([
      'acc_tender_detail',
      'sale_bill_item',
      'txn_charge_detail',
    ]);
    expect(children.map((r) => r.log_notes).sort()).toEqual([
      'Bill charge created',
      'Bill item created',
      'Bill tender created',
    ]);
  });

  it('did NOT post to accounts — no voucher, no receivable', async () => {
    const vouchers = await all(
      `SELECT avh_voucher_id FROM accounts.acc_voucher_header
        WHERE avh_src_module = 'SALES' AND avh_src_doc_type = 'BILL' AND avh_src_doc_id = $1::uuid`,
      created.sbId,
    );
    expect(vouchers).toHaveLength(0);

    const receivables = await all(
      `SELECT abl_id FROM accounts.acc_bill_balance
        WHERE abl_src_module = 'SALES' AND abl_src_doc_type = 'BILL' AND abl_src_doc_id = $1::uuid`,
      created.sbId,
    );
    expect(receivables).toHaveLength(0);
  });

  it('rejects adjustments[] on a DRAFT with 400 naming the field', async () => {
    const openCredit = await one<{ abl_id: string; abl_acc_year: string }>(
      `SELECT abl_id, abl_acc_year FROM accounts.acc_bill_balance
        WHERE abl_party_id = $1::uuid AND abl_dr_cr = 'CR'
          AND abl_is_deleted = false AND abl_is_active = true
          AND abl_pending_amount > 0 LIMIT 1`,
      CUSTOMER,
    );

    const res = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send(
        draftBody({
          sbUsrRefno: 'E2E-DRAFT-ADJ',
          adjustments: [
            {
              againstBillId: openCredit?.abl_id ?? '019f659c-3942-7237-89b0-c4899603dd7a',
              againstBillAccYear: openCredit?.abl_acc_year ?? ACC_YEAR,
              amount: 10,
            },
          ],
        }),
      );

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.field).toBe('adjustments');
    // eslint-disable-next-line no-console
    console.log(`\n[bill draft e2e] adjustments rejection: ${res.body.errors?.[0]?.message}\n`);
  });

  it('GET /bills/get reads the draft back with items, charges, tenders and resolved names', async () => {
    const res = await request(app.getHttpServer())
      .get(GET)
      .set('Authorization', BEARER)
      .query({ sbId: created.sbId, sbCompanyId: COMPANY, sbBranchId: BRANCH, sbAccYear: ACC_YEAR });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.sbStatus).toBe('DRAFT');
    expect(data.items).toHaveLength(1);
    expect(data.charges).toHaveLength(1);
    expect(data.tenders).toHaveLength(1);
    // Read-only resolved names, null on the create response.
    expect(data.items[0].sbiItemName).toBeTruthy();
    expect(data.items[0].sbiGodownName).toBe('Chennai');
    expect(data.items[0].sbiUnitName).toBeTruthy();
    expect(created.items[0].sbiItemName).toBeNull();
  });
});
