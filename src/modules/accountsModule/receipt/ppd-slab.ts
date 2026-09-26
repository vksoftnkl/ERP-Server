import { Prisma } from '@prisma/client';
import { daysBetween, money, ZERO } from './receipt.utils';

/**
 * R16 — the prompt-payment discount, as a pure function.
 *
 * `accounts.ppd_slabs` holds something like
 * `[{"days":7,"perc":2},{"days":15,"perc":1}]`, read as: 2% off if the bill is
 * paid within 7 days of its date, 1% within 15, nothing after that. The BEST
 * slab the bill still qualifies for wins, which for a sane configuration is the
 * tightest one — but the slabs are not required to be sorted or sane, so the
 * search does not assume it.
 *
 * ── What this does NOT do ────────────────────────────────────────────────
 * It SUGGESTS. `/receipts/open-items` returns the figure, the operator sees it
 * in the discount box and may clear it, raise it or leave it — and whatever
 * they left is what `/receipts/post` writes. The server NEVER re-seeds at post
 * (§12): a suggestion that reappears after being cleared is not a suggestion.
 *
 * ── Why the base is the PENDING amount ───────────────────────────────────
 * A bill of 10,000 already half paid has 5,000 left, and 2% of what is being
 * settled today is 100. Basing it on the face value would offer 200 off a
 * 5,000 payment, which is 4% — and on a bill settled in four instalments would
 * offer the full discount four times.
 */

/** One slab as the setting stores it. */
export interface PpdSlab {
  /** Paid within this many days of the bill date. Non-negative. */
  days: number;
  /** Percentage off. Positive; 100 or more is refused as a configuration error. */
  perc: number;
}

/**
 * Parse the setting's JSON into slabs, discarding anything malformed.
 *
 * Silently, and on purpose: this is read on every keystroke of a screen the
 * operator cannot use to fix the setting. A 500 over a bad slab would stop them
 * taking money; dropping the slab merely stops them being offered a discount,
 * which is the failure that does not lose a collection. The settings screen is
 * where a bad value is visible and correctable.
 */
export function parsePpdSlabs(raw: string | null | undefined): PpdSlab[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const slabs: PpdSlab[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const days = (entry as { days?: unknown }).days;
    const perc = (entry as { perc?: unknown }).perc;
    if (typeof days !== 'number' || typeof perc !== 'number') {
      continue;
    }
    if (!Number.isFinite(days) || !Number.isFinite(perc)) {
      continue;
    }
    // A negative window is meaningless; a discount of 100% or more would settle
    // the bill by giving it away, which is a write-off and has its own column.
    if (days < 0 || perc <= 0 || perc >= 100) {
      continue;
    }
    slabs.push({ days: Math.floor(days), perc });
  }
  return slabs;
}

/**
 * The discount the slabs suggest for one bill, at one date.
 *
 * Returns 0 — never null — when nothing qualifies: the screen shows a box with
 * a zero in it either way, and a nullable field would make every caller decide
 * what a null means.
 *
 * A bill dated in the FUTURE relative to `onDate` qualifies for the tightest
 * slab (age 0): a receipt keyed before the invoice date is a data-entry
 * question, not a reason to withhold a discount the customer is plainly
 * entitled to.
 */
export function suggestPpdDiscount(params: {
  docDate: Date;
  onDate: Date;
  pendingAmount: Prisma.Decimal;
  slabs: readonly PpdSlab[];
}): Prisma.Decimal {
  const { docDate, onDate, pendingAmount, slabs } = params;
  if (slabs.length === 0 || pendingAmount.lessThanOrEqualTo(0)) {
    return ZERO;
  }

  const age = Math.max(0, daysBetween(docDate, onDate));

  let best: PpdSlab | null = null;
  for (const slab of slabs) {
    if (age > slab.days) {
      continue;
    }
    // Not "the first that matches" and not "the narrowest window": the highest
    // PERCENTAGE the bill still qualifies for. An unsorted or overlapping
    // configuration then behaves the way an operator would read it.
    if (best === null || slab.perc > best.perc) {
      best = slab;
    }
  }

  if (best === null) {
    return ZERO;
  }

  return money(pendingAmount.times(best.perc).dividedBy(100));
}
