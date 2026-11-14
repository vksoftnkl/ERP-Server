import { Prisma } from '@prisma/client';
import type { DocRow } from '../posting/sales-doc-store';
import { daysBetween, supplyNatureOf } from '../posting/sales-doc.utils';
import { SALES_ERROR_CODES, type SalesMessageParams } from '../posting/types/posting.types';
import {
  D,
  ONE,
  ZERO,
  baseOf,
  basisTotals,
  cashDiscShare,
  emptiesBill as emptiesBillOf,
  everyChargeBack,
  lastSaleLine,
  mirrorBilledLines,
  mirrorCharges,
  n,
  r3,
  r4,
  r6,
  signed,
  todayPriceLine,
  totalsOf,
  zeroParts,
  type ChargeAsk,
  type ChargeBack,
  type Dec,
  type LineMoney,
  type PercentKey,
  type PerUnitKey,
  type PriorBack,
  type ReturnLineAsk,
  type ReturnTotals,
} from './sale-return-money';
import {
  SaleReturnBillReader,
  type BillHeaderFacts,
  type BillLineView,
  type BillTenderFacts,
  type DraftHold,
  type LotFacts,
  type PriorHeader,
  type UnitRow,
} from './sale-return-bill-reader';

/**
 * Plan v5 §6.2 — the whole money of a return, assembled from the bill (the
 * reader) and the pure mirror (sale-return-money.ts), plus the notes a guard
 * run turns into refusals / warnings, and the shapes the screen reads:
 * `/validate`'s `preview`, `/bill-lines`, and the fields `/create` writes.
 */

type Client = Prisma.TransactionClient;

export interface MoneyIssue {
  level: 'REFUSE' | 'WARN' | 'INFO';
  code: string;
  message: string;
  field?: string;
  line?: number;
  params?: SalesMessageParams;
}

export interface MoneyInput {
  srId: string | null;
  companyId: string;
  branchId: string;
  custId: string | null;
  returnDate: string;
  againstBill: boolean;
  billId: string | null;
  billAccYear: string | null;
  priceLevel: number | null;
  posStcd: string | null;
  reasonId: string | null;
  items: readonly DocRow[];
  chargeAsks: ReadonlyMap<string, ChargeAsk>;
  settings: {
    returnWindowDays: number;
    roundOffStep: number;
    freeReturnAllowed: boolean;
    freightCalcType: string | null;
    loadingCalcType: string | null;
    expiredLotDays: number;
  };
}

export interface ReturnMoney {
  bill: BillHeaderFacts | null;
  billLines: BillLineView[];
  prior: Map<string, PriorBack>;
  priorHeader: PriorHeader | null;
  drafts: Map<string, DraftHold>;
  units: Map<string, UnitRow>;
  lots: Map<string, LotFacts>;
  /** One per request item, in request order. */
  lines: LineMoney[];
  charges: ChargeBack[];
  totals: ReturnTotals;
  emptiesBill: boolean;
  nature: 'INTRA' | 'INTER';
  roundOffStep: Dec;
  freightCalcType: string | null;
  loadingCalcType: string | null;
  issues: MoneyIssue[];
}

const dq = (v: unknown): Dec =>
  v === null || v === undefined || v === ''
    ? ZERO
    : v instanceof Prisma.Decimal
      ? v
      : D(v as Prisma.Decimal.Value);

/** A line that could not be mirrored (no bill line, unit unknown): zero money, the client's keys kept. */
function emptyLine(ask: ReturnLineAsk, billItemId: string | null): LineMoney {
  const percent = Object.fromEntries(
    (
      [
        'itemDiscPerc',
        'splDiscPerc',
        'schDiscPerc',
        'billSchPerc',
        'addlDisc1Perc',
        'addlDisc2Perc',
        'cashDiscPerc',
        'taxPerc',
        'cgstPerc',
        'sgstPerc',
        'igstPerc',
        'cessPerc',
        'acessPerc',
      ] as PercentKey[]
    ).map((k) => [k, ZERO]),
  ) as Record<PercentKey, Dec>;
  const perUnit = Object.fromEntries(
    (
      [
        'rate',
        'ratePreTax',
        'maxPrice',
        'minPrice',
        'actPrice',
        'itemDiscQty',
        'splDiscQty',
        'schDiscQty',
        'billSchQty',
        'cessPerUnit',
        'acessPerUnit',
      ] as PerUnitKey[]
    ).map((k) => [k, null]),
  ) as Record<PerUnitKey, Dec | null>;
  return {
    index: ask.index,
    lineNo: ask.lineNo,
    splitNo: ask.splitNo,
    billItemId,
    billAccYear: null,
    billLineNo: null,
    itemId: ask.itemId,
    itemUnitId: ask.itemUnitId,
    qty: ask.qty,
    factor: ask.factor,
    qtyBase: ask.qty.times(ask.factor),
    parts: zeroParts(),
    perUnit,
    percent,
    copy: null,
    discAmt: ZERO,
    taxAmt: ZERO,
    netAmt: ZERO,
    costPerBase: null,
    takesRemainder: false,
    rateSource: { kind: 'BILL', sbRefno: null, sbDate: null, billItemId, accYear: null },
    overQty: false,
    leftBaseBefore: null,
  };
}

const qtyOf = (i: DocRow): Dec => dq(i.sriReturnQty).plus(dq(i.sriFreeQty));

/** The whole money of a return (D45 / D46 / D56 / D68–D71). Reads only; writes nothing. */
export async function buildReturnMoney(
  reader: SaleReturnBillReader,
  c: Client,
  input: MoneyInput,
): Promise<ReturnMoney> {
  const issues: MoneyIssue[] = [];
  const bill =
    input.againstBill && input.billId && input.billAccYear
      ? await reader.billHeader(c, input.billId, input.billAccYear.trim())
      : null;
  const company = await reader.company(c, input.companyId);
  const nature = supplyNatureOf(company.stateCode, input.posStcd ?? bill?.posStcd ?? null);
  const [billLines, prior, priorHeader, drafts, billCharges] = bill
    ? await Promise.all([
        reader.billLines(c, bill),
        reader.priorBack(c, bill, input.srId),
        reader.priorHeader(c, bill, input.srId),
        reader.onDrafts(c, bill, input.srId),
        reader.billCharges(c, bill, input.srId),
      ])
    : [[], new Map<string, PriorBack>(), null, new Map<string, DraftHold>(), []];
  const units = await reader.units(
    c,
    input.items.map((i) => i.sriItemUnitId as string),
  );

  // ── the asks ────────────────────────────────────────────────────────────
  const billLineById = new Map(billLines.map((l) => [l.billItemId, l]));
  const billed: (ReturnLineAsk & { billItemId: string })[] = [];
  const free: ReturnLineAsk[] = [];
  const lines: (LineMoney | null)[] = input.items.map(() => null);
  input.items.forEach((item, index) => {
    const lineNo = (item.sriLineNo as number | null) ?? index + 1;
    const splitNo = (item.sriSplitNo as number | null) ?? 1;
    const itemId = item.sriItemId as string;
    const itemUnitId = item.sriItemUnitId as string;
    const unit = units.get(itemUnitId);
    const base: ReturnLineAsk = {
      index,
      lineNo,
      splitNo,
      itemId,
      itemUnitId,
      qty: qtyOf(item),
      factor: unit?.factor ?? ONE,
    };
    if (!unit || unit.itemId !== itemId) {
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.RETURN_UNIT,
        message: `Line ${lineNo}: unit ${itemUnitId} is not one of this item's units`,
        field: 'sriItemUnitId',
        line: lineNo,
      });
      lines[index] = emptyLine(base, (item.sriBillItemId as string | null) ?? null);
      return;
    }
    if (!bill) {
      free.push(base);
      return;
    }
    // A billed line names its bill line; one that does not is matched to the
    // only line of that item, if there is exactly one (D53 matches scans on
    // the client; this keeps a typed line honest).
    let billItemId = (item.sriBillItemId as string | null) ?? null;
    if (!billItemId) {
      const same = billLines.filter((l) => l.itemId === itemId);
      if (same.length === 1) {
        billItemId = same[0].billItemId;
      } else if (same.length > 1) {
        issues.push({
          level: 'REFUSE',
          code: SALES_ERROR_CODES.LINE_FIELD_REQUIRED,
          message: `Line ${lineNo}: the item is on ${same.length} lines of the bill — name the bill line (sriBillItemId)`,
          field: 'sriBillItemId',
          line: lineNo,
        });
        lines[index] = emptyLine(base, null);
        return;
      }
    }
    const bl = billItemId ? billLineById.get(billItemId) : undefined;
    if (!bl || bl.itemId !== itemId) {
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.RETURN_NOT_ON_BILL,
        message: `Line ${lineNo}: this item is not on bill ${bill.refno ?? bill.sbId}`,
        field: 'sriBillItemId',
        line: lineNo,
        params: { bill: bill.refno ?? '' },
      });
      lines[index] = emptyLine(base, billItemId);
      return;
    }
    // D68: in the bill line's own unit the line's own factor; another unit
    // (D52) converts through that unit's own factor.
    const factor = itemUnitId === bl.itemUnitId ? bl.factor : unit.factor;
    billed.push({ ...base, factor, billItemId: bl.billItemId });
  });

  // ── billed lines: the mirror ───────────────────────────────────────────
  if (bill) {
    for (const m of mirrorBilledLines(
      { refno: bill.refno, date: bill.date },
      billLines,
      prior,
      billed,
    )) {
      lines[m.index] = m;
      if (m.overQty) {
        const bl = billLineById.get(m.billItemId!)!;
        issues.push({
          level: 'REFUSE',
          code: SALES_ERROR_CODES.RETURN_OVER_QTY,
          message: `Line ${m.lineNo}: ${m.qtyBase.toString()} base units back, the bill line has ${Prisma.Decimal.max(ZERO, m.leftBaseBefore ?? ZERO).toString()} left (of ${baseOf(bl).toString()})`,
          field: 'sriReturnQty',
          line: m.lineNo,
          params: {
            qty: r3(
              Prisma.Decimal.max(ZERO, m.leftBaseBefore ?? ZERO).dividedBy(bl.factor),
            ).toString(),
          },
        });
      }
    }
  }

  // ── no-bill lines (D5 / D56) ───────────────────────────────────────────
  if (free.length > 0) {
    if (!input.settings.freeReturnAllowed) {
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.RETURN_NO_BILL_OFF,
        message: 'Returns without a bill are switched off (sales.free_return_allowed)',
        field: 'srBillId',
      });
    }
    for (const ask of free) {
      const item = input.items[ask.index];
      const src = input.custId
        ? await reader.lastSale(c, {
            companyId: input.companyId,
            custId: input.custId,
            itemId: ask.itemId,
            windowDays: input.settings.returnWindowDays,
            returnDate: input.returnDate,
            srcItemId: (item.sriRateSrcItemId as string | null) ?? null,
            srcAccYear: ((item.sriRateSrcAccYear as string | null) ?? null)?.trim() ?? null,
          })
        : null;
      if (src) {
        lines[ask.index] = lastSaleLine(
          src.facts,
          { refno: src.refno, date: src.date },
          ask,
          nature,
        );
        continue;
      }
      if (item.sriRateSrcItemId) {
        issues.push({
          level: 'REFUSE',
          code: SALES_ERROR_CODES.RETURN_NOT_ON_BILL,
          message: `Line ${ask.lineNo}: bill line ${item.sriRateSrcItemId as string} is not a posted sale of this item to this customer`,
          field: 'sriRateSrcItemId',
          line: ask.lineNo,
        });
      }
      const price = await reader.todayPrice(
        c,
        {
          companyId: input.companyId,
          branchId: input.branchId,
          itemId: ask.itemId,
          itemUnitId: ask.itemUnitId,
          priceLevel: input.priceLevel,
        },
        ask.factor,
      );
      lines[ask.index] = todayPriceLine(price, ask, nature);
      if (price.rateWot.lte(0)) {
        // User 2026-11-13: no price today is a WARN the counter may pass — the
        // goods still come back, at 0.00 (no credit).
        issues.push({
          level: 'WARN',
          code: SALES_ERROR_CODES.RETURN_NO_PRICE,
          message: `Line ${ask.lineNo}: no price for this item at the customer's price level; it comes back at 0.00`,
          field: 'sriRate',
          line: ask.lineNo,
        });
        continue;
      }
      issues.push({
        level: 'INFO',
        code: SALES_ERROR_CODES.RETURN_NEVER_SOLD,
        message: `Line ${ask.lineNo}: no sale of this item to this customer${input.settings.returnWindowDays > 0 ? ` in the last ${input.settings.returnWindowDays} days` : ''}; today's price is used`,
        field: 'sriRate',
        line: ask.lineNo,
      });
    }
  }

  const done = lines.map(
    (l, i) =>
      l ??
      emptyLine(
        {
          index: i,
          lineNo: (input.items[i].sriLineNo as number | null) ?? i + 1,
          splitNo: 1,
          itemId: input.items[i].sriItemId as string,
          itemUnitId: input.items[i].sriItemUnitId as string,
          qty: qtyOf(input.items[i]),
          factor: ONE,
        },
        null,
      ),
  );

  // ── charges, cash discount, round off ──────────────────────────────────
  const empties = bill ? emptiesBillOf(billLines, prior, done) : false;
  const freightCalcType = input.settings.freightCalcType ?? bill?.freightCalcType ?? null;
  const loadingCalcType = input.settings.loadingCalcType ?? bill?.loadingCalcType ?? null;
  const reason = await reader.reason(c, input.reasonId);
  const charges = bill
    ? mirrorCharges({
        charges: billCharges,
        asks: input.chargeAsks,
        billBasis: basisTotals(billLines.map((l) => ({ qtyBase: baseOf(l), parts: l.parts }))),
        returnBasis: basisTotals(done),
        emptiesBill: empties,
        manual: {
          freight: (freightCalcType ?? '').toLowerCase() === 'manual',
          loading: (loadingCalcType ?? '').toLowerCase() === 'manual',
        },
        defaultGiveBack: reason?.refundCharges ?? true,
      })
    : [];
  for (const ch of charges.filter((x) => x.overCap)) {
    issues.push({
      level: 'REFUSE',
      code: SALES_ERROR_CODES.CHARGE_OVER_CARRY,
      message: `${ch.bill.name ?? 'Charge'}: ${ch.cap.toString()} is left of it to give back`,
      field: 'charges',
    });
  }
  const lineTaxable = done.reduce((t, l) => t.plus(l.parts.taxableAmt), ZERO);
  const cashDisc =
    bill && priorHeader
      ? cashDiscShare({
          billCashDisc: bill.cashDisc,
          priorCashDisc: priorHeader.cashDisc,
          billLineTaxable: billLines.reduce((t, l) => t.plus(l.parts.taxableAmt), ZERO),
          returnLineTaxable: lineTaxable,
          emptiesBill: empties,
        })
      : ZERO;
  const roundOffStep = bill?.roundOffStep ?? D(input.settings.roundOffStep);
  const totals = totalsOf({
    lines: done,
    charges,
    cashDisc,
    roundOffStep,
    billRoundOffLeft:
      bill && priorHeader && empties && everyChargeBack(charges)
        ? bill.roundOff.minus(priorHeader.roundOff)
        : null,
  });

  // ── notes: on other drafts (D51), expired lot (D57) ────────────────────
  if (bill) {
    const noted = new Set<string>();
    for (const l of done) {
      const hold = l.billItemId ? drafts.get(l.billItemId) : undefined;
      if (!hold || noted.has(l.billItemId!) || hold.base.lte(0)) {
        continue;
      }
      noted.add(l.billItemId!);
      const bl = billLineById.get(l.billItemId!);
      const qty = bl ? r3(hold.base.dividedBy(bl.factor)) : hold.base;
      issues.push({
        level: 'INFO',
        code: SALES_ERROR_CODES.RETURN_ON_DRAFTS,
        message: `Line ${l.lineNo}: ${qty.toString()} of this bill line are on other draft returns (${hold.refnos.join(', ')})`,
        field: 'sriReturnQty',
        line: l.lineNo,
        params: { qty: qty.toString(), refnos: hold.refnos.join(', ') },
      });
    }
  }
  const lotIds = done
    .map((l, i) => l.copy?.lotId ?? (input.items[i].sriLotId as string | null) ?? null)
    .filter((x): x is string => !!x);
  const lots = await reader.lots(c, lotIds);
  done.forEach((l, i) => {
    if (l.qtyBase.lte(0)) {
      return;
    }
    const lotId = l.copy?.lotId ?? (input.items[i].sriLotId as string | null) ?? null;
    const lot = lotId ? lots.get(lotId) : undefined;
    const expiry =
      lot?.expiryDate ?? l.copy?.expiryDate ?? isoOf(input.items[i].sriExpiryDate) ?? null;
    if (!expiry || expiry >= input.returnDate) {
      return;
    }
    const days = daysBetween(expiry, input.returnDate);
    if (days > input.settings.expiredLotDays) {
      const name =
        lot?.batchNo ?? l.copy?.batchNo ?? (input.items[i].sriBatchNo as string | null) ?? '';
      issues.push({
        level: 'WARN',
        code: SALES_ERROR_CODES.RETURN_LOT_EXPIRED,
        message: `Line ${l.lineNo}: lot ${name || lotId || ''} expired on ${expiry}, ${days} days before the return (sales.return_expired_lot_days = ${input.settings.expiredLotDays})`,
        field: 'sriLotId',
        line: l.lineNo,
        params: { lot: name, n: days },
      });
    }
  });

  return {
    bill,
    billLines,
    prior,
    priorHeader,
    drafts,
    units,
    lots,
    lines: done,
    charges,
    totals,
    emptiesBill: empties,
    nature,
    roundOffStep,
    freightCalcType,
    loadingCalcType,
    issues,
  };
}

function isoOf(v: unknown): string | null {
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  return typeof v === 'string' && v ? v.slice(0, 10) : null;
}

// ─── what /create writes ────────────────────────────────────────────────────

const pu = (v: Dec | null): Dec | null => (v === null ? null : r4(v));

/** 'YYYY-MM-DD' (or a full ISO stamp) → the Date a Prisma @db.Date column takes; null stays null. */
export function dbDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T00:00:00.000Z`) : null;
}

/**
 * The server-owned columns of one return line (D45): every money part, rate
 * and tax figure, copied or worked out — never the client's.
 */
export function lineFieldsOf(l: LineMoney, item: DocRow, headerPriceLevel: number | null): DocRow {
  const p = l.parts;
  const billed = l.rateSource.kind === 'BILL' && l.copy !== null;
  const copy = l.copy;
  return {
    sriBillItemId: l.billItemId,
    sriBillAccYear: l.billAccYear,
    sriBillLineNo: l.billLineNo,
    sriToBaseFactor: r6(l.factor),
    sriNetQty: l.qty,
    sriHsnCode: copy?.hsnCode ?? item.sriHsnCode ?? null,
    sriTaxId: copy?.taxId ?? null,
    sriIsTaxIncl: copy?.isTaxIncl ?? false,
    sriIsFree: copy?.isFree ?? false,
    sriFreeType: copy?.freeType ?? null,
    sriIsService: copy?.isService ?? false,
    sriSchemeId: copy?.schemeId ?? null,
    sriSchemeName: copy?.schemeName ?? null,
    sriPriceLevel: copy?.priceLevel ?? headerPriceLevel ?? 1,
    sriEanCode: item.sriEanCode ?? copy?.eanCode ?? null,
    sriSalesmanId: copy?.salesmanId ?? null,
    sriPromoUsageId: copy?.promoUsageId ?? null,
    sriQtyPriceId: copy?.qtyPriceId ?? null,
    sriSize: copy?.size ?? item.sriSize ?? null,
    sriSizeUom: copy?.sizeUom ?? item.sriSizeUom ?? null,
    // A billed line goes back into the lot it left; a no-bill line into the
    // lot the operator picked (F12).
    ...(billed && copy
      ? {
          sriLotId: copy.lotId,
          sriBatchNo: copy.batchNo,
          // The bill copy holds them as 'YYYY-MM-DD'; the line's @db.Date
          // columns take a Date (the /post write is a plain Prisma update).
          sriBatchDate: dbDate(copy.batchDate),
          sriExpiryDate: dbDate(copy.expiryDate),
          sriSerialNo: copy.serialNo,
        }
      : {}),
    sriGrossAmt: p.grossAmt,
    sriItemDiscAmt: p.itemDiscAmt,
    sriSplDiscAmt: p.splDiscAmt,
    sriSchDiscAmt: p.schDiscAmt,
    sriBillSchAmt: p.billSchAmt,
    sriAddlDisc1Amt: p.addlDisc1Amt,
    sriAddlDisc2Amt: p.addlDisc2Amt,
    sriCashDiscAmt: p.cashDiscAmt,
    sriDiscAmt: l.discAmt,
    sriNetGross: p.netGross,
    sriChrgBeforeTax: p.chrgBeforeTax,
    // After-tax charges come back as carried rows (D46), never inside a line.
    sriChrgAfterTax: ZERO,
    sriTaxableAmt: p.taxableAmt,
    sriCgstAmt: p.cgstAmt,
    sriSgstAmt: p.sgstAmt,
    sriIgstAmt: p.igstAmt,
    sriCessAmt: p.cessAmt,
    sriAcessAmt: p.acessAmt,
    sriTaxAmt: l.taxAmt,
    sriRoundOff: ZERO,
    sriNetAmt: l.netAmt,
    sriCogsAmt: p.cogsAmt,
    sriWeightQty: p.weightQty,
    sriLoyaltyPv: p.loyaltyPv,
    sriLoyaltyPoints: p.loyaltyPoints,
    sriItemDiscPerc: l.percent.itemDiscPerc,
    sriSplDiscPerc: l.percent.splDiscPerc,
    sriSchDiscPerc: l.percent.schDiscPerc,
    sriBillSchPerc: l.percent.billSchPerc,
    sriAddlDisc1Perc: l.percent.addlDisc1Perc,
    sriAddlDisc2Perc: l.percent.addlDisc2Perc,
    sriCashDiscPerc: l.percent.cashDiscPerc,
    sriTaxPerc: l.percent.taxPerc,
    sriCgstPerc: l.percent.cgstPerc,
    sriSgstPerc: l.percent.sgstPerc,
    sriIgstPerc: l.percent.igstPerc,
    sriCessPerc: l.percent.cessPerc,
    sriAcessPerc: l.percent.acessPerc,
    sriRate: pu(l.perUnit.rate) ?? ZERO,
    sriRatePreTax: pu(l.perUnit.ratePreTax) ?? ZERO,
    sriMaxPrice: pu(l.perUnit.maxPrice),
    sriMinPrice: pu(l.perUnit.minPrice),
    sriActPrice: pu(l.perUnit.actPrice),
    sriItemDiscQty: r3(l.perUnit.itemDiscQty ?? ZERO),
    sriSplDiscQty: r3(l.perUnit.splDiscQty ?? ZERO),
    sriSchDiscQty: r3(l.perUnit.schDiscQty ?? ZERO),
    sriBillSchQty: r3(l.perUnit.billSchQty ?? ZERO),
    sriCessPerUnit: pu(l.perUnit.cessPerUnit) ?? ZERO,
    sriAcessPerUnit: pu(l.perUnit.acessPerUnit) ?? ZERO,
    sriCostPrice: l.costPerBase ? r4(l.costPerBase.times(l.factor)) : null,
    sriRateSource: l.rateSource.kind,
    sriRateSrcItemId: l.rateSource.kind === 'LAST_SALE' ? l.rateSource.billItemId : null,
    sriRateSrcAccYear: l.rateSource.kind === 'LAST_SALE' ? l.rateSource.accYear : null,
  };
}

/** The server-owned header figures of the return. */
export function headerFieldsOf(m: ReturnMoney): DocRow {
  const t = m.totals;
  return {
    srTotItems: m.lines.filter((l) => l.qty.gt(0)).length,
    srTotWeight: r3(t.weight),
    srGrossAmt: t.gross,
    srDiscAmt: t.discAmt,
    srItemDisc: t.itemDisc,
    srSplDisc: t.splDisc,
    srSchDisc: t.schDisc,
    srBillSchDisc: t.billSchDisc,
    srCashDisc: t.cashDisc,
    srTaxableAmt: t.taxable,
    srCgstAmt: t.cgst,
    srSgstAmt: t.sgst,
    srIgstAmt: t.igst,
    srCessAmt: t.cess,
    srTaxAmt: t.tax,
    srOtherAmt: t.otherAmt,
    srFreightAmt: t.freight,
    srLoadAmt: t.load,
    srUnloadAmt: t.unload,
    srRoundOff: t.roundOff,
    srRoundOffStep: m.roundOffStep,
    srReturnAmt: t.creditNote,
    srTotalCost: t.cogs,
    srFreightCalcType: m.freightCalcType,
    srLoadingCalcType: m.loadingCalcType,
  };
}

/** Whether a mirrored charge row is stored on the return (and posts). */
export function storesCharge(c: ChargeBack): boolean {
  return c.bill.onBill.amount.gt(0) && (c.kind === 'CARRIED' || c.bill.sepPost);
}

/**
 * The return's own charge rows (cd_doc_type SALE_RETURN), one per bill row
 * that is carried, or posts on its own ledger from inside the lines. Stored as
 * the client stores a bill's: a positive cd_amount and the bill's cd_type, so
 * signedCharge (P0) signs them. `existing` maps cd_src_cd_id → the return's
 * own cd_id, so a re-save updates rather than replaces.
 */
export function chargeRowsOf(
  m: ReturnMoney,
  existing: ReadonlyMap<string, string>,
): Record<string, unknown>[] {
  const basis = basisTotals(m.lines);
  return m.charges.filter(storesCharge).map((c, i) => {
    const gst = c.back.cgst.plus(c.back.sgst).plus(c.back.igst).plus(c.back.cess);
    const b = c.bill;
    return {
      ...(existing.get(b.cdId) ? { cdId: existing.get(b.cdId) } : {}),
      cdSlno: i + 1,
      cdChgId: b.chgId,
      cdChgName: b.name,
      cdRole: b.role,
      cdMethod: b.method,
      cdType: b.type,
      cdApplyOn: b.applyOn,
      cdLedgerCode: b.ledgerId,
      cdLandingCost: false,
      cdBeforeTax: b.beforeTax,
      cdTaxApl: b.taxApl,
      cdSepPost: b.sepPost,
      cdUnit: b.unit,
      cdQtyVal: r3(basis.qtyBase).toString(),
      cdWeight: r3(basis.weight).toString(),
      cdRate: '0',
      cdAmount: c.back.amount.toString(),
      cdTaxCode: b.taxApl && !b.beforeTax ? b.taxCode : null,
      cdHsn: b.hsn,
      cdTaxPerc: b.taxPerc.toString(),
      cdTaxAmt: gst.toString(),
      cdCgstPerc: b.cgstPerc.toString(),
      cdCgstAmt: c.back.cgst.toString(),
      cdSgstPerc: b.sgstPerc.toString(),
      cdSgstAmt: c.back.sgst.toString(),
      cdIgstPerc: b.igstPerc.toString(),
      cdIgstAmt: c.back.igst.toString(),
      cdCessPerc: b.cessPerc.toString(),
      cdCessAmt: c.back.cess.toString(),
      cdNetAmt: c.back.amount.plus(gst).toString(),
      cdIsActive: true,
      cdSrcCdId: b.cdId,
      cdSrcAccYear: b.accYear,
      // MANUAL only when Back now was typed (D20): /post then keeps the
      // typed figure; otherwise it is worked out again.
      cdCarryBasis: !c.giveBack ? 'NONE' : c.typed ? 'MANUAL' : 'PRORATA',
    };
  });
}

/** The client's say on each bill charge, from `/create`'s charges[] (keyed by cdSrcCdId). */
export function chargeAsksOfBody(
  charges: readonly Record<string, unknown>[] | undefined,
): Map<string, ChargeAsk> {
  const out = new Map<string, ChargeAsk>();
  for (const c of charges ?? []) {
    const src = c.cdSrcCdId as string | null | undefined;
    if (!src) {
      continue;
    }
    const amount = c.cdAmount;
    out.set(src, {
      giveBack: typeof c.giveBack === 'boolean' ? c.giveBack : null,
      amount: amount === undefined || amount === null || amount === '' ? null : dq(amount).abs(),
    });
  }
  return out;
}

/** The same, from the return's stored rows (what `/post` re-works). */
export function chargeAsksOfStored(
  rows: readonly { cdSrcCdId?: string | null; cdCarryBasis?: string | null; cdAmount?: unknown }[],
): Map<string, ChargeAsk> {
  const out = new Map<string, ChargeAsk>();
  for (const r of rows) {
    if (!r.cdSrcCdId) {
      continue;
    }
    out.set(r.cdSrcCdId, {
      giveBack: r.cdCarryBasis !== 'NONE',
      amount: r.cdCarryBasis === 'MANUAL' ? dq(r.cdAmount).abs() : null,
    });
  }
  return out;
}

// ─── what the screen reads ──────────────────────────────────────────────────

const BUCKET_BY_CONDITION: Record<string, string> = {
  RESTOCK: 'SALEABLE',
  GOOD: 'SALEABLE',
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
  SCRAP: 'QUARANTINE',
};
export const bucketOfCondition = (condition: string | null | undefined): string =>
  BUCKET_BY_CONDITION[(condition ?? 'RESTOCK').toUpperCase()] ?? 'SALEABLE';

/**
 * D12 / D23 — the bucket a return line's goods are classed into. The
 * condition always decides (user 2026-11-14): a bucket the client sends is
 * ignored, and the column's default (SALEABLE) never stands in for a
 * DAMAGED / EXPIRED / SCRAP condition.
 *
 * A RETURN line: the condition's bucket (RESTOCK→SALEABLE, DAMAGED→DAMAGED,
 * EXPIRED→EXPIRED, SCRAP→QUARANTINE).
 *
 * A CLAIM line: EXPIRED for an expired condition, else DAMAGED — the supplier
 * claim's buckets — whether its goods are BACK or DESTROYED. A DESTROYED line
 * brings no stock at all (bringsStock); its bucket only says how the goods
 * were classed, never SALEABLE.
 */
export function lineBucketOf(item: DocRow, claim: boolean): string {
  const condition = (item.sriCondition as string | null | undefined) ?? null;
  if (claim) {
    return (condition ?? '').toUpperCase() === 'EXPIRED' ? 'EXPIRED' : 'DAMAGED';
  }
  return bucketOfCondition(condition);
}

/** D23 — a claim line destroyed at the shop brings no stock back (and no COGS). */
export function bringsStock(item: DocRow, claim: boolean): boolean {
  return !(claim && ((item.sriClaimGoods as string | null) ?? '').toUpperCase() === 'DESTROYED');
}

function lineJson(l: LineMoney): Record<string, unknown> {
  const p = l.parts;
  const pc = l.percent;
  const u = l.perUnit;
  return {
    lineNo: l.lineNo,
    splitNo: l.splitNo,
    billItemId: l.billItemId,
    itemId: l.itemId,
    itemUnitId: l.itemUnitId,
    qty: n(l.qty),
    toBaseFactor: n(l.factor),
    qtyBase: n(l.qtyBase),
    rate: n(u.rate),
    ratePreTax: n(u.ratePreTax),
    grossAmt: n(p.grossAmt),
    itemDisc: { perc: n(pc.itemDiscPerc), qty: n(u.itemDiscQty), amt: n(p.itemDiscAmt) },
    splDisc: { perc: n(pc.splDiscPerc), qty: n(u.splDiscQty), amt: n(p.splDiscAmt) },
    schDisc: { perc: n(pc.schDiscPerc), qty: n(u.schDiscQty), amt: n(p.schDiscAmt) },
    billSch: { perc: n(pc.billSchPerc), qty: n(u.billSchQty), amt: n(p.billSchAmt) },
    addlDisc1: { perc: n(pc.addlDisc1Perc), amt: n(p.addlDisc1Amt) },
    addlDisc2: { perc: n(pc.addlDisc2Perc), amt: n(p.addlDisc2Amt) },
    cashDisc: { perc: n(pc.cashDiscPerc), amt: n(p.cashDiscAmt) },
    discAmt: n(l.discAmt),
    netGross: n(p.netGross),
    chrgBeforeTax: n(p.chrgBeforeTax),
    taxableAmt: n(p.taxableAmt),
    taxId: l.copy?.taxId ?? null,
    taxPerc: n(pc.taxPerc),
    cgst: { perc: n(pc.cgstPerc), amt: n(p.cgstAmt) },
    sgst: { perc: n(pc.sgstPerc), amt: n(p.sgstAmt) },
    igst: { perc: n(pc.igstPerc), amt: n(p.igstAmt) },
    cess: { perc: n(pc.cessPerc), perUnit: n(u.cessPerUnit), amt: n(p.cessAmt) },
    acess: { perc: n(pc.acessPerc), perUnit: n(u.acessPerUnit), amt: n(p.acessAmt) },
    taxAmt: n(l.taxAmt),
    netAmt: n(l.netAmt),
    weightQty: n(p.weightQty),
    costPerBase: l.costPerBase ? n(r6(l.costPerBase)) : null,
    cogsAmt: n(p.cogsAmt),
    loyaltyPoints: n(p.loyaltyPoints),
    lotId: l.copy?.lotId ?? null,
    batchNo: l.copy?.batchNo ?? null,
    expiryDate: l.copy?.expiryDate ?? null,
    takesRemainder: l.takesRemainder,
    overQty: l.overQty,
    rateSource: { ...l.rateSource },
  };
}

function chargeJson(c: ChargeBack): Record<string, unknown> {
  const b = c.bill;
  const gst = (f: { cgst: Dec; sgst: Dec; igst: Dec; cess: Dec }) =>
    f.cgst.plus(f.sgst).plus(f.igst).plus(f.cess);
  const sg = (v: Dec) => n(signed(c, v));
  return {
    cdSrcCdId: b.cdId,
    cdSrcAccYear: b.accYear,
    chgId: b.chgId,
    name: b.name,
    type: b.type,
    kind: c.kind,
    sign: c.sign,
    role: b.role,
    method: b.method,
    basis: c.basis,
    beforeTax: b.beforeTax,
    sepPost: b.sepPost,
    taxApl: b.taxApl,
    ledgerId: b.ledgerId,
    ledgerName: b.ledgerName,
    giveBack: c.giveBack,
    /** Cannot be unticked: a deduction, or a before-tax row inside the lines (D70). */
    locked: c.kind === 'IN_LINES' || c.sign < 0,
    manual: c.manual,
    typed: c.typed,
    onBill: sg(b.onBill.amount),
    onBillGst: sg(gst(b.onBill)),
    backBefore: sg(b.backBefore.amount),
    cap: sg(c.cap),
    proposed: sg(c.proposed),
    backNow: sg(c.back.amount),
    gst: {
      cgst: sg(c.back.cgst),
      sgst: sg(c.back.sgst),
      igst: sg(c.back.igst),
      cess: sg(c.back.cess),
    },
    net: sg(c.back.amount.plus(gst(c.back))),
    /** IN_LINES rows are already inside the goods; only CARRIED rows add to the note. */
    inCreditNote: c.kind === 'CARRIED',
    takesRemainder: c.takesRemainder,
  };
}

export function totalsJson(t: ReturnTotals): Record<string, unknown> {
  return {
    gross: n(t.gross),
    discount: n(t.discAmt),
    goods: n(t.goods),
    taxable: n(t.taxable),
    cgst: n(t.cgst),
    sgst: n(t.sgst),
    igst: n(t.igst),
    cess: n(t.cess),
    acess: n(t.acess),
    tax: n(t.tax),
    chargesNet: n(t.chargesNet),
    cashDisc: n(t.cashDisc),
    roundOff: n(t.roundOff),
    creditNote: n(t.creditNote),
    qty: n(t.qty),
    weight: n(t.weight),
    cogs: n(t.cogs),
    takesBillRoundOff: t.takesBillRoundOff,
  };
}

/**
 * `/validate`'s `preview` (§6.2). The P2b blocks — loyalty / points / voucher,
 * the promotion check, the customer balance, settlement and approvals — are
 * named here and answered null / [] until P2b fills them.
 */
export function previewOf(
  m: ReturnMoney,
  items: readonly DocRow[],
  /** srReturnKind = CLAIM: the claim's buckets, and a DESTROYED line brings nothing (D23). */
  claim = false,
): Record<string, unknown> {
  const buckets = new Map<string, { bucket: string; qtyBase: Dec; lines: number }>();
  m.lines.forEach((l, i) => {
    if (l.qtyBase.lte(0) || l.copy?.isService || !bringsStock(items[i], claim)) {
      return;
    }
    const bucket = lineBucketOf(items[i], claim);
    const b = buckets.get(bucket) ?? { bucket, qtyBase: ZERO, lines: 0 };
    b.qtyBase = b.qtyBase.plus(l.qtyBase);
    b.lines += 1;
    buckets.set(bucket, b);
  });
  const billLineById = new Map(m.billLines.map((l) => [l.billItemId, l]));
  return {
    lines: m.lines.map(lineJson),
    totals: totalsJson(m.totals),
    charges: m.charges.map(chargeJson),
    emptiesBill: m.emptiesBill,
    onOtherDrafts: [...m.drafts.entries()].map(([billItemId, h]) => {
      const bl = billLineById.get(billItemId);
      return {
        billItemId,
        qtyBase: n(h.base),
        qty: bl ? n(r3(h.base.dividedBy(bl.factor))) : n(h.base),
        refnos: h.refnos,
      };
    }),
    stockByBucket: [...buckets.values()].map((b) => ({
      bucket: b.bucket,
      qtyBase: n(b.qtyBase),
      lines: b.lines,
    })),
    // P2b — filled by the settlement / points / gate phase.
    loyaltyReverse: null,
    pointsBack: null,
    voucherShare: null,
    agentCommBack: null,
    promoCheck: [],
    customerBalance: null,
    settlement: null,
    approvals: [],
  };
}

/** `/bill-lines` (§6.2): the bill, every line with what is left, every charge row. */
export function billLinesJson(input: {
  bill: BillHeaderFacts;
  lines: BillLineView[];
  prior: Map<string, PriorBack>;
  drafts: Map<string, DraftHold>;
  itemUnits: Map<string, UnitRow[]>;
  barcodes: Map<string, { code: string; itemUnitId: string | null }[]>;
  charges: Record<string, unknown>[];
  tenders: BillTenderFacts;
  due: Dec;
  receivedLater: Dec;
  refundCap: Dec;
}): Record<string, unknown> {
  const b = input.bill;
  return {
    bill: {
      sbId: b.sbId,
      accYear: b.accYear,
      refno: b.refno,
      date: b.date,
      mode: b.billType,
      billMode: b.billMode,
      payMode: b.payMode,
      branchId: b.branchId,
      status: b.status,
      billAmount: n(b.billAmt),
      due: n(input.due),
      returnedAmt: n(b.returnedAmt),
      returnStatus: b.returnStatus,
      custId: b.custId,
      custName: b.custName,
      posStcd: b.posStcd,
      priceLevel: b.priceLevel,
      salesmanIds: b.salesmanIds,
      loadmanIds: b.loadmanIds,
      agentId: b.agentId,
      supervisorId: b.supervisorId,
      driverId: b.driverId,
      vehicleId: b.vehicleId,
      vehicleNo: b.vehicleNo,
      hasFreight: b.hasFreight,
      hasLoad: b.hasLoad,
      hasUnload: b.hasUnload,
      freightCalcType: b.freightCalcType,
      loadingCalcType: b.loadingCalcType,
      roundOff: n(b.roundOff),
      roundOffStep: n(b.roundOffStep),
      tenders: {
        money: n(input.tenders.money),
        points: n(input.tenders.points),
        pointsRate: input.tenders.pointsUnits.gt(0)
          ? n(r4(input.tenders.points.dividedBy(input.tenders.pointsUnits)))
          : null,
        voucher: n(input.tenders.voucher),
        credit: n(input.tenders.credit),
      },
      receivedLater: n(input.receivedLater),
      refundCap: n(input.refundCap),
    },
    lines: input.lines.map((l) => {
      const billBase = baseOf(l);
      const back = input.prior.get(l.billItemId)?.base ?? ZERO;
      const left = Prisma.Decimal.max(ZERO, billBase.minus(back));
      const drafts = input.drafts.get(l.billItemId);
      const p = l.parts;
      const pc = l.percent;
      const u = l.perUnit;
      return {
        billItemId: l.billItemId,
        accYear: l.accYear,
        lineNo: l.lineNo,
        itemId: l.itemId,
        itemName: l.itemName,
        hsnCode: l.copy.hsnCode,
        itemUnitId: l.itemUnitId,
        unitName: l.unitName,
        toBaseFactor: n(l.factor),
        units: (input.itemUnits.get(l.itemId) ?? []).map((x) => ({
          itemUnitId: x.itemUnitId,
          unitName: x.unitName,
          // The bill's own unit converts by the line's own factor (D68).
          toBaseFactor: n(x.itemUnitId === l.itemUnitId ? l.factor : x.factor),
          isBase: x.isBase,
        })),
        billQty: n(l.qty),
        billQtyBase: n(billBase),
        returnedQtyBase: n(back),
        qtyLeftBase: n(left),
        qtyLeft: n(r3(left.dividedBy(l.factor))),
        onOtherDraftsBase: n(drafts?.base ?? ZERO),
        onOtherDraftsRefnos: drafts?.refnos ?? [],
        fullyReturned: left.lte(0),
        isTaxIncl: l.copy.isTaxIncl,
        rate: n(u.rate),
        ratePreTax: n(u.ratePreTax),
        priceLevel: l.copy.priceLevel,
        itemDisc: { perc: n(pc.itemDiscPerc), qty: n(u.itemDiscQty), amt: n(p.itemDiscAmt) },
        splDisc: { perc: n(pc.splDiscPerc), qty: n(u.splDiscQty), amt: n(p.splDiscAmt) },
        schDisc: { perc: n(pc.schDiscPerc), qty: n(u.schDiscQty), amt: n(p.schDiscAmt) },
        billSch: { perc: n(pc.billSchPerc), qty: n(u.billSchQty), amt: n(p.billSchAmt) },
        addlDisc1: { perc: n(pc.addlDisc1Perc), amt: n(p.addlDisc1Amt) },
        addlDisc2: { perc: n(pc.addlDisc2Perc), amt: n(p.addlDisc2Amt) },
        cashDisc: { perc: n(pc.cashDiscPerc), amt: n(p.cashDiscAmt) },
        grossAmt: n(p.grossAmt),
        netGross: n(p.netGross),
        chrgBeforeTax: n(p.chrgBeforeTax),
        chrgAfterTax: n(l.chrgAfterTax),
        taxableAmt: n(p.taxableAmt),
        taxId: l.copy.taxId,
        taxPerc: n(pc.taxPerc),
        cgst: { perc: n(pc.cgstPerc), amt: n(p.cgstAmt) },
        sgst: { perc: n(pc.sgstPerc), amt: n(p.sgstAmt) },
        igst: { perc: n(pc.igstPerc), amt: n(p.igstAmt) },
        cess: { perc: n(pc.cessPerc), perUnit: n(u.cessPerUnit), amt: n(p.cessAmt) },
        acess: { perc: n(pc.acessPerc), perUnit: n(u.acessPerUnit), amt: n(p.acessAmt) },
        netAmt: n(l.netAmt),
        weightQty: n(p.weightQty),
        costPerBase:
          p.cogsAmt.gt(0) && billBase.gt(0) ? n(r6(p.cogsAmt.dividedBy(billBase))) : null,
        lotId: l.copy.lotId,
        batchNo: l.copy.batchNo ?? l.lotBatchNo,
        expiryDate: l.copy.expiryDate ?? l.lotExpiry,
        lotBarcode: l.lotBatchNo ?? l.copy.batchNo,
        eanCode: l.copy.eanCode,
        barcodes: input.barcodes.get(l.itemId) ?? [],
        godownId: l.godownId,
        isFree: l.copy.isFree,
        freeType: l.copy.freeType,
        schemeId: l.copy.schemeId,
        schemeName: l.copy.schemeName,
        salesmanId: l.copy.salesmanId,
        unitWeight: n(l.unitWeight),
        allowReturn: l.allowReturn,
      };
    }),
    charges: input.charges,
  };
}

export { chargeJson };
