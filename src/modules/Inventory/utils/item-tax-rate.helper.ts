import { Prisma } from '@prisma/client';
import { toNumber } from 'src/common/utils/module-service.utils';

/** What the tax resolver answers for one item, as of one date. */
export interface ItemTaxRate {
  itemId: string;
  taxId: string | null;
  taxPerc: number;
  inclTax: boolean;
  hasCess: boolean;
}

/**
 * The tax percentage per item, AS OF a date (today by default), through
 * item_tax_history — for any screen that derives a price level's without-tax
 * figure and markup from its price: menu 30 (§4.3 of its plan) and the item
 * card's price save (notes 71 B4).
 *
 * "Tax % comes from the item's tax master" is under-specified, and the
 * under-specified part is the date. `inventory.item_tax_history` is
 * date-effective, so an item whose rate changed last week has two answers and
 * only one of them is the one a price written today should be derived from.
 *
 * Resolved SERVER-SIDE and sent down (§3) rather than left to the client: a
 * client reading the item's rate itself would use the current row on a screen
 * that, once §12's dormant effective-date columns wake up, may be writing a
 * future one.
 *
 * Both ith_tax_id and item_default_tax_id point at inventory.tax_rate_master
 * (20260912110000_repoint_items_to_tax_rate_master); item_tax_master is
 * retired, and reading it here answered 0% for every item.
 */
export async function resolveItemTaxRates(
  tx: Pick<Prisma.TransactionClient, 'itemMaster' | 'itemTaxHistory' | 'taxRateMaster'>,
  itemIds: readonly string[],
  asOf: Date = new Date(),
): Promise<Map<string, ItemTaxRate>> {
  const ids = [...new Set(itemIds)];
  if (!ids.length) {
    return new Map();
  }
  const asOfDate = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));

  const items = await tx.itemMaster.findMany({
    where: { itemId: { in: ids } },
    select: { itemId: true, itemDefaultTaxId: true, itemInclTax: true },
  });
  const history = await tx.itemTaxHistory.findMany({
    where: {
      ithItemId: { in: ids },
      ithEffectiveFrom: { lte: asOfDate },
      OR: [{ ithEffectiveTo: null }, { ithEffectiveTo: { gte: asOfDate } }],
    },
    // Latest window that covers the date wins; a history row overrides the
    // item's default, which is the whole reason the table exists.
    orderBy: [{ ithItemId: 'asc' }, { ithEffectiveFrom: 'desc' }],
    select: { ithItemId: true, ithTaxId: true },
  });
  const historyTaxId = new Map<string, string>();
  for (const row of history) {
    if (!historyTaxId.has(row.ithItemId)) {
      historyTaxId.set(row.ithItemId, row.ithTaxId);
    }
  }

  const taxIds = [
    ...new Set(
      [
        ...historyTaxId.values(),
        ...items.map((item) => item.itemDefaultTaxId).filter((id): id is string => !!id),
      ].filter(Boolean),
    ),
  ];
  // No tax_is_deleted filter, as before: the rate an item or its history row
  // names is the rate it is taxed at until someone re-points it.
  const taxes = taxIds.length
    ? await tx.taxRateMaster.findMany({
        where: { taxId: { in: taxIds } },
        select: {
          taxId: true,
          taxRatePerc: true,
          taxCessBasis: true,
          taxAcessBasis: true,
        },
      })
    : [];
  const taxById = new Map(taxes.map((tax) => [tax.taxId, tax]));

  const result = new Map<string, ItemTaxRate>();
  for (const item of items) {
    const taxId = historyTaxId.get(item.itemId) ?? item.itemDefaultTaxId ?? null;
    const tax = taxId ? taxById.get(taxId) : undefined;
    result.set(item.itemId, {
      itemId: item.itemId,
      taxId,
      taxPerc: tax ? toNumber(tax.taxRatePerc) : 0,
      inclTax: item.itemInclTax,
      // §13.5 — cess makes the four-number panel approximate, because
      // tax_cess_per_unit is an amount per unit and not a percentage of price.
      // The screen is told rather than left to pretend. The basis alone
      // answers it: ck_tax_cess_agrees / ck_tax_acess_agrees hold the figures
      // to it, so NONE means both are zero. The additional (state) cess
      // counts too — it is just as missing from taxPerc.
      hasCess: tax ? tax.taxCessBasis !== 'NONE' || tax.taxAcessBasis !== 'NONE' : false,
    });
  }
  return result;
}
