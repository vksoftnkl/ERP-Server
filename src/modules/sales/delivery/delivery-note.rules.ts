import { Prisma } from '@prisma/client';
import { DELIVERY_ERROR_CODES as C } from './core/delivery.constants';
import type { BillLineFacts } from './core/delivery-pending.service';
import { lineWeightKg } from './core/delivery-weight';
import { note, type DeliveryNote } from './delivery.errors';

/**
 * Plan §8.1 "Validate / post rules, in order" as one pure function, so
 * /save, /validate and /post run exactly the same checks and jest can walk
 * every row. The service resolves the facts (bill lines, shelves, lots,
 * godown, vehicle, freeze) and hands them in; nothing here reads the DB.
 */

export type RulePhase = 'save' | 'validate' | 'post';

export interface RuleHeader {
  godownId: string | null;
  /** OK, or why the godown cannot give: missing / not this branch's / inactive. */
  godownState: 'OK' | 'MISSING' | 'OTHER_BRANCH';
  godownName: string;
  branchName: string;
  /** The stored note has lines and the godown changes (decision 48). */
  godownLocked: boolean;
  storedGodownName: string;
  mode: string;
  vehicleId: string | null;
  vehicleNo: string | null;
  vehicleLabel: string;
  capacityKg: Prisma.Decimal | null;
  transporterId: string | null;
  transporterName: string | null;
  collectedBy: string | null;
  /** Post only: the giving godown is frozen for a count now (N4). */
  frozen: { from: string; to: string } | null;
}

export interface RuleLine {
  /** 1-based position on the note. */
  lineNo: number;
  billId: string;
  billAccYear: string;
  billItemId: string;
  /** null = not a number. */
  qty: Prisma.Decimal | null;
  /** null = no such bill line. */
  facts: BillLineFacts | null;
  /** The godown the body named for the line (null = the note's). */
  bodyGodownId: string | null;
  /** The lot given (body's, else the bill line's). */
  lotId: string | null;
  /** The lot holds a balance row in the giving godown for this item. */
  lotKnown: boolean;
  /** Physical (owned + BND) of the giving godown, item, given lot, bucket — base unit. */
  shelfBase: Prisma.Decimal;
  names: {
    bill: string;
    item: string;
    unit: string;
    billGodown: string;
    godown: string;
    lot: string;
    billLot: string;
  };
}

export interface RuleContext {
  phase: RulePhase;
  companyId: string;
  branchId: string;
  canOverride: boolean;
  overrideWarnings: readonly string[];
}

export interface NoteTotals {
  lines: number;
  qty: string;
  bags: string;
  weightKg: string;
  bills: number;
}

export interface NoteLoad {
  capacityKg: string | null;
  weightKg: string;
  percent: number | null;
  spareKg: string | null;
}

const Z = new Prisma.Decimal(0);
const q3 = (d: Prisma.Decimal): string => d.toDecimalPlaces(3).toString();
const positive = (l: RuleLine) => !!l.qty && l.qty.greaterThan(0);

/** The findings in rule order. */
export function checkDeliveryNote(
  header: RuleHeader,
  lines: readonly RuleLine[],
  ctx: RuleContext,
): DeliveryNote[] {
  const out: DeliveryNote[] = [];
  const atPost = ctx.phase !== 'save';

  // ── 2 · header ──────────────────────────────────────────────────────────
  if (header.godownState === 'MISSING') {
    out.push(note(C.DN_GODOWN_REQUIRED, 'REFUSE', 'sdnGodownId', 'Pick the godown the goods leave from'));
  } else if (header.godownState === 'OTHER_BRANCH') {
    out.push(
      note(
        C.DN_GODOWN_NOT_IN_BRANCH,
        'REFUSE',
        'sdnGodownId',
        `${header.godownName} is not a live godown of ${header.branchName}`,
        { godown: header.godownName, branch: header.branchName },
      ),
    );
  }
  if (header.godownLocked) {
    out.push(
      note(
        C.DN_GODOWN_LOCKED,
        'REFUSE',
        'sdnGodownId',
        `The note already has lines from ${header.storedGodownName}; take the lines off first`,
        { godown: header.storedGodownName },
      ),
    );
  }
  if (atPost) {
    if (header.mode === 'VEHICLE' && !header.vehicleId && !header.vehicleNo?.trim()) {
      out.push(note(C.DN_VEHICLE_REQUIRED, 'REFUSE', 'sdnVehicleId', 'Mode is Vehicle: the vehicle is missing'));
    }
    if (header.mode === 'TRANSPORTER' && !header.transporterId && !header.transporterName?.trim()) {
      out.push(
        note(C.DN_TRANSPORTER_REQUIRED, 'REFUSE', 'transport.transporterId', 'Mode is Transporter: the transporter is missing'),
      );
    }
    if (header.mode === 'SELF' && !header.collectedBy?.trim()) {
      out.push(
        note(C.DN_COLLECTED_BY_REQUIRED, 'REFUSE', 'sdnCollectedBy', 'Self pickup: who collected the goods is missing'),
      );
    }
  }

  // ── 3 · lines ───────────────────────────────────────────────────────────
  for (const l of lines) {
    const f = l.facts;
    const at = `lines[${l.lineNo - 1}]`;
    const p = { n: l.lineNo, bill: l.names.bill };
    if (!f || f.companyId !== ctx.companyId || f.billId !== l.billId) {
      out.push(
        note(C.DN_BILL_NOT_POSTED, 'REFUSE', `${at}.billItemId`, `Line ${l.lineNo}: no such posted bill line`, p, l.lineNo),
      );
      continue;
    }
    if (f.branchId !== ctx.branchId) {
      out.push(
        note(
          C.DN_BILL_OTHER_BRANCH,
          'REFUSE',
          `${at}.billId`,
          `${l.names.bill} belongs to another branch`,
          { ...p, branch: '' },
          l.lineNo,
        ),
      );
      continue;
    }
    if (f.billStatus !== 'POSTED' || f.billDeleted || f.lineDeleted) {
      out.push(
        note(
          C.DN_BILL_NOT_POSTED,
          'REFUSE',
          `${at}.billId`,
          `${l.names.bill} is not posted, or is cancelled`,
          p,
          l.lineNo,
        ),
      );
      continue;
    }
    if (f.deliveryMode !== 'PICKUP' && f.deliveryMode !== 'DISPATCH') {
      out.push(
        note(C.DN_BILL_INSTANT, 'REFUSE', `${at}.billId`, `${l.names.bill} is an Instant bill`, p, l.lineNo),
      );
      continue;
    }
    if (!f.eligible) {
      out.push(
        note(
          C.DN_LINE_NOT_GOODS,
          'REFUSE',
          `${at}.billItemId`,
          `Line ${l.lineNo} of ${l.names.bill} is a service or came from a challan`,
          { ...p, dc: f.srcDocRefno ?? '' },
          l.lineNo,
        ),
      );
      continue;
    }
    if (!l.qty || l.qty.lessThan(0)) {
      out.push(
        note(C.DN_QTY_NEGATIVE, 'REFUSE', `${at}.qty`, `Line ${l.lineNo}: Give now cannot be below 0`, { n: l.lineNo }, l.lineNo),
      );
    }
    if (l.bodyGodownId && header.godownId && l.bodyGodownId !== header.godownId) {
      out.push(
        note(
          C.DN_GODOWN_LOCKED,
          'REFUSE',
          `${at}.godownId`,
          `Line ${l.lineNo}: a note gives from its own godown (${header.godownName}) only`,
          { godown: header.godownName, n: l.lineNo },
          l.lineNo,
        ),
      );
    }
  }
  if (atPost && !lines.some(positive)) {
    out.push(note(C.DN_NO_LINES, 'REFUSE', 'lines', 'Every Give now is blank'));
  }

  const good = lines.filter(
    (l) =>
      l.facts &&
      l.facts.eligible &&
      l.facts.branchId === ctx.branchId &&
      l.facts.companyId === ctx.companyId &&
      l.qty &&
      !l.qty.lessThan(0),
  );

  // ── 4 · not more than pending (under the bill locks at post) ───────────
  if (atPost) {
    const sumByLine = new Map<string, Prisma.Decimal>();
    for (const l of good) {
      const k = l.billItemId;
      sumByLine.set(k, (sumByLine.get(k) ?? Z).plus(l.qty!));
    }
    const reported = new Set<string>();
    for (const l of good) {
      const total = sumByLine.get(l.billItemId)!;
      const pending = l.facts!.pendingQty;
      if (total.greaterThan(pending) && l.qty!.greaterThan(0) && !reported.has(l.billItemId)) {
        reported.add(l.billItemId);
        out.push(
          note(
            C.DN_QTY_OVER_PENDING,
            'REFUSE',
            `lines[${l.lineNo - 1}].qty`,
            `Line ${l.lineNo}: ${q3(total)} ${l.names.unit} typed, but only ${q3(pending)} are left to give on ${l.names.bill}`,
            {
              n: l.lineNo,
              qty: q3(total),
              unit: l.names.unit,
              pending: q3(pending.greaterThan(0) ? pending : Z),
              bill: l.names.bill,
            },
            l.lineNo,
          ),
        );
      }
    }
  }

  // ── 5 · another godown's goods ──────────────────────────────────────────
  for (const l of good) {
    if (!header.godownId || l.facts!.godownId === header.godownId) {
      continue;
    }
    if (!ctx.canOverride) {
      out.push(
        note(
          C.DN_GODOWN_RIGHT,
          'REFUSE',
          `lines[${l.lineNo - 1}].godownId`,
          `Line ${l.lineNo} was billed from ${l.names.billGodown}; giving it from ${header.godownName} needs the Override right`,
          { n: l.lineNo, billGodown: l.names.billGodown },
          l.lineNo,
        ),
      );
    } else if (l.qty!.greaterThan(0) && ctx.phase !== 'save') {
      out.push(
        note(
          C.DN_OTHER_GODOWN,
          'WARN',
          `lines[${l.lineNo - 1}].godownId`,
          `Line ${l.lineNo}: billed from ${l.names.billGodown}, given from ${header.godownName}; post moves ${q3(l.qty!)} ${l.names.unit} on the books`,
          {
            n: l.lineNo,
            qty: q3(l.qty!),
            unit: l.names.unit,
            billGodown: l.names.billGodown,
            godown: header.godownName,
          },
          l.lineNo,
        ),
      );
    }
  }

  // ── 6 · the lot ─────────────────────────────────────────────────────────
  for (const l of good) {
    if (l.lotId && !l.lotKnown) {
      out.push(
        note(
          C.DN_LOT_INVALID,
          'REFUSE',
          `lines[${l.lineNo - 1}].lotId`,
          `${l.names.lot} is not a lot of ${l.names.item} in ${header.godownName}`,
          { lot: l.names.lot, item: l.names.item, godown: header.godownName, n: l.lineNo },
          l.lineNo,
        ),
      );
    } else if (
      ctx.phase !== 'save' &&
      l.qty!.greaterThan(0) &&
      l.lotId &&
      l.facts!.lotId &&
      l.lotId !== l.facts!.lotId
    ) {
      out.push(
        note(
          C.DN_LOT_SWAP,
          'INFO',
          `lines[${l.lineNo - 1}].lotId`,
          `Line ${l.lineNo}: lot ${l.names.lot} given for ${l.names.billLot}; post swaps ${q3(l.qty!)} ${l.names.unit} between the lots on the books`,
          { n: l.lineNo, given: l.names.lot, billLot: l.names.billLot, qty: q3(l.qty!), unit: l.names.unit },
          l.lineNo,
        ),
      );
    }
  }

  if (ctx.phase === 'save') {
    return out;
  }

  // ── 7 · the shelf (Physical of the giving godown + lot) ─────────────────
  const drawn = new Map<string, Prisma.Decimal>();
  for (const l of good) {
    const f = l.facts!;
    const key = `${f.itemId}|${l.lotId ?? ''}|${f.bucket}`;
    const base = l.qty!.times(f.factor);
    if (l.qty!.isZero()) {
      if (l.shelfBase.lessThan(f.pendingBase) && f.pendingQty.greaterThan(0)) {
        out.push(
          note(
            C.DN_SHELF_SHORT,
            'INFO',
            `lines[${l.lineNo - 1}].qty`,
            `Line ${l.lineNo}: only ${q3(shelfInUnit(l))} ${l.names.unit} of ${l.names.item} on the shelf here; ${q3(f.pendingQty)} are billed`,
            {
              n: l.lineNo,
              shelf: q3(shelfInUnit(l)),
              unit: l.names.unit,
              item: l.names.item,
              pending: q3(f.pendingQty),
            },
            l.lineNo,
          ),
        );
      }
      continue;
    }
    const sum = (drawn.get(key) ?? Z).plus(base);
    drawn.set(key, sum);
    if (sum.greaterThan(l.shelfBase)) {
      out.push(
        note(
          C.DN_OVER_SHELF,
          'WARN',
          `lines[${l.lineNo - 1}].qty`,
          `Line ${l.lineNo}: the books say ${q3(shelfInUnit(l))} ${l.names.unit} of lot ${l.names.lot} are on the shelf here; ${q3(l.qty!)} are being given`,
          { n: l.lineNo, shelf: q3(shelfInUnit(l)), unit: l.names.unit, lot: l.names.lot, qty: q3(l.qty!) },
          l.lineNo,
        ),
      );
    }
  }

  // ── 8 · the vehicle's load ──────────────────────────────────────────────
  const weight = weightOf(good);
  if (header.mode === 'VEHICLE' && header.capacityKg && header.capacityKg.greaterThan(0)) {
    if (weight.greaterThan(header.capacityKg)) {
      out.push(
        note(
          C.DN_VEHICLE_OVERLOAD,
          'WARN',
          'sdnVehicleId',
          `${q3(weight)} kg on ${header.vehicleLabel}, over its ${q3(header.capacityKg)} kg`,
          { kg: q3(weight), vehicle: header.vehicleLabel, cap: q3(header.capacityKg) },
        ),
      );
    }
  }

  // ── 9 · a count freeze (N4) ─────────────────────────────────────────────
  if (header.frozen) {
    out.push(
      note(
        C.DN_GODOWN_FROZEN,
        'REFUSE',
        'sdnGodownId',
        `${header.godownName} is frozen for a count from ${header.frozen.from} to ${header.frozen.to}`,
        { godown: header.godownName, from: header.frozen.from, to: header.frozen.to },
      ),
    );
  }

  // ── 10 · WARNs nobody ticked (post only) ────────────────────────────────
  if (ctx.phase === 'post') {
    const ticked = new Set(ctx.overrideWarnings.map((c) => c.trim().toUpperCase()));
    const open = [...new Set(out.filter((n) => n.severity === 'WARN').map((n) => n.code))].filter(
      (c) => !ticked.has(c),
    );
    if (open.length > 0) {
      out.push(
        note(
          C.DN_WARN_NOT_CONFIRMED,
          'REFUSE',
          'overrideWarnings',
          `${open.length} warning(s) need your tick before posting: ${open.join(', ')}`,
          { count: open.length, codes: open.join(', ') },
        ),
      );
    }
  }
  return out;
}

function shelfInUnit(l: RuleLine): Prisma.Decimal {
  const f = l.facts!;
  return f.factor.isZero() ? l.shelfBase : l.shelfBase.dividedBy(f.factor);
}

/** Σ line kg, each line qty × its unitKg (one rule: core/delivery-weight). */
function weightOf(lines: readonly RuleLine[]): Prisma.Decimal {
  return lines.reduce((a, l) => a.plus(lineWeightKg(l.qty!, l.facts!.unitKg)), Z);
}

/** totals {lines, qty, bags, weightKg, bills} over the lines given now (qty > 0). */
export function noteTotals(lines: readonly RuleLine[]): NoteTotals {
  const given = lines.filter((l) => positive(l) && l.facts);
  const qty = given.reduce((a, l) => a.plus(l.qty!), Z);
  const bags = given
    .filter((l) => /^bag/i.test(l.names.unit.trim()))
    .reduce((a, l) => a.plus(l.qty!), Z);
  return {
    lines: given.length,
    qty: q3(qty),
    bags: q3(bags),
    weightKg: q3(weightOf(given)),
    bills: new Set(given.map((l) => `${l.billId}|${l.billAccYear}`)).size,
  };
}

/** load {capacityKg, weightKg, percent, spareKg} (callout 12: green / amber > 90 % / red > 100 %). */
export function noteLoad(header: Pick<RuleHeader, 'capacityKg'>, totals: NoteTotals): NoteLoad {
  const weight = new Prisma.Decimal(totals.weightKg);
  const cap = header.capacityKg && header.capacityKg.greaterThan(0) ? header.capacityKg : null;
  return {
    capacityKg: cap ? q3(cap) : null,
    weightKg: q3(weight),
    percent: cap ? Number(weight.dividedBy(cap).times(100).toDecimalPlaces(1).toString()) : null,
    spareKg: cap ? q3(cap.minus(weight)) : null,
  };
}

/** The first refusal, in rule order. */
export function firstRefusal(notes: readonly DeliveryNote[]): DeliveryNote | null {
  return notes.find((n) => n.severity === 'REFUSE') ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  P6 review round (2026-11-16): the line ids, the year, the undo floor
// ═══════════════════════════════════════════════════════════════════════════

/**
 * S2 — a body names each note line once. A second row with the same `sdniId`
 * would insert the line twice (a PK-violation 500 on /save, /post). The
 * first repeat, in body order, else null.
 */
export function duplicateLineIds(lines: readonly { sdniId?: string | null }[]): DeliveryNote | null {
  const seen = new Map<string, number>();
  for (const [idx, l] of lines.entries()) {
    if (!l.sdniId) {
      continue;
    }
    const first = seen.get(l.sdniId);
    if (first !== undefined) {
      return note(
        C.DN_LINE_DUPLICATE,
        'REFUSE',
        `lines[${idx}].sdniId`,
        `Line ${idx + 1} repeats line ${first + 1} (sdniId ${l.sdniId}): each note line is sent once`,
        { n: idx + 1, first: first + 1 },
        idx + 1,
      );
    }
    seen.set(l.sdniId, idx);
  }
  return null;
}

/**
 * N3 — a note is filed in the year it is posted in (§7.1: sdn_acc_year = the
 * post year; the post date is today, IST). A draft saved in one year and
 * posted in the next, or a post made while the session works in another
 * year, is refused rather than filed in a year its date is not in (the
 * partition is never moved). `draft` = an existing draft (its own year).
 */
export function yearChangedNote(
  noteYear: string,
  yearNow: string,
  refno: string | null,
  draft: boolean,
): DeliveryNote | null {
  if (noteYear.trim() === yearNow.trim()) {
    return null;
  }
  return note(
    C.DN_DRAFT_YEAR_CHANGED,
    'REFUSE',
    draft ? 'sdnId' : 'accYear',
    draft
      ? `Draft ${refno ?? ''} was saved in ${noteYear.trim()}, but today falls in ${yearNow}: make the note again in ${yearNow}`
      : `This note would be filed in ${noteYear.trim()}, but today falls in ${yearNow}: switch to ${yearNow}`,
    { refno: refno ?? '', year: noteYear.trim(), yearNow },
  );
}

/** One bill line a cancel / goods back takes goods back from (quantities in base units). */
export interface UndoLine {
  /** The note line no (the Qt row) and the body field the refusal points at. */
  noteLineNo: number;
  field: string;
  billRefno: string;
  billLineNo: number;
  unitName: string;
  /** Bill line unit → base. */
  factor: Prisma.Decimal;
  /** Σ out over every event of the bill line now. */
  givenBase: Prisma.Decimal;
  /** What this cancel / goods back takes off the line's given. */
  removeBase: Prisma.Decimal;
  /** The taken part of the line's live posted sale returns. */
  takenBase: Prisma.Decimal;
  returnRefnos: readonly string[];
}

/**
 * S3 / decision R-1 — a note cancel or goods back may not leave a bill line
 * given less than its live posted sale returns took back as "taken" (those
 * goods were with the customer and came back on a return; un-giving them
 * would put them on the shelf twice). The first such line, else null.
 */
export function undoBelowReturned(lines: readonly UndoLine[]): DeliveryNote | null {
  for (const l of lines) {
    const taken = l.takenBase.toDecimalPlaces(6);
    if (taken.lte(0)) {
      continue;
    }
    const after = l.givenBase.minus(l.removeBase).toDecimalPlaces(6);
    if (after.greaterThanOrEqualTo(taken)) {
      continue;
    }
    const f = l.factor.greaterThan(0) ? l.factor : new Prisma.Decimal(1);
    const qty = q3(taken.dividedBy(f));
    const shown = l.returnRefnos.slice(0, 3).join(', ') + (l.returnRefnos.length > 3 ? ', …' : '');
    return note(
      C.DN_UNDO_BELOW_RETURNED,
      'REFUSE',
      l.field,
      `Line ${l.billLineNo} of ${l.billRefno}: ${qty} ${l.unitName} came back on sale return ${shown}; cancel or amend that return first`,
      {
        n: l.billLineNo,
        bill: l.billRefno,
        qty,
        unit: l.unitName,
        sr: shown,
        givenAfter: q3(Prisma.Decimal.max(Z, after).dividedBy(f)),
      },
      l.noteLineNo,
    );
  }
  return null;
}
