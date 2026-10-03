import { Prisma } from '@prisma/client';
import { loadTdsAnnualBase, loadTdsRate, type TdsRateFacts } from '../vouchers/voucher-facts';
import { registerDeductee } from '../vouchers/voucher-derive';
import { money, ZERO } from '../receipt/receipt.utils';
import type { PaymentParty } from './payment.guards';

/**
 * §5.2 — TDS on a payment, SEEDED server-side from the same lookup the Voucher
 * Register's PmtV uses (`accounts.tds_rates`, section × deductee × date, the
 * company's row over the shared one), so the two screens cannot disagree.
 *
 * The operator keys the NET the bank pays. The deduction is on the GROSS, so
 * the base is grossed up — `net / (1 − rate)` — exactly as voucher-derive.ts
 * does for a payment-shaped type, and the tax is the difference. The party is
 * discharged of the gross: the TDS line is a CR deduction that settles its
 * share of the bills without leaving as money, and a remainder is an advance
 * on the gross (rev 1 P5).
 */

export interface PaymentTdsFacts {
  rate: TdsRateFacts | null;
  annualBaseSoFar: Prisma.Decimal;
}

export interface PaymentTdsComputed {
  section: string;
  sectionName: string;
  deducteeType: string;
  registerDeductee: 'COMPANY' | 'NON_COMPANY';
  rate: Prisma.Decimal;
  rateSource: 'MASTER' | 'NO_PAN' | 'BELOW_THRESHOLD';
  base: Prisma.Decimal;
  tax: Prisma.Decimal;
  deducted: boolean;
  reason: string | null;
}

/** The rate in force and what has already been deducted this year. Null when the party is not TDS-applicable. */
export async function loadPaymentTdsFacts(
  tx: Prisma.TransactionClient,
  params: { companyId: string; party: PaymentParty; accYear: string; date: string },
): Promise<PaymentTdsFacts | null> {
  const { party } = params;
  if (!party.ledIsTdsApplicable || !party.ledTdsSection) {
    return null;
  }
  const [rate, annualBaseSoFar] = await Promise.all([
    loadTdsRate(tx, params.companyId, party.ledTdsSection, party.ledTdsDeducteeType, params.date),
    loadTdsAnnualBase(tx, params.companyId, party.ledId, params.accYear, party.ledTdsSection),
  ]);
  return { rate, annualBaseSoFar };
}

/**
 * What the deduction on a payment of `net` to the party comes to. Null when
 * nothing is deducted for want of a rate (the caller decides whether that is
 * a refusal); `deducted: false` with a reason when the base is inside the
 * section's thresholds.
 */
export function computePaymentTds(
  party: PaymentParty,
  facts: PaymentTdsFacts,
  net: Prisma.Decimal,
): PaymentTdsComputed | null {
  const rate = facts.rate;
  const section = party.ledTdsSection ?? '';
  if (!rate || !section) {
    return null;
  }
  const pct = party.ledPanNo ? rate.rate : rate.noPanRate;
  const rateSource: 'MASTER' | 'NO_PAN' = party.ledPanNo ? 'MASTER' : 'NO_PAN';
  const netMoney = money(net);
  let base: Prisma.Decimal;
  let tax: Prisma.Decimal;
  if (!pct.isZero()) {
    base = money(netMoney.div(new Prisma.Decimal(1).minus(pct.div(100))));
    tax = base.minus(netMoney);
  } else {
    base = netMoney;
    tax = ZERO;
  }
  const cumulative = facts.annualBaseSoFar.plus(base);
  const deduct = crossesTdsThreshold(base, cumulative, rate);
  const common = {
    section,
    sectionName: rate.sectionName,
    deducteeType: party.ledTdsDeducteeType ?? rate.deducteeType,
    registerDeductee: registerDeductee(party.ledTdsDeducteeType),
    rate: pct,
  };
  if (!deduct || tax.lessThanOrEqualTo(0)) {
    return {
      ...common,
      rateSource: 'BELOW_THRESHOLD',
      base: netMoney,
      tax: ZERO,
      deducted: false,
      reason: netMoney.isZero()
        ? 'nothing is paid to the party'
        : `${netMoney.toFixed(2)} is within the ${section} threshold (single ${rate.thresholdSingle.toFixed(2)}, ` +
          `annual ${rate.thresholdAnnual.toFixed(2)}; ${facts.annualBaseSoFar.toFixed(2)} so far this year)`,
    };
  }
  return { ...common, rateSource, base, tax, deducted: true, reason: null };
}

/** voucher-derive.ts's rule: no thresholds = always; else single OR cumulative annual crossed. */
function crossesTdsThreshold(
  base: Prisma.Decimal,
  cumulative: Prisma.Decimal,
  rate: TdsRateFacts,
): boolean {
  const single = rate.thresholdSingle;
  const annual = rate.thresholdAnnual;
  return (
    base.greaterThan(0) &&
    ((single.isZero() && annual.isZero()) ||
      (single.greaterThan(0) && base.greaterThan(single)) ||
      (annual.greaterThan(0) && cumulative.greaterThan(annual)))
  );
}
