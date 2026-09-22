import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SALES_ERROR_CODES } from './types/posting.types';
import { throwSalesRefused } from './sales.errors';
import type {
  ChargeCarryBasis,
  ChargeCarryProposal,
  ChargeCarryRow,
} from './types/charge-carry.types';

/**
 * §3.8 / flow §7 — one order charge, split across the bills that deliver it.
 *
 * The order holds its charge rows (`cd_doc_type = 'ORDER'`). When a bill takes
 * SOME of the order's lines, each order charge is offered to that bill with a
 * proposed amount, and what the bill actually took is added to the source
 * row's `cd_carried_amt`.
 *
 * ── Why the LAST bill is a special case, and must be ───────────────────────
 *
 * Under PRORATA every bill takes `cd_amount × its share`, ROUNDED. Rounding
 * three shares of ₹100 gives 33.33 + 33.33 + 33.33 = 99.99, and a freight
 * charge that never finishes being recovered is a real complaint. So the bill
 * that COMPLETES the order takes `cd_amount − cd_carried_amt` instead of its
 * share, and the sum closes exactly.
 *
 * ── Over-carry is refused, not recorded ───────────────────────────────────
 *
 * This is the one place in the sales chain where an over-draw IS refused at
 * post, and deliberately: unlike stock or a wallet, two tills cannot each
 * legitimately carry the same charge — the money would be collected twice
 * from one customer. `um_can_override` is the only way past it.
 *
 * ── A DC never carries a charge ───────────────────────────────────────────
 *
 * It has no money on it at all. A bill raised against a DC that came from an
 * order resolves the charge from the ORDER, through the DC line's
 * `sdi_src_doc_id`.
 */
@Injectable()
export class ChargeCarryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * What each of the order's charges would give this bill.
   *
   * A proposal only — nothing is written. `/bills/create` shows these in the
   * charge grid and the operator may overtype any of them, which is what
   * `MANUAL` records.
   */
  async propose(
    tx: Prisma.TransactionClient,
    order: { orderId: string; accYear: string },
    billLines: { srcLineId: string; taxableAmt: number }[],
    opts: { defaultBasis?: ChargeCarryBasis } = {},
  ): Promise<ChargeCarryProposal[]> {
    const charges = await tx.$queryRaw<
      {
        cd_id: string;
        cd_acc_year: string;
        cd_chg_id: string | null;
        cd_chg_name: string | null;
        cd_amount: Prisma.Decimal;
        cd_carried_amt: Prisma.Decimal | null;
        cd_carry_basis: string | null;
      }[]
    >`
      SELECT cd_id, cd_acc_year, cd_chg_id, cd_chg_name,
             cd_amount, cd_carried_amt, cd_carry_basis
        FROM public.txn_charge_detail
       WHERE cd_doc_type  = 'ORDER'
         AND cd_doc_id    = ${order.orderId}::uuid
         AND cd_acc_year  = ${order.accYear}::char(9)
         AND cd_is_deleted = false
       ORDER BY cd_slno`;
    if (charges.length === 0) {
      return [];
    }

    // The order's whole taxable value, and the part this bill is taking.
    const [totals] = await tx.$queryRaw<{ order_taxable: Prisma.Decimal | null }[]>`
      SELECT SUM(soi_taxable_amt) AS order_taxable
        FROM sales.sale_order_item
       WHERE soi_order_id  = ${order.orderId}::uuid
         AND soi_acc_year  = ${order.accYear}::char(9)
         AND soi_is_deleted = false`;
    const orderTaxable = Number(totals?.order_taxable ?? 0);
    const billTaxable = billLines.reduce((s, l) => s + l.taxableAmt, 0);

    // Does this bill finish the order? If it does, PRORATA hands it the
    // remainder rather than its arithmetic share.
    const takenLineIds = billLines.map((l) => l.srcLineId);
    const [open] = await tx.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n
        FROM sales.sale_order_item
       WHERE soi_order_id   = ${order.orderId}::uuid
         AND soi_acc_year   = ${order.accYear}::char(9)
         AND soi_is_deleted = false
         AND NOT (soi_id = ANY(${takenLineIds}::uuid[]))`;
    const completesOrder = Number(open?.n ?? 0) === 0;

    return charges.map((c) => {
      const amount = Number(c.cd_amount);
      const carried = Number(c.cd_carried_amt ?? 0);
      const remaining = round2(amount - carried);
      const basis = (c.cd_carry_basis ?? opts.defaultBasis ?? 'PRORATA') as ChargeCarryBasis;

      let proposed = 0;
      switch (basis) {
        case 'FULL':
          // The first bill takes it all; every later one sees nothing left.
          proposed = remaining;
          break;
        case 'NONE':
        case 'MANUAL':
          // MANUAL means the operator will type it; propose nothing rather
          // than a number they would have to notice and clear.
          proposed = 0;
          break;
        default:
          proposed = completesOrder
            ? remaining
            : Math.min(
                remaining,
                orderTaxable > 0 ? round2((amount * billTaxable) / orderTaxable) : 0,
              );
      }

      return {
        srcChargeId: c.cd_id,
        srcAccYear: c.cd_acc_year,
        chargeId: c.cd_chg_id,
        chargeName: c.cd_chg_name,
        amount,
        alreadyCarried: carried,
        remaining,
        basis,
        proposed: Math.max(0, proposed),
        completesOrder,
      };
    });
  }

  /**
   * Post: add what each bill charge took to its source row's `cd_carried_amt`.
   *
   * The source rows are locked in a stable order (by id) before anything is
   * written. Two bills against one order posting at the same moment would
   * otherwise interleave their read-modify-write and both believe the charge
   * was free to take.
   */
  async consume(
    tx: Prisma.TransactionClient,
    rows: ChargeCarryRow[],
    opts: { canOverride?: boolean } = {},
  ): Promise<number> {
    const carrying = rows.filter((r) => r.srcChargeId && r.amount !== 0);
    if (carrying.length === 0) {
      return 0;
    }
    return this.move(tx, carrying, +1, opts.canOverride ?? false);
  }

  /** Cancel: give it back. The same rows, the other way. */
  async release(tx: Prisma.TransactionClient, rows: ChargeCarryRow[]): Promise<number> {
    const carrying = rows.filter((r) => r.srcChargeId && r.amount !== 0);
    if (carrying.length === 0) {
      return 0;
    }
    // A release can never over-carry, so the guard is off for it.
    return this.move(tx, carrying, -1, true);
  }

  private async move(
    tx: Prisma.TransactionClient,
    rows: ChargeCarryRow[],
    sign: 1 | -1,
    canOverride: boolean,
  ): Promise<number> {
    const ids = [...new Set(rows.map((r) => r.srcChargeId!))].sort();

    // Lock the source rows first, in id order, so two bills against one order
    // cannot interleave. Plain FOR UPDATE: they must serialise, not skip.
    const locked = await tx.$queryRaw<
      { cd_id: string; cd_amount: Prisma.Decimal; cd_carried_amt: Prisma.Decimal | null }[]
    >`
      SELECT cd_id, cd_amount, cd_carried_amt
        FROM public.txn_charge_detail
       WHERE cd_id = ANY(${ids}::uuid[])
       ORDER BY cd_id
         FOR UPDATE`;
    const byId = new Map(locked.map((l) => [l.cd_id, l]));

    // Several bill rows may point at one order charge; net them first so the
    // over-carry test sees the whole move, not each half of it.
    const delta = new Map<string, number>();
    for (const r of rows) {
      delta.set(r.srcChargeId!, round2((delta.get(r.srcChargeId!) ?? 0) + sign * r.amount));
    }

    if (sign > 0 && !canOverride) {
      for (const [id, d] of delta) {
        const src = byId.get(id);
        if (!src) {
          continue;
        }
        const after = round2(Number(src.cd_carried_amt ?? 0) + d);
        if (after > Number(src.cd_amount) + 1e-9) {
          throwSalesRefused(
            `Charge ${id} carries ${after} of an order charge of ${Number(src.cd_amount)} — ` +
              `the difference would be collected twice`,
            SALES_ERROR_CODES.CHARGE_OVER_CARRY,
            'charges',
          );
        }
      }
    }

    let touched = 0;
    for (const [id, d] of delta) {
      touched += await tx.$executeRaw`
        UPDATE public.txn_charge_detail
           SET cd_carried_amt = COALESCE(cd_carried_amt, 0) + ${d.toFixed(2)}::numeric,
               cd_modified_on = now()
         WHERE cd_id = ${id}::uuid`;
    }
    return touched;
  }
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}
