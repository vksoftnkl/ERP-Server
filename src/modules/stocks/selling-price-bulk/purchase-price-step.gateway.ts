import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rowTokenSql } from '../cost-price-bulk/cost-price-bulk.gateway';

type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;
type Dec = Prisma.Decimal;

/** The bill the price step works on (purchase.pur_invoice, read here and nowhere else in this module). */
export interface StepBill {
  piId: string;
  accYear: string;
  refno: string;
  companyId: string;
  branchId: string;
  branchName: string | null;
  status: string;
  /** `YYYY-MM-DD`. */
  docDate: string;
  docDatetime: Date;
  supplierInvNo: string | null;
  supplierName: string | null;
  deviceId: string | null;
  policy: unknown;
}

/** What a bill line brought in, per bucket key (an allocation row's MRP / sale price, else the line's). */
export interface StepPortion {
  mrp: Dec | null;
  salePrice: Dec | null;
  /** (qty + free) × factor — qty IN, base units. */
  baseQty: Dec;
}

export interface StepBillLine {
  piiId: string;
  lineNo: number;
  itemId: string;
  itemName: string;
  uomId: string;
  unitName: string | null;
  factor: Dec;
  billedQty: Dec;
  freeQty: Dec;
  rate: Dec;
  /** Per BASE unit, w/o GST (purchase-calc's own figure). */
  landedCostWot: Dec;
  mrp: Dec | null;
  /** Sell A–D typed on the bill. */
  sells: [Dec | null, Dec | null, Dec | null, Dec | null];
  minPrice: Dec | null;
  result: string | null;
  oldPrices: unknown;
  portions: StepPortion[];
}

/** One line of a POSTED bill later than ours (B5), per bucket key. */
export interface LaterLine {
  piId: string;
  accYear: string;
  refno: string;
  docDate: string;
  /** pi_doc_datetime — with docDate and piId, B5's "later" order. */
  docDatetime: Date;
  branchId: string;
  branchName: string | null;
  itemId: string;
  factor: Dec;
  mrp: Dec | null;
  salePrice: Dec | null;
  landedCostWot: Dec;
}

/** D16 — the latest logged change of a key after the bill's business time. */
export interface NewerChange {
  itemId: string;
  unitId: string;
  keyMrp: Dec;
  keySp: Dec;
  /**
   * The change was to a COMPANY-LESS price row (ipcl_company_id NULL: the log copies the row's
   * ipm_company_id). It counts only against a line in force that is itself company-less.
   */
  companyNull?: boolean;
  at: Date;
  who: string | null;
  source: string;
}

/** A price row as Cancel's put-back reads it, locked. */
export interface RowState {
  ipmId: string;
  token: string;
  isDeleted: boolean;
}

/** The figures a put-back restores (exact decimals as text). */
export interface RowFigures {
  cost: string;
  costWot: string;
  prices: [string, string, string, string];
  pricesWot: [string, string, string, string];
  markups: [string, string, string, string];
  min: string;
  max: string;
  profitType: string;
  roundOff: string;
}

/** A trail step's time (IST text) and its user's login. */
export interface StepMark {
  on: string;
  by: string | null;
  /** The exact moment (tsl_changed_on): `on` is cut to the second (review S3's business time needs it whole). */
  at?: Date;
}

/**
 * Change Selling Price P2 — every statement the purchase price step runs that is not a price
 * write: the bill and its lines, the B5 "later bill" lines, the D16 log, the settings it obeys,
 * the locks and row tokens of Cancel's put-back, the trail steps. Price rows are written only by
 * PriceMasterWriter (through SellingPriceBulkService.applyBucketPrice).
 */
@Injectable()
export class PurchasePriceStepGateway {
  /**
   * The bill header, with its supplier's and branch's names. Null when no such live bill.
   * `lock: 'SHARE'` (review N2, the purchase view's save) holds the bill row FOR SHARE: a cancel
   * running meanwhile waits for the save, and one that committed first is read as CANCELLED.
   */
  async readBill(client: Client, piId: string, accYear: string, opts: { lock?: 'SHARE' } = {}): Promise<StepBill | null> {
    const [row] = await client.$queryRaw<
      Array<{
        piId: string;
        accYear: string;
        refno: string;
        companyId: string;
        branchId: string;
        branchName: string | null;
        status: string;
        docDate: string;
        docDatetime: Date;
        supplierInvNo: string | null;
        supplierName: string | null;
        deviceId: string | null;
        policy: unknown;
      }>
    >`
      SELECT h.pi_id::text            AS "piId",
             h.pi_acc_year::text      AS "accYear",
             h.pi_refno               AS "refno",
             h.pi_company_id::text    AS "companyId",
             h.pi_branch_id::text     AS "branchId",
             COALESCE(NULLIF(btrim(b.br_short), ''), b.br_name) AS "branchName",
             h.pi_status              AS "status",
             h.pi_doc_date::text      AS "docDate",
             h.pi_doc_datetime        AS "docDatetime",
             h.pi_supplier_inv_no     AS "supplierInvNo",
             s.sup_name               AS "supplierName",
             h.pi_device_id::text     AS "deviceId",
             h.pi_policy              AS "policy"
        FROM purchase.pur_invoice h
        LEFT JOIN public.branch_master b ON b.br_id = h.pi_branch_id
        LEFT JOIN purchase.suppliers s ON s.sup_id = h.pi_supplier_id
       WHERE h.pi_id = ${piId}::uuid
         AND h.pi_acc_year = ${accYear}::bpchar
         AND h.pi_is_deleted = false
       ${opts.lock === 'SHARE' ? Prisma.sql`FOR SHARE OF h` : Prisma.empty}
    `;
    return row ? { ...row, accYear: row.accYear.trim() } : null;
  }

  /**
   * The bill's lines in bill order, each with its portions: one per distinct bucket key of its
   * allocation rows (`pia_mrp` / `pia_sale_price`, else the line's MRP / Sell A, as the lot is
   * keyed), qty in = (qty + free) × factor. A line billed off a GRN has no allocation rows here:
   * one portion, (received + damaged + free) × factor at the line's MRP.
   */
  async readLines(client: Client, piId: string, accYear: string): Promise<StepBillLine[]> {
    const rows = await client.$queryRaw<
      Array<{
        piiId: string;
        lineNo: number;
        itemId: string;
        itemName: string | null;
        uomId: string;
        unitName: string | null;
        factor: Dec;
        billedQty: Dec;
        freeQty: Dec;
        receivedQty: Dec;
        damagedQty: Dec;
        rate: Dec;
        landedCostWot: Dec;
        mrp: Dec | null;
        sellA: Dec | null;
        sellB: Dec | null;
        sellC: Dec | null;
        sellD: Dec | null;
        minPrice: Dec | null;
        result: string | null;
        oldPrices: unknown;
        portions: Array<{ mrp: string | null; sp: string | null; qty: string }> | null;
      }>
    >`
      SELECT l.pii_id::text        AS "piiId",
             l.pii_line_no         AS "lineNo",
             l.pii_item_id::text   AS "itemId",
             i.item_name_en        AS "itemName",
             l.pii_uom_id::text    AS "uomId",
             u.unit_name           AS "unitName",
             l.pii_to_base_factor  AS "factor",
             l.pii_billed_qty      AS "billedQty",
             l.pii_free_qty        AS "freeQty",
             l.pii_received_qty    AS "receivedQty",
             l.pii_damaged_qty     AS "damagedQty",
             l.pii_rate            AS "rate",
             l.pii_landed_cost_wot AS "landedCostWot",
             l.pii_mrp             AS "mrp",
             l.pii_sell_a AS "sellA", l.pii_sell_b AS "sellB", l.pii_sell_c AS "sellC", l.pii_sell_d AS "sellD",
             l.pii_min_price       AS "minPrice",
             l.pii_price_update_result AS "result",
             l.pii_old_prices      AS "oldPrices",
             (SELECT json_agg(json_build_object('mrp', k.mrp::text, 'sp', k.sp::text, 'qty', k.qty::text))
                FROM (SELECT COALESCE(a.pia_mrp, l.pii_mrp) AS mrp,
                             COALESCE(a.pia_sale_price, l.pii_sell_a) AS sp,
                             SUM((a.pia_qty + a.pia_free_qty) * l.pii_to_base_factor) AS qty,
                             MIN(a.pia_row_no) AS first_row
                        FROM purchase.pur_item_alloc a
                       WHERE a.pia_doc_type = 'PURCHASE_BILL'
                         AND a.pia_line_id = l.pii_id
                         AND a.pia_acc_year = l.pii_acc_year
                         AND a.pia_is_deleted = false
                       GROUP BY 1, 2
                       ORDER BY first_row) k) AS "portions"
        FROM purchase.pur_invoice_item l
        LEFT JOIN inventory.item_master i ON i.item_id = l.pii_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = l.pii_uom_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE l.pii_pi_id = ${piId}::uuid
         AND l.pii_acc_year = ${accYear}::bpchar
         AND l.pii_is_deleted = false
       ORDER BY l.pii_line_no, l.pii_id
    `;
    const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
    return rows.map((row) => {
      const portions: StepPortion[] = (row.portions ?? []).map((p) => ({
        mrp: p.mrp === null ? null : D(p.mrp),
        salePrice: p.sp === null ? null : D(p.sp),
        baseQty: D(p.qty ?? 0),
      }));
      return {
        piiId: row.piiId,
        lineNo: Number(row.lineNo),
        itemId: row.itemId,
        itemName: row.itemName ?? '',
        uomId: row.uomId,
        unitName: row.unitName,
        factor: D(row.factor),
        billedQty: D(row.billedQty),
        freeQty: D(row.freeQty),
        rate: D(row.rate),
        landedCostWot: D(row.landedCostWot ?? 0),
        mrp: row.mrp === null ? null : D(row.mrp),
        sells: [row.sellA, row.sellB, row.sellC, row.sellD].map((v) => (v === null ? null : D(v))) as StepBillLine['sells'],
        minPrice: row.minPrice === null ? null : D(row.minPrice),
        result: row.result,
        oldPrices: row.oldPrices,
        portions: portions.length
          ? portions
          : [
              {
                mrp: row.mrp === null ? null : D(row.mrp),
                salePrice: row.sellA === null ? null : D(row.sellA),
                baseQty: D(row.receivedQty).plus(D(row.damagedQty)).plus(D(row.freeQty)).times(D(row.factor)),
              },
            ],
      };
    });
  }

  /**
   * B5 (plan §4.5, Q4 / Q5) — the lines of POSTED bills of the company LATER than ours by our
   * bill date ((pi_doc_date, pi_doc_datetime, pi_id), any acc year) for these items, with a
   * landed cost above 0, per bucket key, the latest first. DRAFT and CANCELLED bills do not
   * count; the caller narrows to the key and the scope (C4). `ix_pii_item` serves it.
   */
  async laterLines(
    client: Client,
    args: { companyId: string; piId: string; docDate: string; docDatetime: Date; itemIds: readonly string[] },
  ): Promise<LaterLine[]> {
    if (!args.itemIds.length) {
      return [];
    }
    const rows = await client.$queryRaw<
      Array<{
        piId: string;
        accYear: string;
        refno: string;
        docDate: string;
        docDatetime: Date;
        branchId: string;
        branchName: string | null;
        itemId: string;
        factor: Dec;
        mrp: Dec | null;
        sp: Dec | null;
        landedCostWot: Dec;
      }>
    >`
      SELECT DISTINCT
             h.pi_id::text          AS "piId",
             h.pi_acc_year::text    AS "accYear",
             h.pi_refno             AS "refno",
             h.pi_doc_date::text    AS "docDate",
             h.pi_doc_datetime      AS "docDatetime",
             h.pi_branch_id::text   AS "branchId",
             COALESCE(NULLIF(btrim(b.br_short), ''), b.br_name) AS "branchName",
             l.pii_item_id::text    AS "itemId",
             l.pii_to_base_factor   AS "factor",
             COALESCE(a.pia_mrp, l.pii_mrp)           AS "mrp",
             COALESCE(a.pia_sale_price, l.pii_sell_a) AS "sp",
             l.pii_landed_cost_wot  AS "landedCostWot"
        FROM purchase.pur_invoice h
        JOIN purchase.pur_invoice_item l
          ON l.pii_pi_id = h.pi_id AND l.pii_acc_year = h.pi_acc_year AND l.pii_is_deleted = false
        LEFT JOIN purchase.pur_item_alloc a
          ON a.pia_doc_type = 'PURCHASE_BILL' AND a.pia_line_id = l.pii_id
         AND a.pia_acc_year = l.pii_acc_year AND a.pia_is_deleted = false
        LEFT JOIN public.branch_master b ON b.br_id = h.pi_branch_id
       WHERE h.pi_company_id = ${args.companyId}::uuid
         AND h.pi_status = 'POSTED'
         AND h.pi_is_deleted = false
         AND l.pii_item_id = ANY(${[...args.itemIds]}::uuid[])
         AND l.pii_landed_cost_wot > 0
         AND (h.pi_doc_date, h.pi_doc_datetime, h.pi_id)
             > (${args.docDate}::date, ${args.docDatetime}::timestamptz, ${args.piId}::uuid)
       ORDER BY "docDate" DESC, "docDatetime" DESC, "piId" DESC
    `;
    const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
    return rows.map((row) => ({
      piId: row.piId,
      accYear: row.accYear.trim(),
      refno: row.refno,
      docDate: row.docDate,
      docDatetime: row.docDatetime,
      branchId: row.branchId,
      branchName: row.branchName,
      itemId: row.itemId,
      factor: D(row.factor),
      mrp: row.mrp === null ? null : D(row.mrp),
      salePrice: row.sp === null ? null : D(row.sp),
      landedCostWot: D(row.landedCostWot),
    }));
  }

  /**
   * D16, narrowed to the KEY (plan §4.5): the latest logged change of each (item, unit, MRP key,
   * sale-price key) of these items, at the bill's branch or All branches, after the bill's
   * business time. Automatic modes only. Changes to this company's rows AND to company-less rows
   * (ipcl_company_id NULL — an All branches line with no company, which the log files with no
   * company) are read, the latest of each kind per key; the caller counts a company-less one only
   * against a company-less line.
   */
  async newerChanges(
    client: Client,
    args: {
      companyId: string;
      branchId: string;
      itemIds: readonly string[];
      after: Date;
      /**
       * Review S3 (the view's changedSince) — leave out what this bill itself wrote: its post and
       * its cancel (reason "Purchase <refno> …") and saves from its view ("From purchase <refno> …").
       */
      exceptBill?: string;
    },
  ): Promise<NewerChange[]> {
    if (!args.itemIds.length) {
      return [];
    }
    const own = args.exceptBill
      ? Prisma.sql`
         AND NOT (starts_with(COALESCE(l.ipcl_reason, '')::text, ${`Purchase ${args.exceptBill} `}::text)
                  OR starts_with(COALESCE(l.ipcl_reason, '')::text, ${`From purchase ${args.exceptBill} `}::text))`
      : Prisma.empty;
    return client.$queryRaw<NewerChange[]>`
      SELECT DISTINCT ON (l.ipcl_item_id, l.ipcl_unit_id, COALESCE(l.ipcl_bucket_mrp, -1), COALESCE(l.ipcl_bucket_sp, -1),
                          (l.ipcl_company_id IS NULL))
             l.ipcl_item_id::text AS "itemId",
             l.ipcl_unit_id::text AS "unitId",
             COALESCE(l.ipcl_bucket_mrp, -1) AS "keyMrp",
             COALESCE(l.ipcl_bucket_sp, -1)  AS "keySp",
             (l.ipcl_company_id IS NULL) AS "companyNull",
             l.ipcl_changed_on    AS "at",
             l.ipcl_user_name     AS "who",
             l.ipcl_source        AS "source"
        FROM inventory.item_price_change_log l
       WHERE (l.ipcl_company_id = ${args.companyId}::uuid OR l.ipcl_company_id IS NULL)
         AND (l.ipcl_branch_id IS NULL OR l.ipcl_branch_id = ${args.branchId}::uuid)
         AND l.ipcl_price_table = 'IPM'
         AND l.ipcl_item_id = ANY(${[...args.itemIds]}::uuid[])
         AND l.ipcl_changed_on > ${args.after}${own}
       ORDER BY l.ipcl_item_id, l.ipcl_unit_id, COALESCE(l.ipcl_bucket_mrp, -1), COALESCE(l.ipcl_bucket_sp, -1),
                (l.ipcl_company_id IS NULL), l.ipcl_changed_on DESC
    `;
  }

  /**
   * The settings the automatic modes obey, through fn_app_settings_effective at the bill's
   * company and branch: inventory.below_cost_price, inventory.skip_mrp, sales.default_price_level.
   */
  async stepSettings(
    client: Client,
    companyId: string,
    branchId: string,
  ): Promise<{ belowCost: 'restrict' | 'warning' | 'allow'; skipMrp: boolean; defaultLevel: number }> {
    const rows = await client.$queryRaw<Array<{ key: string; value: string | null }>>`
      SELECT out_asd_key AS key, out_effective_value AS value
        FROM public.fn_app_settings_effective(${companyId}::uuid, ${branchId}::uuid, NULL::uuid, NULL::uuid)
       WHERE out_asd_key IN ('inventory.below_cost_price', 'inventory.skip_mrp', 'sales.default_price_level')`;
    const value = (key: string) => rows.find((row) => row.key === key)?.value?.trim() ?? '';
    const policy = value('inventory.below_cost_price').toLowerCase();
    const level = Number.parseInt(value('sales.default_price_level'), 10);
    return {
      belowCost: policy === 'restrict' || policy === 'allow' ? policy : 'warning',
      skipMrp: ['true', '1', 'yes', 'y', 'on'].includes(value('inventory.skip_mrp').toLowerCase()),
      defaultLevel: Number.isInteger(level) && level >= 1 && level <= 4 ? level : 1,
    };
  }

  /**
   * Decision 20 — the target rows locked FOR UPDATE, in ipm_id order (one order for every bill).
   * Answers each row's ipm_company_id (null = a company-less line: D16 then reads its
   * company-less log rows too).
   */
  async lockRows(client: Client, ipmIds: readonly string[]): Promise<Map<string, string | null>> {
    const ids = [...new Set(ipmIds)].sort();
    if (!ids.length) {
      return new Map();
    }
    const rows = await client.$queryRaw<Array<{ ipmId: string; companyId: string | null }>>`
      SELECT p.ipm_id::text AS "ipmId", p.ipm_company_id::text AS "companyId"
        FROM inventory.item_price_master p
       WHERE p.ipm_id = ANY(${ids}::uuid[])
       ORDER BY p.ipm_id
       FOR UPDATE OF p`;
    return new Map(rows.map((row) => [row.ipmId, row.companyId]));
  }

  /**
   * Review S3 — each row's own ipm_company_id (null = a company-less line), with NO lock: the
   * view reads D16's companyNull rule from it (the post reads it from lockRows).
   */
  async rowCompanies(client: Client, ipmIds: readonly string[]): Promise<Map<string, string | null>> {
    const ids = [...new Set(ipmIds)];
    if (!ids.length) {
      return new Map();
    }
    const rows = await client.$queryRaw<Array<{ ipmId: string; companyId: string | null }>>`
      SELECT p.ipm_id::text AS "ipmId", p.ipm_company_id::text AS "companyId"
        FROM inventory.item_price_master p
       WHERE p.ipm_id = ANY(${ids}::uuid[])`;
    return new Map(rows.map((row) => [row.ipmId, row.companyId]));
  }

  /** Each row's token (rowTokenSql) and deleted flag, locked FOR UPDATE in ipm_id order. */
  async lockRowStates(client: Client, ipmIds: readonly string[]): Promise<Map<string, RowState>> {
    const ids = [...new Set(ipmIds)].sort();
    if (!ids.length) {
      return new Map();
    }
    const rows = await client.$queryRaw<RowState[]>`
      SELECT p.ipm_id::text AS "ipmId", ${rowTokenSql('p')} AS "token", p.ipm_is_deleted AS "isDeleted"
        FROM inventory.item_price_master p
       WHERE p.ipm_id = ANY(${ids}::uuid[])
       ORDER BY p.ipm_id
       FOR UPDATE OF p`;
    return new Map(rows.map((row) => [row.ipmId, row]));
  }

  /** The tokens of rows just written (no lock: the writer holds them). */
  async rowTokens(client: Client, ipmIds: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(ipmIds)];
    if (!ids.length) {
      return new Map();
    }
    const rows = await client.$queryRaw<Array<{ ipmId: string; token: string }>>`
      SELECT p.ipm_id::text AS "ipmId", ${rowTokenSql('p')} AS "token"
        FROM inventory.item_price_master p
       WHERE p.ipm_id = ANY(${ids}::uuid[])`;
    return new Map(rows.map((row) => [row.ipmId, row.token]));
  }

  /** The figures a put-back needs, as exact text, per row. */
  async rowFigures(client: Client, ipmIds: readonly string[]): Promise<Map<string, RowFigures>> {
    const ids = [...new Set(ipmIds)];
    if (!ids.length) {
      return new Map();
    }
    const rows = await client.$queryRaw<
      Array<{
        ipmId: string;
        cost: string;
        costWot: string;
        pa: string; pb: string; pc: string; pd: string;
        wa: string; wb: string; wc: string; wd: string;
        ma: string; mb: string; mc: string; md: string;
        min: string;
        max: string;
        profitType: string;
        roundOff: string;
      }>
    >`
      SELECT p.ipm_id::text AS "ipmId",
             p.ipm_cost_price::text AS "cost", p.ipm_cost_wot::text AS "costWot",
             p.ipm_sales_price_a::text AS pa, p.ipm_sales_price_b::text AS pb,
             p.ipm_sales_price_c::text AS pc, p.ipm_sales_price_d::text AS pd,
             p.ipm_price_a_wot::text AS wa, p.ipm_price_b_wot::text AS wb,
             p.ipm_price_c_wot::text AS wc, p.ipm_price_d_wot::text AS wd,
             p.ipm_price_a_markup_perc::text AS ma, p.ipm_price_b_markup_perc::text AS mb,
             p.ipm_price_c_markup_perc::text AS mc, p.ipm_price_d_markup_perc::text AS md,
             p.ipm_min_price::text AS "min", p.ipm_max_price::text AS "max",
             p.ipm_profit_type AS "profitType", p.ipm_round_off::text AS "roundOff"
        FROM inventory.item_price_master p
       WHERE p.ipm_id = ANY(${ids}::uuid[])`;
    return new Map(
      rows.map((row) => [
        row.ipmId,
        {
          cost: row.cost,
          costWot: row.costWot,
          prices: [row.pa, row.pb, row.pc, row.pd],
          pricesWot: [row.wa, row.wb, row.wc, row.wd],
          markups: [row.ma, row.mb, row.mc, row.md],
          min: row.min,
          max: row.max,
          profitType: row.profitType,
          roundOff: row.roundOff,
        },
      ]),
    );
  }

  /** The latest logged change of a row (Cancel's "changed after the bill" note). */
  async lastChange(
    client: Client,
    ipmId: string,
  ): Promise<{ at: Date; who: string | null; source: string } | null> {
    const [row] = await client.$queryRaw<Array<{ at: Date; who: string | null; source: string }>>`
      SELECT ipcl_changed_on AS "at", ipcl_user_name AS "who", ipcl_source AS "source"
        FROM inventory.item_price_change_log
       WHERE ipcl_price_table = 'IPM' AND ipcl_row_id = ${ipmId}::uuid
       ORDER BY ipcl_changed_on DESC, ipcl_id DESC
       LIMIT 1`;
    return row ?? null;
  }

  /** The bill's last step of an event (POSTED, PRICES_REVIEWED): its time as IST text and its user. */
  async lastStep(client: Client, piId: string, accYear: string, event: string): Promise<StepMark | null> {
    const [row] = await client.$queryRaw<Array<{ on: string; by: string | null; at: Date }>>`
      SELECT to_char(t.tsl_changed_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' AS "on",
             COALESCE(u.usr_login_name, t.tsl_created_by) AS "by",
             t.tsl_changed_on AS "at"
        FROM public.txn_status_log t
        LEFT JOIN public.user_master u ON u.usr_id = t.tsl_changed_by
       WHERE t.tsl_src_doc_type = 'PURCHASE_BILL'
         AND t.tsl_src_doc_id = ${piId}::uuid
         AND t.tsl_acc_year = ${accYear}::bpchar
         AND t.tsl_event = ${event}
         AND t.tsl_is_deleted = false
       ORDER BY t.tsl_seq_no DESC
       LIMIT 1`;
    return row ? { on: row.on, by: row.by, ...(row.at ? { at: row.at } : {}) } : null;
  }
}
