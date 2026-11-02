import { Prisma } from '@prisma/client';
import type { CalcChargeIn } from './purchase-calc';

/**
 * A purchase charge's master row (public.charge_master, module P / B) with its own GST rate, and the ONE
 * place its flags become a calcPurchase input. The bill and the PO both build their charges here, so a
 * charge spreads the same way on both (2026-11-02: the PO applies its charges to the lines "like Sale Entry").
 */
export interface PurchaseChargeMaster {
  chg_id: string; chg_name: string; chg_type: string; chg_method: string; chg_default_rate: Prisma.Decimal | null; chg_cost_alloc: string | null;
  chg_before_tax: boolean; chg_tax_apl: boolean; chg_landing_cost: boolean; chg_on_bill: boolean; chg_ledger_code: string; chg_role: string | null;
  tax_rate_perc: Prisma.Decimal | null; chg_tax_id: string | null;
}

/** The purchase charges named by `ids` (live, module P / B), by chg_id. A missing id is simply absent — the caller words the refusal. */
export async function loadPurchaseChargeMasters(db: { $queryRaw: Prisma.TransactionClient['$queryRaw'] }, ids: string[]): Promise<Map<string, PurchaseChargeMaster>> {
  const uniq = [...new Set(ids)];
  const rows = uniq.length
    ? await db.$queryRaw<PurchaseChargeMaster[]>`
        SELECT c.chg_id, c.chg_name, c.chg_type, c.chg_method, c.chg_default_rate, c.chg_cost_alloc, c.chg_before_tax,
               c.chg_tax_apl, c.chg_landing_cost, c.chg_on_bill, c.chg_ledger_code, c.chg_role, c.chg_tax_id, t.tax_rate_perc
          FROM public.charge_master c LEFT JOIN inventory.tax_rate_master t ON t.tax_id = c.chg_tax_id
         WHERE c.chg_id = ANY(${uniq}::uuid[]) AND c.chg_is_deleted = false AND c.chg_module IN ('P','B')`
    : [];
  return new Map(rows.map((r) => [r.chg_id, r]));
}

/**
 * The calc input of one keyed charge, from its master's REAL flags:
 *  - alloc: chg_cost_alloc (blank / NONE = VALUE);
 *  - an on-bill charge is before or after tax as the master says; an off-bill one is never before tax (our own cost);
 *  - landing cost: as the master says on the bill; off-bill is always landing cost (D13);
 *  - own GST: only an after-tax, tax-applicable, on-bill charge (D14: off-bill has no GST);
 *  - payees: an off-bill charge's (who is owed); none on an on-bill one.
 */
export function purchaseChargeInput(
  m: PurchaseChargeMaster,
  keyed: { rate?: number | null; amount?: number | null; payees?: { partyId: string; amount?: number | null }[] | null },
  key: string,
): CalcChargeIn {
  return {
    key, type: m.chg_type === 'DEDUCT' ? 'DEDUCT' : 'ADD',
    method: (m.chg_method as CalcChargeIn['method']) ?? 'FIXED',
    rate: keyed.rate ?? m.chg_default_rate ?? 0, amount: keyed.amount ?? null,
    alloc: ((m.chg_cost_alloc && m.chg_cost_alloc !== 'NONE' ? m.chg_cost_alloc : 'VALUE') as CalcChargeIn['alloc']),
    beforeTax: m.chg_on_bill ? m.chg_before_tax : false,
    onBill: m.chg_on_bill,
    landingCost: m.chg_on_bill ? m.chg_landing_cost : true, // D13: off-bill is always landing cost
    taxPct: m.chg_on_bill && m.chg_tax_apl && !m.chg_before_tax ? (m.tax_rate_perc ?? 0) : 0, // D14: off-bill no GST
    payees: m.chg_on_bill ? [] : (keyed.payees ?? []).map((p) => ({ partyId: p.partyId, amount: p.amount ?? null })),
  };
}
