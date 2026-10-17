import type { PriceLevel, SellingPriceLevelValue } from './types/selling-price-bulk.types';

/** The stored columns are Decimal(18,6); rounding here keeps 0.1+0.2 out of them. */
const SCALE = 6;

function round(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** SCALE;
  return Math.round(value * factor) / factor;
}

/** price ÷ (1 + tax). Guarded, because a −100% tax would divide by zero. */
export function exclusiveOfTax(withTax: number, taxPerc: number): number {
  const divisor = 1 + taxPerc / 100;
  return divisor <= 0 ? round(withTax) : round(withTax / divisor);
}

/**
 * §5.1 — the server's recompute of the three derived numbers from `price`.
 *
 * WHY THE SERVER DOES THIS AT ALL, when §7 puts the four-number panel firmly in
 * the client: four numbers that must agree, arriving over a network from a
 * grid, are four numbers that can arrive disagreeing — a stale cell, a race
 * between the delegate's commit and the save, an older client build. The rule
 * that resolves it has to be a rule, not a judgement:
 *
 *   `price` WINS, ALWAYS. The other three are derivations of it.
 *
 * Which of the four the user actually typed is not knowable server-side, so the
 * client is responsible for having put the user's intent into `price` before it
 * posts. That is the whole contract, and it is why the panel can stay on the
 * client without the two implementations drifting: there is only one of them —
 * the client's — and the server never re-derives `price` from anything.
 *
 * The two ratios use DIFFERENT pairs, and the asymmetry is deliberate (§7):
 *   markup — (price − cost) ÷ cost, on the tax-INCLUSIVE pair
 *   margin — (priceWot − costWot) ÷ priceWot, on the tax-EXCLUSIVE pair
 *
 * `roundOff` is NOT applied here. It is stored and echoed back so the client's
 * price-with-tax step can apply it, and its unit — decimal places, or a nearest
 * multiple — is not settled in this repo. Inventing a rounding semantic on the
 * write path would round prices the operator had already rounded, differently.
 *
 * @param costRate the cost INCLUSIVE of tax, i.e. the ipm_cost_price half of
 *                 the (cost_price, cost_wot) pair. 0 means "no cost known", and
 *                 both ratios come back 0 rather than Infinity.
 */
export function recomputeLevel(
  level: PriceLevel,
  price: number,
  taxPerc: number,
  costRate: number,
): SellingPriceLevelValue {
  const priceWithTax = round(price);
  const priceWot = exclusiveOfTax(priceWithTax, taxPerc);
  const costWot = exclusiveOfTax(costRate, taxPerc);
  return {
    level,
    price: priceWithTax,
    priceWot,
    // BOTH ratios are gated on the COST, not on the price. Margin's own
    // formula divides by priceWot, so a cost of 0 would compute cleanly and
    // report 100% — an item whose cost is merely unknown would show the best
    // margin on the screen. 0 is the honest answer to "we do not know".
    markupPerc: costRate > 0 ? round(((priceWithTax - costRate) / costRate) * 100) : 0,
    marginPerc: costRate > 0 && priceWot > 0 ? round(((priceWot - costWot) / priceWot) * 100) : 0,
  };
}
