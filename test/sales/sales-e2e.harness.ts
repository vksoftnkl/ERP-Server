// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../../src/app.module';
import { AuthSessionService } from '../../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../../src/modules/auth/token.service';

/**
 * What every sales-chain e2e spec shares: the master rows it runs under, the
 * app boot with auth stubbed at the PROVIDER level (never at the guard — see
 * memory erp-server-http-testing-without-credentials), the rights fixture,
 * fresh items with real opening stock, and the row probes the assertions read.
 *
 * ── The database, and what these specs leave behind ────────────────────────
 *
 * They drive the SAME database the live server uses. A posted document has no
 * delete verb — a cancel is a reversal, and the stock ledger is append-only —
 * so every fixture is permanent and every one is labelled E2E-<suite>-<tag>.
 * The items are created fresh per run so the stock figures asserted below are
 * exact, not deltas over whatever an earlier run left.
 *
 * ── Rights ─────────────────────────────────────────────────────────────────
 *
 * On this database NOBODY holds um_can_post on any menu (0 of 1,111
 * user_menus rows on 2026-09-22), so every /post answers 403 SALES_RIGHT_POST
 * until an administrator grants it. The specs grant tester1 the five flags on
 * the three sales menus in beforeAll and take them back in afterAll; the rows
 * are the fixture, not a bypass — the real loadRights() reads them.
 */

export const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
export const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab'; // Acme Foods - Coimbatore Branch
export const ACC_YEAR = '2026-2027';
export const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01'; // Coimbatore — this branch's own
export const DEVICE_ID = '019e7286-d0d9-7916-8d9f-9de260d523ed'; // fixed.device_master 'raman', this branch
export const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1 (SUPER ADMIN)

/** `sales.default_customer_id` — the walk-in. Cannot carry a credit balance. */
export const WALK_IN = '019f659c-3942-7237-89b0-c4899603dd7a'; // MADHAVAN
export const WALK_IN_NAME = 'MADHAVAN';
/** A listed customer of the company: state 33, no credit limits, ledger present. */
export const LISTED_CUSTOMER = '019f1dc6-7d53-7a5d-913b-66d57b891257';
export const LISTED_CUSTOMER_NAME = 'new customer';

/** accounts.acc_tender_master rows of the company, keyed by their acc_tender_types id. */
export const TENDER = {
  CASH: '019fbbd0-9a8e-73db-b762-175dda2e1762',
  UPI: '019fbbd2-406e-7e49-8376-0b03a840f640',
  TEMP_CR: '019fcbbc-6966-71fb-91a0-214c22e5885f',
  CREDIT: '019fcbbb-a9bb-7c2f-9a07-8c24e65bc9b1',
} as const;
/** tnd_ledger_id of the tenders above — where a settlement leg lands. */
export const TENDER_LEDGER = {
  CASH: '019ef844-efba-755d-ab5d-b4d7281edf19',
  UPI: '019ef849-aefe-7e27-8e8f-d4094cf5c254',
} as const;

/** accounts.acc_voucher_types.vchr_type_id */
export const VCHR = {
  BILL: 3,
  SALE_RETURN: 18,
  DELIVERY_CHALLAN: 19,
  DC_RETURN: 20,
  TENDER_CHANGE: 22,
} as const;

/** fixed.menu_master.menu_id the four rights are keyed on. */
export const MENU = { SALE_BILL: 12, SALE_RETURN: 13, DELIVERY_NOTE: 182 } as const;

export const BEARER = 'Bearer dummy-test-token';
export const API = '/api/v1';

/** The same UTC calendar date `isoToday()` in sales-doc.utils answers. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A `date` column (a JS Date at UTC midnight from $queryRaw) or an ISO string → YYYY-MM-DD. */
export function isoDay(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return (v as { toString(): string }).toString().slice(0, 10);
}

/** Prisma Decimal / bigint / string → number for an assertion. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return Number(typeof v === 'object' ? (v as { toString(): string }).toString() : v);
}

/** Every `code` the error envelope carries. */
export function codesOf(res: request.Response): string[] {
  const errors = (res.body?.errors ?? []) as { code?: string }[];
  return errors.map((e) => e.code ?? '').filter(Boolean);
}

export function runTag(): string {
  return Date.now().toString(36).toUpperCase();
}

// ─── app ─────────────────────────────────────────────────────────────────

export interface Harness {
  app: INestApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaClient;
}

export async function bootApp(sessionId: string): Promise<Harness> {
  const claims: AccessTokenPayload = {
    sub: ACTOR,
    user_name: 'tester1',
    sid: sessionId,
    user_type: 'SUPER ADMIN',
    company_id: COMPANY,
    branch_id: BRANCH,
    device_id: DEVICE_ID,
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

  const app = moduleRef.createNestApplication();
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
  return { app, http: request(app.getHttpServer()), prisma: new PrismaClient() };
}

export async function shutdown(h: Harness | undefined): Promise<void> {
  await h?.app?.close();
  await h?.prisma?.$disconnect();
}

// ─── rights fixture ──────────────────────────────────────────────────────

export interface RightsMemo {
  inserted: string[];
  restored: { umId: string; flags: Record<string, boolean> }[];
}

const RIGHT_FLAGS = [
  'um_can_post',
  'um_can_cancel',
  'um_can_amend',
  'um_can_override',
  'um_can_retender',
];

export async function grantSalesRights(prisma: PrismaClient): Promise<RightsMemo> {
  const memo: RightsMemo = { inserted: [], restored: [] };
  for (const menuId of Object.values(MENU)) {
    const rows = await prisma.$queryRaw<({ um_id: string } & Record<string, boolean>)[]>`
      SELECT um_id, um_can_post, um_can_cancel, um_can_amend, um_can_override, um_can_retender
        FROM public.user_menus
       WHERE um_user_id = ${ACTOR}::uuid AND um_menu_id = ${menuId}::int AND um_is_deleted = false
       LIMIT 1`;
    if (rows[0]) {
      const flags: Record<string, boolean> = {};
      for (const f of RIGHT_FLAGS) flags[f] = rows[0][f];
      memo.restored.push({ umId: rows[0].um_id, flags });
      await prisma.$executeRaw`
        UPDATE public.user_menus
           SET um_can_post = true, um_can_cancel = true, um_can_amend = true,
               um_can_override = true, um_can_retender = true
         WHERE um_id = ${rows[0].um_id}::uuid`;
      continue;
    }
    const [created] = await prisma.$queryRaw<{ um_id: string }[]>`
      INSERT INTO public.user_menus (
        um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit,
        um_can_post, um_can_cancel, um_can_amend, um_can_override, um_can_retender, um_created_by
      ) VALUES (
        ${ACTOR}::uuid, ${menuId}::int, true, true, true, true, true, true, true, true, ${ACTOR}::uuid
      )
      RETURNING um_id`;
    memo.inserted.push(created.um_id);
  }
  return memo;
}

export async function revokeSalesRights(prisma: PrismaClient, memo: RightsMemo): Promise<void> {
  for (const umId of memo.inserted) {
    await prisma.$executeRaw`DELETE FROM public.user_menus WHERE um_id = ${umId}::uuid`;
  }
  for (const r of memo.restored) {
    await prisma.$executeRaw`
      UPDATE public.user_menus
         SET um_can_post = ${r.flags.um_can_post}, um_can_cancel = ${r.flags.um_can_cancel},
             um_can_amend = ${r.flags.um_can_amend}, um_can_override = ${r.flags.um_can_override},
             um_can_retender = ${r.flags.um_can_retender}
       WHERE um_id = ${r.umId}::uuid`;
  }
}

// ─── items and opening stock ─────────────────────────────────────────────

export interface Item {
  itemId: string;
  /** item_unit_conversion.iuc_id — the base unit, factor 1. */
  iucId: string;
  code: string;
}

/** A brand-new item so every stock figure below starts from zero. */
export async function makeItem(prisma: PrismaClient, code: string): Promise<Item> {
  const [group] = await prisma.$queryRaw<{ itg_id: string }[]>`
    SELECT itg_id FROM inventory.item_group_master LIMIT 1`;
  const [unit] = await prisma.$queryRaw<{ unit_id: string }[]>`
    SELECT unit_id FROM inventory.item_unit_master WHERE unit_name = 'PCS' LIMIT 1`;
  const item = await prisma.itemMaster.create({
    data: {
      itemCode: code,
      itemNameEn: `${code} (e2e)`,
      itemGroupId: group.itg_id,
      itemCompanyId: COMPANY,
      itemBranchId: BRANCH,
      itemHsnCode: '21069099',
      itemAllowSales: true,
      itemAllowSalesReturn: true,
      // The engine must refuse a short shelf, not silently go negative.
      itemAllowNegStock: false,
    },
    select: { itemId: true },
  });
  const iuc = await prisma.itemUnitConversion.create({
    data: {
      iucItemId: item.itemId,
      iucUnitId: unit.unit_id,
      iucBaseUnitId: unit.unit_id,
      iucToBaseFactor: 1,
      iucUnitSlno: 1,
      iucIsBaseUnit: true,
    },
    select: { iucId: true },
  });
  return { itemId: item.itemId, iucId: iuc.iucId, code };
}

/**
 * Real opening stock through the real route, posted in the same call —
 * `schema/stock/19_opening_stock_flow.md`, the save-and-post path.
 */
export async function postOpeningStock(
  h: Harness,
  item: Item,
  qty: number,
  costRate: number,
  remarks: string,
): Promise<string> {
  const res = await h.http
    .post(`${API}/stock/opening/create`)
    .set('Authorization', BEARER)
    .send({
      header: {
        accYear: ACC_YEAR,
        companyId: COMPANY,
        branchId: BRANCH,
        deviceId: DEVICE_ID,
        docDate: '2026-04-01',
        toGodownId: GODOWN,
        lineCount: 1,
        totalQty: qty,
        totalValue: qty * costRate,
        totalValueWot: qty * costRate,
        rateSource: 'MANUAL',
        remarks,
        userId: ACTOR,
        voucherType: 'OPENING',
        status: 'POSTED',
      },
      lines: [
        {
          lineNo: 1,
          splitNo: 1,
          itemId: item.itemId,
          uomId: item.iucId,
          baseUomId: item.iucId,
          toBaseFactor: 1,
          godownId: GODOWN,
          bucket: 'SALEABLE',
          qty,
          baseQty: qty,
          freeQty: 0,
          freeBaseQty: 0,
          costRate,
          costRateWot: costRate,
          landedRate: 0,
          taxPerc: 0,
        },
      ],
    });
  if (res.status !== 201) {
    throw new Error(`opening stock failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.header.svhId as string;
}

// ─── probes: what the tables say ─────────────────────────────────────────

export type Row = Record<string, any>;

export function probes(prisma: PrismaClient) {
  const all = <T extends Row = Row>(sql: string, ...p: unknown[]) =>
    prisma.$queryRawUnsafe<T[]>(sql, ...p);
  return {
    /** The one stock_balance holding of the item in the fixture godown. */
    async balance(itemId: string): Promise<Row | undefined> {
      const rows = await all(
        `SELECT sbl_in_qty, sbl_out_qty, sbl_on_hand_qty, sbl_available_qty, sbl_avg_cost_rate,
                sbl_stock_value, sbl_bucket
           FROM stock.stock_balance
          WHERE sbl_item_id = $1::uuid AND sbl_godown_id = $2::uuid AND sbl_is_deleted = false
          ORDER BY sbl_bucket`,
        itemId,
        GODOWN,
      );
      return rows[0];
    },
    async itemCost(itemId: string): Promise<Row | undefined> {
      return (
        await all(
          `SELECT sic_total_qty, sic_total_value, sic_avg_cost_rate FROM stock.stock_item_cost
            WHERE sic_item_id = $1::uuid AND sic_branch_id = $2::uuid`,
          itemId,
          BRANCH,
        )
      )[0];
    },
    /** The SHADOW stock vouchers a sales document wrote (svh_link_src_*). */
    stockShadows(docType: string, docId: string) {
      return all(
        `SELECT svh_id, svh_status, svh_voucher_type, svh_refno, svh_line_count, svh_total_qty,
                svh_total_value, svh_total_value_wot
           FROM stock.stock_voucher
          WHERE svh_link_src_module = 'SALES' AND svh_link_src_doc_type = $1
            AND svh_link_src_doc_id = $2::uuid AND svh_is_deleted = false
          ORDER BY svh_created_on`,
        docType,
        docId,
      );
    },
    /** Every ledger row behind those shadows, originals then reversals. */
    stockLedger(docType: string, docId: string) {
      return all(
        `SELECT l.sml_line_no, l.sml_txn_type, l.sml_direction, l.sml_qty, l.sml_base_qty,
                l.sml_signed_base_qty, l.sml_cost_rate, l.sml_cost_value, l.sml_is_reversal,
                l.sml_reverses_id, l.sml_src_module, l.sml_src_doc_type, l.sml_src_refno,
                l.sml_party_id, l.sml_lot_id, l.sml_bucket
           FROM stock.stock_ledger l
           JOIN stock.stock_voucher v ON v.svh_id = l.sml_src_doc_id
          WHERE v.svh_link_src_module = 'SALES' AND v.svh_link_src_doc_type = $1
            AND v.svh_link_src_doc_id = $2::uuid AND l.sml_is_deleted = false
          ORDER BY l.sml_is_reversal, l.sml_posted_on, l.sml_line_no`,
        docType,
        docId,
      );
    },
    /** Live voucher headers raised from a document, oldest first. */
    vouchers(srcDocType: string, srcDocId: string) {
      return all(
        `SELECT avh_voucher_id, avh_voucher_type_id, avh_voucher_no, avh_voucher_refno,
                avh_voucher_status, avh_doc_amount, avh_total_debit, avh_total_credit,
                avh_party_id, avh_cancel_reason, avh_reversal_voucher_id, avh_against_voucher_id,
                avh_posted_on, avh_voucher_date
           FROM accounts.acc_voucher_header
          WHERE avh_src_module = 'SALES' AND avh_src_doc_type = $1
            AND avh_src_doc_id = $2::uuid AND avh_is_deleted = false
          ORDER BY avh_created_on, avh_voucher_slno`,
        srcDocType,
        srcDocId,
      );
    },
    /** One header by id — how a reversal (which carries no source pointer) is read. */
    /** A bill's re-tender contras: each is keyed on the tender row it voided. */
    retenderContras(sbId: string) {
      return all(
        `SELECT h.avh_voucher_id, h.avh_voucher_type_id, h.avh_voucher_no, h.avh_voucher_refno,
                h.avh_voucher_status, h.avh_doc_amount, h.avh_doc_refno, h.avh_src_doc_id
           FROM accounts.acc_voucher_header h
           JOIN accounts.acc_tender_detail t ON t.td_id = h.avh_src_doc_id
          WHERE h.avh_src_module = 'SALES' AND h.avh_src_doc_type = 'SALE_BILL_RETENDER'
            AND t.td_src_doc_type = 'SALE_BILL' AND t.td_src_doc_id = $1::uuid
            AND h.avh_is_deleted = false
          ORDER BY h.avh_created_on, h.avh_voucher_slno`,
        sbId,
      );
    },

    async voucherById(voucherId: string): Promise<Row | undefined> {
      return (
        await all(
          `SELECT avh_voucher_id, avh_voucher_type_id, avh_voucher_no, avh_voucher_refno,
                  avh_voucher_status, avh_doc_amount, avh_total_debit, avh_total_credit,
                  avh_party_id, avh_cancel_reason, avh_reversal_voucher_id, avh_against_voucher_id,
                  avh_posted_on, avh_voucher_date, avh_src_doc_id, avh_doc_refno, avh_remarks
             FROM accounts.acc_voucher_header
            WHERE avh_voucher_id = $1::uuid AND avh_is_deleted = false`,
          voucherId,
        )
      )[0];
    },
    legs(voucherId: string) {
      return all(
        `SELECT av_row_no, av_dr_cr, av_ledger_id, av_amount, av_role, av_remarks
           FROM accounts.acc_vouchers
          WHERE av_voucher_id = $1::uuid AND av_is_deleted = false
          ORDER BY av_row_no`,
        voucherId,
      );
    },
    register(sourceDocId: string) {
      return all(
        `SELECT gdr_id, gdr_doc_type, gdr_doc_status, gdr_tran_nature, gdr_doc_flow, gdr_doc_sign,
                gdr_bill_value, gdr_taxable_value, gdr_cgst_value, gdr_sgst_value, gdr_party_id,
                gdr_is_einvoice_applicable, gdr_is_ewaybill_applicable, gdr_doc_cancel_reason,
                gdr_voucher_id, gdr_voucher_type_id, gdr_supply_nature
           FROM accounts.acc_voucher_doc_register
          WHERE gdr_source_doc_id = $1::uuid AND gdr_is_deleted = false
          ORDER BY gdr_created_on`,
        sourceDocId,
      );
    },
    einvoiceRows(gdrId: string) {
      return all(
        `SELECT gde_status FROM accounts.acc_voucher_doc_einvoice WHERE gde_gdr_id = $1::uuid`,
        gdrId,
      );
    },
    /** Live (not soft-deleted) balance rows of a document. */
    balanceRows(srcDocType: string, srcDocId: string) {
      return all(
        `SELECT abl_id, abl_bill_type, abl_dr_cr, abl_party_id, abl_bill_amount, abl_alloc_amount,
                abl_pending_amount, abl_status, abl_voucher_id, abl_credit_days, abl_doc_refno,
                abl_is_active, abl_narration
           FROM accounts.acc_bill_balance
          WHERE abl_src_module = 'SALES' AND abl_src_doc_type = $1
            AND abl_src_doc_id = $2::uuid AND abl_is_deleted = false
          ORDER BY abl_created_on`,
        srcDocType,
        srcDocId,
      );
    },
    /** Live adjustments written against a balance row (the bill being settled). */
    adjustments(billAblId: string) {
      return all(
        `SELECT abj_id, abj_adj_type, abj_dr_cr, abj_amount, abj_against_bill_id, abj_reversal_of_id
           FROM accounts.acc_bill_adjustment
          WHERE abj_bill_id = $1::uuid AND abj_is_deleted = false
          ORDER BY abj_created_on, abj_row_no`,
        billAblId,
      );
    },
    trail(docId: string) {
      return all(
        `SELECT tsl_seq_no, tsl_event, tsl_from_status, tsl_to_status, tsl_remarks, tsl_src_doc_type
           FROM public.txn_status_log WHERE tsl_src_doc_id = $1::uuid ORDER BY tsl_seq_no`,
        docId,
      );
    },
    tenders(srcDocType: string, srcDocId: string) {
      return all(
        `SELECT td_id, td_row_no, td_tender_id, td_tender_type_id, td_tender_ledger_id, td_dr_cr,
                td_amount, td_is_voided, td_void_reason, td_replaces_id, td_bank_name, td_ref_no
           FROM accounts.acc_tender_detail
          WHERE td_src_module = 'SALES' AND td_src_doc_type = $1 AND td_src_doc_id = $2::uuid
            AND td_is_deleted = false
          ORDER BY td_row_no`,
        srcDocType,
        srcDocId,
      );
    },
    tempCredits(srcDocId: string) {
      return all(
        `SELECT atc_id, atc_status, atc_name, atc_mobile, atc_days, atc_due_date, atc_credit_amount,
                atc_balance_amount, atc_bill_amount, atc_abl_id, atc_tender_id, atc_promise_date,
                atc_remarks
           FROM accounts.acc_temp_credit
          WHERE atc_src_doc_id = $1::uuid AND atc_is_deleted = false ORDER BY atc_created_on`,
        srcDocId,
      );
    },
    /**
     * Net DR of a party ledger over every live leg raised from one document —
     * its own vouchers AND the reversals that answer them.
     */
    async partyNet(partyLedgerId: string, srcDocId: string): Promise<number> {
      const [row] = await all<{ net: unknown }>(
        `SELECT COALESCE(SUM(CASE WHEN v.av_dr_cr = 'DR' THEN v.av_amount ELSE -v.av_amount END), 0) AS net
           FROM accounts.acc_vouchers v
           JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = v.av_voucher_id
          WHERE v.av_ledger_id = $1::uuid
            AND (h.avh_src_doc_id = $2::uuid
                 OR h.avh_against_voucher_id IN (SELECT avh_voucher_id FROM accounts.acc_voucher_header
                                                  WHERE avh_src_doc_id = $2::uuid))
            AND v.av_is_deleted = false AND h.avh_is_deleted = false`,
        partyLedgerId,
        srcDocId,
      );
      return num(row?.net);
    },
    saleBill(sbId: string) {
      return all(
        `SELECT sb_status, sb_bill_refno, sb_posted_voucher_id, sb_doc_register_id, sb_cogs_amt,
                sb_total_cost, sb_paid_amt, sb_balance_amt, sb_pay_status, sb_has_dc, sb_revision_no,
                sb_returned_amt, sb_return_status, sb_tender_amt, sb_advance_amt
           FROM sales.sale_bill WHERE sb_id = $1::uuid AND sb_acc_year = $2`,
        sbId,
        ACC_YEAR,
      ).then((r) => r[0]);
    },
    saleBillItems(sbId: string) {
      return all(
        `SELECT sbi_id, sbi_line_no, sbi_bill_qty, sbi_cogs_amt, sbi_lot_id, sbi_src_doc_type,
                sbi_src_item_id
           FROM sales.sale_bill_item WHERE sbi_bill_id = $1::uuid AND sbi_acc_year = $2
            AND sbi_is_deleted = false ORDER BY sbi_line_no`,
        sbId,
        ACC_YEAR,
      );
    },
    dcItems(sdcId: string) {
      return all(
        `SELECT sdi_id, sdi_line_no, sdi_dc_qty, sdi_billed_qty, sdi_returned_qty, sdi_open_qty,
                sdi_line_status, sdi_cost_price, sdi_lot_id
           FROM sales.sale_dc_item WHERE sdi_dc_id = $1::uuid AND sdi_acc_year = $2
            AND sdi_is_deleted = false ORDER BY sdi_line_no`,
        sdcId,
        ACC_YEAR,
      );
    },
    dcHeader(sdcId: string) {
      return all(
        `SELECT sdc_status, sdc_dc_refno, sdc_posted_voucher_id, sdc_total_cost, sdc_billed_amt,
                sdc_returned_amt, sdc_fulfil_status, sdc_purpose
           FROM sales.sale_dc WHERE sdc_id = $1::uuid AND sdc_acc_year = $2`,
        sdcId,
        ACC_YEAR,
      ).then((r) => r[0]);
    },
    dcReturnHeader(sdrId: string) {
      return all(
        `SELECT sdr_status, sdr_return_refno, sdr_posted_voucher_id, sdr_total_cost, sdr_dc_refno,
                sdr_cust_id
           FROM sales.sale_dc_return WHERE sdr_id = $1::uuid AND sdr_acc_year = $2`,
        sdrId,
        ACC_YEAR,
      ).then((r) => r[0]);
    },
    saleReturnHeader(srId: string) {
      return all(
        `SELECT sr_status, sr_return_refno, sr_posted_voucher_id, sr_total_cost, sr_settle_mode,
                sr_refund_amt, sr_adjusted_amt, sr_credit_amt, sr_settle_status, sr_return_amt
           FROM sales.sale_return WHERE sr_id = $1::uuid AND sr_acc_year = $2`,
        srId,
        ACC_YEAR,
      ).then((r) => r[0]);
    },
    /** The ledger a role resolves to: the company's own row first, else the global one. */
    async ledgerOfRole(role: string): Promise<string> {
      const [row] = await all<{ alm_ledger_id: string }>(
        `SELECT alm_ledger_id FROM accounts.acc_ledger_map
          WHERE (alm_company_id = $1::uuid OR alm_company_id IS NULL) AND alm_role = $2
            AND alm_is_active = true AND alm_is_deleted = false AND alm_supply_nature IS NULL
          ORDER BY (alm_company_id IS NOT NULL) DESC, (alm_branch_id IS NOT NULL) DESC
          LIMIT 1`,
        COMPANY,
        role,
      );
      if (!row) throw new Error(`no ledger mapped for role ${role}`);
      return row.alm_ledger_id;
    },
  };
}

// ─── bodies ──────────────────────────────────────────────────────────────

export interface LineSpec {
  item: Item;
  qty: number;
  rate: number;
  /** GST, split half/half into CGST and SGST (intra-state). */
  taxPerc?: number;
  /** Sold against a posted challan line: no stock moves, no COGS. */
  src?: { sdcId: string; sdiId: string; refno: string; lineNo: number };
}

export interface TenderSpec {
  tenderId: string;
  amount: number;
  refNo?: string;
  tempCredit?: { name: string; mobile: string; days: number; place?: string };
}

/** Line and header figures for `qty × rate` lines at one GST rate. */
export function figures(lines: LineSpec[]) {
  let taxable = 0;
  let cgst = 0;
  let sgst = 0;
  const items = lines.map((l, idx) => {
    const perc = l.taxPerc ?? 18;
    const lineTaxable = round2(l.qty * l.rate);
    const lineCgst = round2((lineTaxable * perc) / 200);
    const lineSgst = round2((lineTaxable * perc) / 200);
    taxable += lineTaxable;
    cgst += lineCgst;
    sgst += lineSgst;
    return {
      lineNo: idx + 1,
      taxable: lineTaxable,
      cgst: lineCgst,
      sgst: lineSgst,
      tax: round2(lineCgst + lineSgst),
      net: round2(lineTaxable + lineCgst + lineSgst),
      perc,
      spec: l,
    };
  });
  taxable = round2(taxable);
  cgst = round2(cgst);
  sgst = round2(sgst);
  return {
    items,
    taxable,
    cgst,
    sgst,
    tax: round2(cgst + sgst),
    total: round2(taxable + cgst + sgst),
  };
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * POST /bills/create body. Cash-tendered by default; pass `tenders: []` for a
 * CREDIT bill (the party stays debited, nothing settles it).
 */
export function billBody(opts: {
  custId: string;
  custName: string;
  lines: LineSpec[];
  tenders?: TenderSpec[];
  usrRefno: string;
  billDate?: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const f = figures(opts.lines);
  const date = opts.billDate ?? today();
  const tenders = opts.tenders ?? [{ tenderId: TENDER.CASH, amount: f.total }];
  const settled = round2(
    tenders
      .filter((t) => t.tenderId !== TENDER.CREDIT && t.tenderId !== TENDER.TEMP_CR)
      .reduce((s, t) => s + t.amount, 0),
  );
  const balance = round2(f.total - settled);
  return {
    sbCompanyId: COMPANY,
    sbBranchId: BRANCH,
    sbAccYear: ACC_YEAR,
    sbDeviceType: 'PC',
    sbDeviceId: DEVICE_ID,
    sbPriceLevel: 1,
    sbCustId: opts.custId,
    sbCustName: opts.custName,
    sbCustStcd: '33',
    sbPosStcd: '33',
    sbUserId: ACTOR,
    sbUsrRefno: opts.usrRefno,
    sbBillDate: date,
    sbDueDays: 30,
    sbDueDate: addDays(date, 30),
    sbBillType: balance > 0 ? 'CREDIT' : 'CASH',
    sbDocType: 'TAX_INVOICE',
    sbTotItems: opts.lines.length,
    sbGrossAmt: f.taxable,
    sbTaxableAmt: f.taxable,
    sbCgstAmt: f.cgst,
    sbSgstAmt: f.sgst,
    sbTaxAmt: f.tax,
    sbBillAmt: f.total,
    sbTenderAmt: round2(tenders.reduce((s, t) => s + t.amount, 0)),
    sbPaidAmt: settled,
    sbBalanceAmt: balance,
    sbPayStatus: balance <= 0 ? 'PAID' : settled > 0 ? 'PARTIAL' : 'UNPAID',
    items: f.items.map((i) => ({
      sbiLineNo: i.lineNo,
      sbiItemId: i.spec.item.itemId,
      sbiItemUnitId: i.spec.item.iucId,
      sbiGodownId: GODOWN,
      sbiHsnCode: '21069099',
      sbiBillQty: i.spec.qty,
      sbiNetQty: i.spec.qty,
      sbiRate: i.spec.rate,
      sbiGrossAmt: i.taxable,
      sbiTaxableAmt: i.taxable,
      sbiTaxPerc: i.perc,
      sbiCgstPerc: i.perc / 2,
      sbiCgstAmt: i.cgst,
      sbiSgstPerc: i.perc / 2,
      sbiSgstAmt: i.sgst,
      sbiTaxAmt: i.tax,
      sbiNetAmt: i.net,
      ...(i.spec.src
        ? {
            sbiSrcDocType: 'DELIVERY_CHALLAN',
            sbiSrcDocId: i.spec.src.sdcId,
            sbiSrcDocYear: ACC_YEAR,
            sbiSrcDocRefno: i.spec.src.refno,
            sbiSrcDocLineNo: i.spec.src.lineNo,
            sbiSrcItemId: i.spec.src.sdiId,
            sbiSrcItemQty: i.spec.qty,
          }
        : {}),
    })),
    tenders: tenders.map((t) => ({
      tdTenderId: t.tenderId,
      tdAmount: t.amount,
      ...(t.refNo ? { tdRefNo: t.refNo } : {}),
      ...(t.tempCredit ? { tempCredit: t.tempCredit } : {}),
    })),
    ...(opts.extra ?? {}),
  };
}

export function billKeys(sbId: string) {
  return { sbId, sbCompanyId: COMPANY, sbBranchId: BRANCH, sbAccYear: ACC_YEAR };
}

export function dcBody(opts: {
  custId: string;
  custName: string;
  lines: LineSpec[];
  usrRefno: string;
  purpose?: string;
}): Record<string, unknown> {
  const f = figures(opts.lines);
  return {
    sdcCompanyId: COMPANY,
    sdcBranchId: BRANCH,
    sdcAccYear: ACC_YEAR,
    sdcDeviceType: 'PC',
    sdcDeviceId: DEVICE_ID,
    // sdc_counter_id is NOT NULL (no counter master exists): the till is the counter.
    sdcCounterId: DEVICE_ID,
    sdcUserId: ACTOR,
    sdcCustId: opts.custId,
    sdcCustName: opts.custName,
    sdcCustStcd: '33',
    sdcPosStcd: '33',
    sdcPurpose: opts.purpose ?? 'SUPPLY',
    sdcUsrRefno: opts.usrRefno,
    sdcDcDate: today(),
    sdcTotItems: opts.lines.length,
    sdcGrossAmt: f.taxable,
    sdcTaxableAmt: f.taxable,
    sdcCgstAmt: f.cgst,
    sdcSgstAmt: f.sgst,
    sdcTaxAmt: f.tax,
    sdcDcAmt: f.total,
    items: f.items.map((i) => ({
      sdiLineNo: i.lineNo,
      sdiItemId: i.spec.item.itemId,
      sdiItemUnitId: i.spec.item.iucId,
      sdiGodownId: GODOWN,
      sdiHsnCode: '21069099',
      sdiDcQty: i.spec.qty,
      sdiNetQty: i.spec.qty,
      sdiRate: i.spec.rate,
      sdiGrossAmt: i.taxable,
      sdiTaxableAmt: i.taxable,
      sdiTaxPerc: i.perc,
      sdiCgstPerc: i.perc / 2,
      sdiCgstAmt: i.cgst,
      sdiSgstPerc: i.perc / 2,
      sdiSgstAmt: i.sgst,
      sdiTaxAmt: i.tax,
      sdiNetAmt: i.net,
    })),
  };
}

export function dcKeys(sdcId: string) {
  return { sdcId, sdcCompanyId: COMPANY, sdcBranchId: BRANCH, sdcAccYear: ACC_YEAR };
}

export function dcReturnBody(opts: {
  sdcId: string;
  lines: (LineSpec & { sdiId: string; costRate: number })[];
  usrRefno: string;
  reason: string;
}): Record<string, unknown> {
  const f = figures(opts.lines);
  return {
    sdrCompanyId: COMPANY,
    sdrBranchId: BRANCH,
    sdrAccYear: ACC_YEAR,
    sdrDeviceType: 'PC',
    sdrDeviceId: DEVICE_ID,
    sdrCounterId: DEVICE_ID,
    sdrUserId: ACTOR,
    sdrDcId: opts.sdcId,
    sdrDcAccYear: ACC_YEAR,
    sdrUsrRefno: opts.usrRefno,
    sdrReturnDate: today(),
    sdrReturnReason: opts.reason,
    sdrTotItems: opts.lines.length,
    sdrGrossAmt: f.taxable,
    sdrTaxableAmt: f.taxable,
    sdrTaxAmt: f.tax,
    sdrReturnAmt: f.total,
    items: f.items.map((i) => {
      const spec = i.spec as LineSpec & { sdiId: string; costRate: number };
      return {
        sdriLineNo: i.lineNo,
        sdriDcItemId: spec.sdiId,
        sdriDcAccYear: ACC_YEAR,
        sdriItemId: spec.item.itemId,
        sdriItemUnitId: spec.item.iucId,
        sdriGodownId: GODOWN,
        sdriHsnCode: '21069099',
        sdriCondition: 'RESTOCK',
        sdriReturnQty: spec.qty,
        sdriNetQty: spec.qty,
        sdriRate: spec.rate,
        // The cost the goods LEFT at — a rate per base unit, what the engine
        // stamps as svi_cost_rate.
        sdriCostPrice: spec.costRate,
        sdriGrossAmt: i.taxable,
        sdriTaxableAmt: i.taxable,
        sdriTaxPerc: i.perc,
        sdriCgstPerc: i.perc / 2,
        sdriCgstAmt: i.cgst,
        sdriSgstPerc: i.perc / 2,
        sdriSgstAmt: i.sgst,
        sdriTaxAmt: i.tax,
        sdriNetAmt: i.net,
      };
    }),
  };
}

export function dcReturnKeys(sdrId: string) {
  return { sdrId, sdrCompanyId: COMPANY, sdrBranchId: BRANCH, sdrAccYear: ACC_YEAR };
}

export function saleReturnBody(opts: {
  custId: string;
  custName: string;
  bill: { sbId: string; refno: string };
  lines: (LineSpec & { sbiId: string; costRate: number })[];
  settleMode: 'CASH' | 'ADJUST' | 'ADVANCE';
  tenders?: TenderSpec[];
  usrRefno: string;
  reason: string;
}): Record<string, unknown> {
  const f = figures(opts.lines);
  return {
    srCompanyId: COMPANY,
    srBranchId: BRANCH,
    srAccYear: ACC_YEAR,
    srDeviceType: 'PC',
    srDeviceId: DEVICE_ID,
    srCounterId: DEVICE_ID,
    srPriceLevel: 1,
    srUserId: ACTOR,
    srCustId: opts.custId,
    srCustName: opts.custName,
    srCustStcd: '33',
    srPosStcd: '33',
    srIsAgainstBill: true,
    srBillId: opts.bill.sbId,
    srBillAccYear: ACC_YEAR,
    srBillRefno: opts.bill.refno,
    srUsrRefno: opts.usrRefno,
    srReturnDate: today(),
    srReturnReason: opts.reason,
    srSettleMode: opts.settleMode,
    srTotItems: opts.lines.length,
    srGrossAmt: f.taxable,
    srTaxableAmt: f.taxable,
    srCgstAmt: f.cgst,
    srSgstAmt: f.sgst,
    srTaxAmt: f.tax,
    srReturnAmt: f.total,
    items: f.items.map((i) => {
      const spec = i.spec as LineSpec & { sbiId: string; costRate: number };
      return {
        sriLineNo: i.lineNo,
        sriBillItemId: spec.sbiId,
        sriBillAccYear: ACC_YEAR,
        sriItemId: spec.item.itemId,
        sriItemUnitId: spec.item.iucId,
        sriGodownId: GODOWN,
        sriHsnCode: '21069099',
        sriCondition: 'RESTOCK',
        sriReturnQty: spec.qty,
        sriNetQty: spec.qty,
        sriRate: spec.rate,
        sriCostPrice: spec.costRate,
        sriGrossAmt: i.taxable,
        sriTaxableAmt: i.taxable,
        sriTaxPerc: i.perc,
        sriCgstPerc: i.perc / 2,
        sriCgstAmt: i.cgst,
        sriSgstPerc: i.perc / 2,
        sriSgstAmt: i.sgst,
        sriTaxAmt: i.tax,
        sriNetAmt: i.net,
      };
    }),
    ...(opts.tenders
      ? {
          tenders: opts.tenders.map((t) => ({
            tdTenderId: t.tenderId,
            tdAmount: t.amount,
            ...(t.refNo ? { tdRefNo: t.refNo } : {}),
          })),
        }
      : {}),
  };
}

export function saleReturnKeys(srId: string) {
  return { srId, srCompanyId: COMPANY, srBranchId: BRANCH, srAccYear: ACC_YEAR };
}

/** Log a failed response so the reason is in the jest output, then hand it back. */
export function explain(label: string, res: request.Response, expected: number): request.Response {
  if (res.status !== expected) {
    // eslint-disable-next-line no-console
    console.error(`[sales e2e] ${label}: ${res.status}\n${JSON.stringify(res.body, null, 2)}`);
  }
  return res;
}
