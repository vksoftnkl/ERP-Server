import { Prisma } from '@prisma/client';
import { D, ZERO, type Tx } from '../common/purchase-doc.helpers';
import type { PurIssue } from '../invoice/purchase-invoice-checks';

/**
 * GRN — the WARN / REFUSE strip and the per-line Check column (purchase_grn_ui_mockup.png: chips OK / SHORT 2 /
 * 2 DAMAGED / SHELF LIFE / 5/5 SN, columns Shelf life % and Labels), the same for /validate, /save and /get.
 * Nothing here writes. Issue shape = the invoice's (purchase-invoice-checks.ts PurIssue).
 */
export interface GrnLineFact {
  index: number;
  lineNo: number;
  itemId: string;
  itemName: string | null;
  challan: Prisma.Decimal;
  received: Prisma.Decimal;
  damaged: Prisma.Decimal;
  free: Prisma.Decimal;
  damageReasonId: string | null;
  excess: Prisma.Decimal;
  excessAction: string | null;
  /** the SALEABLE allocation rows: pieces + expiry / mfg (shelf life is judged on saleable goods only) */
  rows: { bucket: string; qty: Prisma.Decimal; mfgDate: Date | null; expiryDate: Date | null; serialNo: string | null }[];
}

export interface GrnChip { code: 'OK' | 'SHORT' | 'DAMAGED' | 'SHELF_LIFE' | 'SERIALS' | 'EXCESS'; text: string }
export interface GrnLineCheck {
  shortQty: string;
  damagedQty: string;
  damageReasonMissing: boolean;
  excessQty: string;
  excessAction: string | null;
  /** % of the shelf life left at receipt (the worst saleable row); null = no expiry / no span to judge by */
  shelfLifePct: number | null;
  minShelfLifePct: number | null;
  /** labels to print = saleable pieces (received + free), whole */
  labels: number;
  serials: { have: number; need: string } | null;
  chips: GrnChip[];
}

const DAY = 86400000;

/** Per line: the shelf-life % left at receipt (worst saleable row) and the minimum asked (item's, else the setting's). */
export async function grnShelfLife(tx: Pick<Tx, '$queryRaw'>, minPctSetting: number, receipt: string, facts: GrnLineFact[]) {
  const out = new Map<number, { pct: number | null; min: number | null; expired: boolean }>();
  const itemIds = [...new Set(facts.filter((f) => f.rows.some((r) => r.expiryDate)).map((f) => f.itemId))];
  if (!itemIds.length) return out;
  const items = await tx.$queryRaw<{ item_id: string; min_pct: Prisma.Decimal | null; days: number | null }[]>`
    SELECT item_id, item_min_shelf_life_pct AS min_pct, item_expiry_days AS days FROM inventory.item_master WHERE item_id = ANY(${itemIds}::uuid[])`;
  const by = new Map(items.map((i) => [i.item_id, i]));
  const rec = new Date(`${receipt.slice(0, 10)}T00:00:00Z`).getTime();
  for (const f of facts) {
    const it = by.get(f.itemId);
    const min = it?.min_pct != null ? Number(it.min_pct) : minPctSetting > 0 ? minPctSetting : null;
    let worst: number | null = null, expired = false;
    for (const r of f.rows) {
      if (r.bucket !== 'SALEABLE' || !r.expiryDate) continue;
      const exp = r.expiryDate.getTime();
      const left = (exp - rec) / DAY;
      if (left < 0) { expired = true; worst = 0; continue; }
      const span = r.mfgDate && r.mfgDate.getTime() < exp ? (exp - r.mfgDate.getTime()) / DAY : (it?.days ?? 0);
      if (!(span > 0)) continue;
      const pct = Math.max(0, Math.min(100, Math.floor((left / span) * 100)));
      worst = worst == null ? pct : Math.min(worst, pct);
    }
    if (worst != null || expired) out.set(f.lineNo, { pct: worst, min, expired });
  }
  return out;
}

/**
 * The strip + Check column. `shelfMode` = purchase.shelf_life_mode (OFF / WARN / REFUSE); a REFUSE entry may be posted past
 * with overrideWarnings + the Override right (needsRight OVERRIDE). `tracked` = items whose track policy names serials.
 */
export function judgeGrnLines(
  facts: GrnLineFact[],
  shelf: Map<number, { pct: number | null; min: number | null; expired: boolean }>,
  shelfMode: 'OFF' | 'WARN' | 'REFUSE',
  tracked: Set<string>,
): { issues: PurIssue[]; checks: Map<number, GrnLineCheck> } {
  const issues: PurIssue[] = [];
  const checks = new Map<number, GrnLineCheck>();
  for (const f of facts) {
    const name = f.itemName ? ` ${f.itemName}` : '';
    const chips: GrnChip[] = [];
    const short = f.challan.minus(f.received).minus(f.damaged);
    if (short.greaterThan(0)) {
      chips.push({ code: 'SHORT', text: `SHORT ${short.toString()}` });
      issues.push({ code: 'PUR_SHORT_VS_CHALLAN', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.receivedQty`, needsRight: null,
        message: `Line ${f.lineNo}${name}: the challan says ${f.challan.toString()}, ${f.received.plus(f.damaged).toString()} arrived — ${short.toString()} short goes to the shortage register.` });
    }
    const noReason = f.damaged.greaterThan(0) && !f.damageReasonId;
    if (f.damaged.greaterThan(0)) chips.push({ code: 'DAMAGED', text: `${f.damaged.toString()} DAMAGED` });
    if (noReason) {
      issues.push({ code: 'PUR_GRN_DAMAGE_NO_REASON', level: 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.damageReasonId`, needsRight: null,
        message: `Line ${f.lineNo}${name}: ${f.damaged.toString()} damaged with no reason — pick one (Stock Reasons).` });
    }
    if (f.excess.greaterThan(0)) chips.push({ code: 'EXCESS', text: `EXCESS ${f.excess.toString()}` });
    const sl = shelf.get(f.lineNo);
    if (sl && (sl.expired || (sl.pct != null && sl.min != null && sl.pct < sl.min))) {
      chips.push({ code: 'SHELF_LIFE', text: 'SHELF LIFE' });
      if (shelfMode !== 'OFF') {
        const refuse = shelfMode === 'REFUSE';
        issues.push({ code: 'PUR_SHELF_LIFE', level: refuse ? 'REFUSE' : 'WARN', lineNo: f.lineNo, field: `lines.${f.index}.allocs`, needsRight: refuse ? 'OVERRIDE' : null,
          message: sl.expired ? `Line ${f.lineNo}${name}: the goods have already expired.`
            : `Line ${f.lineNo}${name}: ${sl.pct} % of its shelf life left — the minimum is ${sl.min} %.` });
      }
    }
    let serials: GrnLineCheck['serials'] = null;
    if (tracked.has(f.itemId)) {
      const pieces = f.rows.filter((r) => r.bucket === 'SALEABLE' || r.bucket === 'DAMAGED').reduce((s, r) => s.plus(r.qty), ZERO);
      const have = f.rows.filter((r) => r.serialNo?.trim()).length;
      serials = { have, need: pieces.toString() };
      chips.push({ code: 'SERIALS', text: `${have}/${pieces.toString()} SN` });
      if (!D(have).equals(pieces)) {
        // user 2026-10-29: REFUSE (was WARN) — a GRN posts only with one serial per piece; a draft still saves, the strip says so before Post
        issues.push({ code: 'PUR_SERIAL_COUNT', level: 'REFUSE', lineNo: f.lineNo, field: `lines.${f.index}.allocs`, needsRight: null,
          message: `Line ${f.lineNo}${name}: ${have} serial${have === 1 ? '' : 's'} for ${pieces.toString()} received — scan every piece (F12).` });
      }
    }
    if (!chips.some((c) => c.code !== 'SERIALS') && (!serials || D(serials.have).equals(D(serials.need)))) chips.unshift({ code: 'OK', text: 'OK' });
    const labels = f.rows.filter((r) => r.bucket === 'SALEABLE').reduce((s, r) => s.plus(r.qty), ZERO);
    checks.set(f.lineNo, {
      shortQty: (short.isNegative() ? ZERO : short).toString(), damagedQty: f.damaged.toString(), damageReasonMissing: noReason,
      excessQty: f.excess.toString(), excessAction: f.excessAction, shelfLifePct: sl?.pct ?? null, minShelfLifePct: sl?.min ?? null,
      labels: Math.ceil(Number(labels)), serials, chips,
    });
  }
  return { issues, checks };
}
