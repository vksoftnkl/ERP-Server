import { Prisma } from '@prisma/client';
import type { DeliveryEventKind } from './delivery.constants';

/**
 * Plan §5 / §7.3 — the signed quantities each event kind carries, exactly as
 * ck_sde_signs demands (one row's own arithmetic):
 *
 *   GIVEN, CLEANUP         settle +q   out +q   (goods left the godown)
 *   CANCEL, GOODS_BACK     settle −q   out −q   (they did not / came back)
 *   RETURN                 settle +u   out 0    (sale return of goods never taken)
 *   RETURN_CANCEL          settle −u   out 0
 *
 * `qty` / `base` are the magnitudes (> 0). Every reader sums the columns, so
 * BND = billed − Σ settle and "given" = Σ out, whatever the kinds.
 */
export interface DeliveryEventQty {
  settleQty: Prisma.Decimal;
  settleBaseQty: Prisma.Decimal;
  outQty: Prisma.Decimal;
  outBaseQty: Prisma.Decimal;
}

const Z = new Prisma.Decimal(0);

export function deliveryEventQty(
  kind: DeliveryEventKind,
  qty: Prisma.Decimal,
  base: Prisma.Decimal,
): DeliveryEventQty {
  if (!qty.greaterThan(0) || !base.greaterThan(0)) {
    throw new Error(`deliveryEventQty: ${kind} needs a positive qty (got ${qty.toString()} / ${base.toString()})`);
  }
  switch (kind) {
    case 'GIVEN':
    case 'CLEANUP':
      return { settleQty: qty, settleBaseQty: base, outQty: qty, outBaseQty: base };
    case 'CANCEL':
    case 'GOODS_BACK':
      return {
        settleQty: qty.negated(),
        settleBaseQty: base.negated(),
        outQty: qty.negated(),
        outBaseQty: base.negated(),
      };
    case 'RETURN':
      return { settleQty: qty, settleBaseQty: base, outQty: Z, outBaseQty: Z };
    case 'RETURN_CANCEL':
      return { settleQty: qty.negated(), settleBaseQty: base.negated(), outQty: Z, outBaseQty: Z };
  }
}

/** One bill line's figures from its events (§5.1): settled, given, pending. */
export function lineFigures(
  billed: Prisma.Decimal,
  events: readonly Pick<DeliveryEventQty, 'settleQty' | 'outQty'>[],
): { settled: Prisma.Decimal; given: Prisma.Decimal; pending: Prisma.Decimal } {
  const settled = events.reduce((a, e) => a.plus(e.settleQty), Z);
  const given = events.reduce((a, e) => a.plus(e.outQty), Z);
  return { settled, given, pending: billed.minus(settled) };
}
