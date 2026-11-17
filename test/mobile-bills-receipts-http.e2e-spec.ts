import '../src/env.preload';

import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { createHouseValidationPipe } from '../src/common/validation/house-validation';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import {
  ACTOR,
  API,
  BEARER,
  BRANCH,
  COMPANY,
  GODOWN,
  addDays,
  codesOf,
  figures,
  grantSalesRights,
  makeItem,
  num,
  postOpeningStock,
  probes,
  revokeSalesRights,
  runTag,
  today,
  useHarnessDevice,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales/sales-e2e.harness';
import {
  RECEIPT_MENU,
  grantMenuRights,
  restoreMenuRights,
  type MenuRightsMemo,
} from './helpers/menu-rights';

/**
 * /mobile/bills and /mobile/receipts over HTTP against the live dev DB
 * (memories erp-server-http-testing-without-credentials,
 * sales-e2e-specs-rights-fixture): the real guard, house pipe, versioning,
 * prefix and filters; only the token is stubbed (tester1, on the sales
 * harness device E2E-SALES-HARNESS). Run with --runInBand: it grants tester1
 * the sales rights (menus 12 / 13 / 182) and menu 99, and puts them back.
 *
 * Test-owned data: a fresh E2E-MOB-<tag> item with opening stock in the
 * harness godown, and a fresh ZT-MOBILE-BR customer (no older bills, so the
 * oldest-first fill is exact). Every bill and receipt it posts is cancelled in
 * afterAll (receipts first, then bills); the item and the customer stay, as
 * the sales suites' fixtures do.
 */

const HARNESS_UID = 'E2E-SALES-HARNESS';
const tag = runTag();
const SALE_BILL = 'SALE_BILL';
const tail = (refno: string): number => Number(/(\d+)$/.exec(refno)?.[1] ?? NaN);

describe('/mobile bills and receipts (e2e, live DB)', () => {
  let app: INestApplication;
  let h: Harness;
  let p: ReturnType<typeof probes>;
  let rights: RightsMemo | null = null;
  let receiptRights: MenuRightsMemo | null = null;
  let deviceId: string;
  let item: Item;
  let customerId: string;
  let otherCustomerId: string;
  const prisma = new PrismaClient();
  const posted = {
    bills: [] as Record<string, string>[],
    receipts: [] as Record<string, string>[],
  };

  const http = () => request(app.getHttpServer());
  const authed = (path: string, body: Record<string, unknown>) =>
    http().post(`${API}/${path}`).set('Authorization', BEARER).send(body);

  /** The phone's bill: figures as the desktop harness builds them, no server keys. */
  const billBody = (
    clientUuid: string,
    opts: { qty: number; dueInDays: number; usrRefno: string; extra?: Record<string, unknown> },
  ): Record<string, unknown> => {
    const f = figures([{ item, qty: opts.qty, rate: 100 }]);
    const line = f.items[0];
    return {
      sbClientUuid: clientUuid,
      deviceUid: HARNESS_UID,
      sbCompanyId: COMPANY,
      sbCustId: customerId,
      sbCustName: `ZT-MOBILE-BR ${tag}`,
      sbCustStcd: '33',
      sbPosStcd: '33',
      sbPriceLevel: 1,
      sbUsrRefno: opts.usrRefno,
      sbBillDate: today(),
      sbBillDatetime: new Date().toISOString(),
      sbDueDays: opts.dueInDays,
      sbDueDate: addDays(today(), opts.dueInDays),
      sbDocType: 'TAX_INVOICE',
      sbTotItems: 1,
      sbGrossAmt: f.taxable,
      sbTaxableAmt: f.taxable,
      sbCgstAmt: f.cgst,
      sbSgstAmt: f.sgst,
      sbTaxAmt: f.tax,
      sbBillAmt: f.total,
      sbCreditAmt: f.total,
      sbBalanceAmt: f.total,
      sbPayStatus: 'UNPAID',
      sbRemarks: `ZT-MOBILE-BILL ${tag}`,
      items: [
        {
          sbiLineNo: 1,
          sbiItemId: item.itemId,
          sbiItemUnitId: item.iucId,
          sbiGodownId: GODOWN,
          sbiHsnCode: '21069099',
          sbiBillQty: opts.qty,
          sbiNetQty: opts.qty,
          sbiRate: 100,
          sbiGrossAmt: line.taxable,
          sbiTaxableAmt: line.taxable,
          sbiTaxPerc: line.perc,
          sbiCgstPerc: line.perc / 2,
          sbiCgstAmt: line.cgst,
          sbiSgstPerc: line.perc / 2,
          sbiSgstAmt: line.sgst,
          sbiTaxAmt: line.tax,
          sbiNetAmt: line.net,
        },
      ],
      ...(opts.extra ?? {}),
    };
  };

  const receiptBody = (
    clientUuid: string,
    tenders: Record<string, unknown>[],
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    avhClientUuid: clientUuid,
    deviceUid: HARNESS_UID,
    avhCompanyId: COMPANY,
    avhPartyId: customerId,
    avhUsrRefno: `ZT-MOB-RC-${tag}-${tenders.length}`,
    avhRemarks: `ZT-MOBILE-RECEIPT ${tag}`,
    tenders,
    ...extra,
  });

  let tenderOf: (code: string) => { tenderId: string; typeId: number };
  let billLate: Record<string, any>; // due in 30 days, 236.00, saved first
  let billSoon: Record<string, any>; // due in 10 days, 118.00, saved second

  beforeAll(async () => {
    deviceId = await useHarnessDevice(prisma);
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: `e2e-mobile-bills-${tag}`,
      user_type: 'SUPER ADMIN',
      company_id: COMPANY,
      branch_id: BRANCH,
      device_id: deviceId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (): AccessTokenPayload => claims })
      .overrideProvider(AuthSessionService)
      .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createHouseValidationPipe());
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: process.env.API_VERSION ?? '1',
    });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
    h = { app, http: request(app.getHttpServer()), prisma };
    p = probes(prisma);

    rights = await grantSalesRights(prisma);
    receiptRights = await grantMenuRights(prisma, [RECEIPT_MENU]);
    item = await makeItem(prisma, `E2E-MOB-${tag}`);
    await postOpeningStock(h, item, 100, 20, `E2E-MOB-${tag} opening`);

    // A fresh customer: no older bill can take the receipt's money first.
    const options = await http()
      .get(`${API}/mobile/customers/options`)
      .set('Authorization', BEARER);
    const o = options.body.data;
    const tn = o.states.find((s: { code: string }) => s.code === '33');
    const created = await authed('mobile/customers/create', {
      cusName: `ZT-MOBILE-BR ${tag}`,
      cusShort: 'ZTB',
      cusCity: 'Namakkal',
      cusStateCode: tn.code,
      cusStateName: tn.name,
      cusGstType: 'UNREGISTERED',
      cusAreaId: o.areas[0].id,
      cusGroupId: o.groups[0].id,
      cusPriceLevelId: o.priceLevels[0].id,
    });
    if (created.status !== 201) {
      throw new Error(`customer create: ${created.status} ${JSON.stringify(created.body)}`);
    }
    customerId = created.body.data.cusId;
    const [other] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT cus_id::text AS id FROM sales.customers
       WHERE cus_is_deleted = false AND cus_id <> ${customerId}::uuid
       ORDER BY cus_created_on LIMIT 1`;
    otherCustomerId = other.id;

    const tenders = await http()
      .get(`${API}/mobile/receipts/options`)
      .query({ companyId: COMPANY, deviceUid: HARNESS_UID });
    const list = tenders.body.data.tenders as {
      tenderId: string;
      typeId: number;
      typeCode: string;
    }[];
    tenderOf = (code) => {
      const t = list.find((row) => row.typeCode === code);
      if (!t) throw new Error(`no ${code} tender offered`);
      return t;
    };
  }, 240_000);

  afterAll(async () => {
    // Receipts first (a bill a live receipt settles cannot be unwound), newest first.
    for (const r of [...posted.receipts].reverse()) {
      const res = await authed('receipts/cancel', { ...r, reason: `ZT mobile e2e ${tag}` });
      if (res.status >= 300) {
        // eslint-disable-next-line no-console
        console.warn(`receipt cancel ${r.avhVoucherId}: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
    for (const b of [...posted.bills].reverse()) {
      const res = await authed('bills/cancel', { ...b, reason: `ZT mobile e2e ${tag}` });
      if (res.status >= 300) {
        // eslint-disable-next-line no-console
        console.warn(`bill cancel ${b.sbId}: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
    if (rights) await revokeSalesRights(prisma, rights);
    await restoreMenuRights(prisma, receiptRights);
    await app?.close();
    await prisma.$disconnect();
  }, 180_000);

  const keepBill = (d: Record<string, any>) =>
    posted.bills.push({
      sbId: d.sbId,
      sbCompanyId: d.sbCompanyId,
      sbBranchId: d.sbBranchId,
      sbAccYear: d.sbAccYear,
    });
  const keepReceipt = (d: Record<string, any>) =>
    posted.receipts.push({
      avhVoucherId: d.avhVoucherId,
      avhCompanyId: d.avhCompanyId,
      avhBranchId: d.avhBranchId,
      avhAccYear: d.avhAccYear,
    });

  // ── options ─────────────────────────────────────────────────────────────
  it('bills/options: the harness branch and its live godowns, the default first (no token needed)', async () => {
    const res = await http()
      .get(`${API}/mobile/bills/options`)
      .query({ companyId: COMPANY, deviceUid: HARNESS_UID });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.companyId).toBe(COMPANY);
    expect(d.branchId).toBe(BRANCH);
    expect(d.godowns.map((g: { godownId: string }) => g.godownId)).toContain(GODOWN);
    expect(Object.keys(d.godowns[0]).sort()).toEqual([
      'godownId',
      'isDefault',
      'name',
      'shortName',
    ]);
    const [{ n, def }] = await prisma.$queryRaw<{ n: number; def: string | null }[]>`
      SELECT count(*)::int AS n,
             (SELECT br_default_godown_id::text FROM public.branch_master WHERE br_id = ${BRANCH}::uuid) AS def
        FROM inventory.godown_locations
       WHERE gdl_branch_id = ${BRANCH}::uuid AND gdl_is_deleted = false AND gdl_is_active = true`;
    expect(d.godowns).toHaveLength(n);
    if (def) {
      expect(d.godowns[0]).toEqual(expect.objectContaining({ godownId: def, isDefault: true }));
    }
  });

  it('receipts/options: money-in tenders only', async () => {
    const res = await http()
      .get(`${API}/mobile/receipts/options`)
      .query({ companyId: COMPANY, deviceUid: HARNESS_UID });
    expect(res.status).toBe(200);
    const codes = res.body.data.tenders.map((t: { typeCode: string }) => t.typeCode);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(['CASH', 'CARD', 'UPI', 'WALLET', 'CHEQUE', 'BANK']).toContain(code);
    }
    expect(res.body.data.branchId).toBe(BRANCH);
  });

  // ── bills ───────────────────────────────────────────────────────────────
  it('bills/create saves AND posts with the server-filled scope and VK Nex number', async () => {
    const uuid = randomUUID();
    const res = await authed(
      'mobile/bills/create',
      billBody(uuid, { qty: 2, dueInDays: 30, usrRefno: `A1B2/2627/${tag}-1` }),
    );
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    billLate = res.body.data;
    keepBill(billLate);
    expect(res.body.message).toBe('Bill created and posted successfully');
    expect(billLate).toEqual(
      expect.objectContaining({
        sbCompanyId: COMPANY,
        sbBranchId: BRANCH,
        sbStatus: 'POSTED',
        sbUsrRefno: `A1B2/2627/${tag}-1`,
        sbBillAmt: '236.00',
        duplicate: false,
        sbIsDeleted: false,
      }),
    );
    expect(billLate.sbBillRefno).toEqual(expect.any(String));
    const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT sb_client_uuid::text AS uuid, sb_device_id AS device, sb_device_type AS "deviceType",
             sb_bill_type AS "billType", sb_user_id::text AS "user", sb_status AS status,
             sb_bill_refno AS refno, sb_posted_voucher_id IS NOT NULL AS voucher
        FROM sales.sale_bill WHERE sb_id = ${billLate.sbId}::uuid`;
    expect(row).toEqual({
      uuid,
      device: deviceId,
      deviceType: 'MOBILE',
      billType: 'CREDIT',
      user: ACTOR,
      status: 'POSTED',
      refno: billLate.sbBillRefno,
      voucher: true,
    });
    expect(await p.vouchers(SALE_BILL, billLate.sbId)).toHaveLength(1);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(98);
    // The receivable: the whole amount stays on the customer.
    const [abl] = await p.balanceRows(SALE_BILL, billLate.sbId);
    expect(num(abl.abl_pending_amount)).toBe(236);
    expect(abl.abl_party_id).toBe(customerId);
    // The client uuid is on the bill only, never on its voucher.
    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.acc_voucher_header WHERE avh_client_uuid = ${uuid}::uuid`;
    expect(n).toBe(0);
  }, 60_000);

  it('a resend answers the posted bill and writes nothing; two at once post one; another customer is 409', async () => {
    const uuid = randomUUID();
    const body = billBody(uuid, { qty: 1, dueInDays: 10, usrRefno: `A1B2/2627/${tag}-2` });
    const [a, b] = await Promise.all([
      authed('mobile/bills/create', body),
      authed('mobile/bills/create', body),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.data.sbId).toBe(b.body.data.sbId);
    expect([a.body.data.duplicate, b.body.data.duplicate].sort()).toEqual([false, true]);
    billSoon = a.body.data.duplicate ? b.body.data : a.body.data;
    keepBill(billSoon);
    const again = await authed('mobile/bills/create', body);
    expect(again.status).toBe(201);
    expect(again.body.message).toBe('Bill already saved');
    expect(again.body.data).toEqual({ ...billSoon, duplicate: true });
    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM sales.sale_bill
       WHERE sb_company_id = ${COMPANY}::uuid AND sb_client_uuid = ${uuid}::uuid`;
    expect(n).toBe(1);
    expect(num((await p.balance(item.itemId))!.sbl_on_hand_qty)).toBe(97);

    const reused = await authed('mobile/bills/create', { ...body, sbCustId: otherCustomerId });
    expect(reused.status).toBe(409);
    expect(codesOf(reused)).toEqual(['MOBILE_CLIENT_UUID_REUSED']);
  }, 90_000);

  it('refusals leave no bill and burn no number', async () => {
    const usr = `A1B2/2627/${tag}-X`;
    const badGodown = await authed(
      'mobile/bills/create',
      billBody(randomUUID(), {
        qty: 1,
        dueInDays: 10,
        usrRefno: usr,
        extra: {
          items: [
            {
              ...(
                billBody(randomUUID(), { qty: 1, dueInDays: 1, usrRefno: usr }).items as object[]
              )[0],
              sbiGodownId: randomUUID(),
            },
          ],
        },
      }),
    );
    expect(badGodown.status).toBe(422);
    expect(badGodown.body.errors[0]).toEqual(
      expect.objectContaining({ field: 'items.0.sbiGodownId', code: 'MOBILE_GODOWN_INVALID' }),
    );

    // A refusal of the post itself: exactly /bills/post's code.
    const wrongTotal = await authed(
      'mobile/bills/create',
      billBody(randomUUID(), { qty: 1, dueInDays: 10, usrRefno: usr, extra: { sbBillAmt: 999 } }),
    );
    expect(wrongTotal.status).toBe(422);
    expect(codesOf(wrongTotal)).toContain('SALES_AMOUNT_MISMATCH');

    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM sales.sale_bill WHERE sb_usr_refno = ${usr}`;
    expect(n).toBe(0);
    expect(tail(billSoon.sbBillRefno)).toBe(tail(billLate.sbBillRefno) + 1);

    const whitelist = await authed('mobile/bills/create', {
      ...billBody(randomUUID(), { qty: 1, dueInDays: 1, usrRefno: usr }),
      sbBranchId: BRANCH,
      tenders: [],
    });
    expect(whitelist.status).toBe(400);
    expect(codesOf(whitelist)).toEqual(['VALIDATION_WHITELIST', 'VALIDATION_WHITELIST']);

    const noToken = await http()
      .post(`${API}/mobile/bills/create`)
      .send(billBody(randomUUID(), { qty: 1, dueInDays: 1, usrRefno: usr }));
    expect(noToken.status).toBe(401);
  }, 90_000);

  // ── open bills ──────────────────────────────────────────────────────────
  it("receipts/open-bills: every customer's open bills, open-items order within a party, paged", async () => {
    const noToken = await http()
      .get(`${API}/mobile/receipts/open-bills`)
      .query({ companyId: COMPANY });
    expect(noToken.status).toBe(401);

    const all: Record<string, any>[] = [];
    let page = 1;
    let total = -1;
    for (;;) {
      const res = await http()
        .get(`${API}/mobile/receipts/open-bills`)
        .query({ companyId: COMPANY, page, pageSize: 2 })
        .set('Authorization', BEARER);
      expect(res.status).toBe(200);
      total = res.body.data.total;
      all.push(...res.body.data.items);
      if (!res.body.data.hasMore) break;
      page += 1;
    }
    expect(all).toHaveLength(total);
    expect(new Set(all.map((b) => `${b.billId}|${b.billAccYear}`)).size).toBe(total);
    expect(Object.keys(all[0]).sort()).toEqual(
      [
        'billAccYear',
        'billAmount',
        'billId',
        'billType',
        'daysOverdue',
        'docDate',
        'docRefno',
        'dueDate',
        'partyId',
        'pendingAmount',
      ].sort(),
    );
    // Customers only: every party is a live sales.customers row, and the
    // company's open receivables of other parties are left out of total.
    const parties = [...new Set(all.map((b) => b.partyId as string))];
    const [{ live }] = await prisma.$queryRaw<{ live: number }[]>`
      SELECT count(*)::int AS live FROM sales.customers
       WHERE cus_id = ANY(${parties}::uuid[]) AND cus_is_deleted = false`;
    expect(live).toBe(parties.length);
    const [{ open }] = await prisma.$queryRaw<{ open: number }[]>`
      SELECT count(*)::int AS open FROM accounts.acc_bill_balance b
       WHERE b.abl_company_id = ${COMPANY}::uuid AND b.abl_is_deleted = false
         AND b.abl_is_active = true AND b.abl_dr_cr = 'DR' AND b.abl_pending_amount > 0
         AND b.abl_bill_type IN ('SALES', 'OPENING', 'INTEREST', 'JOURNAL', 'PURCHASE_RETURN')
         AND EXISTS (SELECT 1 FROM sales.customers c
                      WHERE c.cus_id = b.abl_party_id AND c.cus_is_deleted = false)`;
    expect(total).toBe(open);
    // Our customer's rows are /receipts/open-items' rows, in its order.
    const mine = all.filter((b) => b.partyId === customerId);
    const items = await http()
      .get(`${API}/receipts/open-items`)
      .query({ companyId: COMPANY, partyId: customerId })
      .set('Authorization', BEARER);
    expect(items.status).toBe(200);
    expect(mine.map((b) => b.billId)).toEqual(
      items.body.data.bills.map((b: { billId: string }) => b.billId),
    );
    expect(mine.map((b) => b.docRefno)).toEqual([billSoon.sbBillRefno, billLate.sbBillRefno]);
    expect(mine.map((b) => b.pendingAmount)).toEqual(['118.00', '236.00']);
  }, 60_000);

  // ── receipts ────────────────────────────────────────────────────────────
  it('receipts/create fills the open bills in open-items order and posts at once', async () => {
    const bank = tenderOf('BANK');
    const uuid = randomUUID();
    const res = await authed(
      'mobile/receipts/create',
      receiptBody(uuid, [
        {
          tdTenderId: bank.tenderId,
          tdTenderTypeId: bank.typeId,
          tdAmount: 300,
          tdRefNo: `ZT${tag}`,
        },
      ]),
    );
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    const d = res.body.data;
    keepReceipt(d);
    expect(res.body.message).toBe('Receipt created and posted successfully');
    expect(d).toEqual(
      expect.objectContaining({
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhVoucherStatus: 'POSTED',
        avhDocAmount: '300.00',
        avhVoucherDate: today(),
        onAccount: '0.00',
        duplicate: false,
        avhIsDeleted: false,
      }),
    );
    expect(d.avhVoucherRefno).toEqual(expect.any(String));
    // Due in 10 days fills before due in 30, though it was billed second.
    expect(d.allocations).toEqual([
      expect.objectContaining({
        docRefno: billSoon.sbBillRefno,
        amount: '118.00',
        pendingAmount: '0.00',
      }),
      expect.objectContaining({
        docRefno: billLate.sbBillRefno,
        amount: '182.00',
        pendingAmount: '54.00',
      }),
    ]);
    const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT avh_client_uuid::text AS uuid, avh_device_type AS "deviceType", avh_device_id AS device,
             avh_user_id::text AS "user", avh_voucher_status AS status
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${d.avhVoucherId}::uuid`;
    expect(row).toEqual({
      uuid,
      deviceType: 'MOBILE',
      device: deviceId,
      user: ACTOR,
      status: 'POSTED',
    });
    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.acc_voucher_header WHERE avh_client_uuid = ${uuid}::uuid`;
    expect(n).toBe(1);

    const again = await authed(
      'mobile/receipts/create',
      receiptBody(uuid, [
        {
          tdTenderId: bank.tenderId,
          tdTenderTypeId: bank.typeId,
          tdAmount: 300,
          tdRefNo: `ZT${tag}`,
        },
      ]),
    );
    expect(again.status).toBe(201);
    expect(again.body.data).toEqual({ ...d, duplicate: true });

    const reused = await authed(
      'mobile/receipts/create',
      receiptBody(
        uuid,
        [{ tdTenderId: bank.tenderId, tdTenderTypeId: bank.typeId, tdAmount: 300 }],
        {
          avhPartyId: otherCustomerId,
        },
      ),
    );
    expect(reused.status).toBe(409);
    expect(codesOf(reused)).toEqual(['MOBILE_CLIENT_UUID_REUSED']);
  }, 90_000);

  it('money beyond the bills is held on account; a surcharge settles no bill', async () => {
    const upi = tenderOf('UPI');
    const [{ perc }] = await prisma.$queryRaw<{ perc: string }[]>`
      SELECT tnd_surcharge_perc::text AS perc FROM accounts.acc_tender_master WHERE tnd_id = ${upi.tenderId}::uuid`;
    // 100.00 for the bills, plus the master's surcharge inside tdAmount (notes 107).
    const amount = Math.round(100 * (1 + Number(perc) / 100) * 100) / 100;
    const res = await authed(
      'mobile/receipts/create',
      receiptBody(randomUUID(), [
        {
          tdTenderId: upi.tenderId,
          tdTenderTypeId: upi.typeId,
          tdAmount: amount,
          tdRefNo: `UTR${tag}`,
        },
      ]),
    );
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    const d = res.body.data;
    keepReceipt(d);
    expect(d.allocations).toEqual([
      expect.objectContaining({
        docRefno: billLate.sbBillRefno,
        amount: '54.00',
        pendingAmount: '0.00',
      }),
    ]);
    expect(d.onAccount).toBe('46.00');
    const [adv] = await prisma.$queryRaw<{ amt: string }[]>`
      SELECT abl_bill_amount::text AS amt FROM accounts.acc_bill_balance
       WHERE abl_voucher_id = ${d.avhVoucherId}::uuid AND abl_bill_type = 'ADVANCE' AND abl_is_deleted = false`;
    expect(Number(adv.amt)).toBe(46);
  }, 90_000);

  it('refusals: no Post right on menu 99, server-owned keys, no token', async () => {
    const bank = tenderOf('BANK');
    const body = receiptBody(
      randomUUID(),
      [{ tdTenderId: bank.tenderId, tdTenderTypeId: bank.typeId, tdAmount: 10 }],
      { avhUsrRefno: `ZT-MOB-RC-${tag}-NORIGHT` },
    );
    await prisma.$executeRaw`
      UPDATE public.user_menus SET um_can_post = false
       WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = 99 AND um_is_deleted = false`;
    try {
      const res = await authed('mobile/receipts/create', body);
      expect(res.status).toBe(403);
      expect(codesOf(res)).toEqual(['RCT_RIGHT_POST']);
    } finally {
      await prisma.$executeRaw`
        UPDATE public.user_menus SET um_can_post = true
         WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = 99 AND um_is_deleted = false`;
    }
    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.acc_voucher_header
       WHERE avh_usr_refno = ${`ZT-MOB-RC-${tag}-NORIGHT`}`;
    expect(n).toBe(0);

    const whitelist = await authed('mobile/receipts/create', {
      ...body,
      onAccount: 0,
      post: true,
      allocations: [],
    });
    expect(whitelist.status).toBe(400);
    expect(codesOf(whitelist)).toEqual([
      'VALIDATION_WHITELIST',
      'VALIDATION_WHITELIST',
      'VALIDATION_WHITELIST',
    ]);

    const noToken = await http().post(`${API}/mobile/receipts/create`).send(body);
    expect(noToken.status).toBe(401);
  }, 60_000);
});
