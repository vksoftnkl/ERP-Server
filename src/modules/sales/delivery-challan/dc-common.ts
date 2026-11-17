import { Prisma } from '@prisma/client';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';
import { resolveDeviceCode } from '../../stocks/stock-voucher/stock-voucher-numbering.helper';
import { StockErrorCode } from '../../stocks/types/stock-error-codes';
import type { RegisterDetailLine, RegisterTaxability } from '../../../common/posting/doc-register.types';
import type { StatutoryService } from '../../../common/posting/statutory.service';
import { STATUTORY_CODES } from '../../../common/posting/statutory.types';
import type { SalesContextService } from '../posting/sales-context.service';
import type { SaleOrderLineRef } from '../sale-order/types/sale-order-api.types';
import { throwSalesRefused } from '../posting/sales.errors';
import { supplyNatureOf } from '../posting/sales-doc.utils';
import { refuse } from '../posting/sales.guards';
import { SALES_ERROR_CODES, type SalesGuardContext } from '../posting/types/posting.types';

/**
 * What the Delivery Challan (menu 182) and the Challan Return (menu 251) share
 * (plan Shared/Prathap/sales/plan-dc-dc-return-2026-11-16.md §5–§8): the
 * per-device number, the GST register's serial, the ageing, the line names,
 * the no-charges rule and the Decimal money check.
 */

type Client = Prisma.TransactionClient;
const D = (v: Prisma.Decimal.Value | null | undefined): Prisma.Decimal =>
  new Prisma.Decimal(v === null || v === undefined || v === '' ? 0 : v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── numbering (§5.1, user 11-16 "one series per PC") ─────────────────────────

/**
 * The document's number at its first save: the device's OWN series of the
 * voucher type (`DC2627D14-00001`), one per device per company and year for
 * every branch (a device-wide type, voucher-sequence.helper isDeviceWideSeries).
 * GST16 / the {DV} rule are the allocator's (SEQUENCE_REFNO_TOO_LONG,
 * SEQUENCE_FORMAT_TOKEN_UNKNOWN); a device that is not registered or is blocked
 * is refused by resolveDeviceCode (STOCK_DEVICE_NOT_FOUND / _BLOCKED).
 */
export async function allocateDcDocNumber(
  tx: Client,
  q: {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string | null | undefined;
    documentDate: Date;
    field: string;
  },
): Promise<{ lastNo: bigint; refno: string }> {
  const deviceId = (q.deviceId ?? '').trim();
  if (!UUID.test(deviceId)) {
    throwSalesRefused(
      `The device "${deviceId}" is not a registered PC: challans and returns are numbered per PC`,
      StockErrorCode.DEVICE_NOT_FOUND,
      q.field,
    );
  }
  const deviceCode = await resolveDeviceCode(tx, deviceId);
  const n = await allocateVoucherNumber(tx, {
    vchrTypeId: q.vchrTypeId,
    companyId: q.companyId,
    branchId: q.branchId,
    accYear: q.accYear,
    deviceCode,
    documentDate: q.documentDate,
  });
  return { lastNo: n.lastNo, refno: n.refno };
}

/**
 * `gdr_voucher_no` of a challan / return register row. It must be unique per
 * (company, branch, year, voucher type) (uq_acc_voucher_doc_register_voucher),
 * and per-device numbers are not: two PCs of one branch both draw 00001. So the
 * register keeps its own running serial for these two types, under an advisory
 * lock, deleted rows counted so a number is never reused. Nothing else reads it
 * (the printed number is the refno, gdr_doc_no).
 */
export async function nextRegisterVoucherNo(
  tx: Client,
  q: { companyId: string; branchId: string; accYear: string; voucherTypeId: number },
): Promise<bigint> {
  const key = [q.companyId, q.branchId, q.accYear, q.voucherTypeId].join('|');
  await tx.$queryRaw`
    SELECT count(pg_advisory_xact_lock(hashtext('accounts.acc_voucher_doc_register.dc_serial'), hashtext(${key})))::int AS locked`;
  const [row] = await tx.$queryRaw<{ n: bigint | null }[]>`
    SELECT COALESCE(MAX(gdr_voucher_no), 0) + 1 AS n
      FROM accounts.acc_voucher_doc_register
     WHERE gdr_company_id = ${q.companyId}::uuid AND gdr_branch_id = ${q.branchId}::uuid
       AND gdr_acc_year = ${q.accYear}::char(9) AND gdr_voucher_type_id = ${q.voucherTypeId}::int`;
  return BigInt(row?.n ?? 1);
}

// ── ageing (§5.6, decision 38) ──────────────────────────────────────────────

export type DcAgeLevel = '' | 'AMBER' | 'RED';

/** Where a statutory figure came from: the company's own row, or the shipped pack. */
export type StatutorySource = 'COMPANY' | 'SHIPPED';

/** DC_RETURN_WINDOW_DAYS as it applies to one challan (null when no row is in force). */
export interface DcReturnWindow {
  days: number;
  source: StatutorySource;
  effectiveFrom: string | null;
}

export interface DcAgeing {
  ageDays: number;
  ageLevel: DcAgeLevel;
  /** The return window the RED test used; null = no row, so no red (decision 38). */
  returnWindow: DcReturnWindow | null;
  /**
   * The challan is past that window: POSTED, not SUPPLY (approval / job work /
   * other: the window is theirs, §5.6) and more days old than the window. The
   * same test as ageLevel RED for those purposes, and as grids 116 / 220.
   */
  pastWindow: boolean;
}

const AMBER_DAYS_KEY = 'sales.delivery_amber_days';
const OLD_DAYS_KEY = 'sales.delivery_old_days';
const DEFAULT_AMBER_DAYS = 7;
const DEFAULT_OLD_DAYS = 30;

const intOr = (v: string | null | undefined, d: number): number => {
  const n = Number.parseInt((v ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

/** Whole days from `docDate` to `today` ('YYYY-MM-DD' both), never below 0. */
export function daysBetween(docDate: string, today: string): number {
  const a = Date.parse(`${docDate}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86_400_000)) : 0;
}

/**
 * §5.6: SUPPLY is AMBER past sales.delivery_amber_days (7) and RED past
 * sales.delivery_old_days (30); APPROVAL / JOB_WORK / any other purpose is RED
 * past DC_RETURN_WINDOW_DAYS (statutory_limits, company row first; no row = no
 * red). Never a block. A DRAFT or CANCELLED challan does not age.
 */
export function ageLevelOf(
  purpose: string | null | undefined,
  ageDays: number,
  limits: { amberDays: number; oldDays: number; windowDays: number | null },
  status: string,
): DcAgeLevel {
  if (status !== 'POSTED') {
    return '';
  }
  if ((purpose ?? 'SUPPLY').toUpperCase() === 'SUPPLY') {
    return ageDays > limits.oldDays ? 'RED' : ageDays > limits.amberDays ? 'AMBER' : '';
  }
  return isPastReturnWindow(purpose, ageDays, limits.windowDays, status) ? 'RED' : '';
}

/**
 * The one past-the-return-window test (decision 38, user 11-16): a POSTED
 * challan that is not SUPPLY (approval / job work / other: the window is theirs,
 * §5.6) and more days old than DC_RETURN_WINDOW_DAYS. No window (no row) = never
 * past it. The ageing (RED), the return's `challan.pastWindow` and the bill's
 * /bills/open-sources `pastWindow` all answer through this.
 */
export function isPastReturnWindow(
  purpose: string | null | undefined,
  ageDays: number,
  windowDays: number | null,
  status: string,
): boolean {
  return (
    status === 'POSTED' &&
    (purpose ?? 'SUPPLY').toUpperCase() !== 'SUPPLY' &&
    windowDays !== null &&
    ageDays > windowDays
  );
}

/**
 * DC_RETURN_WINDOW_DAYS for a challan dated `docDate`: read effective on the
 * CHALLAN's date, company row first, then the shipped one (statutory.limit), as
 * grids 116 / 220 read it. Null when no row is in force (no constant fallback).
 */
export async function dcReturnWindowOf(
  statutory: Pick<StatutoryService, 'limit'>,
  companyId: string,
  docDate: string,
): Promise<DcReturnWindow | null> {
  const window = await statutory.limit(companyId, STATUTORY_CODES.DC_RETURN_WINDOW_DAYS, docDate);
  const value = window?.value === null || window?.value === undefined ? null : Number(window.value);
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return {
    days: value,
    source: window?.isCompanyOverride ? 'COMPANY' : 'SHIPPED',
    effectiveFrom: window?.effectiveFrom ?? null,
  };
}

/**
 * The ageing of one challan. The return window is read effective on the
 * CHALLAN's date (company row first, then the shipped one; no row = no red,
 * no constant fallback), exactly as grids 116 / 220 read it (decision 38): the
 * law in force when the goods left is the one that runs out.
 */
export async function dcAgeing(
  salesContext: Pick<SalesContextService, 'values'>,
  statutory: Pick<StatutoryService, 'limit'>,
  q: {
    companyId: string;
    branchId: string;
    purpose: string | null | undefined;
    docDate: string;
    status: string;
    today: string;
    /**
     * P6 N2 (user 11-17): something is still out on the challan. False = nothing
     * is open (all billed / returned): no age level, as grid 116 / 220 show it.
     * Not given = not known here (the level as before).
     */
    open?: boolean;
  },
): Promise<DcAgeing> {
  const [settings, returnWindow] = await Promise.all([
    salesContext.values(q.companyId, q.branchId, null, [AMBER_DAYS_KEY, OLD_DAYS_KEY]),
    dcReturnWindowOf(statutory, q.companyId, q.docDate),
  ]);
  const ageDays = daysBetween(q.docDate, q.today);
  const windowDays = returnWindow?.days ?? null;
  return {
    ageDays,
    ageLevel:
      q.open === false
        ? ''
        : ageLevelOf(
            q.purpose,
            ageDays,
            {
              amberDays: intOr(settings[AMBER_DAYS_KEY], DEFAULT_AMBER_DAYS),
              oldDays: intOr(settings[OLD_DAYS_KEY], DEFAULT_OLD_DAYS),
              windowDays,
            },
            q.status,
          ),
    returnWindow,
    pastWindow: isPastReturnWindow(q.purpose, ageDays, windowDays, q.status),
  };
}

// ── e-way bill facts (P3b, user 11-16: the mockup's e-way line) ──────────────

/**
 * Why the e-way bill is or is not needed for a challan, as the guard and the
 * register judge it (statutory.ewayApplicable on the challan date): the screen
 * words "not needed · TN intra-state under 1,00,000" or "needed · add the
 * vehicle or the transporter" from it.
 */
export interface DcEwayFacts {
  /** The value is above the limit in force. False when no limit row is in force. */
  needed: boolean;
  /** The company state vs sdcPosStcd (a blank on either side = intra), as TAX_SPLIT and the register. */
  supplyNature: 'INTRA_STATE' | 'INTER_STATE';
  fromStateCode: string | null;
  fromStateName: string | null;
  /**
   * The state the goods go to: sdcPosStcd, or the company's own state when the
   * POS is blank (posFromCompany; user 11-16). Null only when both are blank.
   */
  toStateCode: string | null;
  toStateName: string | null;
  /** True when the POS was blank and toStateCode is the company's state (an intra-state move). */
  posFromCompany: boolean;
  /** The consignment value judged: sdcDcAmt, 2 places. */
  value: string;
  /** The date the limit was read on: the challan date. */
  onDate: string;
  /** EWAY_VALUE_LIMIT that applied; null when no row is in force (never a constant). */
  limit: {
    value: string | null;
    /** The winning row's stl_applies_to: a state code ('33'), INTRA_STATE or INTER_STATE. */
    appliesTo: string;
    source: StatutorySource;
    effectiveFrom: string | null;
  } | null;
  /** Needed, and neither a transporter / LR nor a road vehicle number (SALES_EWAY_TRANSPORT_MISSING). */
  transportMissing: boolean;
}

const trimmed = (v: string | null | undefined): string | null => (v ?? '').trim() || null;

/**
 * The state a challan's (or a challan return's) e-way floor is read for (user
 * 11-16): its place of supply, or, when that is blank, the company's own state:
 * a blank POS is an intra-state move to the company's state, so that state's
 * limit applies (Tamil Nadu 1,00,000, not the INTRA_STATE default of 50,000).
 * The guard, the register row's e-way flag and `eway` all read it here.
 */
export function dcEwayStateOf(
  companyStateCode: string | null | undefined,
  posStateCode: string | null | undefined,
): { stateCode: string | null; posFromCompany: boolean } {
  const pos = trimmed(posStateCode);
  if (pos !== null) {
    return { stateCode: pos, posFromCompany: false };
  }
  const company = trimmed(companyStateCode);
  return { stateCode: company, posFromCompany: company !== null };
}

/** The e-way verdict of a challan's value, nature and date (transportMissing is the caller's). */
export async function dcEwayVerdict(
  c: Client,
  statutory: Pick<StatutoryService, 'ewayApplicable'>,
  q: {
    companyId: string;
    companyStateCode: string | null | undefined;
    posStateCode: string | null | undefined;
    value: Prisma.Decimal.Value | null | undefined;
    docDate: string;
  },
): Promise<Omit<DcEwayFacts, 'transportMissing'>> {
  const nature = supplyNatureOf(q.companyStateCode, q.posStateCode);
  const value = D(q.value);
  const from = trimmed(q.companyStateCode);
  const dest = dcEwayStateOf(q.companyStateCode, q.posStateCode);
  const to = dest.stateCode;
  const codes = [...new Set([from, to].filter((v): v is string => v !== null))];
  const [eway, states] = await Promise.all([
    statutory.ewayApplicable(
      q.companyId,
      value.toNumber(),
      q.docDate,
      { interState: nature === 'INTER', stateCode: to },
      c,
    ),
    codes.length === 0
      ? []
      : c.$queryRaw<{ code: string; name: string | null }[]>`
          SELECT btrim(state_code) AS code, state_name AS name FROM fixed.state_codes
           WHERE btrim(state_code) = ANY(${codes}::text[])`,
  ]);
  const nameOf = new Map(states.map((r) => [r.code, r.name]));
  const limit = eway.limit;
  return {
    needed: eway.applicable,
    supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
    fromStateCode: from,
    fromStateName: from === null ? null : (nameOf.get(from) ?? null),
    toStateCode: to,
    toStateName: to === null ? null : (nameOf.get(to) ?? null),
    posFromCompany: dest.posFromCompany,
    value: value.toFixed(2),
    onDate: q.docDate,
    limit: limit
      ? {
          value: limit.value == null ? null : D(limit.value).toFixed(2),
          appliesTo: limit.appliesTo ?? (nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE'),
          source: limit.isCompanyOverride ? 'COMPANY' : 'SHIPPED',
          effectiveFrom: limit.effectiveFrom ?? null,
        }
      : null,
  };
}

/**
 * G12: Part-B is met by a transporter / LR on the band, or by a vehicle number
 * on the road (the challan's own van: sdcVehicleNo / sdcVehicleId).
 */
export function dcPartBMissing(
  band: Record<string, unknown> | null | undefined,
  row: Record<string, unknown>,
): boolean {
  const mode = ((band?.mode as string | null | undefined) ?? 'ROAD').toUpperCase();
  const hasVehicle =
    (mode === 'ROAD' || mode === '1') &&
    !!(((row.sdcVehicleNo as string | null) ?? '').trim() || row.sdcVehicleId);
  return !(band?.transporterId || band?.transporterName || band?.lrNo) && !hasVehicle;
}

// ── line names (G8) ─────────────────────────────────────────────────────────

export interface DcLineNames {
  itemName: string | null;
  itemCode: string | null;
  unitName: string | null;
  godownName: string | null;
  lotNo: string | null;
  /** kg of ONE unit of the line's unit (item_unit_conversion.iuc_uom_weight), 3 places. */
  unitKg: string;
}

/** The names a line shows, by its ids (one query each, like /sale-returns/get). */
export async function dcLineNames(
  c: Client,
  lines: readonly { itemId: unknown; itemUnitId: unknown; godownId: unknown; lotId: unknown }[],
): Promise<(l: { itemId: unknown; itemUnitId: unknown; godownId: unknown; lotId: unknown }) => DcLineNames> {
  const ids = (pick: (l: (typeof lines)[number]) => unknown): string[] => [
    ...new Set(lines.map(pick).filter((v): v is string => typeof v === 'string' && UUID.test(v))),
  ];
  const itemIds = ids((l) => l.itemId);
  const unitIds = ids((l) => l.itemUnitId);
  const godownIds = ids((l) => l.godownId);
  const lotIds = ids((l) => l.lotId);
  const [items, units, godowns, lots] = await Promise.all([
    itemIds.length === 0
      ? []
      : c.$queryRaw<{ id: string; name: string | null; code: string | null }[]>`
          SELECT item_id AS id, item_name_en AS name, item_code AS code FROM inventory.item_master
           WHERE item_id = ANY(${itemIds}::uuid[])`,
    unitIds.length === 0
      ? []
      : c.$queryRaw<{ id: string; name: string | null; kg: Prisma.Decimal | null }[]>`
          SELECT iuc.iuc_id AS id, um.unit_name AS name, iuc.iuc_uom_weight AS kg
            FROM inventory.item_unit_conversion iuc
            LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
           WHERE iuc.iuc_id = ANY(${unitIds}::uuid[])`,
    godownIds.length === 0
      ? []
      : c.$queryRaw<{ id: string; name: string | null }[]>`
          SELECT gdl_id AS id, gdl_name AS name FROM inventory.godown_locations
           WHERE gdl_id = ANY(${godownIds}::uuid[])`,
    lotIds.length === 0
      ? []
      : c.$queryRaw<{ id: string; name: string | null }[]>`
          SELECT slt_id AS id, slt_batch_no AS name FROM stock.stock_lot
           WHERE slt_id = ANY(${lotIds}::uuid[])`,
  ]);
  const item = new Map(items.map((r) => [r.id, r]));
  const unit = new Map(units.map((r) => [r.id, r]));
  const godown = new Map(godowns.map((r) => [r.id, r.name]));
  const lot = new Map(lots.map((r) => [r.id, r.name]));
  return (l) => ({
    itemName: item.get(l.itemId as string)?.name ?? null,
    itemCode: item.get(l.itemId as string)?.code ?? null,
    unitName: unit.get(l.itemUnitId as string)?.name ?? null,
    godownName: godown.get(l.godownId as string) ?? null,
    lotNo: lot.get(l.lotId as string) ?? null,
    unitKg: D(unit.get(l.itemUnitId as string)?.kg ?? 0).toFixed(3),
  });
}

// ── charges (N2, decision 30) ───────────────────────────────────────────────

/** 422 SALES_DC_CHARGES_NOT_ALLOWED for a body that carries any charge row. */
export function assertNoCharges(charges: unknown): void {
  if (Array.isArray(charges) && charges.length > 0) {
    throwSalesRefused(
      'A challan or a challan return carries no charges: put freight and other charges on the Sales Bill',
      SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED,
      'charges',
    );
  }
}

/** The header charge figures a challan never carries (§5.5), written 0 by the server. */
export const DC_ZERO_CHARGE_FIELDS = [
  'sdcOtherAmt',
  'sdcFreightAmt',
  'sdcLoadAmt',
  'sdcUnloadAmt',
] as const;

// ── free lines (user 2026-11-17) ────────────────────────────────────────────

/** An order line's free flag and type (sale_order_item.soi_is_free / soi_free_type). */
export interface OrderLineFree {
  isFree: boolean;
  freeType: string | null;
}

/** The order line a challan line names (sdiSrcItemId), or null when it names none. */
export function dcOrderLineOf(l: Record<string, unknown>): string | null {
  return l.sdiSrcDocType === 'SALES_ORDER' && typeof l.sdiSrcItemId === 'string' && l.sdiSrcItemId
    ? l.sdiSrcItemId
    : null;
}

/** The free flag and type of these order lines, by soi_id. */
export async function orderLineFreeOf(
  tx: Client,
  soiIds: readonly string[],
): Promise<Map<string, OrderLineFree>> {
  const ids = [...new Set(soiIds)];
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await tx.$queryRaw<
    { soi_id: string; soi_is_free: boolean | null; soi_free_type: string | null }[]
  >`
    SELECT soi_id, soi_is_free, soi_free_type FROM sales.sale_order_item
     WHERE soi_id = ANY(${ids}::uuid[]) AND soi_is_deleted = false`;
  return new Map(
    rows.map((r) => [r.soi_id, { isFree: r.soi_is_free === true, freeType: r.soi_free_type ?? null }]),
  );
}

/**
 * User 2026-11-17: a challan line's Free flag comes ONLY from its order line
 * (Ctrl+F4 brings it; there is no manual key, as on the Sales Bill where only
 * the scheme engine sets it). Refused as SALES_AMOUNT_MISMATCH rule FREE_LINE
 * (its own wording, catalogue 2026-11-17.1: the order may have changed since it
 * was picked; pick its lines again with Ctrl+F4), params `{n}`, field `items`,
 * one per line:
 *  - a free line that names no order line;
 *  - a line whose flag differs from its order line's (a free order line comes
 *    free, a paid one paid);
 *  - a free line that carries a price (rate or taxable not 0).
 * An order line that does not exist is left to SALES_DC_LINE_OVER_ORDER.
 */
export function checkDcFreeLines(
  g: SalesGuardContext,
  lines: readonly Record<string, unknown>[],
  orderFree: ReadonlyMap<string, OrderLineFree>,
): void {
  for (const [idx, l] of lines.entries()) {
    const n = (l.sdiLineNo as number | null | undefined) ?? idx + 1;
    const free = l.sdiIsFree === true;
    const soiId = dcOrderLineOf(l);
    const src = soiId ? orderFree.get(soiId) : undefined;
    let why: string | null = null;
    if (free && !soiId) {
      why = `Line ${n}: only an order's free line comes free onto a challan, and this line names no order line`;
    } else if (src && src.isFree !== free) {
      why = src.isFree
        ? `Line ${n}: its order line is free, so the challan line must be free too`
        : `Line ${n}: its order line is not free, so the challan line cannot be free`;
    } else if (
      free &&
      (!D(l.sdiRate as Prisma.Decimal.Value).isZero() || !D(l.sdiTaxableAmt as Prisma.Decimal.Value).isZero())
    ) {
      why = `Line ${n}: a free line carries no price (rate and taxable 0)`;
    }
    if (why) {
      refuse(g, SALES_ERROR_CODES.AMOUNT_MISMATCH, why, {
        field: 'items',
        line: n,
        rule: 'FREE_LINE',
        params: { n },
      });
    }
  }
}

// ── the order draw-down (user 2026-11-17) ───────────────────────────────────

/** How a challan names its order line, for the order recompute's wording. */
export const DC_ORDER_REF_FIELDS = {
  docId: 'sdiSrcItemId',
  accYear: 'sdiSrcDocAccYear',
  lineNo: 'sdiSrcLineNo',
} as const;

/**
 * The order-line references SaleOrderService.syncOrderFulfilment takes, for
 * these order lines (soi_id), each with its ORDER's own year read off the line
 * (not what a client sent). A deleted order line is left out: nothing is left
 * on it to re-derive.
 */
export async function orderLineRefsOf(
  tx: Client,
  soiIds: readonly (string | null | undefined)[],
): Promise<SaleOrderLineRef[]> {
  const ids = [...new Set(soiIds.filter((v): v is string => typeof v === 'string' && UUID.test(v)))];
  if (ids.length === 0) {
    return [];
  }
  const rows = await tx.$queryRaw<{ soi_id: string; soi_acc_year: string | null }[]>`
    SELECT soi_id, soi_acc_year FROM sales.sale_order_item
     WHERE soi_id = ANY(${ids}::uuid[]) AND soi_is_deleted = false`;
  return (rows ?? [])
    .filter((r) => typeof r?.soi_id === 'string' && typeof r.soi_acc_year === 'string')
    .map((r) => ({
      srcDocId: r.soi_id,
      srcAccYear: (r.soi_acc_year as string).trim(),
      soLineNo: null,
      fields: { ...DC_ORDER_REF_FIELDS },
    }));
}

/** The order and line number of these order lines (soi_id), grouped by order — what reservations key on. */
export async function orderLineKeysOf(
  tx: Client,
  soiIds: readonly (string | null | undefined)[],
): Promise<Map<string, number[]>> {
  const ids = [...new Set(soiIds.filter((v): v is string => typeof v === 'string' && UUID.test(v)))];
  const out = new Map<string, number[]>();
  if (ids.length === 0) {
    return out;
  }
  const rows = await tx.$queryRaw<{ soi_order_id: string; soi_line_no: number }[]>`
    SELECT soi_order_id, soi_line_no FROM sales.sale_order_item
     WHERE soi_id = ANY(${ids}::uuid[]) AND soi_is_deleted = false`;
  for (const r of rows ?? []) {
    if (typeof r?.soi_order_id !== 'string' || typeof r.soi_line_no !== 'number') {
      continue;
    }
    out.set(r.soi_order_id, [...(out.get(r.soi_order_id) ?? []), r.soi_line_no]);
  }
  return out;
}

/**
 * The bill's rule for a line's price level (user 2026-11-17): a line with
 * none (absent, null or 0) takes the challan's own level. Applied to every
 * line the body sends; a header with no level of its own leaves them alone.
 */
export function applyDcLineLevels(dto: {
  sdcPriceLevel?: number | null;
  items?: { sdiPriceLevel?: number | null }[];
}): void {
  const level = dto.sdcPriceLevel;
  if (typeof level !== 'number' || !Number.isInteger(level) || level <= 0) {
    return;
  }
  for (const i of dto.items ?? []) {
    if (i.sdiPriceLevel === undefined || i.sdiPriceLevel === null || i.sdiPriceLevel === 0) {
      i.sdiPriceLevel = level;
    }
  }
}

/** The order lines (sdi_src_item_id) these challan lines were taken from. */
export async function orderLinesOfDcLines(
  tx: Client,
  sdiIds: readonly (string | null | undefined)[],
): Promise<string[]> {
  const ids = [...new Set(sdiIds.filter((v): v is string => typeof v === 'string' && UUID.test(v)))];
  if (ids.length === 0) {
    return [];
  }
  const rows = await tx.$queryRaw<{ soi_id: string }[]>`
    SELECT DISTINCT sdi_src_item_id AS soi_id FROM sales.sale_dc_item
     WHERE sdi_id = ANY(${ids}::uuid[]) AND sdi_src_doc_type = 'SALES_ORDER'
       AND sdi_src_item_id IS NOT NULL`;
  return (rows ?? []).map((r) => r?.soi_id).filter((v): v is string => typeof v === 'string');
}

// ── the house lock order (decision 36; P6 S1, user 11-17) ────────────────────
//
// orders → challan header(s) → challan lines → stock, wherever a challan is
// touched: its own post / cancel / amend / convert, a bill of it (post, cancel,
// amend) and a DC return (post, cancel). Before, the bill and the return locked
// only the challan LINES and read the header unlocked, while the challan's
// cancel / amend / convert locked only the HEADER and read the lines' billed /
// returned caches unlocked: a cancel racing a bill both committed (the stock
// counted twice), and an order-made challan deadlocked (40P01).

/**
 * The sales orders these challan lines came from, read WITHOUT a lock (the
 * caller locks them FIRST, beside its own, in one lockSourceOrders call): each
 * line's order and order line, and its challan header's order.
 */
export async function dcSourceOrdersOfLines(
  tx: Client,
  sdiIds: readonly (string | null | undefined)[],
): Promise<{ orderIds: string[]; orderLineIds: string[] }> {
  const ids = [...new Set(sdiIds.filter((v): v is string => typeof v === 'string' && UUID.test(v)))];
  if (ids.length === 0) {
    return { orderIds: [], orderLineIds: [] };
  }
  const rows = await tx.$queryRaw<
    { line_so_id: string | null; soi_id: string | null; head_so_id: string | null }[]
  >`
    SELECT CASE WHEN d.sdi_src_doc_type = 'SALES_ORDER' THEN d.sdi_src_doc_id::text END AS line_so_id,
           CASE WHEN d.sdi_src_doc_type = 'SALES_ORDER' THEN d.sdi_src_item_id::text END AS soi_id,
           CASE WHEN c.sdc_src_doc_type = 'SALES_ORDER' THEN c.sdc_src_doc_id::text END AS head_so_id
      FROM sales.sale_dc_item d
      JOIN sales.sale_dc c ON c.sdc_id = d.sdi_dc_id AND c.sdc_acc_year = d.sdi_acc_year
     WHERE d.sdi_id = ANY(${ids}::uuid[])`;
  const orderIds = new Set<string>();
  const orderLineIds = new Set<string>();
  for (const r of rows ?? []) {
    for (const id of [r?.line_so_id, r?.head_so_id]) {
      if (typeof id === 'string' && UUID.test(id)) {
        orderIds.add(id);
      }
    }
    if (typeof r?.soi_id === 'string' && UUID.test(r.soi_id)) {
      orderLineIds.add(r.soi_id);
    }
  }
  return { orderIds: [...orderIds], orderLineIds: [...orderLineIds] };
}

/**
 * The challans of these lines — their headers in sdc_id order, then the lines
 * themselves in sdi_id order — FOR UPDATE: after the orders, before any stock.
 * The header lock is what serialises a bill or a return with the challan's own
 * cancel / amend / convert (which lock the header, then the lines).
 */
export async function lockChallansOfLines(
  tx: Client,
  sdiIds: readonly (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(sdiIds.filter((v): v is string => typeof v === 'string' && UUID.test(v)))].sort();
  if (ids.length === 0) {
    return;
  }
  await tx.$queryRaw`
    SELECT c.sdc_id FROM sales.sale_dc c
     WHERE (c.sdc_id, c.sdc_acc_year) IN (SELECT d.sdi_dc_id, d.sdi_acc_year FROM sales.sale_dc_item d
                                          WHERE d.sdi_id = ANY(${ids}::uuid[]))
     ORDER BY c.sdc_id
       FOR UPDATE OF c`;
  await tx.$queryRaw`
    SELECT sdi_id FROM sales.sale_dc_item
     WHERE sdi_id = ANY(${ids}::uuid[])
     ORDER BY sdi_id
       FOR UPDATE`;
}

/**
 * One challan's live lines FOR UPDATE in sdi_id order — after its header
 * (store.lock) and BEFORE its billed / returned caches are read: a bill or a
 * return of it holds these rows until it commits, and its caches with them.
 */
export async function lockDcLines(tx: Client, dcId: string, accYear: string): Promise<void> {
  await tx.$queryRaw`
    SELECT sdi_id FROM sales.sale_dc_item
     WHERE sdi_dc_id = ${dcId}::uuid AND sdi_acc_year = ${accYear.trim()}::char(9)
       AND sdi_is_deleted = false
     ORDER BY sdi_id
       FOR UPDATE`;
}

/**
 * A challan line's quantity in its ORDER line's terms, for the pending check:
 * as it stands in the order line's unit, else through base units (qty × its
 * factor ÷ the order line's), 3 places — as the order's draw-down counts it.
 */
export function dcQtyInOrderTerms(
  l: Record<string, unknown>,
  o: { soi_item_unit_id?: string | null; soi_to_base_factor?: Prisma.Decimal.Value | null },
): Prisma.Decimal {
  const qty = D(l.sdiDcQty as Prisma.Decimal.Value);
  if (!o.soi_item_unit_id || l.sdiItemUnitId === o.soi_item_unit_id) {
    return qty;
  }
  const f = (v: Prisma.Decimal.Value | null | undefined) => {
    const x = D(v);
    return x.isZero() ? D(1) : x;
  };
  return qty
    .times(f(l.sdiToBaseFactor as Prisma.Decimal.Value))
    .dividedBy(f(o.soi_to_base_factor))
    .toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * The free type a challan line stores: its order line's (SCHEME / SAMPLE /
 * REPLACEMENT) when both are free, else null (user 2026-11-17).
 */
export function dcFreeTypeOf(
  l: Record<string, unknown>,
  orderFree: ReadonlyMap<string, OrderLineFree>,
): string | null {
  const soiId = dcOrderLineOf(l);
  const src = soiId ? orderFree.get(soiId) : undefined;
  return l.sdiIsFree === true && src?.isFree ? src.freeType : null;
}

// ── the money (G13) ─────────────────────────────────────────────────────────

/**
 * The one tolerance, and only where a figure is RECOMPUTED (taxable × rate):
 * the Sales Bill's split (the tax rounded once, CGST the half rounded, SGST the
 * rest: 7.88 + 7.87 on 15.75) is exact; two halves each rounded (7.88 + 7.88)
 * sit at most one paisa off (|2·round(x/2) − round(x)| ≤ 0.01). P6 R1 (user
 * 11-17): it was two paise, which let 7.89 + 7.88 = 15.77 through on 15.75.
 */
const PAISA = new Prisma.Decimal('0.01');

const off = (a: Prisma.Decimal, b: Prisma.Decimal, tol: Prisma.Decimal) => a.minus(b).abs().greaterThan(tol);
/** P6 S2 (user 11-17): figures that are plain sums must be exact, not "within a paisa". */
const differs = (a: Prisma.Decimal, b: Prisma.Decimal) => !a.minus(b).isZero();

/**
 * SALES_AMOUNT_MISMATCH (plan §8.2): the figures a challan sends must add up,
 * judged in Decimal against the server's own sums:
 *  - a line's GST components = taxable × its rate, within one paisa (the one
 *    recompute: the tax rounded once and split is exact, each half rounded is
 *    at most a paisa off; P6 R1, it was two);
 *  - EXACT (P6 S2, user 11-17; it was "within a paisa", which stored a line of
 *    7.88 + 7.88 with tax 15.75): a line's tax = CGST + SGST + IGST + cess, its
 *    amount = taxable + tax; the header's taxable / tax = Σ lines, its amount =
 *    taxable + tax + round-off;
 *  - a line's taxable is never above qty × rate plus its before-tax charge.
 * Every refusal goes into `g` (validate lists them all).
 */
export function checkDcMoney(
  g: SalesGuardContext,
  header: Record<string, unknown>,
  lines: readonly Record<string, unknown>[],
  /**
   * The supply nature the register will file (supplyNatureOf(company state,
   * sdcPosStcd)). Given, each line must carry the matching GST pair: INTER =
   * IGST only, INTRA = CGST + SGST only (chk_acc_voucher_doc_detail_supply_tax_logic
   * refused a wrong pair as a raw 500, 2026-11-16).
   */
  nature?: 'INTRA' | 'INTER',
): void {
  let taxable = new Prisma.Decimal(0);
  let tax = new Prisma.Decimal(0);
  for (const [idx, l] of lines.entries()) {
    const lineNo = (l.sdiLineNo as number | null | undefined) ?? idx + 1;
    if (nature !== undefined) {
      const some = (...ks: string[]) => ks.some((k) => !D(l[k] as Prisma.Decimal.Value).isZero());
      const wrong =
        nature === 'INTER'
          ? some('sdiCgstPerc', 'sdiSgstPerc', 'sdiCgstAmt', 'sdiSgstAmt')
          : some('sdiIgstPerc', 'sdiIgstAmt');
      if (wrong) {
        refuse(
          g,
          SALES_ERROR_CODES.AMOUNT_MISMATCH,
          nature === 'INTER'
            ? `Line ${lineNo}: an inter-state challan carries IGST only, not CGST / SGST`
            : `Line ${lineNo}: an intra-state challan carries CGST + SGST, not IGST`,
          {
            field: 'items',
            line: lineNo,
            rule: 'TAX_SPLIT',
            params: { n: lineNo, nature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE' },
          },
        );
      }
    }
    const lineTaxable = D(l.sdiTaxableAmt as Prisma.Decimal.Value);
    const parts = D(l.sdiCgstAmt as Prisma.Decimal.Value)
      .plus(D(l.sdiSgstAmt as Prisma.Decimal.Value))
      .plus(D(l.sdiIgstAmt as Prisma.Decimal.Value));
    const lineTax = parts.plus(D(l.sdiCessAmt as Prisma.Decimal.Value));
    const expectedParts = lineTaxable
      .times(D(l.sdiTaxPerc as Prisma.Decimal.Value))
      .dividedBy(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const ceiling = D(l.sdiDcQty as Prisma.Decimal.Value)
      .times(D(l.sdiRate as Prisma.Decimal.Value))
      .plus(D(l.sdiChrgBeforeTax as Prisma.Decimal.Value));
    const problems: string[] = [];
    if (off(parts, expectedParts, PAISA)) {
      problems.push(`GST ${parts.toFixed(2)} is not ${expectedParts.toFixed(2)} (taxable × rate)`);
    }
    if (l.sdiTaxAmt !== null && l.sdiTaxAmt !== undefined && differs(D(l.sdiTaxAmt as Prisma.Decimal.Value), lineTax)) {
      problems.push(`tax ${D(l.sdiTaxAmt as Prisma.Decimal.Value).toFixed(2)} is not the components' ${lineTax.toFixed(2)}`);
    }
    if (differs(D(l.sdiNetAmt as Prisma.Decimal.Value), lineTaxable.plus(lineTax))) {
      problems.push(`amount ${D(l.sdiNetAmt as Prisma.Decimal.Value).toFixed(2)} is not taxable + tax ${lineTaxable.plus(lineTax).toFixed(2)}`);
    }
    if (lineTaxable.minus(ceiling).greaterThan(PAISA)) {
      problems.push(`taxable ${lineTaxable.toFixed(2)} is above qty × rate ${ceiling.toFixed(2)}`);
    }
    if (problems.length > 0) {
      refuse(g, SALES_ERROR_CODES.AMOUNT_MISMATCH, `Line ${lineNo}: ${problems.join('; ')}`, {
        field: 'items',
        line: lineNo,
      });
    }
    taxable = taxable.plus(lineTaxable);
    tax = tax.plus(lineTax);
  }
  const hTaxable = D(header.sdcTaxableAmt as Prisma.Decimal.Value);
  const hTax = D(header.sdcTaxAmt as Prisma.Decimal.Value);
  const hAmt = D(header.sdcDcAmt as Prisma.Decimal.Value);
  const expectedAmt = hTaxable.plus(hTax).plus(D(header.sdcRoundOff as Prisma.Decimal.Value));
  for (const [field, got, want] of [
    ['sdcTaxableAmt', hTaxable, taxable],
    ['sdcTaxAmt', hTax, tax],
    ['sdcDcAmt', hAmt, expectedAmt],
  ] as const) {
    if (differs(got, want)) {
      refuse(
        g,
        SALES_ERROR_CODES.AMOUNT_MISMATCH,
        `${field} is ${got.toFixed(2)}; the lines make ${want.toFixed(2)}`,
        { field },
      );
    }
  }
}

/** §8.2 `/validate` totals: lines, packages (qty + free), kg, taxable, tax, value. */
export function dcTotals(
  header: Record<string, unknown>,
  lines: readonly Record<string, unknown>[],
  unitKgOf: (l: Record<string, unknown>) => Prisma.Decimal,
): { lines: number; pkgs: string; weightKg: string; taxable: string; tax: string; value: string } {
  let pkgs = new Prisma.Decimal(0);
  let kg = new Prisma.Decimal(0);
  let taxable = new Prisma.Decimal(0);
  let tax = new Prisma.Decimal(0);
  for (const l of lines) {
    const qty = D(l.sdiDcQty as Prisma.Decimal.Value).plus(D(l.sdiFreeQty as Prisma.Decimal.Value));
    pkgs = pkgs.plus(qty);
    const weight = D(l.sdiWeightQty as Prisma.Decimal.Value);
    kg = kg.plus(weight.greaterThan(0) ? weight : qty.times(unitKgOf(l)));
    taxable = taxable.plus(D(l.sdiTaxableAmt as Prisma.Decimal.Value));
    tax = tax
      .plus(D(l.sdiCgstAmt as Prisma.Decimal.Value))
      .plus(D(l.sdiSgstAmt as Prisma.Decimal.Value))
      .plus(D(l.sdiIgstAmt as Prisma.Decimal.Value))
      .plus(D(l.sdiCessAmt as Prisma.Decimal.Value));
  }
  return {
    lines: lines.length,
    pkgs: pkgs.toFixed(3),
    weightKg: kg.toFixed(3),
    taxable: taxable.toFixed(2),
    tax: tax.toFixed(2),
    value: taxable.plus(tax).plus(D(header.sdcRoundOff as Prisma.Decimal.Value)).toFixed(2),
  };
}

// ── GST register taxability (P3 fix 2026-11-17) ──────────────────────────────

/** The rate and tax figures of one register detail line. */
export type RegisterLineTaxFigures = Pick<
  RegisterDetailLine,
  | 'totalTaxRate'
  | 'cgstRate'
  | 'sgstRate'
  | 'igstRate'
  | 'cessRate'
  | 'cgstAmount'
  | 'sgstAmount'
  | 'igstAmount'
  | 'cessAmount'
>;

/**
 * A register line is TAXABLE when it carries any GST rate or any tax, EXEMPT
 * otherwise: the Sales Bill's rule (`tax > 0 || taxPerc > 0`), widened to every
 * figure `chk_acc_voucher_doc_detail_non_taxable_zero` reads (a non-TAXABLE row
 * must hold 0 in every rate and amount). A FREE line (rate 0, so tax 0) keeps its
 * item's 18 % and stays TAXABLE; a 0 % / nil-rated item is EXEMPT.
 */
export function registerLineTaxability(l: RegisterLineTaxFigures): 'TAXABLE' | 'EXEMPT' {
  const figures = [
    l.totalTaxRate,
    l.cgstRate,
    l.sgstRate,
    l.igstRate,
    l.cessRate,
    l.cgstAmount,
    l.sgstAmount,
    l.igstAmount,
    l.cessAmount,
  ];
  return figures.some((v) => v !== 0) ? 'TAXABLE' : 'EXEMPT';
}

/** The document's taxability from its lines, as the Sales Bill files it: all TAXABLE, none (EXEMPT) or MIXED. */
export function registerDocTaxability(
  lines: readonly Pick<RegisterDetailLine, 'taxability'>[],
): RegisterTaxability {
  const taxed = lines.filter((l) => l.taxability === 'TAXABLE').length;
  return taxed === 0 ? 'EXEMPT' : taxed === lines.length ? 'TAXABLE' : 'MIXED';
}

export { D as dec, UUID as UUID_PATTERN };
