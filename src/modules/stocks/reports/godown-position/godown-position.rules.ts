import { Prisma } from '@prisma/client';
import type {
  BehindBillDbRow,
  BehindChallanDbRow,
  ByLotDbRow,
  ItemFactDbRow,
  PositionDbRow,
} from './godown-position.sql';
import type {
  BehindBillRow,
  BehindChallanRow,
  BehindLot,
  LastGiven,
  PositionQtyIn,
  PositionRow,
  PositionTiles,
  PositionTotals,
} from './types/godown-position.types';

/**
 * Godown Stock Position — the pure rules (plan §8.3, mockup 306). Every sum
 * in `Prisma.Decimal`; strings formatted once here (3 dp qty, 3 dp kg).
 *
 *   Physical     = Owned + Billed not delivered            (every row, the tie)
 *   Free to sell = stock_balance available (= Owned − Reserved)
 *   Short        = Billed not delivered − Physical when > 0 (= −Owned: billed
 *                  ahead of stock); the shelf holds less than is billed to go
 *   Over-given   = Σ −pending of over-given lines (decision 46)
 *   tie          = Physical = Owned + BND, and BND from the line quantities =
 *                  BND from the events' base columns (a drift between the two
 *                  means an event's base qty disagrees with qty × factor)
 */
type Dec = Prisma.Decimal;
type Num = Dec | string | number;

export const D0 = new Prisma.Decimal(0);

export function dec(v: Num | null | undefined): Dec {
  if (v === null || v === undefined || v === '') return D0;
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

/** A base quantity in a unit of `factor`, 3 dp. */
export function qtyIn(base: Num, factor: Num): string {
  const f = dec(factor);
  return dec(base)
    .dividedBy(f.isZero() ? 1 : f)
    .toFixed(3);
}

export function kg(v: Num): string {
  return dec(v).toFixed(3);
}

/** The Qty-in unit of one item: the selling unit (Q16, default) or the base unit. */
export function unitOf(
  f: ItemFactDbRow | undefined,
  mode: PositionQtyIn,
): { name: string; factor: Dec } {
  if (mode === 'BASE' || !f) {
    return { name: f?.base_unit ?? '', factor: dec(1) };
  }
  const factor = dec(f.sell_factor);
  return {
    name: f.sell_unit || f.base_unit,
    factor: factor.greaterThan(0) ? factor : dec(1),
  };
}

/** The package unit (always the selling unit) — tiles count packages. */
function sellFactorOf(f: ItemFactDbRow | undefined): Dec {
  const factor = dec(f?.sell_factor ?? 1);
  return factor.greaterThan(0) ? factor : dec(1);
}

export function lastGivenOf(r: {
  last_refno: string | null;
  last_date: string | null;
  last_doc_id: string | null;
  last_doc_year: string | null;
}): LastGiven | null {
  if (!r.last_date) return null;
  return {
    refno: r.last_refno,
    date: r.last_date,
    sdnId: r.last_doc_id,
    accYear: r.last_doc_year ? r.last_doc_year.trim() : null,
  };
}

/** One row of a Show, with the numbers views filter and total on. */
export interface PositionRunRow {
  wire: PositionRow;
  nameKey: string;
  godownSort: number;
  godownNameKey: string;
  findText: string;
  billIds: readonly string[];
  dcIds: readonly string[];
  num: {
    owned: Dec;
    bnd: Dec;
    physical: Dec;
    reserved: Dec;
    free: Dec;
    dc: Dec;
    short: Dec;
  };
  /** Base units → kg for the item. */
  kgPerBase: Dec;
  /** Base units → packages (the selling unit). */
  sellFactor: Dec;
}

export interface BuildRowsInput {
  rows: readonly PositionDbRow[];
  facts: readonly ItemFactDbRow[];
  godowns: ReadonlyMap<string, { name: string; sort: number }>;
  qtyIn: PositionQtyIn;
}

export function buildRows(input: BuildRowsInput): PositionRunRow[] {
  const facts = new Map(input.facts.map((f) => [f.item_id, f]));
  return input.rows.map((r) => {
    const f = facts.get(r.item_id);
    const unit = unitOf(f, input.qtyIn);
    const owned = dec(r.owned);
    const bnd = dec(r.bnd);
    const physical = owned.plus(bnd);
    const reserved = dec(r.reserved);
    const free = dec(r.free);
    const dc = dec(r.dc_open);
    const short = bnd.minus(physical).greaterThan(0) ? bnd.minus(physical) : D0;
    const kgPerBase = dec(f?.kg_per_base);
    const g = input.godowns.get(r.godown_id);
    const tie = physical.equals(owned.plus(bnd)) && bnd.equals(dec(r.bnd_ev));
    const name = f?.item_name ?? '';
    const wire: PositionRow = {
      itemId: r.item_id,
      itemCode: f?.item_code ?? null,
      itemName: name,
      godownId: r.godown_id,
      godownName: g?.name ?? null,
      unitName: unit.name,
      unitFactor: unit.factor.toFixed(6),
      physical: qtyIn(physical, unit.factor),
      billedNotDelivered: qtyIn(bnd, unit.factor),
      owned: qtyIn(owned, unit.factor),
      reserved: qtyIn(reserved, unit.factor),
      freeToSell: qtyIn(free, unit.factor),
      onVehicle: null,
      challanOut: qtyIn(dc, unit.factor),
      physicalKg: kg(physical.times(kgPerBase)),
      lastGiven: lastGivenOf(r),
      short: qtyIn(short, unit.factor),
      overGiven: qtyIn(dec(r.over_given), unit.factor),
      tie,
    };
    return {
      wire,
      nameKey: name.toLowerCase(),
      godownSort: g?.sort ?? Number.MAX_SAFE_INTEGER,
      godownNameKey: (g?.name ?? '').toLowerCase(),
      findText: [f?.item_code, f?.item_name, f?.barcode].filter(Boolean).join('\u0001').toLowerCase(),
      billIds: r.bill_ids ?? [],
      dcIds: r.dc_ids ?? [],
      num: { owned, bnd, physical, reserved, free, dc, short },
      kgPerBase,
      sellFactor: sellFactorOf(f),
    };
  });
}

/** Item name, then godown (gdl_sort, name), then ids — the mockup's order. */
export function sortRows(rows: readonly PositionRunRow[]): PositionRunRow[] {
  return [...rows].sort((a, b) => {
    if (a.nameKey !== b.nameKey) return a.nameKey < b.nameKey ? -1 : 1;
    if (a.wire.itemId !== b.wire.itemId) return a.wire.itemId < b.wire.itemId ? -1 : 1;
    if (a.godownSort !== b.godownSort) return a.godownSort - b.godownSort;
    if (a.godownNameKey !== b.godownNameKey) return a.godownNameKey < b.godownNameKey ? -1 : 1;
    return a.wire.godownId < b.wire.godownId ? -1 : a.wire.godownId > b.wire.godownId ? 1 : 0;
  });
}

/** Hide zero / Only with goods to give / Find — applied to the computed rows. */
export function filterRows(
  rows: readonly PositionRunRow[],
  v: { hideZero: boolean; onlyToGive: boolean; find: string },
): PositionRunRow[] {
  const find = v.find.trim().toLowerCase();
  return rows.filter((r) => {
    const n = r.num;
    if (
      v.hideZero &&
      n.owned.isZero() &&
      n.bnd.isZero() &&
      n.reserved.isZero() &&
      n.dc.isZero()
    ) {
      return false;
    }
    if (v.onlyToGive && n.bnd.isZero()) return false;
    if (find && !r.findText.includes(find)) return false;
    return true;
  });
}

/** The six tiles (weights, because units differ; packages in the selling unit). */
export function tilesOf(rows: readonly PositionRunRow[]): PositionTiles {
  let physKg = D0;
  let physPk = D0;
  let bndKg = D0;
  let bndPk = D0;
  let ownKg = D0;
  let ownPk = D0;
  let resKg = D0;
  let resPk = D0;
  let dcKg = D0;
  let dcPk = D0;
  const bills = new Set<string>();
  const dcs = new Set<string>();
  const reservedItems = new Set<string>();
  let shortRows = 0;
  let first: PositionTiles['short']['first'] = null;
  for (const r of rows) {
    const n = r.num;
    physKg = physKg.plus(n.physical.times(r.kgPerBase));
    physPk = physPk.plus(n.physical.dividedBy(r.sellFactor));
    bndKg = bndKg.plus(n.bnd.times(r.kgPerBase));
    bndPk = bndPk.plus(n.bnd.dividedBy(r.sellFactor));
    ownKg = ownKg.plus(n.owned.times(r.kgPerBase));
    ownPk = ownPk.plus(n.owned.dividedBy(r.sellFactor));
    resKg = resKg.plus(n.reserved.times(r.kgPerBase));
    resPk = resPk.plus(n.reserved.dividedBy(r.sellFactor));
    dcKg = dcKg.plus(n.dc.times(r.kgPerBase));
    dcPk = dcPk.plus(n.dc.dividedBy(r.sellFactor));
    r.billIds.forEach((b) => bills.add(b));
    r.dcIds.forEach((d) => dcs.add(d));
    if (!n.reserved.isZero()) reservedItems.add(r.wire.itemId);
    if (n.short.greaterThan(0)) {
      shortRows += 1;
      if (!first) {
        first = {
          itemId: r.wire.itemId,
          itemName: r.wire.itemName,
          godownId: r.wire.godownId,
          godownName: r.wire.godownName,
          unitName: r.wire.unitName,
          physical: r.wire.physical,
          billedNotDelivered: r.wire.billedNotDelivered,
        };
      }
    }
  }
  return {
    physical: { kg: kg(physKg), pkgs: physPk.toFixed(3), rows: rows.length },
    billedNotDelivered: { kg: kg(bndKg), pkgs: bndPk.toFixed(3), bills: bills.size },
    owned: { kg: kg(ownKg), pkgs: ownPk.toFixed(3) },
    reserved: { kg: kg(resKg), pkgs: resPk.toFixed(3), items: reservedItems.size },
    short: { items: shortRows, first },
    challanOut: { kg: kg(dcKg), pkgs: dcPk.toFixed(3), challans: dcs.size },
  };
}

export function totalsOf(rows: readonly PositionRunRow[]): PositionTotals {
  let phys = D0;
  let bnd = D0;
  let own = D0;
  let res = D0;
  let free = D0;
  let dc = D0;
  let tie = true;
  for (const r of rows) {
    phys = phys.plus(r.num.physical.times(r.kgPerBase));
    bnd = bnd.plus(r.num.bnd.times(r.kgPerBase));
    own = own.plus(r.num.owned.times(r.kgPerBase));
    res = res.plus(r.num.reserved.times(r.kgPerBase));
    free = free.plus(r.num.free.times(r.kgPerBase));
    dc = dc.plus(r.num.dc.times(r.kgPerBase));
    tie = tie && r.wire.tie;
  }
  return {
    physicalKg: kg(phys),
    bndKg: kg(bnd),
    ownedKg: kg(own),
    reservedKg: kg(res),
    freeKg: kg(free),
    challanKg: kg(dc),
    rows: rows.length,
    tie,
  };
}

/** /behind kind BND — each open line in the Qty-in unit of the ROW (the bill line's own unit converted). */
export function behindBillRows(rows: readonly BehindBillDbRow[], factor: Dec): BehindBillRow[] {
  return rows.map((r) => {
    const lf = dec(r.factor);
    return {
      billId: r.bill_id,
      billAccYear: r.bill_acc_year.trim(),
      billRefno: r.bill_refno,
      billDate: r.bill_date,
      days: r.days === null ? null : Number(r.days),
      custId: r.cust_id,
      custName: r.cust_name,
      areaName: r.area_name,
      mode: r.mode,
      billItemId: r.line_id,
      lineNo: Number(r.line_no),
      lotId: r.lot_id,
      lotNo: r.lot_no,
      billed: qtyIn(dec(r.billed_qty).times(lf), factor),
      given: qtyIn(dec(r.given_qty).times(lf), factor),
      pending: qtyIn(dec(r.pending_base), factor),
      lastGiven: lastGivenOf(r),
    };
  });
}

export function behindChallanRows(
  rows: readonly BehindChallanDbRow[],
  factor: Dec,
): BehindChallanRow[] {
  return rows.map((r) => ({
    dcId: r.dc_id,
    dcAccYear: r.dc_acc_year.trim(),
    dcRefno: r.dc_refno,
    dcDate: r.dc_date,
    days: r.days === null ? null : Number(r.days),
    custId: r.cust_id,
    custName: r.cust_name,
    open: qtyIn(r.open_base, factor),
    total: qtyIn(r.total_base, factor),
  }));
}

/** THE SUM · BY LOT: owned + not delivered = physical per lot, and the row's sum. */
export function byLotOf(
  rows: readonly ByLotDbRow[],
  factor: Dec,
): {
  byLot: BehindLot[];
  sum: {
    owned: string;
    billedNotDelivered: string;
    physical: string;
    reserved: string;
    freeToSell: string;
  };
} {
  let own = D0;
  let bnd = D0;
  let res = D0;
  let free = D0;
  const byLot = rows
    .filter((r) => !dec(r.owned).isZero() || !dec(r.bnd).isZero())
    .map((r) => {
      const o = dec(r.owned);
      const b = dec(r.bnd);
      return {
        lotId: r.lot_id,
        lotNo: r.lot_no,
        owned: qtyIn(o, factor),
        notDelivered: qtyIn(b, factor),
        physical: qtyIn(o.plus(b), factor),
      };
    });
  for (const r of rows) {
    own = own.plus(dec(r.owned));
    bnd = bnd.plus(dec(r.bnd));
    res = res.plus(dec(r.reserved));
    free = free.plus(dec(r.free));
  }
  return {
    byLot,
    sum: {
      owned: qtyIn(own, factor),
      billedNotDelivered: qtyIn(bnd, factor),
      physical: qtyIn(own.plus(bnd), factor),
      reserved: qtyIn(res, factor),
      freeToSell: qtyIn(free, factor),
    },
  };
}

const BUCKET_LABEL: Record<string, string> = {
  SALEABLE: 'saleable',
  DAMAGED: 'damaged',
  QUARANTINE: 'quarantine',
  EXPIRED: 'expired',
  SAMPLE: 'sample',
};

/** The applied filters as one sentence (the export's first line, the print heading). */
export function printedAsOf(p: {
  branchName: string | null;
  godownName: string | null;
  groupName: string | null;
  brandName: string | null;
  asOf: string;
  qtyIn: PositionQtyIn;
  bucket: string;
  onlyToGive: boolean;
  hideZero: boolean;
  find: string;
}): string {
  return [
    p.branchName,
    p.godownName ?? 'All godowns',
    p.groupName ? `Group: ${p.groupName}` : null,
    p.brandName ? `Brand: ${p.brandName}` : null,
    p.qtyIn === 'BASE' ? 'qty in base unit' : 'qty in the selling unit',
    p.bucket === 'ALL' ? 'All buckets' : (BUCKET_LABEL[p.bucket] ?? p.bucket.toLowerCase()),
    p.onlyToGive ? 'only with goods to give' : null,
    p.hideZero ? 'hide zero' : null,
    p.find ? `find "${p.find}"` : null,
    `as of ${p.asOf}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
