import { Prisma } from '@prisma/client';
import { throwSalesForbidden } from 'src/common/utils/module-service.utils';
import {
  rankedQtySlabs,
  resolveSaleLinePrice,
  type QtyPriceSettingReader,
  type SaleLinePriceClient,
} from '../../Inventory/items-price-master/sale-line-price';
import { pickSlab, slabLineRate } from '../../Inventory/items-qty-price-master/qty-slab.rules';
import type { SalesCodedErrorDetail } from '../posting/sales.errors';
import { SALES_ERROR_CODES, type SalesRefusal } from '../posting/types/posting.types';

/**
 * Review step 6 (U6, D7 to D12) — the user's rate / discount lock on the SALE BILL.
 *
 *   - usr_edit_rate ("Allow rate / discount change") off: a line's rate must be the one the
 *     item gives (the server works it out itself, D12: the shared sale-line price resolver,
 *     the same answer /master-lookups/item-price gives the screen), no discount may be typed,
 *     and the price level may not be changed (user 20/11): the bill's and each line's level
 *     must be one the bill gives by default — the customer's own level (cus_price_level_id)
 *     or the sales.default_price_level setting (the two the Sale Bill screen starts from), or
 *     the order / challan line's level for a line billed from one —
 *     SALES_RATE_CHANGE_NOT_ALLOWED {line} / SALES_DISC_NOT_ALLOWED /
 *     SALES_PRICE_LEVEL_NOT_ALLOWED {line} (field items) or (field sbPriceLevel, the bill's).
 *   - on: any rate, and discounts up to usr_max_disc_perc (NULL = no limit, D6): a line's
 *     typed discount over max % of the line's value before it → SALES_LINE_DISC_OVER_USER_MAX
 *     {line, max}; the typed bill discount over max % of the bill's value before it →
 *     SALES_BILL_DISC_OVER_USER_MAX {max} (D8, D9 refuse).
 *
 * Only what the user TYPES counts (D7):
 *   - a line's typed discount = its item + special discount, counted only when it is MORE
 *     than the line would carry untouched — the price row's default disc % / per-qty, or the
 *     order / challan line it was billed from. Scheme and bill-scheme discounts (promotions)
 *     never count; a discount lowered or removed is not "given";
 *   - the typed bill discount = the DEDUCT charge rows, plus the header's sb_addl_disc1 /
 *     sb_addl_disc2 / sb_cash_disc (the Qt bill sends 0); sb_bill_sch_disc is a promotion's
 *     and never counts. Two kinds of DEDUCT row are not typed while they hold no more than
 *     their untouched value (api-tester 11-20: the value counts, not the rate):
 *       - a row the charge master auto-applies (chg_auto_apply): no more than the master's
 *         default gives — 0 when the default is 0 (any method), the default itself (FIXED),
 *         default % of the bill value it applies on (PERCENT); for another method with a
 *         non-zero default, the default rate itself;
 *       - a row carried from an order / challan (cd_src_cd_id): no more than the source row's
 *         amount (a part carry is not "giving"; over-carry is the carry guard's).
 *     Over that, the whole row counts as typed;
 *   - whatever this save did not change does not count: a line (or charge row) that is the
 *     same as before the save — an amend re-sending a posted bill's lines, an edit of a draft
 *     someone else saved — is not this user's typing.
 *
 * Never judged (rate): a free line, a promotion / scheme line (sbi_is_promo, sbi_scheme_id,
 * sbi_promo_usage_id — promotions are priced by the client), a weigh-scale item (a price
 * barcode sets the rate), and a line the item gives no rate for (no price row, or a 0 price:
 * the cashier types it). A line billed from an order / challan may carry that line's rate.
 *
 * Tolerances (Prisma.Decimal throughout): a rate is "the same" within 0.01 (a paisa); a
 * discount amount within 0.01 plus 0.01 % of the line's value (the pre-tax rate the client
 * sends is rounded to 4 places, which moves a long line's amounts by a few paise).
 */

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);
/** A rate within a paisa of the one the item gives is that rate. */
export const RATE_TOLERANCE = new Prisma.Decimal('0.01');
const PAISA = new Prisma.Decimal('0.01');
const RELATIVE_TOLERANCE = new Prisma.Decimal('0.0001');

type Dec = Prisma.Decimal;
type Num = Prisma.Decimal | string | number | null | undefined;

const dec = (v: Num): Dec => {
  if (v === null || v === undefined || v === '') {
    return ZERO;
  }
  try {
    const d = new Prisma.Decimal(v);
    return d.isFinite() ? d : ZERO;
  } catch {
    return ZERO;
  }
};
const decOrNull = (v: Num): Dec | null =>
  v === null || v === undefined || v === '' ? null : dec(v);

/** The acting user's two flags. */
export interface RateLockUser {
  usrId: string;
  editRate: boolean;
  /** NULL = no limit. */
  maxDiscPerc: Dec | null;
}

/** One bill line as the lock reads it (a stored row or a DTO line). */
export interface LockLine {
  /** For the refusal's {line}: sbi_line_no, else the 1-based position. */
  lineNo: number;
  id: string | null;
  itemId: string;
  unitId: string;
  priceLevel: number;
  lotId: string | null;
  mrp: number | null;
  isTaxIncl: boolean;
  taxPerc: Dec;
  billQty: Dec;
  netQty: Dec;
  rate: Dec;
  ratePreTax: Dec;
  isFree: boolean;
  isPromo: boolean;
  srcDocType: string | null;
  srcItemId: string | null;
  itemDiscPerc: Dec;
  itemDiscQty: Dec;
  itemDiscAmt: Dec;
  splDiscPerc: Dec;
  splDiscQty: Dec;
  splDiscAmt: Dec;
  schDiscAmt: Dec;
  billSchAmt: Dec;
  netGross: Dec | null;
  netAmt: Dec;
}

/** One charge row as the lock reads it. */
export interface LockCharge {
  chgId: string | null;
  type: string;
  /** cd_method (FIXED, PERCENT, QTY …); null = not sent (the master's then). */
  method: string | null;
  rate: Dec | null;
  amount: Dec;
  beforeTax: boolean;
  srcCdId: string | null;
}

export interface LockHeader {
  companyId: string;
  branchId: string;
  /** The bill's device (sb_device_id): the default price level is resolved down to it. */
  deviceId: string | null;
  custId: string | null;
  /** sb_price_level. */
  priceLevel: number;
  /** `YYYY-MM-DD`. */
  billDate: string;
  discAlterBase: boolean;
  /** sb_addl_disc1 + sb_addl_disc2 + sb_cash_disc. */
  headerDisc: Dec;
}

export interface LockInput {
  header: LockHeader;
  lines: LockLine[];
  charges: LockCharge[];
  /** What the bill held before this save; empty on a create. */
  priorLines: LockLine[];
  priorCharges: LockCharge[];
  priorHeaderDisc: Dec;
  /** The bill's price level before this save; null on a create. */
  priorHeaderLevel: number | null;
}

/** What one line's untouched state is: the rates it may carry and the discount it carries. */
export interface LineNormal {
  /** Empty = the item gives no rate for it (the cashier types one): any rate stands. */
  rates: Dec[];
  /** A weigh-scale item: a price barcode sets the rate. */
  skipRate: boolean;
  /** Each untouched discount the line could carry (price row default, its source line). */
  baselines: Array<{ itemPerc: Dec; itemQty: Dec; splPerc: Dec; splQty: Dec }>;
  /** The price level of the order / challan line it was billed from (null: none, or not stored). */
  sourceLevel: number | null;
}

/** A charge master's auto-apply rule. */
export interface ChargeMasterRule {
  autoApply: boolean;
  defaultRate: Dec | null;
  /** chg_method. */
  method?: string | null;
}

export interface LockRefusal {
  code: string;
  message: string;
  field: string;
  line?: number;
  /** The user's limit as text ("12.5"), for {max}. */
  max?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
//  The judgement — pure
// ═══════════════════════════════════════════════════════════════════════════

/** The line's value the discounts are taken off (D8: "the value before it"). */
export function lineDiscountBase(line: LockLine, discAlterBase: boolean): Dec {
  const preTax = line.netQty.times(line.ratePreTax);
  const asTyped = line.netQty.times(line.rate);
  const base = discAlterBase || preTax.lte(0) ? asTyped : preTax;
  return base.gt(0) ? base : ZERO;
}

/** Item + special discount the line would carry with these inputs (the client's order of steps). */
function baselineAmount(
  base: Dec,
  netQty: Dec,
  b: { itemPerc: Dec; itemQty: Dec; splPerc: Dec; splQty: Dec },
): Dec {
  const item = b.itemPerc.gt(0)
    ? base.times(b.itemPerc).div(HUNDRED)
    : b.itemQty.gt(0)
      ? netQty.times(b.itemQty)
      : ZERO;
  const spl = b.splPerc.gt(0)
    ? base.minus(item).times(b.splPerc).div(HUNDRED)
    : b.splQty.gt(0)
      ? netQty.times(b.splQty)
      : ZERO;
  return item.plus(spl);
}

function amountTolerance(base: Dec): Dec {
  return PAISA.plus(base.times(RELATIVE_TOLERANCE));
}

const lineDisc = (l: LockLine): Dec => l.itemDiscAmt.plus(l.splDiscAmt);

/** The line this save started from: same id, else the same line number, item and unit. */
export function priorOf(line: LockLine, prior: readonly LockLine[]): LockLine | null {
  const byId = line.id ? prior.find((p) => p.id === line.id) : undefined;
  const found = byId ?? prior.find((p) => p.lineNo === line.lineNo && p.itemId === line.itemId);
  return found && found.itemId === line.itemId && found.unitId === line.unitId ? found : null;
}

/** The line's price level is one this user may not set (no right, not a default, not kept). */
function levelChanged(
  user: RateLockUser,
  line: LockLine,
  prior: LockLine | null,
  allowedLevels: ReadonlySet<number>,
): boolean {
  return (
    !user.editRate &&
    !line.isPromo &&
    allowedLevels.size > 0 &&
    !allowedLevels.has(line.priceLevel) &&
    !(prior && prior.priceLevel === line.priceLevel)
  );
}

/** The lines whose untouched state must be read before judging (the rest need nothing). */
export function linesNeedingNormal(
  user: RateLockUser,
  input: LockInput,
  allowedLevels: ReadonlySet<number> = new Set(),
): number[] {
  const out: number[] = [];
  input.lines.forEach((line, idx) => {
    if (line.isFree) {
      return;
    }
    const prior = priorOf(line, input.priorLines);
    const rateChanged =
      !user.editRate &&
      !line.isPromo &&
      !(prior && line.rate.minus(prior.rate).abs().lte(RATE_TOLERANCE));
    const base = lineDiscountBase(line, input.header.discAlterBase);
    const disc = lineDisc(line);
    const discChanged =
      disc.gt(amountTolerance(base)) &&
      !(prior && disc.minus(lineDisc(prior)).abs().lte(amountTolerance(base))) &&
      (!user.editRate || user.maxDiscPerc !== null);
    if (rateChanged || discChanged || levelChanged(user, line, prior, allowedLevels)) {
      out.push(idx);
    }
  });
  return out;
}

/**
 * Every refusal the lock raises for this save, in line order, the bill-level one last.
 * `normals` holds a LineNormal for each index linesNeedingNormal named (null = none known).
 */
export function judgeRateDiscount(
  user: RateLockUser,
  input: LockInput,
  normals: ReadonlyMap<number, LineNormal | null>,
  chargeRules: ReadonlyMap<string, ChargeMasterRule>,
  allowedLevels: ReadonlySet<number> = new Set(),
  /** cd_id of a carried row's source → that source row's amount. */
  sourceCharges: ReadonlyMap<string, Dec> = new Map(),
): LockRefusal[] {
  const refusals: LockRefusal[] = [];
  const max = user.maxDiscPerc;
  const maxText = max === null ? undefined : max.toDecimalPlaces(2).toString();
  const { header } = input;

  // The bill's own price level (no right only): a default one, or the one it already had.
  const headerLevelRefused =
    !user.editRate &&
    allowedLevels.size > 0 &&
    !allowedLevels.has(header.priceLevel) &&
    input.priorHeaderLevel !== header.priceLevel;
  if (headerLevelRefused) {
    refusals.push({
      code: SALES_ERROR_CODES.PRICE_LEVEL_NOT_ALLOWED,
      message: `You may not change the bill's price level (${header.priceLevel})`,
      field: 'sbPriceLevel',
    });
  }

  input.lines.forEach((line, idx) => {
    if (line.isFree) {
      return;
    }
    const prior = priorOf(line, input.priorLines);
    const normal = normals.get(idx) ?? null;

    // Price level (user 20/11): a default level, the order / challan line's, or the one the
    // line already had. A line that only follows a refused bill level is not repeated.
    if (
      levelChanged(user, line, prior, allowedLevels) &&
      normal?.sourceLevel !== line.priceLevel &&
      !(headerLevelRefused && line.priceLevel === header.priceLevel)
    ) {
      refusals.push({
        code: SALES_ERROR_CODES.PRICE_LEVEL_NOT_ALLOWED,
        message: `Line ${line.lineNo}: you may not change the price level (${line.priceLevel})`,
        field: 'items',
        line: line.lineNo,
      });
    }

    // Rate (D12): only for a user without the right.
    if (
      !user.editRate &&
      !line.isPromo &&
      !(prior && line.rate.minus(prior.rate).abs().lte(RATE_TOLERANCE)) &&
      normal &&
      !normal.skipRate &&
      normal.rates.length > 0 &&
      !normal.rates.some((r) => line.rate.minus(r).abs().lte(RATE_TOLERANCE))
    ) {
      refusals.push({
        code: SALES_ERROR_CODES.RATE_CHANGE_NOT_ALLOWED,
        message: `Line ${line.lineNo}: you may not change the rate (${line.rate.toString()})`,
        field: 'items',
        line: line.lineNo,
      });
    }

    // Discount (D7, D8).
    const base = lineDiscountBase(line, header.discAlterBase);
    const tol = amountTolerance(base);
    const disc = lineDisc(line);
    if (disc.lte(tol)) {
      return;
    }
    if (prior && disc.minus(lineDisc(prior)).abs().lte(tol)) {
      return;
    }
    const untouched = (normal?.baselines ?? []).reduce(
      (most, b) => Prisma.Decimal.max(most, baselineAmount(base, line.netQty, b)),
      ZERO,
    );
    if (disc.lte(untouched.plus(tol))) {
      return;
    }
    if (!user.editRate) {
      refusals.push({
        code: SALES_ERROR_CODES.DISC_NOT_ALLOWED,
        message: `Line ${line.lineNo}: you may not give a discount`,
        field: 'items',
        line: line.lineNo,
      });
      return;
    }
    if (max !== null && disc.gt(base.times(max).div(HUNDRED).plus(tol))) {
      refusals.push({
        code: SALES_ERROR_CODES.LINE_DISC_OVER_USER_MAX,
        message: `Line ${line.lineNo}: the discount is more than your limit of ${maxText}%`,
        field: 'items',
        line: line.lineNo,
        max: maxText,
      });
    }
  });

  // The bill-level discount (D8: of the bill's value before it).
  const valueBeforeTax = input.lines.reduce(
    (sum, l) => sum.plus(lineValueBeforeTax(l, header.discAlterBase)),
    ZERO,
  );
  const valueWithTax = input.lines.reduce(
    (sum, l) => sum.plus(l.netAmt.gt(0) ? l.netAmt : ZERO),
    ZERO,
  );
  const typedRows = typedBillDiscounts(input, chargeRules, sourceCharges, {
    beforeTax: valueBeforeTax,
    withTax: valueWithTax,
  });
  const headerTyped = header.headerDisc.minus(input.priorHeaderDisc).abs().lte(PAISA)
    ? ZERO
    : header.headerDisc;
  const total = typedRows.reduce((sum, row) => sum.plus(row.amount), headerTyped);
  if (total.gt(PAISA)) {
    if (!user.editRate) {
      refusals.push({
        code: SALES_ERROR_CODES.DISC_NOT_ALLOWED,
        message: 'You may not give a bill discount',
        field: 'charges',
      });
    } else if (max !== null) {
      const rows = [
        ...typedRows.map((r) => ({
          amount: r.amount,
          base: r.beforeTax ? valueBeforeTax : valueWithTax,
        })),
        ...(headerTyped.gt(0) ? [{ amount: headerTyped, base: valueBeforeTax }] : []),
      ];
      const share = rows.reduce(
        (sum, r) =>
          r.base.lte(0)
            ? sum.plus(r.amount.gt(PAISA) ? HUNDRED : ZERO)
            : sum.plus(Prisma.Decimal.max(ZERO, r.amount.minus(PAISA)).div(r.base)),
        ZERO,
      );
      if (share.times(HUNDRED).gt(max)) {
        refusals.push({
          code: SALES_ERROR_CODES.BILL_DISC_OVER_USER_MAX,
          message: `The bill discount is more than your limit of ${maxText}%`,
          field: 'charges',
          max: maxText,
        });
      }
    }
  }
  return refusals;
}

/** A line's value after its own discounts, before tax and before any bill-level charge. */
function lineValueBeforeTax(line: LockLine, discAlterBase: boolean): Dec {
  if (line.netGross !== null && line.netGross.gt(0)) {
    return line.netGross;
  }
  const v = lineDiscountBase(line, discAlterBase)
    .minus(lineDisc(line))
    .minus(line.schDiscAmt)
    .minus(line.billSchAmt);
  return v.gt(0) ? v : ZERO;
}

/**
 * The most a row may hold and still be untouched: the master's default value for an
 * auto-applied row, the source row's amount for a carried one; null = the row is not one of
 * those (it is typed), undefined = an auto-applied row whose default value is not knowable here
 * (a measured method with a non-zero default: judged on its rate instead).
 */
function untouchedValue(
  row: LockCharge,
  rule: ChargeMasterRule | undefined,
  sourceCharges: ReadonlyMap<string, Dec>,
  bases: { beforeTax: Dec; withTax: Dec },
): Dec | null | undefined {
  if (row.srcCdId) {
    // A dangling source (the FK refuses one on save) is not trusted: typed.
    return sourceCharges.get(row.srcCdId)?.abs() ?? null;
  }
  if (!rule?.autoApply) {
    return null;
  }
  const defaultRate = rule.defaultRate ?? ZERO;
  if (defaultRate.lte(0)) {
    return ZERO;
  }
  const method = (row.method ?? rule.method ?? '').toUpperCase();
  if (method === 'FIXED') {
    return defaultRate;
  }
  if (method === 'PERCENT') {
    return (row.beforeTax ? bases.beforeTax : bases.withTax).times(defaultRate).div(HUNDRED);
  }
  return undefined;
}

/** The DEDUCT rows this save typed (see the file header: not untouched, not unchanged). */
function typedBillDiscounts(
  input: LockInput,
  chargeRules: ReadonlyMap<string, ChargeMasterRule>,
  sourceCharges: ReadonlyMap<string, Dec>,
  bases: { beforeTax: Dec; withTax: Dec },
): LockCharge[] {
  const priorLeft = input.priorCharges.filter((c) => isDeduct(c));
  const typed: LockCharge[] = [];
  for (const row of input.charges) {
    const amount = row.amount.abs();
    if (!isDeduct(row) || amount.lte(PAISA)) {
      continue;
    }
    const same = priorLeft.findIndex(
      (p) => p.chgId === row.chgId && p.amount.abs().minus(amount).abs().lte(PAISA),
    );
    if (same >= 0) {
      priorLeft.splice(same, 1);
      continue;
    }
    const rule = row.chgId ? chargeRules.get(row.chgId) : undefined;
    const untouched = untouchedValue(row, rule, sourceCharges, bases);
    if (untouched === undefined) {
      // An auto-applied measured charge (QTY, KG …) with a non-zero default: its amount is
      // the client's measure × rate, so the rate tells whether it was typed.
      const atDefault =
        rule?.defaultRate !== null &&
        rule?.defaultRate !== undefined &&
        row.rate !== null &&
        row.rate.minus(rule.defaultRate).abs().lte(new Prisma.Decimal('0.0001'));
      if (atDefault) {
        continue;
      }
    } else if (untouched !== null && amount.lte(untouched.plus(amountTolerance(untouched)))) {
      continue;
    }
    typed.push({ ...row, amount });
  }
  return typed;
}

const isDeduct = (c: LockCharge): boolean => (c.type ?? '').toUpperCase() === 'DEDUCT';

// ═══════════════════════════════════════════════════════════════════════════
//  Reading the facts
// ═══════════════════════════════════════════════════════════════════════════

export type LockClient = SaleLinePriceClient &
  Pick<
    Prisma.TransactionClient,
    'userMaster' | 'chargeMaster' | 'customer' | 'transactionChargeDetail'
  >;

/** The acting user's flags; null when the id names no user (no lock to apply). */
export async function readRateLockUser(
  client: Pick<Prisma.TransactionClient, 'userMaster'>,
  usrId: string | null | undefined,
): Promise<RateLockUser | null> {
  if (!usrId) {
    return null;
  }
  const row = await client.userMaster.findUnique({
    where: { usrId },
    select: { usrId: true, usrEditRate: true, usrMaxDiscPerc: true },
  });
  return row
    ? { usrId: row.usrId, editRate: row.usrEditRate, maxDiscPerc: row.usrMaxDiscPerc }
    : null;
}

/** The order / challan line a bill line was billed from: its rate and discount inputs. */
interface SourceFacts {
  rate: Dec;
  priceLevel: number | null;
  itemPerc: Dec;
  itemQty: Dec;
  splPerc: Dec;
  splQty: Dec;
}

async function sourceFactsOf(
  client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  lines: readonly LockLine[],
): Promise<Map<string, SourceFacts>> {
  const orderIds = [
    ...new Set(
      lines.filter((l) => l.srcDocType === 'SALES_ORDER' && l.srcItemId).map((l) => l.srcItemId!),
    ),
  ];
  const dcIds = [
    ...new Set(
      lines
        .filter((l) => l.srcDocType === 'DELIVERY_CHALLAN' && l.srcItemId)
        .map((l) => l.srcItemId!),
    ),
  ];
  type Row = {
    id: string;
    rate: Prisma.Decimal | null;
    price_level: number | null;
    item_perc: Prisma.Decimal | null;
    item_qty: Prisma.Decimal | null;
    spl_perc: Prisma.Decimal | null;
    spl_qty: Prisma.Decimal | null;
  };
  const rows: Row[] = [];
  if (orderIds.length) {
    rows.push(
      ...(await client.$queryRaw<Row[]>`
        SELECT soi_id::text AS id, soi_rate AS rate, soi_price_level AS price_level,
               soi_item_disc_perc AS item_perc, soi_item_disc_qty AS item_qty,
               soi_spl_disc_perc AS spl_perc, soi_spl_disc_qty AS spl_qty
          FROM sales.sale_order_item
         WHERE soi_id = ANY(${orderIds}::uuid[])`),
    );
  }
  if (dcIds.length) {
    rows.push(
      ...(await client.$queryRaw<Row[]>`
        SELECT sdi_id::text AS id, sdi_rate AS rate, sdi_price_level AS price_level,
               sdi_item_disc_perc AS item_perc, NULL::numeric AS item_qty,
               sdi_spl_disc_perc AS spl_perc, NULL::numeric AS spl_qty
          FROM sales.sale_dc_item
         WHERE sdi_id = ANY(${dcIds}::uuid[])`),
    );
  }
  return new Map(
    (rows ?? []).map((r) => [
      r.id,
      {
        rate: dec(r.rate),
        priceLevel:
          r.price_level === null || r.price_level === undefined ? null : Number(r.price_level),
        itemPerc: dec(r.item_perc),
        itemQty: dec(r.item_qty),
        splPerc: dec(r.spl_perc),
        splQty: dec(r.spl_qty),
      },
    ]),
  );
}

/**
 * The untouched state of each line `indexes` names: the rate the item gives (with and
 * without the customer's per-unit discount, and the qty slab its qty falls in), the price
 * row's default discount, and — for a line billed from an order / challan — that line's
 * rate and discounts. A line the item gives no price for has no rates (any rate stands).
 */
export async function readLineNormals(
  client: LockClient,
  header: LockHeader,
  lines: readonly LockLine[],
  indexes: readonly number[],
  qtyPriceSetting?: QtyPriceSettingReader,
): Promise<Map<number, LineNormal | null>> {
  const out = new Map<number, LineNormal | null>();
  if (!indexes.length) {
    return out;
  }
  const sources = await sourceFactsOf(
    client,
    indexes.map((i) => lines[i]),
  );
  for (const idx of indexes) {
    const line = lines[idx];
    const source = line.srcItemId ? sources.get(line.srcItemId) : undefined;
    const normal: LineNormal = {
      rates: [],
      skipRate: false,
      baselines: [],
      sourceLevel: source?.priceLevel ?? null,
    };
    if (source) {
      if (source.rate.gt(0)) {
        normal.rates.push(source.rate);
      }
      normal.baselines.push({
        itemPerc: source.itemPerc,
        itemQty: source.itemQty,
        splPerc: source.splPerc,
        splQty: source.splQty,
      });
    }
    const answer = await resolveSaleLinePrice(client, {
      itemId: line.itemId,
      unitId: line.unitId,
      companyId: header.companyId,
      branchId: header.branchId,
      customerId: header.custId,
      priceLevel: line.priceLevel,
      docDate: header.billDate,
      mrp: line.mrp,
      lotId: line.lotId,
    });
    if (answer.ok) {
      normal.skipRate = answer.item.itemWeighScale === true;
      const sales = dec(answer.salesPrice);
      const basePrice = dec(answer.basePrice);
      if (sales.gt(0)) {
        normal.rates.push(sales);
        if (!basePrice.equals(sales) && basePrice.gt(0)) {
          normal.rates.push(basePrice);
        }
        const slabs = await rankedQtySlabs(
          client,
          {
            itemId: line.itemId,
            iucId: answer.rate.itemUnitConversion.iucId,
            companyId: header.companyId,
            branchId: header.branchId,
            partyId: header.custId,
            priceLevel: line.priceLevel,
            onDate: header.billDate,
          },
          qtyPriceSetting,
        );
        for (const qty of [line.billQty, line.netQty]) {
          const slab = slabs.length ? pickSlab(slabs, qty) : null;
          const slabRate = slab
            ? slabLineRate(sales, slab, { inclTax: line.isTaxIncl, taxPerc: line.taxPerc })
            : null;
          if (slabRate) {
            normal.rates.push(slabRate);
          }
        }
      } else if (!source) {
        // A 0 price: the cashier types the rate.
        normal.rates = [];
      }
      normal.baselines.push({
        itemPerc: dec(answer.rate.ipmDiscPerc),
        itemQty: dec(answer.rate.ipmDiscQty),
        splPerc: ZERO,
        splQty: ZERO,
      });
    }
    out.set(idx, normal);
  }
  return out;
}

async function readChargeRules(
  client: Pick<Prisma.TransactionClient, 'chargeMaster'>,
  charges: readonly LockCharge[],
): Promise<Map<string, ChargeMasterRule>> {
  const ids = [...new Set(charges.filter((c) => isDeduct(c) && c.chgId).map((c) => c.chgId!))];
  if (!ids.length) {
    return new Map();
  }
  const rows = await client.chargeMaster.findMany({
    where: { chgId: { in: ids } },
    select: { chgId: true, chgAutoApply: true, chgDefaultRate: true, chgMethod: true },
  });
  return new Map(
    rows.map((r) => [
      r.chgId,
      { autoApply: r.chgAutoApply, defaultRate: r.chgDefaultRate, method: r.chgMethod },
    ]),
  );
}

/** The amounts of the order / challan charge rows the bill's carried DEDUCT rows name. */
async function readSourceCharges(
  client: Pick<Prisma.TransactionClient, 'transactionChargeDetail'>,
  charges: readonly LockCharge[],
): Promise<Map<string, Dec>> {
  const ids = [...new Set(charges.filter((c) => isDeduct(c) && c.srcCdId).map((c) => c.srcCdId!))];
  if (!ids.length) {
    return new Map();
  }
  const rows = await client.transactionChargeDetail.findMany({
    where: { cdId: { in: ids } },
    select: { cdId: true, cdAmount: true },
  });
  return new Map(rows.map((r) => [r.cdId, dec(r.cdAmount)]));
}

/** What the lock asks of the sales settings (the caller's resolver). */
export interface LockOptions {
  /** `sales.apply_qty_prices`, for the slab rates. */
  qtyPriceSetting?: QtyPriceSettingReader;
  /** `sales.default_price_level` for the bill's company / branch / device; null = not known. */
  defaultPriceLevel?: (header: LockHeader) => Promise<number | null>;
}

/**
 * The price levels the bill gives by default (user 20/11): the customer's own level
 * (sales.customers.cus_price_level_id — the screen takes it when the customer is picked) and
 * the sales.default_price_level setting (what the screen starts at, and keeps for a walk-in).
 * Both, because lines keyed before the customer was picked keep the setting's level. Empty
 * = nothing known: the level is not judged.
 */
export async function readAllowedLevels(
  client: Pick<Prisma.TransactionClient, 'customer'>,
  header: LockHeader,
  defaultPriceLevel?: (header: LockHeader) => Promise<number | null>,
): Promise<Set<number>> {
  const levels = new Set<number>();
  if (header.custId) {
    const customer = await client.customer.findFirst({
      where: { cusId: header.custId },
      select: { cusPriceLevelId: true },
    });
    if (customer && customer.cusPriceLevelId > 0) {
      levels.add(customer.cusPriceLevelId);
    }
  }
  const fallback = defaultPriceLevel ? await defaultPriceLevel(header) : null;
  if (fallback !== null && Number.isInteger(fallback) && fallback > 0) {
    levels.add(fallback);
  }
  return levels;
}

/**
 * True when the lock has nothing to judge for this user: the right and no limit — every real
 * user on 20/11 (D6: the limit starts NULL for everyone). No price is read for them.
 */
export function isLockExempt(user: RateLockUser | null): boolean {
  return !user || (user.editRate && user.maxDiscPerc === null);
}

/** Every refusal the lock raises for this user and save ([] when none). */
export async function rateDiscountRefusalsFor(
  client: LockClient,
  user: RateLockUser,
  input: LockInput,
  options: LockOptions = {},
): Promise<LockRefusal[]> {
  if (isLockExempt(user)) {
    return [];
  }
  // The price level is locked only for a user without the right.
  const allowedLevels = user.editRate
    ? new Set<number>()
    : await readAllowedLevels(client, input.header, options.defaultPriceLevel);
  const indexes = linesNeedingNormal(user, input, allowedLevels);
  const [normals, chargeRules, sourceCharges] = await Promise.all([
    readLineNormals(client, input.header, input.lines, indexes, options.qtyPriceSetting),
    readChargeRules(client, input.charges),
    readSourceCharges(client, input.charges),
  ]);
  return judgeRateDiscount(user, input, normals, chargeRules, allowedLevels, sourceCharges);
}

/** The same for the user `usrId` names ([] when it names nobody, or an exempt user). */
export async function rateDiscountRefusals(
  client: LockClient,
  usrId: string | null | undefined,
  input: LockInput,
  options: LockOptions = {},
): Promise<LockRefusal[]> {
  const user = await readRateLockUser(client, usrId);
  return user ? rateDiscountRefusalsFor(client, user, input, options) : [];
}

/** 403 with every refusal of the save, each worded by its code ({line}, {max}). */
export function throwRateDiscountRefusals(refusals: readonly LockRefusal[]): void {
  if (!refusals.length) {
    return;
  }
  throwSalesForbidden<SalesCodedErrorDetail & { max?: string }>(
    refusals[0].message,
    refusals.map((r) => ({
      field: r.field,
      message: r.message,
      code: r.code,
      ...(r.line === undefined ? {} : { line: r.line }),
      ...(r.max === undefined ? {} : { max: r.max }),
    })),
  );
}

/** The same refusals as /bills/validate reports them (REFUSE, {max} through params). */
export function asSalesRefusals(refusals: readonly LockRefusal[]): SalesRefusal[] {
  return refusals.map((r) => ({
    code: r.code,
    message: r.message,
    field: r.field,
    ...(r.line === undefined ? {} : { line: r.line }),
    ...(r.max === undefined ? {} : { params: { max: r.max } }),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
//  Adapters: stored rows and DTO lines → LockLine / LockCharge
// ═══════════════════════════════════════════════════════════════════════════

/** The columns the lock reads off a stored sale_bill_item (a Prisma SaleBillItem has them). */
export interface StoredBillLine {
  sbiId: string;
  sbiLineNo: number;
  sbiItemId: string;
  sbiItemUnitId: string;
  sbiPriceLevel: number;
  sbiLotId: string | null;
  sbiMaxPrice: Prisma.Decimal | null;
  sbiIsTaxIncl: boolean;
  sbiTaxPerc: Prisma.Decimal;
  sbiBillQty: Prisma.Decimal;
  sbiNetQty: Prisma.Decimal;
  sbiRate: Prisma.Decimal;
  sbiRatePreTax: Prisma.Decimal;
  sbiIsFree: boolean;
  sbiIsPromo: boolean;
  sbiSchemeId: string | null;
  sbiPromoUsageId: string | null;
  sbiSrcDocType: string | null;
  sbiSrcItemId: string | null;
  sbiItemDiscPerc: Prisma.Decimal;
  sbiItemDiscQty: Prisma.Decimal;
  sbiItemDiscAmt: Prisma.Decimal;
  sbiSplDiscPerc: Prisma.Decimal;
  sbiSplDiscQty: Prisma.Decimal;
  sbiSplDiscAmt: Prisma.Decimal;
  sbiSchDiscAmt: Prisma.Decimal;
  sbiBillSchAmt: Prisma.Decimal;
  sbiNetGross: Prisma.Decimal | null;
  sbiNetAmt: Prisma.Decimal;
}

export function lockLineOfStored(row: StoredBillLine): LockLine {
  return {
    lineNo: row.sbiLineNo,
    id: row.sbiId,
    itemId: row.sbiItemId,
    unitId: row.sbiItemUnitId,
    priceLevel: row.sbiPriceLevel,
    lotId: row.sbiLotId,
    mrp:
      row.sbiMaxPrice !== null && dec(row.sbiMaxPrice).gt(0)
        ? dec(row.sbiMaxPrice).toNumber()
        : null,
    isTaxIncl: row.sbiIsTaxIncl,
    taxPerc: dec(row.sbiTaxPerc),
    billQty: dec(row.sbiBillQty),
    netQty: dec(row.sbiNetQty),
    rate: dec(row.sbiRate),
    ratePreTax: dec(row.sbiRatePreTax),
    isFree: row.sbiIsFree,
    isPromo: row.sbiIsPromo || !!row.sbiSchemeId || !!row.sbiPromoUsageId,
    srcDocType: row.sbiSrcDocType,
    srcItemId: row.sbiSrcItemId,
    itemDiscPerc: dec(row.sbiItemDiscPerc),
    itemDiscQty: dec(row.sbiItemDiscQty),
    itemDiscAmt: dec(row.sbiItemDiscAmt),
    splDiscPerc: dec(row.sbiSplDiscPerc),
    splDiscQty: dec(row.sbiSplDiscQty),
    splDiscAmt: dec(row.sbiSplDiscAmt),
    schDiscAmt: dec(row.sbiSchDiscAmt),
    billSchAmt: dec(row.sbiBillSchAmt),
    netGross: decOrNull(row.sbiNetGross),
    netAmt: dec(row.sbiNetAmt),
  };
}

/** A DTO line (string | number money), for /bills/validate. */
export interface DtoBillLine {
  sbiId?: string;
  sbiLineNo?: number;
  sbiItemId: string;
  sbiItemUnitId: string;
  sbiPriceLevel?: number;
  sbiLotId?: string | null;
  sbiMaxPrice?: Num;
  sbiIsTaxIncl?: boolean;
  sbiTaxPerc?: Num;
  sbiBillQty?: Num;
  sbiNetQty?: Num;
  sbiRate?: Num;
  sbiRatePreTax?: Num;
  sbiIsFree?: boolean;
  sbiIsPromo?: boolean;
  sbiSchemeId?: string | null;
  sbiPromoUsageId?: string | null;
  sbiSrcDocType?: string | null;
  sbiSrcItemId?: string | null;
  sbiItemDiscPerc?: Num;
  sbiItemDiscQty?: Num;
  sbiItemDiscAmt?: Num;
  sbiSplDiscPerc?: Num;
  sbiSplDiscQty?: Num;
  sbiSplDiscAmt?: Num;
  sbiSchDiscAmt?: Num;
  sbiBillSchAmt?: Num;
  sbiNetGross?: Num;
  sbiNetAmt?: Num;
}

export function lockLineOfDto(row: DtoBillLine, index: number, headerLevel: number): LockLine {
  const mrp = dec(row.sbiMaxPrice);
  return {
    lineNo: row.sbiLineNo ?? index + 1,
    id: row.sbiId ?? null,
    itemId: row.sbiItemId,
    unitId: row.sbiItemUnitId,
    priceLevel: row.sbiPriceLevel ?? headerLevel,
    lotId: row.sbiLotId ?? null,
    mrp: mrp.gt(0) ? mrp.toNumber() : null,
    isTaxIncl: row.sbiIsTaxIncl ?? false,
    taxPerc: dec(row.sbiTaxPerc),
    billQty: dec(row.sbiBillQty),
    netQty: dec(row.sbiNetQty),
    rate: dec(row.sbiRate),
    ratePreTax: dec(row.sbiRatePreTax),
    isFree: row.sbiIsFree ?? false,
    isPromo: (row.sbiIsPromo ?? false) || !!row.sbiSchemeId || !!row.sbiPromoUsageId,
    srcDocType: row.sbiSrcDocType ?? null,
    srcItemId: row.sbiSrcItemId ?? null,
    itemDiscPerc: dec(row.sbiItemDiscPerc),
    itemDiscQty: dec(row.sbiItemDiscQty),
    itemDiscAmt: dec(row.sbiItemDiscAmt),
    splDiscPerc: dec(row.sbiSplDiscPerc),
    splDiscQty: dec(row.sbiSplDiscQty),
    splDiscAmt: dec(row.sbiSplDiscAmt),
    schDiscAmt: dec(row.sbiSchDiscAmt),
    billSchAmt: dec(row.sbiBillSchAmt),
    netGross: decOrNull(row.sbiNetGross),
    netAmt: dec(row.sbiNetAmt),
  };
}

/** A stored txn_charge_detail row or a DTO charge (the same key names). */
export interface ChargeLike {
  cdChgId?: string | null;
  cdType?: string | null;
  cdMethod?: string | null;
  cdRate?: Num;
  cdAmount?: Num;
  cdBeforeTax?: boolean | null;
  cdSrcCdId?: string | null;
  cdIsDeleted?: boolean | null;
  cdIsActive?: boolean | null;
}

export function lockChargeOf(row: ChargeLike): LockCharge {
  return {
    chgId: row.cdChgId ?? null,
    type: row.cdType ?? 'ADD',
    method: row.cdMethod ?? null,
    rate: decOrNull(row.cdRate),
    amount: dec(row.cdAmount),
    beforeTax: row.cdBeforeTax === true,
    srcCdId: row.cdSrcCdId ?? null,
  };
}

/** The header facts off a stored sale_bill or a DTO (same key names). */
export function lockHeaderOf(bill: {
  sbCompanyId: string;
  sbBranchId: string;
  sbDeviceId?: string | null;
  sbPriceLevel?: number | null;
  sbCustId?: string | null;
  sbBillDate?: Date | string | null;
  sbDiscAlterBase?: boolean | null;
  sbAddlDisc1?: Num;
  sbAddlDisc2?: Num;
  sbCashDisc?: Num;
}): LockHeader {
  const date =
    bill.sbBillDate instanceof Date
      ? bill.sbBillDate.toISOString().slice(0, 10)
      : typeof bill.sbBillDate === 'string' && bill.sbBillDate
        ? bill.sbBillDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
  return {
    companyId: bill.sbCompanyId,
    branchId: bill.sbBranchId,
    deviceId: bill.sbDeviceId ?? null,
    custId: bill.sbCustId ?? null,
    priceLevel: bill.sbPriceLevel ?? 0,
    billDate: date,
    discAlterBase: bill.sbDiscAlterBase === true,
    headerDisc: dec(bill.sbAddlDisc1).plus(dec(bill.sbAddlDisc2)).plus(dec(bill.sbCashDisc)),
  };
}
