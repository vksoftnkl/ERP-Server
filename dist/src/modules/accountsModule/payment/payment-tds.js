"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPaymentTdsFacts = loadPaymentTdsFacts;
exports.computePaymentTds = computePaymentTds;
const client_1 = require("@prisma/client");
const voucher_facts_1 = require("../vouchers/voucher-facts");
const voucher_derive_1 = require("../vouchers/voucher-derive");
const receipt_utils_1 = require("../receipt/receipt.utils");
async function loadPaymentTdsFacts(tx, params) {
    const { party } = params;
    if (!party.ledIsTdsApplicable || !party.ledTdsSection) {
        return null;
    }
    const [rate, annualBaseSoFar] = await Promise.all([
        (0, voucher_facts_1.loadTdsRate)(tx, params.companyId, party.ledTdsSection, party.ledTdsDeducteeType, params.date),
        (0, voucher_facts_1.loadTdsAnnualBase)(tx, params.companyId, party.ledId, params.accYear, party.ledTdsSection),
    ]);
    return { rate, annualBaseSoFar };
}
function computePaymentTds(party, facts, net) {
    const rate = facts.rate;
    const section = party.ledTdsSection ?? '';
    if (!rate || !section) {
        return null;
    }
    const pct = party.ledPanNo ? rate.rate : rate.noPanRate;
    const rateSource = party.ledPanNo ? 'MASTER' : 'NO_PAN';
    const netMoney = (0, receipt_utils_1.money)(net);
    let base;
    let tax;
    if (!pct.isZero()) {
        base = (0, receipt_utils_1.money)(netMoney.div(new client_1.Prisma.Decimal(1).minus(pct.div(100))));
        tax = base.minus(netMoney);
    }
    else {
        base = netMoney;
        tax = receipt_utils_1.ZERO;
    }
    const cumulative = facts.annualBaseSoFar.plus(base);
    const deduct = crossesTdsThreshold(base, cumulative, rate);
    const common = {
        section,
        sectionName: rate.sectionName,
        deducteeType: party.ledTdsDeducteeType ?? rate.deducteeType,
        registerDeductee: (0, voucher_derive_1.registerDeductee)(party.ledTdsDeducteeType),
        rate: pct,
    };
    if (!deduct || tax.lessThanOrEqualTo(0)) {
        return {
            ...common,
            rateSource: 'BELOW_THRESHOLD',
            base: netMoney,
            tax: receipt_utils_1.ZERO,
            deducted: false,
            reason: netMoney.isZero()
                ? 'nothing is paid to the party'
                : `${netMoney.toFixed(2)} is within the ${section} threshold (single ${rate.thresholdSingle.toFixed(2)}, ` +
                    `annual ${rate.thresholdAnnual.toFixed(2)}; ${facts.annualBaseSoFar.toFixed(2)} so far this year)`,
        };
    }
    return { ...common, rateSource, base, tax, deducted: true, reason: null };
}
function crossesTdsThreshold(base, cumulative, rate) {
    const single = rate.thresholdSingle;
    const annual = rate.thresholdAnnual;
    return (base.greaterThan(0) &&
        ((single.isZero() && annual.isZero()) ||
            (single.greaterThan(0) && base.greaterThan(single)) ||
            (annual.greaterThan(0) && cumulative.greaterThan(annual))));
}
//# sourceMappingURL=payment-tds.js.map