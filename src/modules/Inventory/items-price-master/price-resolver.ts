/**
 * ONE price table, ONE resolver (plan-nestjs-one-price-table.md §2).
 *
 * `inventory.item_price_master` holds the headline row an item has always had
 * AND the MRP / sale-price buckets: a row whose `ipm_bucket_mrp` /
 * `ipm_bucket_sp` are both NULL is the headline, a row with one set is "what
 * stock at THIS MRP sells for". This function picks the row that prices a line,
 * and every caller — the sale lookup, menu 30's grid, the item card — asks it
 * rather than re-deriving the rule. It is `fn_smp_effective` with the UNION
 * collapsed, because there is no second table to union any more.
 *
 * PURE: no Prisma, no Nest, no clock. It takes the rows the caller already read
 * (the lookup's own `findMany`) so the till can run it offline over its synced
 * copy of the table and reach the same answer the server does.
 *
 * The bucket key it is handed must already be POLICY-BLANKED — see
 * `bucketKeyFor` in stock-voucher-posting.helper.ts, the same rule lot
 * identity uses. An untracked item therefore always asks for (NULL, NULL), i.e.
 * its headline, whatever MRP the bill typed.
 */

/** The price-defining half of a lot's identity. NULL = that dimension is not a bucket. */
export interface BucketKey {
  mrp: number | null;
  salePrice: number | null;
}

/** BUCKET = the exact (MRP, sale price) row answered; MASTER = the headline did. */
export type PriceSource = 'BUCKET' | 'MASTER';

/** BRANCH = the winning row belongs to one branch (an override); CHAIN = branch NULL. */
export type PriceScope = 'BRANCH' | 'CHAIN';

/** The headline's key. */
export const HEADLINE_KEY: Readonly<BucketKey> = Object.freeze({ mrp: null, salePrice: null });

/** The sentinel `ipm_key_mrp` / `ipm_key_sp` (and `slt_key_mrp` / `slt_key_sp`) store for NULL. */
export const NO_BUCKET_KEY = -1;

type DecimalLike = number | string | { toString(): string };
type DateLike = Date | string;

/** The columns the resolver reads. A Prisma `ItemPriceMaster` satisfies it as is. */
export interface PriceRowScope {
  ipmCompanyId: string | null;
  ipmBranchId: string | null;
  /** GENERATED: COALESCE(ipm_bucket_mrp, -1). */
  ipmKeyMrp: DecimalLike | null;
  /** GENERATED: COALESCE(ipm_bucket_sp, -1). */
  ipmKeySp: DecimalLike | null;
  ipmEffectiveFrom: DateLike;
  ipmEffectiveTo: DateLike;
  ipmIsDeleted: boolean;
}

/**
 * Who is asking. An omitted (undefined / null) company or branch switches that
 * half of the scope filter off — the lookup's long-standing "resolve across
 * every branch" when no branch is given.
 */
export interface PriceCallerScope {
  companyId?: string | null;
  branchId?: string | null;
}

export interface ResolvedPrice<R> {
  row: R;
  source: PriceSource;
  scope: PriceScope;
}

/**
 * The row that prices `key` on `onDate`, or null ("no price row" — the lookup's
 * 404 `Item price not found`).
 *
 * Rules, in the order they decide:
 *   1. only rows in force: not deleted, onDate within [effective_from, effective_to];
 *   2. only rows of the caller's scope or wider (company = ? OR NULL, branch = ? OR NULL);
 *   3. EXACT BUCKET FIRST — key_mrp = COALESCE(key.mrp, -1) and key_sp =
 *      COALESCE(key.salePrice, -1); among them branch beats chain, then company
 *      beats shared (`ORDER BY (branch IS NULL), (company IS NULL)`, the
 *      fn_stp_effective pattern) → BUCKET;
 *   4. else the same ordering over the (-1, -1) headline rows → MASTER;
 *   5. else null.
 *
 * `rows` should be ONE unit's rows — the unit is chosen before the row
 * (selectUnitRate). Ties that survive the ordering keep the caller's order.
 *
 * @param onDate `YYYY-MM-DD` — the document's date, not necessarily today.
 */
export function resolveEffectivePrice<R extends PriceRowScope>(
  rows: readonly R[],
  key: BucketKey,
  onDate: string,
  caller: PriceCallerScope = {},
): ResolvedPrice<R> | null {
  const live = livePriceRows(rows, onDate, caller);
  const wanted = keyOf(key);
  const exact = mostSpecific(live.filter((row) => rowKeyEquals(row, wanted)));
  if (exact && !isHeadlineKey(key)) {
    return { row: exact, source: 'BUCKET', scope: scopeOf(exact) };
  }
  const headline = mostSpecific(live.filter((row) => rowKeyEquals(row, keyOf(HEADLINE_KEY))));
  return headline ? { row: headline, source: 'MASTER', scope: scopeOf(headline) } : null;
}

/**
 * Rules 1 and 2 alone: the rows in force on `onDate` at the caller's scope or
 * wider. For a caller that must choose something BEFORE the row — the lookup
 * chooses the unit first — so it never picks a unit only a future-dated or
 * another branch's row prices.
 */
export function livePriceRows<R extends PriceRowScope>(
  rows: readonly R[],
  onDate: string,
  caller: PriceCallerScope = {},
): R[] {
  return rows.filter((row) => isInForce(row, onDate) && isInScope(row, caller));
}

/** Both dimensions blank. */
export function isHeadlineKey(key: BucketKey): boolean {
  return key.mrp === null && key.salePrice === null;
}

/** The bucket a stored row prices, read back off its generated key columns. */
export function bucketKeyOfRow(row: Pick<PriceRowScope, 'ipmKeyMrp' | 'ipmKeySp'>): BucketKey {
  const mrp = toAmount(row.ipmKeyMrp);
  const salePrice = toAmount(row.ipmKeySp);
  return {
    mrp: mrp === null || sameAmount(mrp, NO_BUCKET_KEY) ? null : mrp,
    salePrice: salePrice === null || sameAmount(salePrice, NO_BUCKET_KEY) ? null : salePrice,
  };
}

/**
 * A bucket value as the table can hold it: a positive amount, else NULL.
 * `ck_ipm_bucket_mrp` / `ck_ipm_bucket_sp` refuse 0 and negatives, and an MRP of
 * 0 is how a skip_mrp shop says "no MRP" — never a bucket of its own.
 */
export function normalizeBucketValue(value: DecimalLike | null | undefined): number | null {
  const amount = toAmount(value);
  return amount !== null && amount > 0 ? amount : null;
}

/** Two keys name the same bucket. */
export function sameBucket(a: BucketKey, b: BucketKey): boolean {
  return nullableEquals(a.mrp, b.mrp) && nullableEquals(a.salePrice, b.salePrice);
}

/** `CHAIN` when the row has no branch, else `BRANCH`. */
export function scopeOf(row: Pick<PriceRowScope, 'ipmBranchId'>): PriceScope {
  return row.ipmBranchId === null ? 'CHAIN' : 'BRANCH';
}

/** The day part of a date column, as `YYYY-MM-DD`. Prisma returns @db.Date at UTC midnight. */
export function toDay(value: DateLike): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function isInForce(row: PriceRowScope, onDate: string): boolean {
  const day = onDate.slice(0, 10);
  return (
    !row.ipmIsDeleted && toDay(row.ipmEffectiveFrom) <= day && day <= toDay(row.ipmEffectiveTo)
  );
}

function isInScope(row: PriceRowScope, caller: PriceCallerScope): boolean {
  const companyOk =
    !caller.companyId || row.ipmCompanyId === null || row.ipmCompanyId === caller.companyId;
  const branchOk =
    !caller.branchId || row.ipmBranchId === null || row.ipmBranchId === caller.branchId;
  return companyOk && branchOk;
}

/** Branch beats chain, then company beats shared; the caller's order breaks what is left. */
function mostSpecific<R extends PriceRowScope>(rows: readonly R[]): R | null {
  let best: R | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const rank = (row.ipmBranchId === null ? 2 : 0) + (row.ipmCompanyId === null ? 1 : 0);
    if (rank < bestRank) {
      best = row;
      bestRank = rank;
    }
  }
  return best;
}

function keyOf(key: BucketKey): { mrp: number; salePrice: number } {
  return {
    mrp: key.mrp ?? NO_BUCKET_KEY,
    salePrice: key.salePrice ?? NO_BUCKET_KEY,
  };
}

function rowKeyEquals(row: PriceRowScope, wanted: { mrp: number; salePrice: number }): boolean {
  return (
    sameAmount(toAmount(row.ipmKeyMrp) ?? NO_BUCKET_KEY, wanted.mrp) &&
    sameAmount(toAmount(row.ipmKeySp) ?? NO_BUCKET_KEY, wanted.salePrice)
  );
}

function toAmount(value: DecimalLike | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const amount = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(amount) ? amount : null;
}

/** numeric(18,6) equality without float noise: half a unit in the sixth place. */
function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 5e-7;
}

function nullableEquals(a: number | null, b: number | null): boolean {
  return a === null || b === null ? a === b : sameAmount(a, b);
}
