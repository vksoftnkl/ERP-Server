// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { PrismaClient } from '@prisma/client';

import {
  ACC_YEAR,
  ACTOR,
  API,
  BEARER,
  BRANCH,
  COMPANY,
  bootApp,
  codesOf,
  num,
  runTag,
  shutdown,
  type Harness,
} from './sales/sales-e2e.harness';

/**
 * voucher_register.md §11.1 over HTTP, on the live dev database.
 *
 * Auth is stubbed at the PROVIDER level (the harness), so the real
 * AccessTokenGuard, ValidationPipe, versioning, prefix and exception filters
 * run. Rights: tester1 holds NOTHING on the register menus, so beforeAll
 * grants the eleven flags on 101–104 / 163 / 259–262 and afterAll takes them
 * back — the real loadRights() reads them (decision E).
 *
 * Fixtures are PERMANENT (a posted voucher has no delete verb; a cancel is a
 * reversal) and labelled E2E-VCH-<tag>: four ledgers of the company, a
 * company-scoped 194C rate with no thresholds (the PNG example deducts 500 on
 * 25,000, which the shipped 30,000 single threshold would not), and the three
 * RCM payable ledgers mapped for the company.
 *
 * Run alone: `npx jest --config ./test/jest-e2e.json --runInBand test/vouchers-register-http.e2e-spec.ts`
 */

const V = `${API}/vouchers`;
// 52 = Issued Cheques (notes 55), 263 = Cheque Books (notes 58)
const MENUS = [52, 101, 102, 103, 104, 163, 259, 260, 261, 262, 263];
const FLAGS = [
  'um_can_view',
  'um_can_create',
  'um_can_edit',
  'um_can_delete',
  'um_can_print',
  'um_can_export',
  'um_can_post',
  'um_can_cancel',
  'um_can_amend',
  'um_can_override',
  'um_can_retender',
];
const GROUP = {
  SUPPLIERS: '019f081c-98cc-757a-9346-4cfba810c47f', // Suppliers (Sundry Creditors)
  CUSTOMERS: '019f081c-6764-73b0-b397-3f30a6efe73e', // Customers (Sundry Debtors)
  INDIRECT_EXPENSES: '019eee86-f34b-7ec8-813f-df893287fb9c',
  DUTIES: '019eee86-f34b-7d92-bd27-71398afb4e7d',
};
const LEDGER = {
  CASH: '019ef844-efba-755d-ab5d-b4d7281edf19', // Cash In Hand (shared)
  KVB: '019ef849-aefe-7e27-8e8f-d4094cf5c254', // Kvb Current A/c (shared, a tender's ledger, still a bank)
  CHEQUES: '019fef37-d504-7e13-981b-9dabfdd18686', // Cheques In Hannd — the CHEQUE tender's ledger
};

interface Fixtures {
  tag: string;
  supplier: string;
  customer: string;
  housekeeping: string;
  stationery: string;
  tax18: string;
  tax12: string;
  inputCgst: string;
}

const prisma = new PrismaClient();
let h: Harness;
let fx: Fixtures;
let rights: { inserted: string[]; restored: { umId: string; flags: Record<string, boolean> }[] };

async function ledger(
  name: string,
  groupId: string,
  extra: string,
  extraVals: string,
): Promise<string> {
  const [row] = await prisma.$queryRawUnsafe<{ led_id: string }[]>(
    `INSERT INTO accounts.acc_ledger_master (led_company_id, led_group_id, led_name, led_state_code, led_created_by ${extra})
     VALUES ('${COMPANY}', '${groupId}', '${name}', '33', 'e2e' ${extraVals}) RETURNING led_id`,
  );
  return row.led_id;
}

async function grantRights(): Promise<typeof rights> {
  const memo: typeof rights = { inserted: [], restored: [] };
  for (const menuId of MENUS) {
    const rows = await prisma.$queryRaw<({ um_id: string } & Record<string, boolean>)[]>`
      SELECT um_id, um_can_view, um_can_create, um_can_edit, um_can_delete, um_can_print, um_can_export,
             um_can_post, um_can_cancel, um_can_amend, um_can_override, um_can_retender
        FROM public.user_menus
       WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = ${menuId}::int AND um_is_deleted = false
       LIMIT 1`;
    if (rows[0]) {
      const flags: Record<string, boolean> = {};
      for (const f of FLAGS) flags[f] = rows[0][f];
      memo.restored.push({ umId: rows[0].um_id, flags });
      await prisma.$executeRawUnsafe(
        `UPDATE public.user_menus SET ${FLAGS.map((f) => `${f} = true`).join(', ')} WHERE um_id = '${rows[0].um_id}'`,
      );
      continue;
    }
    const [created] = await prisma.$queryRaw<{ um_id: string }[]>`
      INSERT INTO public.user_menus (
        um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete, um_can_print, um_can_export,
        um_can_post, um_can_cancel, um_can_amend, um_can_override, um_can_retender, um_created_by
      ) VALUES (
        ${ACTOR}::uuid, ${menuId}::int, true, true, true, true, true, true, true, true, true, true, true, ${ACTOR}::uuid
      ) RETURNING um_id`;
    memo.inserted.push(created.um_id);
  }
  return memo;
}

async function revokeRights(memo: typeof rights): Promise<void> {
  for (const umId of memo.inserted) {
    await prisma.$executeRaw`DELETE FROM public.user_menus WHERE um_id = ${umId}::uuid`;
  }
  for (const r of memo.restored) {
    await prisma.$executeRawUnsafe(
      `UPDATE public.user_menus SET ${FLAGS.map((f) => `${f} = ${r.flags[f] ? 'true' : 'false'}`).join(', ')} WHERE um_id = '${r.umId}'`,
    );
  }
}

/** Fails with the BODY in the message, so a refusal names itself. */
function expectStatus(res: { status: number; body: unknown }, status: number): void {
  if (res.status !== status) {
    throw new Error(`expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

async function setRight(menuId: number, flag: string, value: boolean): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE public.user_menus SET ${flag} = ${value} WHERE um_user_id = '${ACTOR}' AND um_menu_id = ${menuId} AND um_is_deleted = false`,
  );
}

const today = (): string => new Date().toISOString().slice(0, 10);

function pngPayload(over: Record<string, unknown> = {}, docRefno = `SFS/${fx.tag}`) {
  return {
    header: {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      typeCode: 'PurA',
      date: today(),
      partyId: fx.supplier,
      docRefno,
      docDate: today(),
      remarks: `E2E-VCH-${fx.tag} housekeeping + stationery`,
      ...over,
    },
    lines: [
      {
        rowNo: 1,
        drCr: 'DR',
        ledgerId: fx.housekeeping,
        amount: 25000,
        remarks: 'Sept housekeeping',
        gst: { taxId: fx.tax18, hsn: '998533', itcEligibility: 'INPUT_SERVICES' },
        tdsBase: true,
      },
      {
        rowNo: 2,
        drCr: 'DR',
        ledgerId: fx.stationery,
        amount: '4000.00',
        remarks: 'A4 reams',
        gst: { taxId: fx.tax12, hsn: '4820', itcEligibility: 'INPUTS' },
        tdsBase: false,
      },
    ],
    allocations: [],
    newBill: { dueDays: 30 },
  };
}

const post = (path: string, body: object) =>
  h.http.post(`${V}/${path}`).set('Authorization', BEARER).send(body);
const get = (path: string, query: Record<string, unknown>) =>
  h.http.get(`${V}/${path}`).set('Authorization', BEARER).query(query);

describe('Voucher Register — /vouchers/* (e2e, live DB)', () => {
  beforeAll(async () => {
    const tag = runTag();
    const [t18] = await prisma.$queryRaw<
      { tax_id: string }[]
    >`SELECT tax_id FROM inventory.tax_rate_master WHERE tax_rate_perc = 18 AND tax_taxability = 'TAXABLE' AND tax_is_deleted = false LIMIT 1`;
    const [t12] = await prisma.$queryRaw<
      { tax_id: string }[]
    >`SELECT tax_id FROM inventory.tax_rate_master WHERE tax_rate_perc = 12 AND tax_taxability = 'TAXABLE' AND tax_is_deleted = false LIMIT 1`;
    const [icg] = await prisma.$queryRaw<
      { alm_ledger_id: string }[]
    >`SELECT alm_ledger_id FROM accounts.acc_ledger_map WHERE alm_role = 'INPUT_CGST' AND alm_is_deleted = false LIMIT 1`;

    fx = {
      tag,
      supplier: await ledger(
        `E2E-VCH-${tag} Sundaram Facility Services`,
        GROUP.SUPPLIERS,
        ', led_is_bill_by_bill, led_is_tds_applicable, led_tds_nature_of_payment, led_tds_deductee_type, led_pan_no, led_gstin_no, led_gst_party_reg_type',
        ", true, true, '194C', 'FIRM', 'AAAFS1234A', '33AAAFS1234A1Z5', 'REGULAR'",
      ),
      customer: await ledger(
        `E2E-VCH-${tag} Sri Krishna Traders`,
        GROUP.CUSTOMERS,
        ', led_is_bill_by_bill, led_gstin_no, led_gst_party_reg_type',
        ", true, '33AABCK1234A1Z5', 'REGULAR'",
      ),
      housekeeping: await ledger(
        `E2E-VCH-${tag} Housekeeping Charges`,
        GROUP.INDIRECT_EXPENSES,
        ', led_itc_eligibility',
        ", 'INPUT_SERVICES'",
      ),
      stationery: await ledger(
        `E2E-VCH-${tag} Printing & Stationery`,
        GROUP.INDIRECT_EXPENSES,
        ', led_itc_eligibility',
        ", 'ELIGIBLE'",
      ),
      tax18: t18.tax_id,
      tax12: t12.tax_id,
      inputCgst: icg.alm_ledger_id,
    };

    // A company-scoped 194C / FIRM rate with no thresholds, so 25,000 deducts (the PNG).
    await prisma.$executeRaw`
      INSERT INTO accounts.tds_rates (tdr_company_id, tdr_section, tdr_section_name, tdr_deductee_type, tdr_rate, tdr_no_pan_rate,
                                      tdr_threshold_single, tdr_threshold_annual, tdr_effective_from, tdr_remarks, tdr_created_by)
      SELECT ${COMPANY}::uuid, '194C', 'Payment to contractors', 'FIRM', 2, 20, 0, 0, DATE '2026-04-01', 'E2E-VCH fixture', 'e2e'
       WHERE NOT EXISTS (SELECT 1 FROM accounts.tds_rates WHERE tdr_company_id = ${COMPANY}::uuid AND tdr_section = '194C'
                           AND tdr_deductee_type = 'FIRM' AND tdr_is_deleted = false AND tdr_is_active = true)`;
    // The three RCM payable roles, mapped for the company (menu 250 would do the same).
    for (const c of ['CGST', 'SGST', 'IGST']) {
      const role = `RCM_${c}_PAYABLE`;
      const [have] = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM accounts.acc_ledger_map WHERE alm_role = ${role} AND alm_is_deleted = false
           AND (alm_company_id IS NULL OR alm_company_id = ${COMPANY}::uuid)`;
      if (Number(have.n) === 0) {
        const led = await ledger(`E2E-VCH RCM ${c} Payable`, GROUP.DUTIES, '', '');
        await prisma.$executeRaw`
          INSERT INTO accounts.acc_ledger_map (alm_company_id, alm_role, alm_ledger_id, alm_remarks, alm_created_by)
          VALUES (${COMPANY}::uuid, ${role}, ${led}::uuid, 'E2E-VCH fixture', 'e2e')`;
      }
    }

    h = await bootApp(`e2e-vch-${tag}`);
    rights = await grantRights();
  });

  afterAll(async () => {
    if (fx) {
      await prisma.$executeRaw`
        UPDATE accounts.acc_voucher_header SET avh_is_deleted = true
         WHERE avh_voucher_status = 'DRAFT' AND avh_remarks LIKE ${`E2E-VCH-${fx.tag}%`}`;
    }
    if (rights) await revokeRights(rights);
    await shutdown(h);
    await prisma.$disconnect();
  });

  // ─── §6.1 types and rights (E) ───────────────────────────────────────────

  it('GET /types — every permitted type with the caller’s rights; menuId=103 narrows to Journal', async () => {
    const all = await get('types', { companyId: COMPANY });
    expect(all.status).toBe(200);
    const codes = all.body.data.types.map((t: { typeCode: string }) => t.typeCode).sort();
    expect(codes).toEqual(['Con', 'CrN', 'DrN', 'Jrl', 'PmtV', 'PurA', 'RcpV', 'SalA']);
    const pura = all.body.data.types.find((t: { typeCode: string }) => t.typeCode === 'PurA');
    expect(pura.rights).toMatchObject({ view: true, create: true, post: true, cancel: true });
    expect(pura.menuId).toBe(163);
    expect(pura.drGroups.map((g: { name: string }) => g.name)).toContain('Indirect Expenses');

    const one = await get('types', { companyId: COMPANY, menuId: 103 });
    expect(one.body.data.types.map((t: { typeCode: string }) => t.typeCode)).toEqual(['Jrl']);
  });

  it('GET /types — with no row on menu 163, PurA never reaches the band and /create is a 403 (#12)', async () => {
    await setRight(163, 'um_is_deleted', true);
    try {
      const res = await get('types', { companyId: COMPANY });
      expect(res.body.data.types.map((t: { typeCode: string }) => t.typeCode)).not.toContain(
        'PurA',
      );
      const denied = await post('create', pngPayload());
      expect(denied.status).toBe(403);
      expect(codesOf(denied)).toEqual(['VCH_RIGHT_CREATE']);
      const pick = await get('ledger-pick', {
        companyId: COMPANY,
        branchId: BRANCH,
        typeCode: 'PurA',
        side: 'DR',
      });
      expect(pick.status).toBe(403);
    } finally {
      await prisma.$executeRaw`
        UPDATE public.user_menus SET um_is_deleted = false
         WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = 163`;
    }
  });

  // ─── §6.2 the picker ─────────────────────────────────────────────────────

  it('GET /ledger-pick — a Contra offers cash and bank, not a customer, not Cheques in Hand (#8 client, #11)', async () => {
    const res = await get('ledger-pick', {
      companyId: COMPANY,
      branchId: BRANCH,
      typeCode: 'Con',
      side: 'DR',
      limit: 200,
    });
    expect(res.status).toBe(200);
    const ids = res.body.data.ledgers.map((l: { ledId: string }) => l.ledId);
    expect(ids).toContain(LEDGER.CASH);
    expect(ids).toContain(LEDGER.KVB);
    expect(ids).not.toContain(fx.customer);
    expect(ids).not.toContain(LEDGER.CHEQUES);

    const any = await get('ledger-pick', {
      companyId: COMPANY,
      branchId: BRANCH,
      typeCode: 'Jrl',
      side: 'CR',
      q: `E2E-VCH-${fx.tag}`,
      limit: 50,
    });
    expect(any.body.data.ledgers.map((l: { ledId: string }) => l.ledId).sort()).toEqual(
      [fx.supplier, fx.customer, fx.housekeeping, fx.stationery].sort(),
    );
    const sup = any.body.data.ledgers.find((l: { ledId: string }) => l.ledId === fx.supplier);
    expect(sup).toMatchObject({
      isParty: true,
      isBillByBill: true,
      isTdsApplicable: true,
      tdsSection: '194C',
    });
  });

  // ─── notes (56) · the money side of a Receipt / Payment in the picker ────

  it('GET /ledger-pick — RcpV DR offers cash and bank ONLY, RcpV CR never; PmtV the mirror; Jrl both (notes 56)', async () => {
    const pick = async (typeCode: string, side: 'DR' | 'CR', q?: string) => {
      const res = await get('ledger-pick', {
        companyId: COMPANY,
        branchId: BRANCH,
        typeCode,
        side,
        ...(q ? { q } : {}),
        limit: 200,
      });
      expect(res.status).toBe(200);
      return res.body.data.ledgers.map((l: { ledId: string }) => l.ledId) as string[];
    };
    const tagged = `E2E-VCH-${fx.tag}`;

    // RECEIPT: DR is cash / bank only — no customer, no expense, and no Cheques in Hand.
    const rcpDr = await pick('RcpV', 'DR');
    expect(rcpDr).toContain(LEDGER.CASH);
    expect(rcpDr).toContain(LEDGER.KVB);
    expect(rcpDr).not.toContain(fx.customer);
    expect(rcpDr).not.toContain(fx.stationery);
    expect(rcpDr).not.toContain(LEDGER.CHEQUES);
    expect(await pick('RcpV', 'DR', tagged)).toEqual([]);
    // RECEIPT: CR never cash / bank — the customer is there, Cash and the bank are not.
    const rcpCr = await pick('RcpV', 'CR');
    expect(rcpCr).not.toContain(LEDGER.CASH);
    expect(rcpCr).not.toContain(LEDGER.KVB);
    expect(await pick('RcpV', 'CR', tagged)).toEqual(
      expect.arrayContaining([fx.customer, fx.supplier, fx.housekeeping, fx.stationery]),
    );

    // PAYMENT: the mirror.
    const pmtCr = await pick('PmtV', 'CR');
    expect(pmtCr).toContain(LEDGER.CASH);
    expect(pmtCr).toContain(LEDGER.KVB);
    expect(pmtCr).not.toContain(fx.supplier);
    expect(await pick('PmtV', 'CR', tagged)).toEqual([]);
    const pmtDr = await pick('PmtV', 'DR');
    expect(pmtDr).not.toContain(LEDGER.CASH);
    expect(pmtDr).not.toContain(LEDGER.KVB);
    expect(await pick('PmtV', 'DR', tagged)).toEqual(
      expect.arrayContaining([fx.supplier, fx.stationery]),
    );

    // JOURNAL: no money side — both sides still offer Cash.
    expect(await pick('Jrl', 'DR')).toContain(LEDGER.CASH);
    expect(await pick('Jrl', 'CR')).toContain(LEDGER.CASH);
  });

  it('POST /validate — RcpV Cr Cash and PmtV Dr Cash are refused as a Contra; Jrl Dr Cash / Cr Bank passes (notes 56)', async () => {
    const lines = (dr: string, cr: string) => [
      { rowNo: 1, drCr: 'DR', ledgerId: dr, amount: 2500 },
      { rowNo: 2, drCr: 'CR', ledgerId: cr, amount: 2500 },
    ];
    const header = (typeCode: string) => ({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      typeCode,
      date: today(),
    });
    const refusals = (res: { body: { data: { refusals: { code: string; line?: number; message: string }[] } } }) =>
      res.body.data.refusals;

    const deposit = await post('validate', { header: header('RcpV'), lines: lines(LEDGER.KVB, LEDGER.CASH) });
    expectStatus(deposit, 200);
    expect(deposit.body.data.ok).toBe(false);
    expect(refusals(deposit).map((r) => r.code)).toEqual(['VCH_LEDGER_SIDE']);
    expect(refusals(deposit)[0].line).toBe(2);
    expect(refusals(deposit)[0].message).toMatch(/cash to bank is a Contra/);

    const withdrawal = await post('validate', { header: header('PmtV'), lines: lines(LEDGER.CASH, LEDGER.KVB) });
    expectStatus(withdrawal, 200);
    expect(refusals(withdrawal).map((r) => r.code)).toEqual(['VCH_LEDGER_SIDE']);
    expect(refusals(withdrawal)[0].line).toBe(1);
    expect(refusals(withdrawal)[0].message).toMatch(/bank to cash is a Contra/);

    const expense = await post('validate', { header: header('RcpV'), lines: lines(fx.stationery, fx.customer) });
    expectStatus(expense, 200);
    expect(refusals(expense).map((r) => r.code)).toContain('VCH_LEDGER_SIDE');
    expect(refusals(expense).find((r) => r.code === 'VCH_LEDGER_SIDE')?.message).toMatch(
      /may not be debited on a Receipt Voucher — the DR side takes cash or bank only/,
    );

    const journal = await post('validate', { header: header('Jrl'), lines: lines(LEDGER.CASH, LEDGER.KVB) });
    expectStatus(journal, 200);
    expect(journal.body.data.ok).toBe(true);
  });

  // ─── §11.1 #3 · a Contra with a Sundry Debtors ledger ────────────────────

  it('POST /validate — a Contra with a customer ledger is refused on the side rule; Cheques in Hand on any type (#3, #11)', async () => {
    const res = await post('validate', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'Con',
        date: today(),
      },
      lines: [
        { rowNo: 1, drCr: 'CR', ledgerId: LEDGER.CASH, amount: 85000 },
        { rowNo: 2, drCr: 'DR', ledgerId: fx.customer, amount: 85000 },
      ],
    });
    expectStatus(res, 200);
    expect(res.body.data.ok).toBe(false);
    expect(res.body.data.refusals.map((r: { code: string }) => r.code)).toEqual([
      'VCH_LEDGER_SIDE',
    ]);
    expect(res.body.data.refusals[0].line).toBe(2);

    const cheque = await post('validate', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'Jrl',
        date: today(),
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: LEDGER.CHEQUES, amount: 100 },
        { rowNo: 2, drCr: 'CR', ledgerId: fx.customer, amount: 100 },
      ],
    });
    expect(cheque.body.data.refusals.map((r: { code: string }) => r.code)).toEqual([
      'VCH_INSTRUMENT_LEDGER',
    ]);
    expect(cheque.body.data.refusals[0].message).toMatch(/51 \/ 52/);
  });

  // ─── §11.1 #1 · the Journal ──────────────────────────────────────────────

  it('POST /post — a Journal out by 0.01 is a 422 VCH_UNBALANCED; balanced it posts with two typed legs', async () => {
    const bad = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'Jrl',
        date: today(),
        remarks: `E2E-VCH-${fx.tag}`,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: fx.housekeeping, amount: 100 },
        { rowNo: 2, drCr: 'CR', ledgerId: fx.stationery, amount: 99.99 },
      ],
    });
    expect(bad.status).toBe(422);
    expect(codesOf(bad)).toEqual(['VCH_UNBALANCED']);

    const ok = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'Jrl',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} reclass`,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: fx.housekeeping, amount: 100 },
        { rowNo: 2, drCr: 'CR', ledgerId: fx.stationery, amount: 100 },
      ],
    });
    expectStatus(ok, 201);
    expect(ok.body.data.header.status).toBe('POSTED');
    expect(ok.body.data.header.voucherRefno).toMatch(/^jrl\d{5}$/);
    expect(ok.body.data.header.partyId).toBeNull();
    expect(ok.body.data.legs).toHaveLength(2);
    expect(ok.body.data.legs.every((l: { generated: boolean }) => !l.generated)).toBe(true);
    expect(ok.body.data.bills).toEqual([]);
  });

  // ─── §11.1 #5 · the PNG example ──────────────────────────────────────────

  let pua: { voucherId: string; refno: string; billId: string; billAccYear: string };

  it('POST /post — PurA, the PNG example: Input CGST 2,490 / SGST 2,490 / TDS 500 / party 33,480; bill +30; gdr + 2 vtx; atd', async () => {
    const res = await post('post', pngPayload());
    expectStatus(res, 201);
    const d = res.body.data;
    expect(d.header.voucherRefno).toMatch(/^pua\d{5}$/);
    expect(d.header.partyId).toBe(fx.supplier);
    const by = (name: RegExp) =>
      d.legs.find((l: { ledgerName: string }) => name.test(l.ledgerName));
    expect(by(/^Input CGST/)).toMatchObject({
      drCr: 'DR',
      amount: 2490,
      generated: true,
      role: 'INPUT_CGST',
    });
    expect(by(/^Input SGST/)).toMatchObject({
      drCr: 'DR',
      amount: 2490,
      generated: true,
      role: 'INPUT_SGST',
    });
    expect(by(/^TDS Payable/)).toMatchObject({
      drCr: 'CR',
      amount: 500,
      generated: true,
      role: 'TDS_PAYABLE',
    });
    const party = d.legs.find((l: { ledgerId: string }) => l.ledgerId === fx.supplier);
    expect(party).toMatchObject({ drCr: 'CR', amount: 33480, generated: true, rowNo: 6 });
    expect(
      d.legs
        .filter((l: { generated: boolean }) => !l.generated)
        .map((l: { rowNo: number }) => l.rowNo),
    ).toEqual([1, 2]);
    expect(d.header.totalDebit).toBe(33980);
    expect(d.header.totalCredit).toBe(33980);
    expect(d.legs[0].oppLedgerId).toBe(fx.supplier);

    expect(d.bills).toHaveLength(1);
    expect(d.bills[0]).toMatchObject({
      billType: 'PURCHASE',
      side: 'CR',
      billAmount: 33480,
      pendingAmount: 33480,
      docRefno: `SFS/${fx.tag}`,
    });
    const due = new Date(`${today()}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 30);
    expect(d.bills[0].dueDate).toBe(due.toISOString().slice(0, 10));

    expect(d.gstDoc).toMatchObject({
      docType: 'INVOICE',
      docStatus: 'POSTED',
      supplyNature: 'INTRA_STATE',
      isReverseCharge: false,
      taxable: 29000,
      cgst: 2490,
      sgst: 2490,
      billValue: 33980,
    });
    expect(
      d.gstDoc.lines.map((l: { rowNo: number; itcEligibility: string }) => [
        l.rowNo,
        l.itcEligibility,
      ]),
    ).toEqual([
      [1, 'INPUT_SERVICES'],
      [2, 'INPUTS'],
    ]);
    expect(d.tds).toHaveLength(1);
    expect(d.tds[0]).toMatchObject({
      section: '194C',
      rate: 2,
      base: 25000,
      tax: 500,
      rateSource: 'MASTER',
      deducteeType: 'NON_COMPANY',
    });

    pua = {
      voucherId: d.header.voucherId,
      refno: d.header.voucherRefno,
      billId: d.bills[0].ablId,
      billAccYear: d.bills[0].ablAccYear,
    };

    // the rows, straight from the tables
    const [gdr] = await prisma.$queryRaw<
      { gdr_source_module: string; gdr_party_type: string; n: bigint }[]
    >`
      SELECT g.gdr_source_module::text, g.gdr_party_type::text,
             (SELECT count(*) FROM accounts.acc_voucher_doc_detail v WHERE v.vtx_gdr_id = g.gdr_id) AS n
        FROM accounts.acc_voucher_doc_register g WHERE g.gdr_voucher_id = ${pua.voucherId}::uuid`;
    expect(gdr).toMatchObject({ gdr_source_module: 'ACCOUNTS', gdr_party_type: 'VENDOR' });
    expect(Number(gdr.n)).toBe(2);
    const [atd] = await prisma.$queryRaw<
      { atd_direction: string; atd_quarter: string; atd_bill_id: string | null }[]
    >`
      SELECT atd_direction, atd_quarter, atd_bill_id FROM accounts.acc_tds_register WHERE atd_voucher_id = ${pua.voucherId}::uuid`;
    expect(atd).toMatchObject({ atd_direction: 'DEDUCTED', atd_bill_id: pua.billId });
  });

  it('POST /validate — answers the legs /post wrote (#19), and the party facts / open bills / balance agree', async () => {
    const res = await post('validate', pngPayload({}, `SFS/${fx.tag}-V`));
    expectStatus(res, 200);
    expect(res.body.data.ok).toBe(true);
    const legs = res.body.data.derived.legs.map(
      (l: { drCr: string; ledgerId: string; amount: number }) => [l.drCr, l.ledgerId, l.amount],
    );
    const posted = (
      await get('get', {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        voucherId: pua.voucherId,
      })
    ).body.data.legs.map((l: { drCr: string; ledgerId: string; amount: number }) => [
      l.drCr,
      l.ledgerId,
      l.amount,
    ]);
    expect(legs).toEqual(posted);
    expect(res.body.data.derived.tds).toMatchObject({ deducted: true, tax: 500 });

    const facts = await get('party-facts', {
      companyId: COMPANY,
      partyId: fx.supplier,
      asOn: today(),
    });
    expect(facts.body.data).toMatchObject({
      isBillByBill: true,
      gstin: '33AAAFS1234A1Z5',
      stateCode: '33',
    });
    expect(facts.body.data.tds).toMatchObject({
      applicable: true,
      section: '194C',
      rate: 2,
      rateSource: 'MASTER',
    });
    expect(facts.body.data.outstanding).toEqual({ amount: 33480, side: 'CR' });

    const open = await get('open-bills', { companyId: COMPANY, partyId: fx.supplier, side: 'CR' });
    expect(
      open.body.data.bills.map((b: { ablId: string; pending: number }) => [b.ablId, b.pending]),
    ).toEqual([[pua.billId, 33480]]);

    const bal = await get('ledger-balance', {
      companyId: COMPANY,
      accYear: ACC_YEAR,
      ledgerId: fx.supplier,
      asOn: today(),
    });
    expect(bal.body.data).toMatchObject({ amount: 33480, side: 'CR' });
    const [fn] = await prisma.$queryRaw<{ bal: unknown }[]>`
      SELECT accounts.fn_ledger_book_balance(${COMPANY}::uuid, ${fx.supplier}::uuid, ${ACC_YEAR}::char(9)) AS bal`;
    expect(Math.abs(num(fn.bal))).toBe(33480);
  });

  it('POST /post — the same supplier document number again is refused (ux_avh_doc_refno, VCH_DUP_DOC_REFNO)', async () => {
    const res = await post('post', pngPayload());
    expect(res.status).toBe(422);
    expect(codesOf(res)).toContain('VCH_DUP_DOC_REFNO');
  });

  it('POST /post — #8 a typed Input CGST line on PurA → VCH_GST_LEDGER_TYPED; #6 an outside state → IGST', async () => {
    const typed = pngPayload({}, `SFS/${fx.tag}-T`);
    typed.lines.push({
      rowNo: 3,
      drCr: 'DR',
      ledgerId: fx.inputCgst,
      amount: 1,
      remarks: 'typed tax',
      gst: null as never,
      tdsBase: false,
    });
    const bad = await post('post', typed);
    expect(bad.status).toBe(422);
    expect(codesOf(bad)).toContain('VCH_GST_LEDGER_TYPED');

    const inter = await post('validate', pngPayload({ posStcd: '29' }, `SFS/${fx.tag}-I`));
    expect(inter.body.data.ok).toBe(true);
    const igst = inter.body.data.derived.legs.find(
      (l: { role: string }) => l.role === 'INPUT_IGST',
    );
    expect(igst).toMatchObject({ amount: 4980, drCr: 'DR' });
    expect(
      inter.body.data.derived.legs.find((l: { role: string }) => l.role === 'INPUT_CGST'),
    ).toBeUndefined();
    expect(inter.body.data.derived.gst.supplyNature).toBe('INTER_STATE');
  });

  it('POST /post — #7 reverse charge: DR Input, CR RCM payable, the party is owed the taxable less TDS', async () => {
    const res = await post(
      'post',
      pngPayload({ reverseCharge: true, remarks: `E2E-VCH-${fx.tag} RCM` }, `SFS/${fx.tag}-RCM`),
    );
    expectStatus(res, 201);
    const d = res.body.data;
    const rcm = d.legs.filter((l: { role: string | null }) => l.role?.startsWith('RCM_'));
    expect(
      rcm.map((l: { role: string; drCr: string; amount: number }) => [l.role, l.drCr, l.amount]),
    ).toEqual([
      ['RCM_CGST_PAYABLE', 'CR', 2490],
      ['RCM_SGST_PAYABLE', 'CR', 2490],
    ]);
    expect(d.legs.find((l: { ledgerId: string }) => l.ledgerId === fx.supplier)).toMatchObject({
      drCr: 'CR',
      amount: 28500,
    });
    expect(d.gstDoc).toMatchObject({ isReverseCharge: true, billValue: 29000 });
  });

  // ─── §11.1 #9 · the credit note ──────────────────────────────────────────

  it('POST /post — a Credit Note with tax puts output tax on DR and writes a CREDIT_NOTE doc; without tax, no doc (S21)', async () => {
    const withTax = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'CrN',
        date: today(),
        partyId: fx.customer,
        remarks: `E2E-VCH-${fx.tag} rate diff`,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: fx.stationery, amount: 4000, gst: { taxId: fx.tax18 } },
      ],
    });
    expectStatus(withTax, 201);
    const d = withTax.body.data;
    expect(d.legs.find((l: { role: string }) => l.role === 'OUTPUT_CGST')).toMatchObject({
      drCr: 'DR',
      amount: 360,
    });
    expect(d.legs.find((l: { ledgerId: string }) => l.ledgerId === fx.customer)).toMatchObject({
      drCr: 'CR',
      amount: 4720,
    });
    expect(d.gstDoc).toMatchObject({ docType: 'CREDIT_NOTE' });
    expect(d.bills[0]).toMatchObject({
      billType: 'JOURNAL',
      side: 'CR',
      billAmount: 4720,
      status: 'OPEN',
    });

    const plain = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'CrN',
        date: today(),
        partyId: fx.customer,
        remarks: `E2E-VCH-${fx.tag} plain note`,
      },
      lines: [{ rowNo: 1, drCr: 'DR', ledgerId: fx.stationery, amount: 1000 }],
    });
    expect(plain.status).toBe(201);
    expect(plain.body.data.gstDoc).toBeNull();
    expect(plain.body.data.legs).toHaveLength(2);
  });

  // ─── §11.1 #18 · the draft, then its post ────────────────────────────────

  it('POST /create → /get → /post — a DRAFT writes no rows and round-trips its payload; posting numbers it', async () => {
    const payload = pngPayload({ remarks: `E2E-VCH-${fx.tag} draft` }, `SFS/${fx.tag}-D`);
    const created = await post('create', payload);
    expectStatus(created, 201);
    const { voucherId } = created.body.data;
    const keys = { companyId: COMPANY, branchId: BRANCH, accYear: ACC_YEAR, voucherId };

    const [rows] = await prisma.$queryRaw<
      { av: bigint; abj: bigint; abl: bigint; gdr: bigint; atd: bigint }[]
    >`
      SELECT (SELECT count(*) FROM accounts.acc_vouchers WHERE av_voucher_id = ${voucherId}::uuid) AS av,
             (SELECT count(*) FROM accounts.acc_bill_adjustment WHERE abj_voucher_id = ${voucherId}::uuid) AS abj,
             (SELECT count(*) FROM accounts.acc_bill_balance WHERE abl_voucher_id = ${voucherId}::uuid) AS abl,
             (SELECT count(*) FROM accounts.acc_voucher_doc_register WHERE gdr_voucher_id = ${voucherId}::uuid) AS gdr,
             (SELECT count(*) FROM accounts.acc_tds_register WHERE atd_voucher_id = ${voucherId}::uuid) AS atd`;
    expect([rows.av, rows.abj, rows.abl, rows.gdr, rows.atd].map(Number)).toEqual([0, 0, 0, 0, 0]);

    const got = await get('get', keys);
    expect(got.status).toBe(200);
    expect(got.body.data.header).toMatchObject({
      status: 'DRAFT',
      voucherRefno: null,
      voucherNo: null,
    });
    expect(got.body.data.draft).toEqual(JSON.parse(JSON.stringify(payload)));
    expect(got.body.data.locks.editable).toBe(true);

    // an edit keeps the id
    const again = await post('create', {
      ...payload,
      header: { ...payload.header, voucherId, remarks: 'edited' },
    });
    expect(again.status).toBe(201);
    expect(again.body.data).toMatchObject({ voucherId, created: false });

    const posted = await post('post', { ...payload, header: { ...payload.header, voucherId } });
    expectStatus(posted, 201);
    expect(posted.body.data.header).toMatchObject({ voucherId, status: 'POSTED' });
    expect(posted.body.data.header.voucherRefno).toMatch(/^pua\d{5}$/);
    expect(posted.body.data.draft).toBeNull();

    // a posted voucher cannot be edited or deleted
    const edit = await post('create', { ...payload, header: { ...payload.header, voucherId } });
    expect(edit.status).toBe(409);
    expect(codesOf(edit)).toEqual(['VCH_POSTED']);
    const del = await post('delete', keys);
    expect(del.status).toBe(409);
    expect(codesOf(del)).toEqual(['VCH_POSTED']);
  });

  it('POST /delete — a DRAFT is thrown away; a second delete is a 404', async () => {
    const created = await post('create', pngPayload({}, `SFS/${fx.tag}-DEL`));
    const keys = {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: created.body.data.voucherId,
    };
    const del = await post('delete', keys);
    expect(del.status).toBe(201);
    expect(del.body.data.deleted).toBe(true);
    expect((await post('delete', keys)).status).toBe(404);
    expect((await get('get', keys)).status).toBe(404);
  });

  // ─── §11.1 #10 / #12 / #15 / #16 · payment, rights, cancel ───────────────

  let pmv: { voucherId: string };

  it('POST /post — a Payment Voucher allocates its party line: a remainder previews as an ADVANCE (notes 57), over-allocation is refused (#10); then it settles the PurA bill', async () => {
    // notes (53): a Payment names its parties on the lines. The supplier is
    // 194C, so its line would deduct TDS; the tick is cleared to pay 5,000 flat.
    const payLines = [
      { rowNo: 1, drCr: 'DR', ledgerId: fx.supplier, amount: 5000, tdsBase: false },
      { rowNo: 2, drCr: 'CR', ledgerId: LEDGER.KVB, amount: 5000 },
    ];
    const pay = (allocated: number) => ({
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'PmtV',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} pay`,
      },
      lines: payLines,
      allocations: [
        { lineRowNo: 1, billId: pua.billId, billAccYear: pua.billAccYear, amount: allocated },
      ],
    });
    // short by 1,000: not refused any more — the remainder would be a DR advance on the supplier
    const short = await post('validate', pay(4000));
    expectStatus(short, 200);
    expect(short.body.data.ok).toBe(true);
    expect(short.body.data.derived.bills).toEqual([
      expect.objectContaining({ partyId: fx.supplier, billType: 'ADVANCE', side: 'DR', amount: 1000, isAdvance: true }),
    ]);
    // over by 1,000: still refused
    const over = await post('post', pay(6000));
    expect(over.status).toBe(422);
    expect(codesOf(over)).toContain('VCH_BILLWISE_SHORT');

    const ok = await post('post', pay(5000));
    expectStatus(ok, 201);
    expect(ok.body.data.bills).toEqual([]);
    pmv = { voucherId: ok.body.data.header.voucherId };
    expect(ok.body.data.header.voucherRefno).toMatch(/^pmv\d{5}$/);
    expect(ok.body.data.allocations).toHaveLength(1);
    expect(ok.body.data.allocations[0]).toMatchObject({
      billId: pua.billId,
      adjType: 'ALLOCATION',
      drCr: 'DR',
      amount: 5000,
    });
    const [bill] = await prisma.$queryRaw<{ abl_pending_amount: unknown; abl_status: string }[]>`
      SELECT abl_pending_amount, abl_status FROM accounts.acc_bill_balance WHERE abl_id = ${pua.billId}::uuid`;
    expect(num(bill.abl_pending_amount)).toBe(28480);
    expect(bill.abl_status).toBe('PARTIAL');
  });

  it('POST /cancel — refused while the payment stands against its bill (#16); after the payment is cancelled, it reverses (#15)', async () => {
    const keys = {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: pua.voucherId,
    };
    const blocked = await post('cancel', { ...keys, reason: 'Keyed wrong' });
    expect(blocked.status).toBe(409);
    expect(codesOf(blocked)).toEqual(['VCH_ALLOCATED_ELSEWHERE']);

    const payCancel = await post('cancel', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: pmv.voucherId,
      reason: 'Duplicate',
    });
    expectStatus(payCancel, 201);
    expect(payCancel.body.data).toMatchObject({ allocationsReversed: 1, billsClosed: 0 });
    expect(payCancel.body.data.reversalRefno).toMatch(/^rev\d{5}$/);
    const [reopened] = await prisma.$queryRaw<{ abl_pending_amount: unknown }[]>`
      SELECT abl_pending_amount FROM accounts.acc_bill_balance WHERE abl_id = ${pua.billId}::uuid`;
    expect(num(reopened.abl_pending_amount)).toBe(33480);

    const [before] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM accounts.acc_voucher_header h JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       WHERE t.vchr_type_code = 'Rev' AND h.avh_company_id = ${COMPANY}::uuid`;
    const cancelled = await post('cancel', { ...keys, reason: 'Wrong party' });
    expectStatus(cancelled, 201);
    expect(cancelled.body.data).toMatchObject({
      voucherRefno: pua.refno,
      billsClosed: 1,
      gstDocCancelled: true,
      tdsReversed: 1,
    });
    expect(cancelled.body.data.reversalRefno).toMatch(/^rev\d{5}$/);
    const [after] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM accounts.acc_voucher_header h JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       WHERE t.vchr_type_code = 'Rev' AND h.avh_company_id = ${COMPANY}::uuid`;
    expect(Number(after.n)).toBe(Number(before.n) + 1);

    const got = await get('get', keys);
    expect(got.body.data.header).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Wrong party',
    });
    expect(got.body.data.header.reversalRefno).toBe(cancelled.body.data.reversalRefno);
    expect(got.body.data.gstDoc.docStatus).toBe('CANCELED');
    expect(
      got.body.data.tds.map((t: { tax: number; isReversal: boolean }) => [t.tax, t.isReversal]),
    ).toEqual([
      [500, false],
      [-500, true],
    ]);
    expect(got.body.data.bills[0].isDeleted).toBe(true);

    // the mirror: type Rev, dated the original, every leg flipped, linked both ways
    const rev = await get('get', { ...keys, voucherId: cancelled.body.data.reversalVoucherId });
    expect(rev.status).toBe(200);
    expect(rev.body.data.header).toMatchObject({
      typeCode: 'Rev',
      date: today(),
      againstVoucherId: pua.voucherId,
      againstRefno: pua.refno,
    });
    expect(
      rev.body.data.legs.find((l: { ledgerId: string }) => l.ledgerId === fx.supplier),
    ).toMatchObject({ drCr: 'DR', amount: 33480 });

    // a second cancel is a 409; the ledger nets to zero
    expect((await post('cancel', { ...keys, reason: 'again' })).status).toBe(409);
    const bal = await get('ledger-balance', {
      companyId: COMPANY,
      accYear: ACC_YEAR,
      ledgerId: fx.supplier,
      asOn: today(),
    });
    // the RCM PurA (28,500 CR) and the draft-posted PurA (33,480 CR) still stand
    expect(bal.body.data).toMatchObject({ amount: 61980, side: 'CR' });
  });

  it('POST /post — #15 the next PurA takes the next number: the cancelled one burned nothing', async () => {
    const seq = Number(pua.refno.replace(/\D/g, ''));
    const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM accounts.acc_voucher_header h JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       WHERE t.vchr_type_code = 'PurA' AND h.avh_company_id = ${COMPANY}::uuid AND h.avh_branch_id = ${BRANCH}::uuid
         AND h.avh_acc_year = ${ACC_YEAR}::char(9) AND h.avh_voucher_no > ${seq}`;
    const res = await post(
      'post',
      pngPayload({ remarks: `E2E-VCH-${fx.tag} next` }, `SFS/${fx.tag}-N`),
    );
    expectStatus(res, 201);
    expect(Number(res.body.data.header.voucherRefno.replace(/\D/g, ''))).toBe(seq + Number(n) + 1);
  });

  it('POST /post — #14 two concurrent PurA posts get different numbers', async () => {
    const [a, b] = await Promise.all([
      post('post', pngPayload({ remarks: `E2E-VCH-${fx.tag} c1` }, `SFS/${fx.tag}-C1`)),
      post('post', pngPayload({ remarks: `E2E-VCH-${fx.tag} c2` }, `SFS/${fx.tag}-C2`)),
    ]);
    expectStatus(a, 201);
    expectStatus(b, 201);
    expect(a.body.data.header.voucherRefno).not.toBe(b.body.data.header.voucherRefno);
  });

  it('rights (#12) — create without post saves a draft and gets 403 VCH_RIGHT_POST on post', async () => {
    await setRight(163, 'um_can_post', false);
    try {
      const draft = await post('create', pngPayload({}, `SFS/${fx.tag}-R`));
      expect(draft.status).toBe(201);
      const denied = await post('post', {
        ...pngPayload({}, `SFS/${fx.tag}-R`),
        header: {
          ...pngPayload().header,
          docRefno: `SFS/${fx.tag}-R`,
          voucherId: draft.body.data.voucherId,
        },
      });
      expect(denied.status).toBe(403);
      expect(codesOf(denied)).toEqual(['VCH_RIGHT_POST']);
      await post('delete', {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        voucherId: draft.body.data.voucherId,
      });
    } finally {
      await setRight(163, 'um_can_post', true);
    }
  });

  it('GET /tax-rates and a bad key are answered as documented', async () => {
    const rates = await get('tax-rates', { companyId: COMPANY });
    expect(rates.status).toBe(200);
    expect(rates.body.data.rates.some((r: { ratePerc: number }) => r.ratePerc === 18)).toBe(true);
    const missing = await get('get', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    });
    expect(missing.status).toBe(404);
    const malformed = await post('post', { header: { companyId: COMPANY }, lines: [] });
    expect(malformed.status).toBe(400);
  });

  // ─── notes (53) · Receipt / Payment Voucher with MANY parties ────────────

  /** A Journal that raises one JOURNAL bill on `party` — the bills the runs below settle. */
  async function journalBill(
    party: string,
    side: 'DR' | 'CR',
    amount: number,
  ): Promise<{ billId: string; billAccYear: string }> {
    const res = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'Jrl',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} bill for a run`,
      },
      lines: [
        { rowNo: 1, drCr: side, ledgerId: party, amount, tdsBase: false },
        {
          rowNo: 2,
          drCr: side === 'DR' ? 'CR' : 'DR',
          ledgerId: fx.housekeeping,
          amount,
          tdsBase: false,
        },
      ],
      allocations: [],
    });
    expectStatus(res, 201);
    expect(res.body.data.bills).toHaveLength(1);
    return {
      billId: res.body.data.bills[0].ablId,
      billAccYear: res.body.data.bills[0].ablAccYear,
    };
  }

  const pending = async (billId: string): Promise<number> => {
    const [b] = await prisma.$queryRaw<{ abl_pending_amount: unknown }[]>`
      SELECT abl_pending_amount FROM accounts.acc_bill_balance WHERE abl_id = ${billId}::uuid`;
    return num(b.abl_pending_amount);
  };

  it('POST /post — a collection run: one Receipt, two customers, each settling its own bills; one short → only it keeps an advance (notes 57)', async () => {
    const custA = await ledger(
      `E2E-VCH-${fx.tag} Run Customer A`,
      GROUP.CUSTOMERS,
      ', led_is_bill_by_bill',
      ', true',
    );
    const custB = await ledger(
      `E2E-VCH-${fx.tag} Run Customer B`,
      GROUP.CUSTOMERS,
      ', led_is_bill_by_bill',
      ', true',
    );
    const a1 = await journalBill(custA, 'DR', 6000);
    const a2 = await journalBill(custA, 'DR', 4000);
    const b1 = await journalBill(custB, 'DR', 5000);
    const receipt = (bAllocated: number) => ({
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'RcpV',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} collection run`,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: LEDGER.CASH, amount: 15000 },
        { rowNo: 2, drCr: 'CR', ledgerId: custA, amount: 10000 },
        { rowNo: 3, drCr: 'CR', ledgerId: custB, amount: 5000 },
      ],
      allocations: [
        { lineRowNo: 2, ...a1, amount: 6000 },
        { lineRowNo: 2, ...a2, amount: 4000 },
        { lineRowNo: 3, ...b1, amount: bAllocated },
      ],
    });

    const short = await post('validate', receipt(4000));
    expectStatus(short, 200);
    expect(short.body.data.ok).toBe(true);
    expect(short.body.data.derived.bills).toEqual([
      expect.objectContaining({ lineRowNo: 3, partyId: custB, billType: 'ADVANCE', side: 'CR', amount: 1000 }),
    ]);
    expect(JSON.stringify(short.body.data.derived.bills)).not.toContain(custA);

    const ok = await post('post', receipt(5000));
    expectStatus(ok, 201);
    expect(ok.body.data.header.partyId).toBeNull();
    expect(await pending(a1.billId)).toBe(0);
    expect(await pending(a2.billId)).toBe(0);
    expect(await pending(b1.billId)).toBe(0);
    const adj = await prisma.$queryRaw<
      { abj_bill_id: string; abj_party_id: string; abj_amount: unknown }[]
    >`
      SELECT j.abj_bill_id, j.abj_party_id, j.abj_amount
        FROM accounts.acc_bill_adjustment j
       WHERE j.abj_bill_id IN (${a1.billId}::uuid, ${a2.billId}::uuid, ${b1.billId}::uuid)
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
       ORDER BY j.abj_amount DESC`;
    expect(adj.map((r) => [r.abj_bill_id, r.abj_party_id, num(r.abj_amount)])).toEqual([
      [a1.billId, custA, 6000],
      [b1.billId, custB, 5000],
      [a2.billId, custA, 4000],
    ]);
  });

  // ─── notes (57) · the remainder is kept as an ADVANCE ─────────────────────

  it('POST /post — RcpV 16,000 with 15,000 allocated keeps a 1,000 ADVANCE; over-allocation refused; a Journal adjusts it; cancel retracts it (notes 57)', async () => {
    const cust = await ledger(
      `E2E-VCH-${fx.tag} Advance Customer`,
      GROUP.CUSTOMERS,
      ', led_is_bill_by_bill',
      ', true',
    );
    const c1 = await journalBill(cust, 'DR', 15000);
    const c2 = await journalBill(cust, 'DR', 5000);
    const receipt = (allocations: { lineRowNo: number; billId: string; billAccYear: string; amount: number }[]) => ({
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'RcpV',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} advance receipt`,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: LEDGER.CASH, amount: 16000 },
        { rowNo: 2, drCr: 'CR', ledgerId: cust, amount: 16000 },
      ],
      allocations,
    });

    // over: 15,000 + 5,000 set against a party amount of 16,000
    const over = await post('post', receipt([
      { lineRowNo: 2, ...c1, amount: 15000 },
      { lineRowNo: 2, ...c2, amount: 5000 },
    ]));
    expect(over.status).toBe(422);
    expect(codesOf(over)).toEqual(['VCH_BILLWISE_SHORT']);
    expect(JSON.stringify(over.body)).toContain('is allocated against a party amount of');

    // validate says so before Post
    const preview = await post('validate', receipt([{ lineRowNo: 2, ...c1, amount: 15000 }]));
    expectStatus(preview, 200);
    expect(preview.body.data.ok).toBe(true);
    expect(preview.body.data.derived.bills).toEqual([
      expect.objectContaining({
        lineRowNo: 2,
        partyId: cust,
        billType: 'ADVANCE',
        side: 'CR',
        amount: 1000,
        dueDate: null,
        isAdvance: true,
      }),
    ]);

    // short: the 1,000 remainder is one ADVANCE CR bill on the customer
    const ok = await post('post', receipt([{ lineRowNo: 2, ...c1, amount: 15000 }]));
    expectStatus(ok, 201);
    const voucherId = ok.body.data.header.voucherId as string;
    expect(await pending(c1.billId)).toBe(0);
    expect(ok.body.data.bills).toHaveLength(1);
    const adv = ok.body.data.bills[0];
    expect(adv).toMatchObject({
      billType: 'ADVANCE',
      side: 'CR',
      billAmount: 1000,
      pendingAmount: 1000,
      dueDate: null,
      isDeleted: false,
    });
    expect(adv.docRefno).toBe(ok.body.data.header.voucherRefno);
    const [row] = await prisma.$queryRaw<
      { abl_party_id: string; abl_voucher_id: string; abl_doc_date: Date; abl_due_date: Date | null; abl_bill_type: string }[]
    >`SELECT abl_party_id, abl_voucher_id, abl_doc_date, abl_due_date, abl_bill_type
        FROM accounts.acc_bill_balance WHERE abl_id = ${adv.ablId}::uuid`;
    expect(row).toMatchObject({ abl_party_id: cust, abl_voucher_id: voucherId, abl_due_date: null, abl_bill_type: 'ADVANCE' });
    expect(row.abl_doc_date.toISOString().slice(0, 10)).toBe(today());
    // …and it sits in the customer's credits, where a later receipt or sale bill finds it
    const credits = await get('open-bills', { companyId: COMPANY, partyId: cust, side: 'CR' });
    expectStatus(credits, 200);
    expect(credits.body.data.bills.map((b: { ablId: string; billType: string; pending: number }) => [b.ablId, b.billType, b.pending])).toEqual([
      [adv.ablId, 'ADVANCE', 1000],
    ]);

    // a later Journal on the customer adjusts the advance (ADVANCE_ADJUST pair)
    const jrl = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'Jrl',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} adjusts the advance`,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: cust, amount: 1000, tdsBase: false },
        { rowNo: 2, drCr: 'CR', ledgerId: fx.housekeeping, amount: 1000, tdsBase: false },
      ],
      allocations: [{ lineRowNo: 1, billId: adv.ablId, billAccYear: adv.ablAccYear, amount: 1000 }],
    });
    expectStatus(jrl, 201);
    expect(jrl.body.data.allocations.map((a: { adjType: string; amount: number }) => [a.adjType, a.amount])).toEqual(
      expect.arrayContaining([['ADVANCE_ADJUST', 1000]]),
    );
    expect(await pending(adv.ablId)).toBe(0);

    // while the advance stands settled elsewhere, the receipt cannot be cancelled
    const keys = { companyId: COMPANY, branchId: BRANCH, accYear: ACC_YEAR, voucherId };
    const blocked = await post('cancel', { ...keys, reason: 'Keyed wrong' });
    expect(blocked.status).toBe(409);
    expect(codesOf(blocked)).toEqual(['VCH_ALLOCATED_ELSEWHERE']);

    // release it, then cancel: the advance is retracted with the allocation
    expectStatus(
      await post('cancel', { ...keys, voucherId: jrl.body.data.header.voucherId, reason: 'Release the advance' }),
      201,
    );
    expect(await pending(adv.ablId)).toBe(1000);
    const cancelled = await post('cancel', { ...keys, reason: 'Wrong customer' });
    expectStatus(cancelled, 201);
    expect(cancelled.body.data).toMatchObject({ allocationsReversed: 1, billsClosed: 1 });
    expect(await pending(c1.billId)).toBe(15000);
    const [gone] = await prisma.$queryRaw<{ abl_is_deleted: boolean }[]>`
      SELECT abl_is_deleted FROM accounts.acc_bill_balance WHERE abl_id = ${adv.ablId}::uuid`;
    expect(gone.abl_is_deleted).toBe(true);
    const after = await get('open-bills', { companyId: COMPANY, partyId: cust, side: 'CR' });
    expect(after.body.data.bills).toEqual([]);
  });

  it('POST /post — PmtV with TDS allocated short keeps gross − allocated as a DR ADVANCE on the supplier (notes 57)', async () => {
    const sup = await ledger(
      `E2E-VCH-${fx.tag} Advance Supplier`,
      GROUP.SUPPLIERS,
      ', led_is_bill_by_bill, led_is_tds_applicable, led_tds_nature_of_payment, led_tds_deductee_type, led_pan_no',
      ", true, true, '194C', 'FIRM', 'AAAFR3333C'",
    );
    const bill = await journalBill(sup, 'CR', 10000);
    // 9,800 net out of the bank = 10,000 gross; 9,000 set against the bill; 1,000 owed ahead
    const res = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'PmtV',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} advance payment`,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: sup, amount: 9800 },
        { rowNo: 2, drCr: 'CR', ledgerId: LEDGER.KVB, amount: 9800 },
      ],
      allocations: [{ lineRowNo: 1, ...bill, amount: 9000 }],
    });
    expectStatus(res, 201);
    const data = res.body.data;
    expect(data.legs.filter((l: { ledgerId: string }) => l.ledgerId === sup).map((l: { amount: number }) => l.amount)).toEqual([10000]);
    expect(
      data.legs.filter((l: { role: string | null }) => l.role === 'TDS_PAYABLE').map((l: { drCr: string; amount: number }) => [l.drCr, l.amount]),
    ).toEqual([['CR', 200]]);
    expect(await pending(bill.billId)).toBe(1000);
    expect(data.bills).toHaveLength(1);
    expect(data.bills[0]).toMatchObject({ billType: 'ADVANCE', side: 'DR', billAmount: 1000, dueDate: null });
    const debits = await get('open-bills', { companyId: COMPANY, partyId: sup, side: 'DR' });
    expect(debits.body.data.bills.map((b: { billType: string; pending: number }) => [b.billType, b.pending])).toEqual([['ADVANCE', 1000]]);

    const cancelled = await post('cancel', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: data.header.voucherId,
      reason: 'Paid ahead by mistake',
    });
    expectStatus(cancelled, 201);
    expect(cancelled.body.data).toMatchObject({ tdsReversed: 1, allocationsReversed: 1, billsClosed: 1 });
    expect(await pending(bill.billId)).toBe(10000);
  });

  it('POST /post → /cancel — a payment run deducts 194C per supplier line: grossed up, one TDS leg and one atd row each', async () => {
    const supplier = (name: string, pan: string) =>
      ledger(
        `E2E-VCH-${fx.tag} ${name}`,
        GROUP.SUPPLIERS,
        ', led_is_bill_by_bill, led_is_tds_applicable, led_tds_nature_of_payment, led_tds_deductee_type, led_pan_no',
        `, true, true, '194C', 'FIRM', '${pan}'`,
      );
    const supA = await supplier('Run Supplier A', 'AAAFR1111A');
    const supB = await supplier('Run Supplier B', 'AAAFR2222B');
    const billA = await journalBill(supA, 'CR', 10000);
    const billB = await journalBill(supB, 'CR', 5000);

    // the NET paid: 9,800 + 4,900 out of the bank; 2% of 10,000 and of 5,000 withheld
    const res = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'PmtV',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} payment run`,
      },
      lines: [
        { rowNo: 1, drCr: 'DR', ledgerId: supA, amount: 9800 },
        { rowNo: 2, drCr: 'DR', ledgerId: supB, amount: 4900 },
        { rowNo: 3, drCr: 'CR', ledgerId: LEDGER.KVB, amount: 14700 },
      ],
      allocations: [
        { lineRowNo: 1, ...billA, amount: 10000 },
        { lineRowNo: 2, ...billB, amount: 5000 },
      ],
    });
    expectStatus(res, 201);
    const data = res.body.data;
    const legOf = (ledgerId: string) =>
      data.legs.filter((l: { ledgerId: string }) => l.ledgerId === ledgerId);
    expect(legOf(supA).map((l: { amount: number }) => l.amount)).toEqual([10000]);
    expect(legOf(supB).map((l: { amount: number }) => l.amount)).toEqual([5000]);
    expect(
      data.legs
        .filter((l: { role: string | null }) => l.role === 'TDS_PAYABLE')
        .map((l: { drCr: string; amount: number }) => [l.drCr, l.amount]),
    ).toEqual([
      ['CR', 200],
      ['CR', 100],
    ]);
    expect(await pending(billA.billId)).toBe(0);
    expect(await pending(billB.billId)).toBe(0);
    const atd = await prisma.$queryRaw<
      { atd_party_id: string; atd_base_amount: unknown; atd_tax_amount: unknown }[]
    >`
      SELECT atd_party_id, atd_base_amount, atd_tax_amount FROM accounts.acc_tds_register
       WHERE atd_voucher_id = ${data.header.voucherId}::uuid AND atd_is_deleted = false
       ORDER BY atd_base_amount DESC`;
    expect(atd.map((r) => [r.atd_party_id, num(r.atd_base_amount), num(r.atd_tax_amount)])).toEqual(
      [
        [supA, 10000, 200],
        [supB, 5000, 100],
      ],
    );

    const cancelled = await post('cancel', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: data.header.voucherId,
      reason: 'Paid twice',
    });
    expectStatus(cancelled, 201);
    expect(cancelled.body.data).toMatchObject({ tdsReversed: 2, allocationsReversed: 2 });
    expect(await pending(billA.billId)).toBe(10000);
    expect(await pending(billB.billId)).toBe(5000);
  });

  // ─── notes (54) · the Receipt Voucher takes cheques ──────────────────────

  const plusDays = (days: number): string => {
    const d = new Date(`${today()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const cheques = (path: string, body: object) =>
    h.http.post(`${API}/cheques/${path}`).set('Authorization', BEARER).send(body);

  it('GET /instruments and /types — the usable tenders, and RcpV carries instruments', async () => {
    const types = await get('types', { companyId: COMPANY, menuId: 260 });
    expect(
      types.body.data.types.map((t: { typeCode: string; instruments: boolean }) => [
        t.typeCode,
        t.instruments,
      ]),
    ).toEqual([['RcpV', true]]);

    const res = await get('instruments', { companyId: COMPANY, branchId: BRANCH });
    expectStatus(res, 200);
    const names = res.body.data.tenders.map((t: { typeName: string }) => t.typeName);
    expect(names).toEqual(expect.arrayContaining(['CASH', 'CHEQUE', 'UPI']));
    expect(names).not.toContain('TEMP_CR');
    expect(names).not.toContain('CREDIT');
    expect(names).not.toContain('LOYALTY');
    expect(names).not.toContain('RRN');
    const chq = res.body.data.tenders.find((t: { isCheque: boolean }) => t.isCheque);
    // needsRef follows the MASTER row (tnd_needs_ref), which on this box is off for the cheque tender;
    // a cheque is required to carry its number regardless (VCH_CHEQUE_DETAILS)
    expect(chq).toMatchObject({ isCash: false, ledgerId: LEDGER.CHEQUES });
    expect(typeof chq.needsRef).toBe('boolean');
    expect(res.body.data.tenders.find((t: { isCash: boolean }) => t.isCash)).toMatchObject({
      ledgerId: LEDGER.CASH,
    });
  });

  let run1: {
    voucherId: string;
    pdcA: { apdId: string; apdAccYear: string };
    billA: string;
    billB: string;
    billC: string;
    custA: string;
  };

  it('POST /validate + /post — a collection run: a cheque today, cash, a post-dated cheque; each customer settles its own bills', async () => {
    const ins = (await get('instruments', { companyId: COMPANY, branchId: BRANCH })).body.data
      .tenders;
    const CASH = ins.find((t: { isCash: boolean }) => t.isCash).tenderId as string;
    const CHEQUE = ins.find((t: { isCheque: boolean }) => t.isCheque).tenderId as string;
    const custA = await ledger(
      `E2E-VCH-${fx.tag} Chq Customer A`,
      GROUP.CUSTOMERS,
      ', led_is_bill_by_bill',
      ', true',
    );
    const custB = await ledger(
      `E2E-VCH-${fx.tag} Chq Customer B`,
      GROUP.CUSTOMERS,
      ', led_is_bill_by_bill',
      ', true',
    );
    const custC = await ledger(
      `E2E-VCH-${fx.tag} Chq Customer C`,
      GROUP.CUSTOMERS,
      ', led_is_bill_by_bill',
      ', true',
    );
    const a = await journalBill(custA, 'DR', 6000);
    const b = await journalBill(custB, 'DR', 5000);
    const c = await journalBill(custC, 'DR', 4000);
    const pdcDay = plusDays(7);
    const payload = {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'RcpV',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} cheque run`,
        employeeIds: [],
      },
      lines: [
        {
          rowNo: 1,
          drCr: 'CR',
          ledgerId: custA,
          amount: 6000,
          instrument: {
            tenderId: CHEQUE,
            refNo: `E2E${fx.tag}A`,
            instrumentDate: today(),
            bankName: 'KVB',
            cheque: { drawerName: 'Customer A' },
          },
        },
        { rowNo: 2, drCr: 'CR', ledgerId: custB, amount: 5000, instrument: { tenderId: CASH } },
        {
          rowNo: 3,
          drCr: 'CR',
          ledgerId: custC,
          amount: 4000,
          instrument: {
            tenderId: CHEQUE,
            refNo: `E2E${fx.tag}C`,
            instrumentDate: pdcDay,
            bankName: 'HDFC',
          },
        },
      ],
      allocations: [
        { lineRowNo: 1, ...a, amount: 6000 },
        { lineRowNo: 2, ...b, amount: 5000 },
        { lineRowNo: 3, ...c, amount: 4000 },
      ],
    };

    const v = await post('validate', payload);
    expectStatus(v, 200);
    expect(v.body.data.ok).toBe(true);
    const gen = v.body.data.derived.legs.filter(
      (l: { source: string }) => l.source === 'INSTRUMENT',
    );
    expect(
      gen.map((l: { drCr: string; ledgerId: string; amount: number; postDated: boolean }) => [
        l.drCr,
        l.ledgerId,
        l.amount,
        l.postDated,
      ]),
    ).toEqual([
      ['DR', LEDGER.CHEQUES, 6000, false],
      ['DR', LEDGER.CASH, 5000, false],
      ['DR', LEDGER.CHEQUES, 4000, true],
    ]);
    expect(v.body.data.derived.totals).toEqual({ debit: 11000, credit: 11000, difference: 0 });
    expect(v.body.data.derived.postDated).toEqual([
      expect.objectContaining({ lineRowNo: 3, amount: 4000, postsOn: pdcDay }),
    ]);

    // a cheque without its bank is refused, naming the box
    const bad = JSON.parse(JSON.stringify(payload));
    delete bad.lines[0].instrument.bankName;
    const refused = await post('validate', bad);
    // the refused instrument generates no Dr leg, so the voucher also reads unbalanced
    expect(
      refused.body.data.refusals.map((r: { code: string; line: number }) => [r.code, r.line]),
    ).toEqual([
      ['VCH_CHEQUE_DETAILS', 1],
      ['VCH_UNBALANCED', undefined],
    ]);

    const res = await post('post', payload);
    expectStatus(res, 201);
    const d = res.body.data;
    expect(d.header).toMatchObject({
      status: 'POSTED',
      totalDebit: 11000,
      totalCredit: 11000,
      partyId: null,
    });
    expect(
      d.legs
        .filter((l: { generated: boolean }) => l.generated)
        .map((l: { ledgerId: string; amount: number }) => [l.ledgerId, l.amount]),
    ).toEqual([
      [LEDGER.CHEQUES, 6000],
      [LEDGER.CASH, 5000],
    ]);
    expect(d.legs.find((l: { ledgerId: string }) => l.ledgerId === custA).instrument).toMatchObject(
      { isCheque: true, refNo: `E2E${fx.tag}A`, pdcStatus: 'HELD', voucherId: d.header.voucherId },
    );
    expect(d.legs.find((l: { ledgerId: string }) => l.ledgerId === custB).instrument).toMatchObject(
      { isCheque: false, pdcId: null },
    );
    expect(d.instruments).toHaveLength(3);
    const insC = d.instruments.find((i: { partyId: string }) => i.partyId === custC);
    expect(insC).toMatchObject({ isPostDated: true, pdcStatus: 'HELD', instrumentDate: pdcDay });
    expect(d.pdcVouchers).toHaveLength(1);
    const pdc = d.pdcVouchers[0];
    expect(pdc).toMatchObject({ date: pdcDay, status: 'POSTED', partyId: custC });
    expect(pdc.voucherRefno).toMatch(/^rcv\d{5}$/);
    expect(insC.voucherId).toBe(pdc.voucherId);
    expect(
      pdc.legs.map((l: { drCr: string; ledgerId: string; amount: number; generated: boolean }) => [
        l.drCr,
        l.ledgerId,
        l.amount,
        l.generated,
      ]),
    ).toEqual([
      [pdc.legs[0].drCr, pdc.legs[0].ledgerId, 4000, pdc.legs[0].generated],
      [pdc.legs[1].drCr, pdc.legs[1].ledgerId, 4000, pdc.legs[1].generated],
    ]);
    expect(pdc.legs.find((l: { ledgerId: string }) => l.ledgerId === LEDGER.CHEQUES)).toMatchObject(
      { drCr: 'DR', generated: true },
    );
    expect(
      pdc.allocations.map((x: { billId: string; amount: number; adjDate: string }) => [
        x.billId,
        x.amount,
        x.adjDate,
      ]),
    ).toEqual([[c.billId, 4000, pdcDay]]);
    expect(d.locks.chequeMoved).toBe(false);

    // the rows: A and B settled today, C waits for its cheque to mature
    expect(await pending(a.billId)).toBe(0);
    expect(await pending(b.billId)).toBe(0);
    expect(await pending(c.billId)).toBe(4000);
    const [hdr] = await prisma.$queryRaw<
      { avh_against_voucher_id: string | null; avh_voucher_date: Date }[]
    >`
      SELECT avh_against_voucher_id, avh_voucher_date FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${pdc.voucherId}::uuid`;
    expect(hdr.avh_against_voucher_id).toBe(d.header.voucherId);
    const apd = await prisma.$queryRaw<
      {
        apd_party_id: string;
        apd_status: string;
        apd_voucher_id: string;
        apd_tender_id: string | null;
      }[]
    >`
      SELECT r.apd_party_id, r.apd_status, r.apd_voucher_id, r.apd_tender_id FROM accounts.acc_pdc_register r
       JOIN accounts.acc_tender_detail t ON t.td_id = r.apd_tender_id
       WHERE t.td_src_doc_id = ${d.header.voucherId}::uuid ORDER BY t.td_row_no`;
    expect(apd.map((r) => [r.apd_party_id, r.apd_status, r.apd_voucher_id])).toEqual([
      [custA, 'HELD', d.header.voucherId],
      [custC, 'HELD', pdc.voucherId],
    ]);
    const adjC = await prisma.$queryRaw<
      { abj_is_post_dated: boolean; abj_cheque_id: string | null; abj_settlement_mode: string }[]
    >`
      SELECT abj_is_post_dated, abj_cheque_id, abj_settlement_mode FROM accounts.acc_bill_adjustment
       WHERE abj_bill_id = ${c.billId}::uuid AND abj_is_deleted = false`;
    expect(adjC).toEqual([
      { abj_is_post_dated: true, abj_cheque_id: insC.pdcId, abj_settlement_mode: 'CHEQUE' },
    ]);

    run1 = {
      voucherId: d.header.voucherId,
      pdcA: {
        apdId: d.instruments.find((i: { partyId: string }) => i.partyId === custA).pdcId,
        apdAccYear: ACC_YEAR,
      },
      billA: a.billId,
      billB: b.billId,
      billC: c.billId,
      custA,
    };
  });

  it('POST /cheques/bounce on one cheque reopens ONLY its customer’s bill; the voucher then cannot be cancelled (VCH_CHEQUE_MOVED)', async () => {
    const dep = await cheques('deposit', {
      cheques: [run1.pdcA],
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      bankLedgerId: LEDGER.KVB,
      depositDate: today(),
      slipNo: `E2E-${fx.tag}`,
    });
    expectStatus(dep, 201);
    const bounced = await cheques('bounce', {
      ...run1.pdcA,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      bounceDate: today(),
      reason: 'Funds insufficient',
      bankCharge: 0,
      partyCharge: 0,
    });
    expectStatus(bounced, 201);
    expect(await pending(run1.billA)).toBe(6000);
    expect(await pending(run1.billB)).toBe(0);
    expect(await pending(run1.billC)).toBe(4000);

    const got = await get('get', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: run1.voucherId,
    });
    expect(got.body.data.locks.chequeMoved).toBe(true);
    expect(
      got.body.data.instruments.find((i: { partyId: string }) => i.partyId === run1.custA)
        .pdcStatus,
    ).toBe('BOUNCED');

    const cancel = await post('cancel', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: run1.voucherId,
      reason: 'Keyed wrong',
    });
    expect(cancel.status).toBe(409);
    expect(codesOf(cancel)).toEqual(['VCH_CHEQUE_MOVED']);
  });

  it('POST /cancel — with every cheque still HELD: the rows go CANCELLED, the post-dated voucher is reversed too, the bills reopen', async () => {
    const ins = (await get('instruments', { companyId: COMPANY, branchId: BRANCH })).body.data
      .tenders;
    const CHEQUE = ins.find((t: { isCheque: boolean }) => t.isCheque).tenderId as string;
    const custD = await ledger(
      `E2E-VCH-${fx.tag} Chq Customer D`,
      GROUP.CUSTOMERS,
      ', led_is_bill_by_bill',
      ', true',
    );
    const custE = await ledger(
      `E2E-VCH-${fx.tag} Chq Customer E`,
      GROUP.CUSTOMERS,
      ', led_is_bill_by_bill',
      ', true',
    );
    const dBill = await journalBill(custD, 'DR', 2000);
    const eBill = await journalBill(custE, 'DR', 1000);
    const res = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'RcpV',
        date: today(),
        remarks: `E2E-VCH-${fx.tag} cheque run 2`,
      },
      lines: [
        {
          rowNo: 1,
          drCr: 'CR',
          ledgerId: custD,
          amount: 2000,
          instrument: {
            tenderId: CHEQUE,
            refNo: `E2E${fx.tag}D`,
            instrumentDate: today(),
            bankName: 'KVB',
          },
        },
        {
          rowNo: 2,
          drCr: 'CR',
          ledgerId: custE,
          amount: 1000,
          instrument: {
            tenderId: CHEQUE,
            refNo: `E2E${fx.tag}E`,
            instrumentDate: plusDays(10),
            bankName: 'KVB',
          },
        },
      ],
      allocations: [
        { lineRowNo: 1, ...dBill, amount: 2000 },
        { lineRowNo: 2, ...eBill, amount: 1000 },
      ],
    });
    expectStatus(res, 201);
    const voucherId = res.body.data.header.voucherId as string;
    const pdcVoucherId = res.body.data.pdcVouchers[0].voucherId as string;
    expect(await pending(dBill.billId)).toBe(0);

    // the same cheque number again for the same customer is refused before the index says so
    const dup = await post('validate', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'RcpV',
        date: today(),
      },
      lines: [
        {
          rowNo: 1,
          drCr: 'CR',
          ledgerId: custD,
          amount: 1,
          instrument: {
            tenderId: CHEQUE,
            refNo: `E2E${fx.tag}D`,
            instrumentDate: today(),
            bankName: 'KVB',
          },
        },
      ],
    });
    expect(dup.body.data.refusals.map((r: { code: string }) => r.code)).toContain(
      'VCH_CHEQUE_DETAILS',
    );

    const cancelled = await post('cancel', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId,
      reason: 'Wrong customer',
    });
    expectStatus(cancelled, 201);
    expect(cancelled.body.data).toMatchObject({
      chequesCancelled: 2,
      pdcVouchersReversed: 1,
      allocationsReversed: 2,
    });
    expect(await pending(dBill.billId)).toBe(2000);
    expect(await pending(eBill.billId)).toBe(1000);
    const rows = await prisma.$queryRaw<{ apd_status: string; apd_cancel_reason: string | null }[]>`
      SELECT r.apd_status, r.apd_cancel_reason FROM accounts.acc_pdc_register r
       JOIN accounts.acc_tender_detail t ON t.td_id = r.apd_tender_id WHERE t.td_src_doc_id = ${voucherId}::uuid`;
    expect(rows).toEqual([
      { apd_status: 'CANCELLED', apd_cancel_reason: 'Wrong customer' },
      { apd_status: 'CANCELLED', apd_cancel_reason: 'Wrong customer' },
    ]);
    const [pdcHdr] = await prisma.$queryRaw<
      { avh_voucher_status: string; avh_reversal_voucher_id: string | null }[]
    >`
      SELECT avh_voucher_status, avh_reversal_voucher_id FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${pdcVoucherId}::uuid`;
    expect(pdcHdr.avh_voucher_status).toBe('CANCELLED');
    expect(pdcHdr.avh_reversal_voucher_id).not.toBeNull();
    const got = await get('get', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId,
    });
    expect(got.body.data.header.status).toBe('CANCELLED');
    expect(got.body.data.pdcVouchers[0]).toMatchObject({ status: 'CANCELLED' });
    expect(got.body.data.pdcVouchers[0].reversalRefno).toMatch(/^rev\d{5}$/);
    // the cheque number is free again
    const again = await post('validate', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'RcpV',
        date: today(),
      },
      lines: [
        {
          rowNo: 1,
          drCr: 'CR',
          ledgerId: custD,
          amount: 1,
          instrument: {
            tenderId: CHEQUE,
            refNo: `E2E${fx.tag}D`,
            instrumentDate: today(),
            bankName: 'KVB',
          },
        },
      ],
      allocations: [{ lineRowNo: 1, ...dBill, amount: 1 }],
    });
    expect(again.body.data.ok).toBe(true);
  });

  // ─── notes (55) · the Payment Voucher issues cheques ──────────────────────

  const CB = `${API}/cheque-books`;
  const IC = `${API}/issued-cheques`;
  const cbPost = (path: string, body: object) =>
    h.http.post(`${CB}/${path}`).set('Authorization', BEARER).send(body);
  const icPost = (path: string, body: object) =>
    h.http.post(`${IC}/${path}`).set('Authorization', BEARER).send(body);
  const icGet = (path: string, query: Record<string, unknown>) =>
    h.http.get(`${IC}/${path}`).set('Authorization', BEARER).query(query);

  let pay: {
    chequeTender: string;
    base: number;
    book1: string;
    book2: string;
    supX: string;
    supY: string;
    supZ: string;
    billX: { billId: string; billAccYear: string };
    billY: { billId: string; billAccYear: string };
    voucherXY: string;
    chqX: { apdId: string; apdAccYear: string };
    chqY: { apdId: string; apdAccYear: string };
  };

  const chequeKeys = (c: { apdId: string; apdAccYear: string }) => ({
    ...c,
    companyId: COMPANY,
    branchId: BRANCH,
  });
  const payHeader = (remarks: string) => ({
    companyId: COMPANY,
    branchId: BRANCH,
    accYear: ACC_YEAR,
    typeCode: 'PmtV',
    date: today(),
    remarks: `E2E-VCH-${fx.tag} ${remarks}`,
  });
  const chequeLine = (
    rowNo: number,
    ledgerId: string,
    amount: number,
    book: string,
    extra: Record<string, unknown> = {},
  ) => ({
    rowNo,
    drCr: 'DR',
    ledgerId,
    amount,
    tdsBase: false,
    instrument: {
      tenderId: pay.chequeTender,
      bankLedgerId: LEDGER.KVB,
      chequeBookId: book,
      instrumentDate: today(),
      ...extra,
    },
  });
  const leafOf = (n: number) => String(n).padStart(8, '0');

  it('cheque books — open two on the bank; /vouchers/cheque-books lists them with the next leaf; an overlap is refused', async () => {
    const ins = (
      await get('instruments', { companyId: COMPANY, branchId: BRANCH, typeCode: 'PmtV' })
    ).body.data.tenders;
    // a paying type is offered only cash / cheque / UPI / bank transfer
    expect(ins.every((t: { typeId: number }) => [1, 3, 5, 6].includes(t.typeId))).toBe(true);
    const chequeTender = ins.find((t: { isCheque: boolean }) => t.isCheque).tenderId as string;
    // a leaf range no earlier run on this bank can have used
    const base = 10_000_000 + (Date.now() % 80_000_000);
    const open = (bookNo: string, from: number, to: number) =>
      cbPost('create', {
        companyId: COMPANY,
        bankLedgerId: LEDGER.KVB,
        bookNo,
        leafFrom: from,
        leafTo: to,
        leafWidth: 8,
        remarks: `E2E-VCH-${fx.tag}`,
      });
    const b1 = await open(`E2E-${fx.tag}-1`, base, base + 2);
    expectStatus(b1, 200);
    expect(b1.body.data).toMatchObject({
      leafFrom: leafOf(base),
      leafTo: leafOf(base + 2),
      nextLeaf: leafOf(base),
      left: 3,
      status: 'ACTIVE',
    });
    const b2 = await open(`E2E-${fx.tag}-2`, base + 100, base + 109);
    expectStatus(b2, 200);
    const clash = await open(`E2E-${fx.tag}-3`, base + 105, base + 120);
    expect(clash.status).toBe(409);
    expect(codesOf(clash)).toEqual(['VCH_BOOK_OVERLAP']);

    const list = await get('cheque-books', { companyId: COMPANY, bankLedgerId: LEDGER.KVB });
    expectStatus(list, 200);
    const mine = list.body.data.books.filter((b: { bookNo: string }) =>
      b.bookNo.startsWith(`E2E-${fx.tag}`),
    );
    expect(mine.map((b: { nextLeaf: string; left: number }) => [b.nextLeaf, b.left])).toEqual([
      [leafOf(base), 3],
      [leafOf(base + 100), 10],
    ]);

    const supplier = (name: string) =>
      ledger(`E2E-VCH-${fx.tag} ${name}`, GROUP.SUPPLIERS, ', led_is_bill_by_bill', ', true');
    const supX = await supplier('Chq Supplier X');
    const supY = await supplier('Chq Supplier Y');
    const supZ = await supplier('Chq Supplier Z');
    pay = {
      chequeTender,
      base,
      book1: b1.body.data.chequeBookId,
      book2: b2.body.data.chequeBookId,
      supX,
      supY,
      supZ,
      billX: await journalBill(supX, 'CR', 3000),
      billY: await journalBill(supY, 'CR', 3000),
      voucherXY: '',
      chqX: { apdId: '', apdAccYear: '' },
      chqY: { apdId: '', apdAccYear: '' },
    };
  });

  it('POST /validate + /post — a payment run takes the book’s leaves in line order; the bank is credited; HELD P rows', async () => {
    const body = {
      header: payHeader('cheque run'),
      lines: [
        chequeLine(1, pay.supX, 3000, pay.book1),
        chequeLine(2, pay.supY, 3000, pay.book1, { favouring: 'Y Enterprises', acPayee: false }),
      ],
      allocations: [
        { lineRowNo: 1, ...pay.billX, amount: 3000 },
        { lineRowNo: 2, ...pay.billY, amount: 3000 },
      ],
    };
    // the refusals first: no bank, a book on another bank
    const noBank = await post('validate', {
      ...body,
      lines: [chequeLine(1, pay.supX, 3000, pay.book1, { bankLedgerId: null }), body.lines[1]],
    });
    expect(noBank.body.data.refusals.map((r: { code: string }) => r.code)).toContain(
      'VCH_BANK_REQUIRED',
    );
    const noBook = await post('validate', {
      ...body,
      lines: [chequeLine(1, pay.supX, 3000, pay.book1, { chequeBookId: null }), body.lines[1]],
    });
    expect(noBook.body.data.refusals.map((r: { code: string }) => r.code)).toContain(
      'VCH_BOOK_REQUIRED',
    );

    const dry = await post('validate', body);
    expectStatus(dry, 200);
    expect(dry.body.data.ok).toBe(true);
    const money = dry.body.data.derived.legs.filter(
      (l: { source: string }) => l.source === 'INSTRUMENT',
    );
    expect(
      money.map((l: { drCr: string; ledgerId: string; amount: number }) => [
        l.drCr,
        l.ledgerId,
        l.amount,
      ]),
    ).toEqual([
      ['CR', LEDGER.KVB, 3000],
      ['CR', LEDGER.KVB, 3000],
    ]);
    // shown, not promised
    expect(money.map((l: { instrument: { nextLeaf: string } }) => l.instrument.nextLeaf)).toEqual([
      leafOf(pay.base),
      leafOf(pay.base + 1),
    ]);

    const res = await post('post', body);
    expectStatus(res, 201);
    const ins = res.body.data.instruments;
    expect(
      ins.map(
        (i: {
          leaf: string;
          refNo: string;
          bookNo: string;
          favouring: string;
          acPayee: boolean;
          pdcStatus: string;
          issued: boolean;
        }) => [i.leaf, i.refNo, i.bookNo, i.favouring, i.acPayee, i.pdcStatus, i.issued],
      ),
    ).toEqual([
      [
        leafOf(pay.base),
        leafOf(pay.base),
        `E2E-${fx.tag}-1`,
        `E2E-VCH-${fx.tag} Chq Supplier X`,
        true,
        'HELD',
        true,
      ],
      [
        leafOf(pay.base + 1),
        leafOf(pay.base + 1),
        `E2E-${fx.tag}-1`,
        'Y Enterprises',
        false,
        'HELD',
        true,
      ],
    ]);
    // a reopened voucher names its bank by id
    expect(ins.map((i: { bankLedgerId: string }) => i.bankLedgerId)).toEqual([
      LEDGER.KVB,
      LEDGER.KVB,
    ]);
    pay.voucherXY = res.body.data.header.voucherId;
    pay.chqX = { apdId: ins[0].pdcId, apdAccYear: ins[0].pdcAccYear };
    pay.chqY = { apdId: ins[1].pdcId, apdAccYear: ins[1].pdcAccYear };
    const rows = await prisma.$queryRaw<
      {
        apd_tra_type: string;
        apd_bank_ledger_id: string;
        apd_cheque_book_id: string;
        apd_amount: unknown;
      }[]
    >`SELECT apd_tra_type, apd_bank_ledger_id, apd_cheque_book_id, apd_amount FROM accounts.acc_pdc_register
       WHERE apd_voucher_id = ${pay.voucherXY}::uuid ORDER BY apd_instrument_no`;
    expect(
      rows.map((r) => [
        r.apd_tra_type,
        r.apd_bank_ledger_id,
        r.apd_cheque_book_id,
        num(r.apd_amount),
      ]),
    ).toEqual([
      ['P', LEDGER.KVB, pay.book1, 3000],
      ['P', LEDGER.KVB, pay.book1, 3000],
    ]);
    const [adj] = await prisma.$queryRaw<{ abj_cheque_id: string | null }[]>`
      SELECT abj_cheque_id FROM accounts.acc_bill_adjustment
       WHERE abj_bill_id = ${pay.billX.billId}::uuid AND abj_is_deleted = false AND abj_reversal_of_id IS NULL`;
    expect(adj.abj_cheque_id).toBe(pay.chqX.apdId);
    expect(await pending(pay.billX.billId)).toBe(0);
  });

  it('cheque books are judged on menu 263, not 52: without it, get / create / close are 403 while Issued Cheques (52) is still held (notes 58)', async () => {
    const base = 30_000_000 + (Date.now() % 60_000_000);
    const opened = await cbPost('create', {
      companyId: COMPANY,
      bankLedgerId: LEDGER.KVB,
      bookNo: `E2E-${fx.tag}-263`,
      leafFrom: base,
      leafTo: base + 1,
      leafWidth: 8,
      remarks: `E2E-VCH-${fx.tag} notes 58`,
    });
    expectStatus(opened, 200);
    const chequeBookId = opened.body.data.chequeBookId as string;
    const cbGet = () =>
      h.http.get(`${CB}/get`).set('Authorization', BEARER).query({ companyId: COMPANY, chequeBookId });

    await prisma.$executeRaw`
      UPDATE public.user_menus SET um_is_deleted = true
       WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = 263`;
    try {
      const view = await cbGet();
      expect(view.status).toBe(403);
      expect(codesOf(view)).toEqual(['VCH_RIGHT_VIEW']);
      expect(JSON.stringify(view.body)).toContain('menu 263');
      const create = await cbPost('create', {
        companyId: COMPANY,
        bankLedgerId: LEDGER.KVB,
        bookNo: `E2E-${fx.tag}-263b`,
        leafFrom: base + 10,
        leafTo: base + 11,
        leafWidth: 8,
      });
      expect(create.status).toBe(403);
      expect(codesOf(create)).toEqual(['VCH_RIGHT_CREATE']);
      const close = await cbPost('close', { companyId: COMPANY, chequeBookId, reason: 'no right' });
      expect(close.status).toBe(403);
      expect(codesOf(close)).toEqual(['VCH_RIGHT_EDIT']);
      // 52 is still held: the register's own listing and the Issued Cheques routes are untouched
      const list = await get('cheque-books', { companyId: COMPANY, bankLedgerId: LEDGER.KVB });
      expectStatus(list, 200);
    } finally {
      await prisma.$executeRaw`
        UPDATE public.user_menus SET um_is_deleted = false
         WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = 263`;
    }
    // rights back: the same calls pass, and the book is put away
    expectStatus(await cbGet(), 200);
    const closed = await cbPost('close', { companyId: COMPANY, chequeBookId, reason: 'notes 58 probe' });
    expectStatus(closed, 200);
    expect(closed.body.data.status).toBe('CLOSED');
  });

  it('a finished book: the third leaf goes, the book finishes, a fourth cheque is VCH_BOOK_FINISHED', async () => {
    const billZ = await journalBill(pay.supZ, 'CR', 500);
    const twoMore = await post('validate', {
      header: payHeader('two more'),
      lines: [chequeLine(1, pay.supZ, 250, pay.book1), chequeLine(2, pay.supZ, 250, pay.book1)],
      allocations: [
        { lineRowNo: 1, ...billZ, amount: 250 },
        { lineRowNo: 2, ...billZ, amount: 250 },
      ],
    });
    // one leaf left: the second line is refused, naming its row (a refused
    // instrument generates no money leg, so the voucher is also unbalanced)
    expect(
      twoMore.body.data.refusals.map((r: { code: string; line: number }) => [r.code, r.line]),
    ).toContainEqual(['VCH_BOOK_FINISHED', 2]);

    const last = await post('post', {
      header: payHeader('last leaf'),
      lines: [chequeLine(1, pay.supZ, 500, pay.book1)],
      allocations: [{ lineRowNo: 1, ...billZ, amount: 500 }],
    });
    expectStatus(last, 201);
    expect(last.body.data.instruments[0].leaf).toBe(leafOf(pay.base + 2));
    const book = await h.http
      .get(`${CB}/get`)
      .set('Authorization', BEARER)
      .query({ companyId: COMPANY, chequeBookId: pay.book1 });
    expectStatus(book, 200);
    expect(book.body.data).toMatchObject({ status: 'FINISHED', nextLeaf: null, left: 0, used: 3 });
    expect(book.body.data.leaves.map((l: { leaf: string }) => l.leaf)).toEqual([
      leafOf(pay.base),
      leafOf(pay.base + 1),
      leafOf(pay.base + 2),
    ]);

    const after = await post('validate', {
      header: payHeader('after'),
      lines: [chequeLine(1, pay.supZ, 1, pay.book1)],
      allocations: [],
    });
    expect(after.body.data.refusals.map((r: { code: string }) => r.code)).toContain(
      'VCH_BOOK_FINISHED',
    );
  });

  it('two concurrent payments on one book get consecutive, different leaves', async () => {
    const [bA, bB] = [
      await journalBill(pay.supZ, 'CR', 100),
      await journalBill(pay.supZ, 'CR', 100),
    ];
    const one = (bill: { billId: string; billAccYear: string }, tag: string) =>
      post('post', {
        header: payHeader(`concurrent ${tag}`),
        lines: [chequeLine(1, pay.supZ, 100, pay.book2)],
        allocations: [{ lineRowNo: 1, ...bill, amount: 100 }],
      });
    const [a, b] = await Promise.all([one(bA, 'a'), one(bB, 'b')]);
    expectStatus(a, 201);
    expectStatus(b, 201);
    const leaves = [a.body.data.instruments[0].leaf, b.body.data.instruments[0].leaf].sort();
    expect(leaves).toEqual([leafOf(pay.base + 100), leafOf(pay.base + 101)]);

    // stop one of them: its bill reopens, the leaf stays used
    const stopped = a.body.data.instruments[0];
    const stop = await icPost('stop', {
      ...chequeKeys({ apdId: stopped.pdcId, apdAccYear: stopped.pdcAccYear }),
      date: today(),
      reason: 'Supplier asked for a transfer',
    });
    expectStatus(stop, 200);
    expect(stop.body.data).toMatchObject({ status: 'CANCELLED', typeCode: 'PmtV' });
    expect(stop.body.data.cancelReason).toMatch(/^STOPPED: /);
    expect(stop.body.data.reversalRefno).toMatch(/^chqbnc/);
    expect(await pending(bA.billId)).toBe(100);
    const list = await get('cheque-books', { companyId: COMPANY, bankLedgerId: LEDGER.KVB });
    const b2 = list.body.data.books.find(
      (x: { chequeBookId: string }) => x.chequeBookId === pay.book2,
    );
    expect(b2.nextLeaf).toBe(leafOf(pay.base + 102));
  });

  it('present / return / cancel refused — a presented cheque moves no money; a returned one reverses only its own line', async () => {
    const presented = await icPost('presented', { ...chequeKeys(pay.chqX), date: today() });
    expectStatus(presented, 200);
    expect(presented.body.data).toMatchObject({
      status: 'CLEARED',
      presentedOn: today(),
      reversalVoucherId: null,
    });

    // a presented cheque cannot be unmade by cancelling its voucher
    const cancel = await post('cancel', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: pay.voucherXY,
      reason: 'Keyed wrong',
    });
    expect(cancel.status).toBe(409);
    expect(codesOf(cancel)).toEqual(['VCH_CHEQUE_MOVED']);
    expect(JSON.stringify(cancel.body)).toContain('menu 52');

    // and once presented it cannot be returned
    const late = await icPost('returned', { ...chequeKeys(pay.chqX), date: today(), reason: 'x' });
    expect(late.status).toBe(409);
    expect(codesOf(late)).toEqual(['VCH_CHEQUE_STATE']);

    const returned = await icPost('returned', {
      ...chequeKeys(pay.chqY),
      date: today(),
      reason: 'Funds insufficient',
      charges: 150,
    });
    expectStatus(returned, 200);
    expect(returned.body.data).toMatchObject({
      status: 'BOUNCED',
      returnReason: 'Funds insufficient',
      charges: 150,
    });
    // Y's bill reopens; X's (the other line of the same voucher) stays settled
    expect(await pending(pay.billY.billId)).toBe(3000);
    expect(await pending(pay.billX.billId)).toBe(0);
    const bnc = await get('get', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      voucherId: returned.body.data.reversalVoucherId,
    });
    expect(
      bnc.body.data.legs.map((l: { drCr: string; ledgerId: string; amount: number }) => [
        l.drCr,
        l.ledgerId,
        l.amount,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['DR', LEDGER.KVB, 3000],
        ['CR', pay.supY, 3000],
        ['CR', LEDGER.KVB, 150],
      ]),
    );

    const hist = await icGet('history', chequeKeys(pay.chqY));
    expectStatus(hist, 200);
    expect(hist.body.data.entries.map((e: { toStatus: string }) => e.toStatus)).toEqual([
      'BOUNCED',
    ]);
  });

  it('replace — a returned cheque: a new Payment Voucher on a new leaf pays the same bill again; the old row goes REPLACED', async () => {
    const res = await icPost('replace', {
      ...chequeKeys(pay.chqY),
      date: today(),
      chequeBookId: pay.book2,
      reason: 'Re-issued after the return',
    });
    expectStatus(res, 200);
    const { replaced, replacement } = res.body.data;
    expect(replaced).toMatchObject({ status: 'REPLACED', replacedById: replacement.apdId });
    expect(replacement).toMatchObject({
      status: 'HELD',
      typeCode: 'PmtV',
      leaf: leafOf(pay.base + 102),
      favouring: 'Y Enterprises',
      acPayee: false,
      amount: 3000,
      replacesId: pay.chqY.apdId,
    });
    expect(replacement.voucherId).not.toBe(pay.voucherXY);
    expect(await pending(pay.billY.billId)).toBe(0);
  });

  it('a TDS line comes back gross: the returned cheque gives the line’s TDS back on the register', async () => {
    const sup = await ledger(
      `E2E-VCH-${fx.tag} Chq TDS Supplier`,
      GROUP.SUPPLIERS,
      ', led_is_bill_by_bill, led_is_tds_applicable, led_tds_nature_of_payment, led_tds_deductee_type, led_pan_no',
      ", true, true, '194C', 'FIRM', 'AAAFT3333C'",
    );
    const bill = await journalBill(sup, 'CR', 10000);
    const res = await post('post', {
      header: payHeader('tds cheque'),
      lines: [{ ...chequeLine(1, sup, 9800, pay.book2), tdsBase: true }],
      allocations: [{ lineRowNo: 1, ...bill, amount: 10000 }],
    });
    expectStatus(res, 201);
    const chq = res.body.data.instruments[0];
    // the cheque is for the net, the line discharged the gross
    expect(chq.amount).toBe(9800);
    expect(await pending(bill.billId)).toBe(0);

    const back = await icPost('returned', {
      ...chequeKeys({ apdId: chq.pdcId, apdAccYear: chq.pdcAccYear }),
      date: today(),
      reason: 'Signature differs',
    });
    expectStatus(back, 200);
    expect(await pending(bill.billId)).toBe(10000);
    const atd = await prisma.$queryRaw<
      { atd_base_amount: unknown; atd_tax_amount: unknown; rev: boolean }[]
    >`
      SELECT atd_base_amount, atd_tax_amount, atd_reversal_of_id IS NOT NULL AS rev
        FROM accounts.acc_tds_register WHERE atd_party_id = ${sup}::uuid AND atd_is_deleted = false
       ORDER BY atd_created_on`;
    expect(atd.map((r) => [num(r.atd_base_amount), num(r.atd_tax_amount), r.rev])).toEqual([
      [10000, 200, false],
      [10000, -200, true],
    ]);
  });

  it('void and close — a voided cheque’s leaf stays used; a closed book hands out nothing', async () => {
    const bill = await journalBill(pay.supZ, 'CR', 70);
    const res = await post('post', {
      header: payHeader('to void'),
      lines: [chequeLine(1, pay.supZ, 70, pay.book2)],
      allocations: [{ lineRowNo: 1, ...bill, amount: 70 }],
    });
    expectStatus(res, 201);
    const chq = res.body.data.instruments[0];
    const voided = await icPost('void', {
      ...chequeKeys({ apdId: chq.pdcId, apdAccYear: chq.pdcAccYear }),
      reason: 'Leaf spoilt',
    });
    expectStatus(voided, 200);
    expect(voided.body.data.cancelReason).toBe('VOIDED: Leaf spoilt');
    expect(await pending(bill.billId)).toBe(70);

    const closed = await cbPost('close', {
      companyId: COMPANY,
      chequeBookId: pay.book2,
      reason: 'E2E done',
    });
    expectStatus(closed, 200);
    expect(closed.body.data.status).toBe('CLOSED');
    const refused = await post('validate', {
      header: payHeader('closed'),
      lines: [chequeLine(1, pay.supZ, 70, pay.book2)],
      allocations: [{ lineRowNo: 1, ...bill, amount: 70 }],
    });
    expect(refused.body.data.refusals.map((r: { code: string }) => r.code)).toContain(
      'VCH_BOOK_FINISHED',
    );
  });
});
