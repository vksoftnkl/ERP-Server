import { Prisma } from '@prisma/client';
import type { ItemPriceLookupPayload } from '../../modules/master-lookup/types/master-lookup-api.types';
import type { SaveSaleOrderDto } from '../../modules/sales/sale-order/dto/save-sale-order.dto';
import type { SaveSaleOrderItemDto } from '../../modules/sales/sale-order/dto/save-sale-order-item.dto';

/**
 * What the desktop order screen works out and sends with every order, and the
 * phone does not (user, 2026-11-20: "order creation should work like the Qt
 * desktop application"), so a phone order reads, reports and bills like one
 * keyed on the desktop. Mirrors NexERP sale_order_entry.cpp:
 *  - fetchItemPrice: the /master-lookups/item-price answer onto the line (base
 *    price, cost, MRP / min, freight and service flags, barcode, weight, stock);
 *  - priceRowStandard + finalizeRowWithCharges: the per-unit outcome (pre-tax
 *    rate, net gross, sold price, profit, MRP saving);
 *  - recalcDocumentTotals: total cost, margin, MRP savings;
 *  - buildSaveHeaderPayload: the customer's GST snapshot, the pricing policy
 *    and the delivery mode the company's settings give.
 *
 * FILL ONLY: a key the phone sent is kept. The phone's money (rate, discount,
 * taxable, GST, net) is what the salesman agreed with the shop, so nothing here
 * re-prices a line; the figures are derived from it.
 */

type Num = string | number | null | undefined;
type Line = Omit<
  SaveSaleOrderItemDto,
  | 'soiId'
  | 'soiOrderId'
  | 'soiCompanyId'
  | 'soiBranchId'
  | 'soiTenantId'
  | 'soiAccYear'
  | 'soiCreatedBy'
  | 'soiModifiedBy'
>;

/** What the desktop's pick copies off the item-price lookup onto a line. */
export interface DesktopLineFacts {
  /** sales_price: the level's price (customer rate applied), before any typed change. */
  actPrice: number;
  costPrice: number;
  costPreTax: number;
  maxPrice: number;
  minPrice: number;
  hasFreight: boolean;
  isService: boolean;
  eanCode: string | null;
  /** item_hsn_code (the lookup's hsn_code). */
  hsnCode: string | null;
  /** iuc_uom_weight, per unit, as the desktop sends it. */
  weight: number;
  /** Stock in the line's godown, BASE unit; null = no stock record. */
  availableStock: number | null;
}

export function lineFactsOf(answer: ItemPriceLookupPayload): DesktopLineFacts {
  return {
    actPrice: answer.sales_price,
    costPrice: answer.cost_price,
    costPreTax: answer.cost_wot,
    maxPrice: answer.max_price,
    minPrice: answer.min_price,
    hasFreight: answer.add_freight,
    isService: answer.service_item === 'Y',
    eanCode: answer.barcode,
    hsnCode: answer.hsn_code,
    weight: answer.iuc_uom_weight,
    availableStock: answer.stock,
  };
}

/** The customer columns the desktop snapshots on the order header. */
export interface DesktopCustomerFacts {
  gstType: string | null;
  /** cus_state_code as the customer holds it (soCustStcd has no FK). */
  stateCode: string | null;
  /** The same state when fixed.state_codes has it (soPosStcd's FK), else null. */
  posStateCode: string | null;
  posStateName: string | null;
}

/** The company settings the desktop stamps on every order (AppSession). */
export const DESKTOP_ORDER_SETTING_KEYS = [
  'sales.freight_calc_type',
  'sales.loading_calc_type',
  'sales.disc_alter_base_rate',
  'sales.round_off_step',
  'sales.default_delivery_mode',
] as const;

/** ck_so_delivery_mode. */
const DELIVERY_MODES: readonly string[] = [
  'STORE_PICKUP',
  'HOME_DELIVERY',
  'SHIP_FROM_STORE',
  'COURIER',
  'TRANSPORT',
];

const sent = (value: unknown): boolean => value !== undefined && value !== null && value !== '';
const dec = (value: Num): Prisma.Decimal =>
  new Prisma.Decimal(sent(value) ? (value as string | number) : 0);
const round = (value: Prisma.Decimal, places: number): number =>
  value.toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP).toNumber();

/** The line's billable qty, as the desktop's NetQty. */
const netQtyOf = (line: Line): Prisma.Decimal =>
  dec(sent(line.soiNetQty) ? line.soiNetQty : line.soiOrderQty);

/**
 * One phone line with what the desktop would have sent beside it. `facts` is
 * the item-price lookup's answer for the line (null when the lookup could not
 * price it: only what the line's own money gives is filled then).
 */
export function withDesktopLineFigures<T extends Line>(line: T, facts: DesktopLineFacts | null): T {
  const out: T = { ...line };
  const fill = <K extends keyof T>(key: K, value: T[K] | undefined) => {
    if (!sent(out[key]) && value !== undefined) out[key] = value;
  };

  // No rate-lock control on the desktop screen: a new line is not locked, so
  // the bill may re-price it at delivery.
  fill('soiIsRateLocked', false as T['soiIsRateLocked']);

  if (facts) {
    fill('soiActPrice', facts.actPrice as T['soiActPrice']);
    fill('soiCostPrice', facts.costPrice as T['soiCostPrice']);
    fill('soiCostPreTax', facts.costPreTax as T['soiCostPreTax']);
    fill('soiMaxPrice', facts.maxPrice as T['soiMaxPrice']);
    fill('soiMinPrice', facts.minPrice as T['soiMinPrice']);
    fill('soiEanCode', facts.eanCode as T['soiEanCode']);
    fill('soiHsnCode', facts.hsnCode as T['soiHsnCode']);
    fill('soiWeightQty', facts.weight as T['soiWeightQty']);
    if (facts.availableStock !== null) {
      fill('soiAvailableStock', round(dec(facts.availableStock), 3) as T['soiAvailableStock']);
    }
    fill('soiHasFreight', facts.hasFreight as T['soiHasFreight']);
    fill('soiIsService', facts.isService as T['soiIsService']);
  }

  const netQty = netQtyOf(out);
  const rate = dec(out.soiRate);
  const taxPerc = dec(out.soiTaxPerc);
  const cessPerc = dec(out.soiCessPerc);
  const cessPerUnit = dec(out.soiCessPerUnit);
  const tax = dec(out.soiTaxAmt).plus(dec(out.soiCessAmt));
  const net = dec(out.soiNetAmt);
  // The phone's taxable; an order saved before the phone kept one: what the
  // net holds besides the tax and the charges.
  const taxable = sent(out.soiTaxableAmt)
    ? dec(out.soiTaxableAmt)
    : net.minus(tax).minus(dec(out.soiFreightAmt)).minus(dec(out.soiLoadAmt));

  // priceRowStandard: the rate before tax.
  const ratePreTax = out.soiIsTaxIncl
    ? rate.minus(cessPerUnit).div(taxPerc.plus(cessPerc).div(100).plus(1))
    : rate;
  fill('soiRatePreTax', round(ratePreTax, 4) as T['soiRatePreTax']);
  // The desktop's RateDiff: how far the rate moved off the lookup's price.
  if (sent(out.soiActPrice)) {
    const actPrice = dec(out.soiActPrice);
    fill('soiRateDiff', (actPrice.gt(0) ? round(rate.minus(actPrice), 4) : 0) as T['soiRateDiff']);
  }

  // finalizeRowWithCharges: taxable = net gross + before-tax charges (none on
  // a phone line); total = taxable + tax + after-tax charges, so the phone's
  // freight and loading are the after-tax charge.
  fill('soiNetGross', round(taxable, 4) as T['soiNetGross']);
  fill('soiChrgBeforeTax', 0 as T['soiChrgBeforeTax']);
  fill('soiChrgAfterTax', round(net.minus(taxable).minus(tax), 4) as T['soiChrgAfterTax']);

  const sold = netQty.gt(0) ? net.div(netQty) : new Prisma.Decimal(0);
  const soldPreTax = netQty.gt(0) ? taxable.div(netQty) : new Prisma.Decimal(0);
  fill('soiSoldPrice', round(sold, 4) as T['soiSoldPrice']);
  fill('soiSoldPreTax', round(soldPreTax, 2) as T['soiSoldPreTax']);

  if (sent(out.soiCostPrice)) {
    fill('soiItemProfit', round(sold.minus(dec(out.soiCostPrice)), 2) as T['soiItemProfit']);
  }
  if (sent(out.soiCostPreTax)) {
    fill(
      'soiProfitPreTax',
      round(soldPreTax.minus(dec(out.soiCostPreTax)), 2) as T['soiProfitPreTax'],
    );
  }

  const mrp = dec(out.soiMaxPrice);
  const savingsPerc = mrp.gt(0) ? mrp.minus(sold).div(mrp).mul(100) : new Prisma.Decimal(0);
  const savings = mrp.gt(0) ? mrp.minus(sold).mul(netQty) : new Prisma.Decimal(0);
  fill('soiMrpSavingsPerc', round(savingsPerc, 2) as T['soiMrpSavingsPerc']);
  fill('soiMrpSavings', round(savings, 3) as T['soiMrpSavings']);
  return out;
}

/** A setting's text, or undefined when the company has none (the order column's default then). */
const settingText = (values: ReadonlyMap<string, string | null>, key: string) => {
  const value = values.get(key);
  return value === null || value === undefined || value === '' ? undefined : value;
};

/**
 * The header with what the desktop sends beside the phone's: the customer's
 * GST snapshot, the pricing policy and delivery mode of the company's settings,
 * no agent commission, and the cost / margin / MRP-savings roll-ups of `lines`
 * (already through withDesktopLineFigures).
 */
export function withDesktopHeaderFigures<T extends Partial<SaveSaleOrderDto>>(
  header: T,
  lines: readonly Line[],
  customer: DesktopCustomerFacts | null,
  settings: ReadonlyMap<string, string | null>,
): T {
  const out: T = { ...header };
  const fill = <K extends keyof T>(key: K, value: T[K] | undefined) => {
    if (!sent(out[key]) && value !== undefined && value !== null) out[key] = value;
  };

  if (customer) {
    fill('soCustGstType', customer.gstType as T['soCustGstType']);
    // The customer's own state, and the place of supply the desktop seeds from
    // it: its state dropdown, so only a listed state, by the list's name.
    fill('soCustStcd', customer.stateCode as T['soCustStcd']);
    fill('soPosStcd', customer.posStateCode as T['soPosStcd']);
    fill('soStateName', customer.posStateName as T['soStateName']);
  }
  fill('soAgentCommPerc', 0 as T['soAgentCommPerc']);
  fill('soAgentCommAmt', 0 as T['soAgentCommAmt']);

  fill(
    'soFreightCalcType',
    settingText(settings, 'sales.freight_calc_type') as T['soFreightCalcType'],
  );
  fill(
    'soLoadingCalcType',
    settingText(settings, 'sales.loading_calc_type') as T['soLoadingCalcType'],
  );
  const discAlter = settingText(settings, 'sales.disc_alter_base_rate');
  if (discAlter !== undefined) {
    fill(
      'soDiscAlterBase',
      ['true', '1', 'y', 'yes'].includes(discAlter.toLowerCase()) as T['soDiscAlterBase'],
    );
  }
  const step = settingText(settings, 'sales.round_off_step');
  if (step !== undefined && Number.isFinite(Number(step))) {
    fill('soRoundOffStep', Number(step) as T['soRoundOffStep']);
  }
  // The desktop's combo shows only ck_so_delivery_mode's modes; another value
  // leaves the order's own default (STORE_PICKUP).
  const deliveryMode = settingText(settings, 'sales.default_delivery_mode');
  if (deliveryMode !== undefined && DELIVERY_MODES.includes(deliveryMode)) {
    fill('soDeliveryMode', deliveryMode as T['soDeliveryMode']);
  }

  // recalcDocumentTotals.
  let totalCost = new Prisma.Decimal(0);
  let margin = new Prisma.Decimal(0);
  let gross = new Prisma.Decimal(0);
  let savings = new Prisma.Decimal(0);
  let mrpValue = new Prisma.Decimal(0);
  let costKnown = false;
  for (const line of lines) {
    const netQty = netQtyOf(line);
    gross = gross.plus(dec(line.soiGrossAmt));
    if (sent(line.soiCostPrice)) {
      costKnown = true;
      totalCost = totalCost.plus(dec(line.soiCostPrice).mul(netQty));
      margin = margin.plus(dec(line.soiItemProfit).mul(netQty));
    }
    const mrp = dec(line.soiMaxPrice);
    if (mrp.gt(0)) {
      mrpValue = mrpValue.plus(mrp.mul(netQty));
      savings = savings.plus(mrp.minus(dec(line.soiSoldPrice)).mul(netQty));
    }
  }
  if (costKnown) {
    fill('soTotalCost', round(totalCost, 2) as T['soTotalCost']);
    fill('soMarginAmt', round(margin, 2) as T['soMarginAmt']);
    fill(
      'soMarginPerc',
      (gross.gt(0) ? round(margin.div(gross).mul(100), 2) : 0) as T['soMarginPerc'],
    );
  }
  fill('soMrpSavings', round(savings, 3) as T['soMrpSavings']);
  fill(
    'soMrpSavingsPerc',
    (mrpValue.gt(0) ? round(savings.div(mrpValue).mul(100), 2) : 0) as T['soMrpSavingsPerc'],
  );
  return out;
}
