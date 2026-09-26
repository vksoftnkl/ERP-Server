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
const MENUS = [101, 102, 103, 104, 163, 259, 260, 261, 262];
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

  it('POST /post — a Payment Voucher must allocate exactly its party leg (#10), then settles the PurA bill', async () => {
    const short = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'PmtV',
        date: today(),
        partyId: fx.supplier,
        remarks: `E2E-VCH-${fx.tag} pay`,
      },
      lines: [{ rowNo: 1, drCr: 'CR', ledgerId: LEDGER.KVB, amount: 5000 }],
      allocations: [
        { lineRowNo: 0, billId: pua.billId, billAccYear: pua.billAccYear, amount: 4000 },
      ],
    });
    expect(short.status).toBe(422);
    expect(codesOf(short)).toContain('VCH_BILLWISE_SHORT');

    const ok = await post('post', {
      header: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        typeCode: 'PmtV',
        date: today(),
        partyId: fx.supplier,
        remarks: `E2E-VCH-${fx.tag} pay`,
      },
      lines: [{ rowNo: 1, drCr: 'CR', ledgerId: LEDGER.KVB, amount: 5000 }],
      allocations: [
        { lineRowNo: 0, billId: pua.billId, billAccYear: pua.billAccYear, amount: 5000 },
      ],
    });
    expectStatus(ok, 201);
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
});
