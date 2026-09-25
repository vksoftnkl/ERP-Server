// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';

/**
 * HTTP-level test for the opening balance module — the §9 checklist of
 * plan-backend-opening-balance.md, run against the live dev database.
 *
 * Auth is stubbed at the PROVIDER level, never at the guard, so the real
 * AccessTokenGuard, the global ValidationPipe, URI versioning, the global
 * prefix and the exception filters all run and the status codes match the live
 * server. See memory: erp-server-http-testing-without-credentials.
 *
 * Everything lives under two throwaway companies created in beforeAll and hard
 * deleted in afterAll, so nothing here can touch a real company's books. The
 * years are 2026-2027 (which already has voucher partitions, needed for the
 * closing-balance path) and 2027-2028 (created by ensure_acc_year_partitions).
 */

const BASE = '/api/v1/opening-balances';
const BEARER = 'Bearer dummy-test-token';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1, a real user_master row

const FROM_YEAR = '2026-2027';
const TO_YEAR = '2027-2028';

const prisma = new PrismaClient();

// acc_voucher_types row 3, 'Sales Bill' — only needed so the SALES-bill
// fixture can satisfy ck_abl_voucher.
const SALES_VOUCHER_TYPE_ID = 3;

const COMPANY_NAME = 'E2E_OpeningBal_Co';
const OTHER_COMPANY_NAME = 'E2E_OpeningBal_Other';

describe('opening-balances (e2e — live DB)', () => {
  let app: INestApplication;

  let companyId: string;
  let otherCompanyId: string;
  let branchId: string;

  let assetsGroupId: string;
  let liabilitiesGroupId: string;
  let incomeGroupId: string;
  let noNatureGroupId: string;

  let cashLedgerId: string; // Assets
  let capitalLedgerId: string; // Liabilities
  let debtorLedgerId: string; // Assets, bill-by-bill
  let salesLedgerId: string; // Income  — must be refused an opening
  let retainedLedgerId: string; // Liabilities — the RETAINED_EARNINGS role
  let diffLedgerId: string; // Liabilities — the OPENING_DIFFERENCE role
  let unclassifiedLedgerId: string;
  let foreignLedgerId: string; // owned by otherCompanyId

  const post = (path: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post(`${BASE}/${path}`).set('Authorization', BEARER).send(body);
  const get = (path: string, query: string) =>
    request(app.getHttpServer()).get(`${BASE}/${path}?${query}`).set('Authorization', BEARER);
  const del = (query: string) =>
    request(app.getHttpServer()).delete(`${BASE}/delete?${query}`).set('Authorization', BEARER);

  /** The party's live opening bills, shaped as the screen would send them back. */
  const currentBills = async () => {
    const bills = await prisma.accBillBalance.findMany({
      where: {
        ablPartyId: debtorLedgerId,
        ablAccYear: FROM_YEAR,
        ablBillType: 'OPENING',
        ablIsDeleted: false,
      },
      select: {
        ablId: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablDrCr: true,
        ablBillAmount: true,
      },
      orderBy: { ablDocRefno: 'asc' },
    });
    return bills.map((bill) => ({
      ablId: bill.ablId,
      ablDocRefno: bill.ablDocRefno,
      ablDocDate: bill.ablDocDate.toISOString().slice(0, 10),
      ablDrCr: bill.ablDrCr as 'DR' | 'CR',
      ablBillAmount: Number(bill.ablBillAmount),
    }));
  };

  const makeGroup = async (name: string, nature: string | null) =>
    (
      await prisma.accGroupMaster.create({
        data: {
          accGroupName: name,
          accGroupType: 'BALANCESHEET',
          accGroupNature: nature,
          accGroupCompanyId: companyId,
        },
        select: { accGroupId: true },
      })
    ).accGroupId;

  const makeLedger = async (
    name: string,
    groupId: string,
    opts: { billByBill?: boolean; ownerId?: string } = {},
  ) =>
    (
      await prisma.accLedgerMaster.create({
        data: {
          ledName: name,
          ledGroupId: groupId,
          ledCompanyId: opts.ownerId ?? companyId,
          ledIsBillByBill: opts.billByBill ?? false,
        },
        select: { ledId: true },
      })
    ).ledId;

  /**
   * Everything these two throwaway companies own, in dependency order. Run
   * BEFORE the fixtures as well as after them: a run killed mid-flight leaves
   * the companies behind, and comp_name is unique, so the next run would fail
   * in beforeAll and report all 22 tests as broken.
   */
  const purge = async () => {
    const companies = await prisma.company.findMany({
      where: { compName: { in: [COMPANY_NAME, OTHER_COMPANY_NAME] } },
      select: { compId: true },
    });
    const ids = companies.map((c) => c.compId);
    if (ids.length === 0) {
      return;
    }
    await prisma.appSettingValue.deleteMany({ where: { asvCompanyId: { in: ids } } });
    await prisma.accBillBalance.deleteMany({ where: { ablCompanyId: { in: ids } } });
    await prisma.accVoucherHeader.deleteMany({ where: { avhCompanyId: { in: ids } } });
    await prisma.accOpeningBalance.deleteMany({ where: { opCompanyId: { in: ids } } });
    await prisma.accOpeningRun.deleteMany({ where: { aorCompanyId: { in: ids } } });
    await prisma.accLedgerMap.deleteMany({ where: { almCompanyId: { in: ids } } });
    await prisma.fiscalYear.deleteMany({ where: { compId: { in: ids } } });
    await prisma.accLedgerMaster.deleteMany({ where: { ledCompanyId: { in: ids } } });
    await prisma.accGroupMaster.deleteMany({ where: { accGroupCompanyId: { in: ids } } });
    await prisma.branchMaster.deleteMany({ where: { brCompId: { in: ids } } });
    await prisma.company.deleteMany({ where: { compId: { in: ids } } });
  };

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-opening-balance',
      user_type: 'SUPER ADMIN',
      company_id: null,
      branch_id: null,
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

    // The target year's partitions. acc_opening_balance and acc_bill_balance
    // are both partitioned by accounting year, so without this every save 500s.
    await prisma.$executeRawUnsafe(`SELECT public.ensure_acc_year_partitions('${TO_YEAR}')`);

    await purge();

    const company = await prisma.company.create({
      data: { compName: COMPANY_NAME, compStateCode: '33' },
      select: { compId: true },
    });
    companyId = company.compId;

    const other = await prisma.company.create({
      data: { compName: OTHER_COMPANY_NAME, compStateCode: '33' },
      select: { compId: true },
    });
    otherCompanyId = other.compId;

    // notes (47): the trial books check refuses a post whose party's bills
    // and ledger disagree. Several fixtures below write acc_bill_balance rows
    // directly (a SALES bill behind a leg-less header), which is exactly that
    // state — they exercise the opening screen, not posting, so the check is
    // off for these two throwaway companies.
    await prisma.appSettingValue.createMany({
      data: [companyId, otherCompanyId].map((id) => ({
        asvSettingKey: 'accounts.reconcile_on_post',
        asvScope: 'COMPANY',
        asvCompanyId: id,
        asvValue: 'false',
        asvCreatedBy: ACTOR,
      })),
    });

    const branch = await prisma.branchMaster.create({
      data: { brName: 'E2E_OpeningBal_Branch', brStateCode: '33', brCompId: companyId },
      select: { brId: true },
    });
    branchId = branch.brId;

    assetsGroupId = await makeGroup('E2E_OB_Assets', 'Assets');
    liabilitiesGroupId = await makeGroup('E2E_OB_Liabilities', 'Liabilities');
    incomeGroupId = await makeGroup('E2E_OB_Income', 'Income');
    await makeGroup('E2E_OB_Expenses', 'Expenses');
    // The trigger from 20260915090000 inherits a nature from the parent chain,
    // so a genuinely nature-less group has to be a ROOT with none.
    noNatureGroupId = await makeGroup('E2E_OB_NoNature', null);

    cashLedgerId = await makeLedger('E2E_OB_Cash', assetsGroupId);
    capitalLedgerId = await makeLedger('E2E_OB_Capital', liabilitiesGroupId);
    debtorLedgerId = await makeLedger('E2E_OB_Debtor', assetsGroupId, { billByBill: true });
    salesLedgerId = await makeLedger('E2E_OB_Sales', incomeGroupId);
    retainedLedgerId = await makeLedger('E2E_OB_Retained', liabilitiesGroupId);
    diffLedgerId = await makeLedger('E2E_OB_Difference', liabilitiesGroupId);
    unclassifiedLedgerId = await makeLedger('E2E_OB_Unclassified', noNatureGroupId);
    foreignLedgerId = await makeLedger('E2E_OB_Foreign', assetsGroupId, {
      ownerId: otherCompanyId,
    });

    // The two roles, mapped for this company only — seeded by 20260915090000.
    await prisma.accLedgerMap.createMany({
      data: [
        { almCompanyId: companyId, almRole: 'OPENING_DIFFERENCE', almLedgerId: diffLedgerId },
        { almCompanyId: companyId, almRole: 'RETAINED_EARNINGS', almLedgerId: retainedLedgerId },
      ],
    });

    await prisma.fiscalYear.createMany({
      data: [
        {
          compId: companyId,
          fyYearName: FROM_YEAR,
          fyBeginDate: new Date('2026-04-01'),
          fyEndDate: new Date('2027-03-31'),
          fyStatus: 'OPEN',
          createdBy: ACTOR,
        },
        {
          compId: companyId,
          fyYearName: TO_YEAR,
          fyBeginDate: new Date('2027-04-01'),
          fyEndDate: new Date('2028-03-31'),
          fyStatus: 'OPEN',
          createdBy: ACTOR,
        },
      ],
    });
  }, 180_000);

  afterAll(async () => {
    await purge();
    await prisma.$disconnect();
    await app.close();
  }, 120_000);

  // ── §4.1 / §4.2 — the company-year set ────────────────────────────────────

  it('refuses a negative amount with a readable message, not a constraint name', async () => {
    const res = await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [{ opLedgerId: cashLedgerId, opAmount: -500, opDrCr: 'D' }],
    });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('ck_op_amount');
    expect(res.body.errors[0].field).toBe('rows.0.opAmount');
    expect(res.body.errors[0].message).toContain('E2E_OB_Cash');
  });

  it('refuses an income ledger — an opening on one is a category error', async () => {
    const res = await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [{ opLedgerId: salesLedgerId, opAmount: 100, opDrCr: 'C' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toContain('only Assets and Liabilities');
  });

  it("refuses another company's ledger, and a ledger that does not exist", async () => {
    const foreign = await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [{ opLedgerId: foreignLedgerId, opAmount: 100, opDrCr: 'D' }],
    });
    expect(foreign.status).toBe(400);
    expect(foreign.body.errors[0].message).toContain('does not belong to this company');

    const missing = await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [{ opLedgerId: '019f0000-0000-7000-8000-00000000dead', opAmount: 100, opDrCr: 'D' }],
    });
    expect(missing.status).toBe(400);
    expect(JSON.stringify(missing.body)).not.toContain('fk_op_ledger');
  });

  it('writes a balanced set, and a zero-amount row writes no row at all', async () => {
    const res = await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [
        { opLedgerId: cashLedgerId, opAmount: 100000, opDrCr: 'D', opSource: 'MIGRATION' },
        { opLedgerId: capitalLedgerId, opAmount: 100000, opDrCr: 'C', opSource: 'MIGRATION' },
        { opLedgerId: unclassifiedLedgerId, opAmount: 0, opDrCr: 'D' },
      ],
      replace: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.skippedZero).toBe(1);
    expect(res.body.data.trialBalance).toMatchObject({
      totalDebit: 100000,
      totalCredit: 100000,
      difference: 0,
      isBalanced: true,
    });
    // The plug ledger is resolved through the role, never by name.
    expect(res.body.data.trialBalance.differenceLedgerId).toBe(diffLedgerId);

    const stored = await prisma.accOpeningBalance.count({
      where: { opCompanyId: companyId, opAccYear: FROM_YEAR, opIsDeleted: false },
    });
    expect(stored).toBe(2);
  });

  it('reports an unbalanced set rather than refusing the save (DECISION 3)', async () => {
    const res = await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [
        { opLedgerId: cashLedgerId, opAmount: 109310, opDrCr: 'D', opSource: 'MIGRATION' },
        { opLedgerId: capitalLedgerId, opAmount: 100000, opDrCr: 'C', opSource: 'MIGRATION' },
      ],
      replace: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.trialBalance.isBalanced).toBe(false);
    expect(res.body.data.trialBalance.difference).toBe(9310);
    expect(res.body.message).toContain('9310');

    // Put it back for the tests that follow.
    await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [
        { opLedgerId: cashLedgerId, opAmount: 100000, opDrCr: 'D', opSource: 'MIGRATION' },
        { opLedgerId: capitalLedgerId, opAmount: 100000, opDrCr: 'C', opSource: 'MIGRATION' },
      ],
      replace: true,
    });
  });

  it('keeps a company-level row and a branch row for the same ledger apart (ux_op_scope COALESCE)', async () => {
    const res = await post('create', {
      opCompanyId: companyId,
      opBranchId: branchId,
      opAccYear: FROM_YEAR,
      rows: [{ opLedgerId: cashLedgerId, opAmount: 4200, opDrCr: 'D', opSource: 'MANUAL' }],
      replace: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(1);

    const rows = await prisma.accOpeningBalance.findMany({
      where: {
        opCompanyId: companyId,
        opAccYear: FROM_YEAR,
        opLedgerId: cashLedgerId,
        opIsDeleted: false,
      },
      select: { opBranchId: true, opAmount: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.opBranchId === null)).toHaveLength(1);
    expect(rows.filter((r) => r.opBranchId === branchId)).toHaveLength(1);

    // And the company-level list does not show the branch figure.
    const list = await get('list', `companyId=${companyId}&accYear=${FROM_YEAR}`);
    const cash = list.body.data.rows.find((r: { ledId: string }) => r.ledId === cashLedgerId);
    expect(cash.opAmount).toBe(100000);
  });

  it('lists the whole chart and reports unclassified ledgers separately', async () => {
    const res = await get('list', `companyId=${companyId}&accYear=${FROM_YEAR}&includeZero=true`);

    expect(res.status).toBe(200);
    const ledIds = res.body.data.rows.map((r: { ledId: string }) => r.ledId);
    // Every balance-sheet ledger, opened or not.
    expect(ledIds).toEqual(expect.arrayContaining([cashLedgerId, capitalLedgerId, debtorLedgerId]));
    // Never the income ledger, and never another company's.
    expect(ledIds).not.toContain(salesLedgerId);
    expect(ledIds).not.toContain(foreignLedgerId);
    // Reported, not dropped and not defaulted to Assets.
    expect(res.body.data.unclassified.map((u: { ledId: string }) => u.ledId)).toContain(
      unclassifiedLedgerId,
    );
  });

  it('round-trips opRemarks through /list', async () => {
    await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [
        {
          opLedgerId: cashLedgerId,
          opAmount: 100000,
          opDrCr: 'D',
          opSource: 'MIGRATION',
          opRemarks: 'counted at go-live',
        },
        { opLedgerId: capitalLedgerId, opAmount: 100000, opDrCr: 'C', opSource: 'MIGRATION' },
      ],
    });

    const res = await get('list', `companyId=${companyId}&accYear=${FROM_YEAR}`);
    const cash = res.body.data.rows.find((r: { ledId: string }) => r.ledId === cashLedgerId);

    // Written by /create and readable again — a remark that saves but never
    // reads back looks lost when it is only invisible.
    expect(cash.opRemarks).toBe('counted at go-live');

    const capital = res.body.data.rows.find((r: { ledId: string }) => r.ledId === capitalLedgerId);
    expect(capital.opRemarks).toBeNull();
  });

  it('treats includeZero=false as false, not as true', async () => {
    // enableImplicitConversion turns a query string into Boolean('false') ===
    // true unless the transform reads the raw value. Every ?flag=false in this
    // API depended on that being got right.
    const absent = await get('list', `companyId=${companyId}&accYear=${FROM_YEAR}`);
    const explicitTrue = await get(
      'list',
      `companyId=${companyId}&accYear=${FROM_YEAR}&includeZero=true`,
    );
    const explicitFalse = await get(
      'list',
      `companyId=${companyId}&accYear=${FROM_YEAR}&includeZero=false`,
    );

    // Absent defaults to the whole chart, and matches an explicit true.
    expect(absent.body.data.rows.length).toBe(explicitTrue.body.data.rows.length);
    expect(absent.body.data.rows.length).toBeGreaterThan(2);

    // False actually narrows — to the ledgers that have a figure.
    expect(explicitFalse.body.data.rows.length).toBeLessThan(absent.body.data.rows.length);
    expect(explicitFalse.body.data.rows.map((r: { ledId: string }) => r.ledId).sort()).toEqual(
      [cashLedgerId, capitalLedgerId].sort(),
    );

    // '0' and 'no' mean false too, and an empty value means "not specified".
    const zero = await get('list', `companyId=${companyId}&accYear=${FROM_YEAR}&includeZero=0`);
    expect(zero.body.data.rows.length).toBe(explicitFalse.body.data.rows.length);
  });

  it('never hands back an empty chart for a company that has never been opened', async () => {
    // The first thing this screen is ever used for. 0 = 0 balances, so an
    // empty list reads as a company whose books are in order.
    const res = await get('list', `companyId=${companyId}&accYear=${TO_YEAR}&branchId=${branchId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rows.length).toBeGreaterThan(2);
    expect(res.body.data.trialBalance.isBalanced).toBe(true);
  });

  it('clears the year on rows:[] + replace:true, and refuses an omitted rows key', async () => {
    const omitted = await post('create', {
      opCompanyId: companyId,
      opBranchId: branchId,
      opAccYear: FROM_YEAR,
      replace: true,
    });
    expect(omitted.status).toBe(400);

    const cleared = await post('create', {
      opCompanyId: companyId,
      opBranchId: branchId,
      opAccYear: FROM_YEAR,
      rows: [],
      replace: true,
    });
    expect(cleared.status).toBe(201);
    expect(cleared.body.data.deleted).toBe(1);

    const left = await prisma.accOpeningBalance.count({
      where: {
        opCompanyId: companyId,
        opAccYear: FROM_YEAR,
        opBranchId: branchId,
        opIsDeleted: false,
      },
    });
    expect(left).toBe(0);
  });

  // ── §4.6 — bill-wise ──────────────────────────────────────────────────────

  it('lets the bills write the party opening, and counts only linked bills in the tie', async () => {
    const res = await post('bills', {
      companyId,
      branchId,
      accYear: FROM_YEAR,
      partyId: debtorLedgerId,
      bills: [
        { ablDocRefno: 'E2E/OB/1', ablDocDate: '2026-05-10', ablDrCr: 'DR', ablBillAmount: 120000 },
        { ablDocRefno: 'E2E/OB/2', ablDocDate: '2026-06-10', ablDrCr: 'DR', ablBillAmount: 98400 },
      ],
      replace: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.billTotalAmount).toBe(218400);
    expect(res.body.data.billTotalDrCr).toBe('D');
    expect(res.body.data.openingAmount).toBe(218400);
    expect(res.body.data.openingDrCr).toBe('D');
    expect(res.body.data.isTied).toBe(true);

    // Every bill carries the source link and no voucher (ck_abl_voucher).
    const bills = await prisma.accBillBalance.findMany({
      where: { ablPartyId: debtorLedgerId, ablAccYear: FROM_YEAR, ablIsDeleted: false },
      select: {
        ablSrcDocType: true,
        ablSrcDocId: true,
        ablSrcModule: true,
        ablVoucherId: true,
        ablVoucherTypeId: true,
        ablBillType: true,
      },
    });
    expect(bills).toHaveLength(2);
    for (const bill of bills) {
      expect(bill.ablBillType).toBe('OPENING');
      expect(bill.ablSrcModule).toBe('ACCOUNTS');
      expect(bill.ablSrcDocType).toBe('OPENING_BALANCE');
      expect(bill.ablSrcDocId).toBe(res.body.data.opId);
      expect(bill.ablVoucherId).toBeNull();
      expect(bill.ablVoucherTypeId).toBeNull();
    }

    // A SALES bill of the same party and year must not move the tie. It needs a
    // real voucher: ck_abl_voucher forces every non-OPENING bill to have one,
    // and fk_abl_voucher points at acc_voucher_header.
    const header = await prisma.accVoucherHeader.create({
      data: {
        avhCompanyId: companyId,
        avhBranchId: branchId,
        avhAccYear: FROM_YEAR,
        avhVoucherTypeId: SALES_VOUCHER_TYPE_ID,
        avhVoucherDate: new Date('2026-07-01'),
        avhPartyId: debtorLedgerId,
        avhUserId: ACTOR,
      },
      select: { avhVoucherId: true },
    });

    await prisma.accBillBalance.create({
      data: {
        ablCompanyId: companyId,
        ablBranchId: branchId,
        ablAccYear: FROM_YEAR,
        ablPartyId: debtorLedgerId,
        ablBillType: 'SALES',
        ablVoucherId: header.avhVoucherId,
        ablVoucherTypeId: SALES_VOUCHER_TYPE_ID,
        ablDocRefno: 'E2E/SALES/9',
        ablDocDate: new Date('2026-07-01'),
        ablDrCr: 'DR',
        ablBillAmount: 50000,
      },
    });

    const after = await get(
      'bills',
      `partyId=${debtorLedgerId}&companyId=${companyId}&accYear=${FROM_YEAR}&branchId=${branchId}`,
    );
    expect(after.body.data.billTotalAmount).toBe(218400);
    expect(after.body.data.isTied).toBe(true);
  });

  it('refuses a duplicate reference with a message, not a constraint name', async () => {
    const res = await post('bills', {
      companyId,
      branchId,
      accYear: FROM_YEAR,
      partyId: debtorLedgerId,
      // No ablId, so this is an insert — and the reference is already taken.
      bills: [
        { ablDocRefno: 'E2E/OB/1', ablDocDate: '2026-05-10', ablDrCr: 'DR', ablBillAmount: 1 },
      ],
    });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('ux_abl_doc_refno');
    expect(res.body.errors[0].message).toContain('E2E/OB/1');
  });

  it('moves the party opening when a credit bill is added, with no call to /create', async () => {
    // The screen echoes back the ids it received from GET; only the new row
    // has none.
    const existing = await currentBills();
    const res = await post('bills', {
      companyId,
      branchId,
      accYear: FROM_YEAR,
      partyId: debtorLedgerId,
      bills: [
        ...existing,
        { ablDocRefno: 'E2E/OB/3', ablDocDate: '2026-06-20', ablDrCr: 'CR', ablBillAmount: 2300 },
      ],
      replace: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.openingAmount).toBe(216100);
    expect(res.body.data.openingDrCr).toBe('D');
    expect(res.body.data.isTied).toBe(true);
  });

  it('refuses a hand-typed figure on a bill-by-bill ledger', async () => {
    const res = await post('create', {
      opCompanyId: companyId,
      opBranchId: branchId,
      opAccYear: FROM_YEAR,
      rows: [{ opLedgerId: debtorLedgerId, opAmount: 999999, opDrCr: 'D' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toContain('total of its bills');
    expect(res.body.errors[0].message).toContain('216100.00');
  });

  it("refuses an opId that names another party's opening", async () => {
    const otherOpening = await prisma.accOpeningBalance.findFirst({
      where: {
        opCompanyId: companyId,
        opAccYear: FROM_YEAR,
        opLedgerId: cashLedgerId,
        opIsDeleted: false,
      },
      select: { opId: true },
    });

    const res = await post('bills', {
      companyId,
      branchId,
      accYear: FROM_YEAR,
      partyId: debtorLedgerId,
      opId: otherOpening!.opId,
      bills: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('opId');
  });

  it('freezes a receipted bill: a new due date is fine, a smaller amount is not', async () => {
    const bill = await prisma.accBillBalance.findFirst({
      where: { ablDocRefno: 'E2E/OB/1', ablAccYear: FROM_YEAR, ablIsDeleted: false },
      select: { ablId: true },
    });
    await prisma.accBillBalance.update({
      where: { ablId_ablAccYear: { ablId: bill!.ablId, ablAccYear: FROM_YEAR } },
      data: { ablAllocAmount: 20000 },
    });

    const full = await currentBills();
    expect(full[0].ablDocRefno).toBe('E2E/OB/1');

    const dueDateOk = await post('bills', {
      companyId,
      branchId,
      accYear: FROM_YEAR,
      partyId: debtorLedgerId,
      bills: full.map((b, i) => (i === 0 ? { ...b, ablDueDate: '2026-07-15' } : b)),
      replace: true,
    });
    expect(dueDateOk.status).toBe(201);
    expect(dueDateOk.body.data.frozenUnchanged).toBe(1);

    const smaller = await post('bills', {
      companyId,
      branchId,
      accYear: FROM_YEAR,
      partyId: debtorLedgerId,
      bills: full.map((b, i) => (i === 0 ? { ...b, ablBillAmount: 5000 } : b)),
      replace: true,
    });
    expect(smaller.status).toBe(400);
    expect(smaller.body.errors[0].message).toContain('E2E/OB/1');
    expect(smaller.body.errors[0].message).toContain('20000.00');

    const flipped = await post('bills', {
      companyId,
      branchId,
      accYear: FROM_YEAR,
      partyId: debtorLedgerId,
      bills: full.map((b, i) => (i === 0 ? { ...b, ablDrCr: 'CR' as const } : b)),
      replace: true,
    });
    expect(flipped.status).toBe(400);

    const omitted = await post('bills', {
      companyId,
      branchId,
      accYear: FROM_YEAR,
      partyId: debtorLedgerId,
      bills: full.slice(1),
      replace: true,
    });
    expect(omitted.status).toBe(400);
    expect(omitted.body.errors[0].message).toContain('E2E/OB/1');
  });

  it('refuses deleting an opening that still has bills', async () => {
    const opening = await prisma.accOpeningBalance.findFirst({
      where: {
        opCompanyId: companyId,
        opAccYear: FROM_YEAR,
        opLedgerId: debtorLedgerId,
        opIsDeleted: false,
      },
      select: { opId: true },
    });

    const res = await del(`opId=${opening!.opId}&accYear=${FROM_YEAR}`);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toContain('opening bill');
  });

  // ── §4.5 — carry forward ──────────────────────────────────────────────────

  it('carries the sign split in both directions, carries bills, and records the run', async () => {
    const res = await post('carry-forward', {
      companyId,
      fromAccYear: FROM_YEAR,
      toAccYear: TO_YEAR,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.skippedManual).toBe(0);

    const carried = await prisma.accOpeningBalance.findMany({
      where: { opCompanyId: companyId, opAccYear: TO_YEAR, opBranchId: null, opIsDeleted: false },
      select: { opLedgerId: true, opAmount: true, opDrCr: true, opSource: true },
    });
    const byLedger = new Map(carried.map((row) => [row.opLedgerId, row]));

    // 100,000 Dr closes 100,000 D; 100,000 Cr closes 100,000 C.
    expect(byLedger.get(cashLedgerId)).toMatchObject({ opDrCr: 'D', opSource: 'CARRY_FORWARD' });
    expect(Number(byLedger.get(cashLedgerId)!.opAmount)).toBe(100000);
    expect(byLedger.get(capitalLedgerId)).toMatchObject({ opDrCr: 'C' });
    expect(Number(byLedger.get(capitalLedgerId)!.opAmount)).toBe(100000);

    // The bills came too, chained to the bills they continue.
    const carriedBills = await prisma.accBillBalance.findMany({
      where: { ablPartyId: debtorLedgerId, ablAccYear: TO_YEAR, ablIsDeleted: false },
      select: {
        ablDocRefno: true,
        ablBillAmount: true,
        ablAllocAmount: true,
        ablParentBillId: true,
        ablParentAccYear: true,
        ablBranchId: true,
        ablSrcDocId: true,
      },
    });
    // Four, not three: an unpaid SALES invoice at the year end is exactly what
    // an opening bill IS next year, so it carries alongside the three typed
    // opening bills. §5.2 step 4 says "each still-open bill", not "each
    // still-open OPENING bill", and this is why.
    expect(carriedBills.length).toBe(4);
    expect(carriedBills.map((b) => b.ablDocRefno).sort()).toEqual([
      'E2E/OB/1',
      'E2E/OB/2',
      'E2E/OB/3',
      'E2E/SALES/9',
    ]);
    const first = carriedBills.find((b) => b.ablDocRefno === 'E2E/OB/1')!;
    // What was LEFT of the bill becomes the new bill's full amount.
    expect(Number(first.ablBillAmount)).toBe(100000);
    expect(Number(first.ablAllocAmount)).toBe(0);
    expect(first.ablParentAccYear).toBe(FROM_YEAR);
    expect(first.ablParentBillId).not.toBeNull();
    expect(first.ablBranchId).toBe(branchId);

    // The party's carried opening is the total of its carried bills.
    const partyOpening = await prisma.accOpeningBalance.findFirst({
      where: {
        opCompanyId: companyId,
        opAccYear: TO_YEAR,
        opLedgerId: debtorLedgerId,
        opIsDeleted: false,
      },
      select: { opId: true, opAmount: true, opDrCr: true },
    });
    // 100000 + 98400 - 2300 + 50000
    expect(Number(partyOpening!.opAmount)).toBe(246100);
    expect(partyOpening!.opDrCr).toBe('D');
    expect(carriedBills.every((b) => b.ablSrcDocId === partyOpening!.opId)).toBe(true);

    // Step 6 and step 7.
    const year = await prisma.fiscalYear.findFirst({
      where: { compId: companyId, fyYearName: TO_YEAR },
      select: { fyIsCarriedForward: true, fyPrevFyId: true },
    });
    expect(year!.fyIsCarriedForward).toBe(true);
    expect(year!.fyPrevFyId).not.toBeNull();

    const runs = await prisma.accOpeningRun.count({ where: { aorCompanyId: companyId } });
    expect(runs).toBe(1);
  }, 120_000);

  it('is idempotent: a second run adds a run row but not a second set of bills', async () => {
    const res = await post('carry-forward', {
      companyId,
      fromAccYear: FROM_YEAR,
      toAccYear: TO_YEAR,
    });
    expect(res.status).toBe(201);

    const bills = await prisma.accBillBalance.count({
      where: { ablPartyId: debtorLedgerId, ablAccYear: TO_YEAR, ablIsDeleted: false },
    });
    expect(bills).toBe(4);

    const runs = await prisma.accOpeningRun.count({ where: { aorCompanyId: companyId } });
    expect(runs).toBe(2);
  }, 120_000);

  it("spares a bill-wise party's MANUAL opening, and does not re-carry its bills over it", async () => {
    // A bill-wise party's opening is BRANCH scoped, so it never appears in the
    // company-level ledger loop — its protection has to come from the bill
    // carry itself.
    const opening = await prisma.accOpeningBalance.findFirst({
      where: {
        opCompanyId: companyId,
        opAccYear: TO_YEAR,
        opLedgerId: debtorLedgerId,
        opIsDeleted: false,
      },
      select: { opId: true },
    });
    await prisma.accOpeningBalance.update({
      where: { opId_opAccYear: { opId: opening!.opId, opAccYear: TO_YEAR } },
      data: { opSource: 'MANUAL', opAmount: 111111 },
    });

    const res = await post('carry-forward', {
      companyId,
      fromAccYear: FROM_YEAR,
      toAccYear: TO_YEAR,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.skippedManual).toBeGreaterThanOrEqual(1);

    const after = await prisma.accOpeningBalance.findFirst({
      where: { opId: opening!.opId, opAccYear: TO_YEAR },
      select: { opAmount: true, opSource: true },
    });
    expect(after!.opSource).toBe('MANUAL');
    expect(Number(after!.opAmount)).toBe(111111);

    // Put it back so the tests after this one see a carried party again.
    await prisma.accOpeningBalance.update({
      where: { opId_opAccYear: { opId: opening!.opId, opAccYear: TO_YEAR } },
      data: { opSource: 'CARRY_FORWARD', opAmount: 246100 },
    });
  }, 120_000);

  it('flips an edited CARRY_FORWARD row to MANUAL, and the next run then spares it', async () => {
    const carried = await prisma.accOpeningBalance.findFirst({
      where: {
        opCompanyId: companyId,
        opAccYear: TO_YEAR,
        opLedgerId: cashLedgerId,
        opIsDeleted: false,
      },
      select: { opId: true },
    });

    const edited = await post('create', {
      opCompanyId: companyId,
      opAccYear: TO_YEAR,
      rows: [
        {
          opId: carried!.opId,
          opLedgerId: cashLedgerId,
          opAmount: 95000,
          opDrCr: 'D',
          opSource: 'CARRY_FORWARD',
        },
      ],
    });

    expect(edited.status).toBe(201);
    // Sent as CARRY_FORWARD, stored as MANUAL — the figure changed.
    expect(edited.body.data.flippedToManual).toContain(carried!.opId);

    const stored = await prisma.accOpeningBalance.findFirst({
      where: { opId: carried!.opId, opAccYear: TO_YEAR },
      select: { opSource: true, opGeneratedAt: true },
    });
    expect(stored!.opSource).toBe('MANUAL');
    // op_generated_* is kept: it records what the figure was derived from.
    expect(stored!.opGeneratedAt).not.toBeNull();

    const rerun = await post('carry-forward', {
      companyId,
      fromAccYear: FROM_YEAR,
      toAccYear: TO_YEAR,
    });
    expect(rerun.body.data.skippedManual).toBeGreaterThanOrEqual(1);

    const afterRerun = await prisma.accOpeningBalance.findFirst({
      where: { opId: carried!.opId, opAccYear: TO_YEAR },
      select: { opAmount: true, opSource: true },
    });
    expect(Number(afterRerun!.opAmount)).toBe(95000);
    expect(afterRerun!.opSource).toBe('MANUAL');
  }, 120_000);

  it('re-saving a CARRY_FORWARD row unchanged keeps it CARRY_FORWARD', async () => {
    const row = await prisma.accOpeningBalance.findFirst({
      where: {
        opCompanyId: companyId,
        opAccYear: TO_YEAR,
        opLedgerId: capitalLedgerId,
        opIsDeleted: false,
      },
      select: { opId: true, opAmount: true, opDrCr: true },
    });

    const res = await post('create', {
      opCompanyId: companyId,
      opAccYear: TO_YEAR,
      rows: [
        {
          opId: row!.opId,
          opLedgerId: capitalLedgerId,
          opAmount: Number(row!.opAmount),
          opDrCr: row!.opDrCr,
          opSource: 'CARRY_FORWARD',
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.flippedToManual).not.toContain(row!.opId);

    const stored = await prisma.accOpeningBalance.findFirst({
      where: { opId: row!.opId, opAccYear: TO_YEAR },
      select: { opSource: true },
    });
    expect(stored!.opSource).toBe('CARRY_FORWARD');
  });

  // ── §5.5 rule 4 / §7.4 ────────────────────────────────────────────────────

  it('stales the later year when the earlier year is edited, sparing its MANUAL rows', async () => {
    const before = await prisma.accOpeningBalance.findMany({
      where: { opCompanyId: companyId, opAccYear: TO_YEAR, opIsDeleted: false },
      select: { opId: true, opSource: true, opIsStale: true },
    });
    expect(before.some((r) => r.opSource === 'CARRY_FORWARD')).toBe(true);

    const res = await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [
        { opLedgerId: cashLedgerId, opAmount: 101000, opDrCr: 'D', opSource: 'MIGRATION' },
        { opLedgerId: capitalLedgerId, opAmount: 100000, opDrCr: 'C', opSource: 'MIGRATION' },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.staledAccYears).toContain(TO_YEAR);

    const after = await prisma.accOpeningBalance.findMany({
      where: { opCompanyId: companyId, opAccYear: TO_YEAR, opIsDeleted: false },
      select: { opSource: true, opIsStale: true, opStaleReason: true },
    });
    for (const row of after) {
      if (row.opSource === 'CARRY_FORWARD') {
        expect(row.opIsStale).toBe(true);
        expect(row.opStaleReason).toBe('SOURCE_OPENING_EDITED');
      } else {
        // A MANUAL row was never derived from the earlier year.
        expect(row.opIsStale).toBe(false);
      }
    }
  });

  it('refuses a write into a CLOSED year, naming the year', async () => {
    await prisma.fiscalYear.updateMany({
      where: { compId: companyId, fyYearName: FROM_YEAR },
      data: { fyStatus: 'CLOSED' },
    });

    const res = await post('create', {
      opCompanyId: companyId,
      opAccYear: FROM_YEAR,
      rows: [{ opLedgerId: cashLedgerId, opAmount: 1, opDrCr: 'D' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toContain(FROM_YEAR);
    expect(res.body.errors[0].message).toContain('CLOSED');

    await prisma.fiscalYear.updateMany({
      where: { compId: companyId, fyYearName: FROM_YEAR },
      data: { fyStatus: 'OPEN' },
    });
  });

  // ── §4.3 ──────────────────────────────────────────────────────────────────

  it('returns a null differenceLedgerId for a company with no OPENING_DIFFERENCE mapping', async () => {
    const res = await get('trial-balance', `companyId=${otherCompanyId}&accYear=${FROM_YEAR}`);

    expect(res.status).toBe(200);
    expect(res.body.data.differenceLedgerId).toBeNull();
    expect(res.body.data.isBalanced).toBe(true);
  });
});
