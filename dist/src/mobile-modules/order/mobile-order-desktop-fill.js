"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESKTOP_ORDER_SETTING_KEYS = void 0;
exports.lineFactsOf = lineFactsOf;
exports.withDesktopLineFigures = withDesktopLineFigures;
exports.withDesktopHeaderFigures = withDesktopHeaderFigures;
const client_1 = require("@prisma/client");
function lineFactsOf(answer) {
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
exports.DESKTOP_ORDER_SETTING_KEYS = [
    'sales.freight_calc_type',
    'sales.loading_calc_type',
    'sales.disc_alter_base_rate',
    'sales.round_off_step',
    'sales.default_delivery_mode',
];
const DELIVERY_MODES = [
    'STORE_PICKUP',
    'HOME_DELIVERY',
    'SHIP_FROM_STORE',
    'COURIER',
    'TRANSPORT',
];
const sent = (value) => value !== undefined && value !== null && value !== '';
const dec = (value) => new client_1.Prisma.Decimal(sent(value) ? value : 0);
const round = (value, places) => value.toDecimalPlaces(places, client_1.Prisma.Decimal.ROUND_HALF_UP).toNumber();
const netQtyOf = (line) => dec(sent(line.soiNetQty) ? line.soiNetQty : line.soiOrderQty);
function withDesktopLineFigures(line, facts) {
    const out = { ...line };
    const fill = (key, value) => {
        if (!sent(out[key]) && value !== undefined)
            out[key] = value;
    };
    fill('soiIsRateLocked', false);
    if (facts) {
        fill('soiActPrice', facts.actPrice);
        fill('soiCostPrice', facts.costPrice);
        fill('soiCostPreTax', facts.costPreTax);
        fill('soiMaxPrice', facts.maxPrice);
        fill('soiMinPrice', facts.minPrice);
        fill('soiEanCode', facts.eanCode);
        fill('soiHsnCode', facts.hsnCode);
        fill('soiWeightQty', facts.weight);
        if (facts.availableStock !== null) {
            fill('soiAvailableStock', round(dec(facts.availableStock), 3));
        }
        fill('soiHasFreight', facts.hasFreight);
        fill('soiIsService', facts.isService);
    }
    const netQty = netQtyOf(out);
    const rate = dec(out.soiRate);
    const taxPerc = dec(out.soiTaxPerc);
    const cessPerc = dec(out.soiCessPerc);
    const cessPerUnit = dec(out.soiCessPerUnit);
    const tax = dec(out.soiTaxAmt).plus(dec(out.soiCessAmt));
    const net = dec(out.soiNetAmt);
    const taxable = sent(out.soiTaxableAmt)
        ? dec(out.soiTaxableAmt)
        : net.minus(tax).minus(dec(out.soiFreightAmt)).minus(dec(out.soiLoadAmt));
    const ratePreTax = out.soiIsTaxIncl
        ? rate.minus(cessPerUnit).div(taxPerc.plus(cessPerc).div(100).plus(1))
        : rate;
    fill('soiRatePreTax', round(ratePreTax, 4));
    if (sent(out.soiActPrice)) {
        const actPrice = dec(out.soiActPrice);
        fill('soiRateDiff', (actPrice.gt(0) ? round(rate.minus(actPrice), 4) : 0));
    }
    fill('soiNetGross', round(taxable, 4));
    fill('soiChrgBeforeTax', 0);
    fill('soiChrgAfterTax', round(net.minus(taxable).minus(tax), 4));
    const sold = netQty.gt(0) ? net.div(netQty) : new client_1.Prisma.Decimal(0);
    const soldPreTax = netQty.gt(0) ? taxable.div(netQty) : new client_1.Prisma.Decimal(0);
    fill('soiSoldPrice', round(sold, 4));
    fill('soiSoldPreTax', round(soldPreTax, 2));
    if (sent(out.soiCostPrice)) {
        fill('soiItemProfit', round(sold.minus(dec(out.soiCostPrice)), 2));
    }
    if (sent(out.soiCostPreTax)) {
        fill('soiProfitPreTax', round(soldPreTax.minus(dec(out.soiCostPreTax)), 2));
    }
    const mrp = dec(out.soiMaxPrice);
    const savingsPerc = mrp.gt(0) ? mrp.minus(sold).div(mrp).mul(100) : new client_1.Prisma.Decimal(0);
    const savings = mrp.gt(0) ? mrp.minus(sold).mul(netQty) : new client_1.Prisma.Decimal(0);
    fill('soiMrpSavingsPerc', round(savingsPerc, 2));
    fill('soiMrpSavings', round(savings, 3));
    return out;
}
const settingText = (values, key) => {
    const value = values.get(key);
    return value === null || value === undefined || value === '' ? undefined : value;
};
function withDesktopHeaderFigures(header, lines, customer, settings) {
    const out = { ...header };
    const fill = (key, value) => {
        if (!sent(out[key]) && value !== undefined && value !== null)
            out[key] = value;
    };
    if (customer) {
        fill('soCustGstType', customer.gstType);
        fill('soCustStcd', customer.stateCode);
        fill('soPosStcd', customer.posStateCode);
        fill('soStateName', customer.posStateName);
    }
    fill('soAgentCommPerc', 0);
    fill('soAgentCommAmt', 0);
    fill('soFreightCalcType', settingText(settings, 'sales.freight_calc_type'));
    fill('soLoadingCalcType', settingText(settings, 'sales.loading_calc_type'));
    const discAlter = settingText(settings, 'sales.disc_alter_base_rate');
    if (discAlter !== undefined) {
        fill('soDiscAlterBase', ['true', '1', 'y', 'yes'].includes(discAlter.toLowerCase()));
    }
    const step = settingText(settings, 'sales.round_off_step');
    if (step !== undefined && Number.isFinite(Number(step))) {
        fill('soRoundOffStep', Number(step));
    }
    const deliveryMode = settingText(settings, 'sales.default_delivery_mode');
    if (deliveryMode !== undefined && DELIVERY_MODES.includes(deliveryMode)) {
        fill('soDeliveryMode', deliveryMode);
    }
    let totalCost = new client_1.Prisma.Decimal(0);
    let margin = new client_1.Prisma.Decimal(0);
    let gross = new client_1.Prisma.Decimal(0);
    let savings = new client_1.Prisma.Decimal(0);
    let mrpValue = new client_1.Prisma.Decimal(0);
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
        fill('soTotalCost', round(totalCost, 2));
        fill('soMarginAmt', round(margin, 2));
        fill('soMarginPerc', (gross.gt(0) ? round(margin.div(gross).mul(100), 2) : 0));
    }
    fill('soMrpSavings', round(savings, 3));
    fill('soMrpSavingsPerc', (mrpValue.gt(0) ? round(savings.div(mrpValue).mul(100), 2) : 0));
    return out;
}
//# sourceMappingURL=mobile-order-desktop-fill.js.map