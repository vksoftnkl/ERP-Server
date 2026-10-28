import type { Prisma } from '@prisma/client';

/**
 * purchase.* settings (migration 20261028140000), resolved the one way every setting is:
 * fn_app_settings_effective (GLOBAL < COMPANY < BRANCH …), the catalog default when no row.
 * A purchase bill snapshots the money-steering ones in pi_policy, so an old bill keeps
 * the rules it was made under.
 */
export interface PurchaseSettings {
  defaultEntry: 'DIRECT' | 'GRN';
  invAmountCheck: 'REFUSE' | 'WARN';
  duplicateBillMode: 'REFUSE' | 'WARN';
  labelsAfterPost: 'ASK' | 'ALWAYS' | 'NEVER';
  allowPriceUpdate: boolean;
  priceUpdate: 'UPDATE_PRICES' | 'COST_ONLY' | 'OPEN_CHANGE_SELLING' | 'NONE';
  priceSetAt: 'INVOICE' | 'GRN';
  rateTolerancePct: number;
  shelfLifeMode: 'OFF' | 'WARN' | 'REFUSE';
  minShelfLifePct: number;
  closePoOnFirstBill: boolean;
  poApprovalAbove: number;
  returnSettlementDefault: 'ADJUST' | 'ADVANCE' | 'CASH';
}

const pick = <T extends string>(v: string | undefined, allowed: readonly T[], dflt: T): T =>
  (allowed as readonly string[]).includes((v ?? '').toUpperCase()) ? ((v ?? '').toUpperCase() as T) : dflt;
const bool = (v: string | undefined, dflt: boolean) =>
  v === undefined ? dflt : ['true', '1', 'yes', 'y', 'on'].includes(v.trim().toLowerCase());
const num = (v: string | undefined, dflt: number) => (v === undefined || v.trim() === '' || Number.isNaN(Number(v)) ? dflt : Number(v));

export async function loadPurchaseSettings(tx: Prisma.TransactionClient, companyId: string, branchId: string): Promise<PurchaseSettings> {
  const rows = await tx.$queryRaw<{ key: string; value: string | null }[]>`
    SELECT out_asd_key AS key, out_effective_value AS value
      FROM public.fn_app_settings_effective(${companyId}::uuid, ${branchId}::uuid, NULL::uuid, NULL::uuid)
     WHERE out_asd_key LIKE 'purchase.%'`;
  const s = new Map(rows.map((r) => [r.key, r.value ?? undefined]));
  const g = (k: string) => s.get(`purchase.${k}`);
  return {
    defaultEntry: pick(g('default_entry'), ['DIRECT', 'GRN'] as const, 'DIRECT'),
    invAmountCheck: pick(g('inv_amount_check'), ['REFUSE', 'WARN'] as const, 'REFUSE'),
    duplicateBillMode: pick(g('duplicate_bill_mode'), ['REFUSE', 'WARN'] as const, 'REFUSE'),
    labelsAfterPost: pick(g('labels_after_post'), ['ASK', 'ALWAYS', 'NEVER'] as const, 'ASK'),
    allowPriceUpdate: bool(g('allow_price_update'), false),
    priceUpdate: pick(g('price_update'), ['UPDATE_PRICES', 'COST_ONLY', 'OPEN_CHANGE_SELLING', 'NONE'] as const, 'UPDATE_PRICES'),
    priceSetAt: pick(g('price_set_at'), ['INVOICE', 'GRN'] as const, 'INVOICE'),
    rateTolerancePct: num(g('rate_tolerance_pct'), 2),
    shelfLifeMode: pick(g('shelf_life_mode'), ['OFF', 'WARN', 'REFUSE'] as const, 'WARN'),
    minShelfLifePct: num(g('min_shelf_life_pct'), 60),
    closePoOnFirstBill: bool(g('close_po_on_first_bill'), false),
    poApprovalAbove: num(g('po_approval_above'), 0),
    returnSettlementDefault: pick(g('return_settlement_default'), ['ADJUST', 'ADVANCE', 'CASH'] as const, 'ADJUST'),
  };
}
