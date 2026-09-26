import { Prisma } from '@prisma/client';

/**
 * notes (51): ONE rule for "which godown does a sale line use when nobody has
 * chosen one yet", shared by /master-lookups/item-price (a hand-picked line)
 * and /quotations/get (a quotation line, which stores no godown):
 *
 *   1. an explicit godown (the lookup's godown_id, a line's own column), else
 *   2. the item's price row godown (item_price_master.ipm_godown_id — legacy
 *      `isale_no`, the per-item sale godown), else
 *   3. the branch's default (branch_master.br_default_godown_id), when that
 *      godown is still live.
 *
 * The price row is picked the way item-price picks it: the row for the line's
 * unit conversion, a branch-specific row beating a branch-less one.
 */
export type SaleGodownReader = Pick<
  Prisma.TransactionClient,
  'branchMaster' | 'godownLocation' | 'itemPriceMaster'
>;

export type SaleGodown = { gdlId: string; gdlName: string; gdlNegativeStock: boolean };

/** One line to resolve: the item and its unit conversion (iuc_id). */
export type SaleGodownLine = { itemId: string; iucId: string };

export const saleGodownKey = (line: SaleGodownLine): string => `${line.itemId}|${line.iucId}`;

/** Step 3 alone: the branch's default godown id, or null when unset / retired. */
export async function branchDefaultGodownId(
  prisma: SaleGodownReader,
  branchId: string,
): Promise<string | null> {
  const branch = await prisma.branchMaster.findFirst({
    where: { brId: branchId },
    select: { brDefaultGodownId: true },
  });
  if (!branch?.brDefaultGodownId) return null;
  const godown = await prisma.godownLocation.findFirst({
    where: { gdlId: branch.brDefaultGodownId, gdlIsDeleted: false },
    select: { gdlId: true },
  });
  return godown?.gdlId ?? null;
}

/**
 * Steps 2–3 for a batch of lines, keyed by saleGodownKey. A line whose item has
 * no price row for that unit and whose branch has no live default maps to null.
 */
export async function resolveDefaultSaleGodowns(
  prisma: SaleGodownReader,
  branchId: string,
  lines: readonly SaleGodownLine[],
): Promise<Map<string, SaleGodown | null>> {
  const result = new Map<string, SaleGodown | null>();
  if (lines.length === 0) return result;
  const itemIds = [...new Set(lines.map((line) => line.itemId))];
  const [priceRows, branchDefault] = await Promise.all([
    prisma.itemPriceMaster.findMany({
      where: {
        ipmItemId: { in: itemIds },
        OR: [{ ipmBranchId: branchId }, { ipmBranchId: null }],
        ipmIsDeleted: false,
      },
      select: { ipmItemId: true, ipmUcUnitId: true, ipmBranchId: true, ipmGodownId: true },
      orderBy: { ipmId: 'asc' },
    }),
    branchDefaultGodownId(prisma, branchId),
  ]);
  // Same preference as preferBranchPriceRows: first row per unit, replaced by
  // a branch-specific one if the first was branch-less.
  const rowByKey = new Map<string, (typeof priceRows)[number]>();
  for (const row of priceRows) {
    const key = saleGodownKey({ itemId: row.ipmItemId, iucId: row.ipmUcUnitId });
    const current = rowByKey.get(key);
    if (!current || (current.ipmBranchId !== branchId && row.ipmBranchId === branchId)) {
      rowByKey.set(key, row);
    }
  }
  const godownIdByKey = new Map<string, string | null>();
  for (const line of lines) {
    const key = saleGodownKey(line);
    godownIdByKey.set(key, rowByKey.get(key)?.ipmGodownId ?? branchDefault);
  }
  const godownIds = [
    ...new Set([...godownIdByKey.values()].filter((id): id is string => id !== null)),
  ];
  const godowns = godownIds.length
    ? await prisma.godownLocation.findMany({
        where: { gdlId: { in: godownIds } },
        select: { gdlId: true, gdlName: true, gdlNegativeStock: true },
      })
    : [];
  const godownById = new Map(godowns.map((godown) => [godown.gdlId, godown]));
  for (const [key, godownId] of godownIdByKey) {
    result.set(key, godownId ? (godownById.get(godownId) ?? null) : null);
  }
  return result;
}

/**
 * The effective "may this line go below zero", as /item-price derives
 * allow_negative_stock: a service item always may; otherwise it is blocked
 * only when the godown, the company AND the item all say no. An unknown
 * godown or company (null) is not a "no".
 */
export function saleLineAllowsNegativeStock(
  item: { itemIsService: boolean; itemAllowNegStock: boolean },
  godownAllowsNegStock: boolean | null | undefined,
  companyAllowsNegStock: boolean | null | undefined,
): boolean {
  return (
    item.itemIsService ||
    !(
      godownAllowsNegStock === false &&
      companyAllowsNegStock === false &&
      item.itemAllowNegStock === false
    )
  );
}
