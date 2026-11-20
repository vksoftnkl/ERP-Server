import type { Prisma } from '@prisma/client';

/**
 * Item master review 2026-11-20, Q12 step 1 (user: recommended) — the Item History
 * shows the item's unit conversion, price, barcode and reorder rows as well, and
 * each of them is named the way the card shows it ("Unit Bag", "Price PCS · MRP
 * 150") instead of the stored "<item id>:<unit row id>:NO_BRANCH:ALL_GODOWNS".
 *
 * Read side only: the stored rows keep their display names. `record` is the row's
 * record AFTER the label map and the id → name lookups (Unit ID is already the
 * unit's name, Branch ID the branch's, …), so old and new rows read alike.
 */
export const ITEM_HISTORY_CHILD_SCREENS: ReadonlySet<string> = new Set([
  'Item Unit Conversion Master',
  'Item Price Master',
  'Item EAN Code Master',
  'Item Reorder Master',
]);

const text = (value: Prisma.JsonValue | undefined): string | null => {
  if (value === null || value === undefined || typeof value === 'object') {
    return null;
  }
  const shown = String(value).trim();
  return shown ? shown : null;
};

/** "a · b · c" over the parts that are set. */
const joined = (...parts: (string | null)[]): string =>
  parts.filter((part): part is string => part !== null).join(' · ');

/** The child row's name as the History lists it, or null for any other screen. */
export function itemChildDisplayName(
  screenName: string,
  record: Prisma.JsonValue | null,
): string | null {
  if (!ITEM_HISTORY_CHILD_SCREENS.has(screenName)) {
    return null;
  }
  const row = record !== null && typeof record === 'object' && !Array.isArray(record) ? record : {};
  const unit = text(row['Unit ID']);
  const branch = text(row['Branch ID']);
  const godown = text(row['Godown ID']);
  switch (screenName) {
    case 'Item Unit Conversion Master':
      return `Unit ${unit ?? '?'}${row['Is Base Unit'] === true ? ' (base)' : ''}`;
    case 'Item Price Master': {
      const mrp = text(row['MRP Bucket']);
      return joined(`Price ${unit ?? '?'}`, branch, godown, mrp ? `MRP ${mrp}` : null);
    }
    case 'Item EAN Code Master': {
      const code = text(row['EAN / Barcode']) ?? '?';
      return `Barcode ${code}${unit ? ` (${unit})` : ''}`;
    }
    default:
      return joined(`Reorder ${unit ?? 'any unit'}`, branch, godown);
  }
}
