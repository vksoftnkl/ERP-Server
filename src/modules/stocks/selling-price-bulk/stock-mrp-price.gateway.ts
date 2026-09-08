/*
 * Every method below takes the arguments its statement will bind and uses none
 * of them yet — see the class comment. The names are `_`-prefixed and the rule
 * is off for the file rather than for eighteen individual lines.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * Every method is `async` and awaits nothing yet. They stay async because the
 * $queryRaw that fills each one is awaited, and because a caller must not have
 * to change when they are filled in.
 */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { buildStockErrorResponse, toNumber } from 'src/common/utils/module-service.utils';
import type { ScopeResolution } from './selling-price-scope.helper';
import {
  STOCK_MRP_PRICE_NOT_DEPLOYED,
  type PagedResult,
  type PriceLevel,
  type SellingPriceNoStockRow,
  type SellingPriceProblem,
  type SellingPriceRow,
  type StockErrorDetail,
  type StockErrorResponse,
} from './types/selling-price-bulk.types';

/** What §3's grid is filtered by. All optional but the company. */
export interface ListSellingPricesArgs {
  companyId: string;
  branchId: string;
  itemGroupId?: string;
  itemBrandId?: string;
  itemSectionId?: string;
  supplierId?: string;
  limit: number;
  offset: number;
}

/** The bucket the opening picker SEEDS a line with — 19q Q6's price columns. */
export interface OpeningSeedBucket {
  mrp: number;
  salePrice: number;
}

/** What Q6's price seed is keyed by: the document's scope, the item, the keyed unit, the document date. */
export interface OpeningSeedBucketArgs {
  /** null restricts the read to company-wide (smp_company_id IS NULL) rows. */
  companyId: string | null;
  /** null restricts the read to branch-wide (smp_branch_id IS NULL) rows. */
  branchId: string | null;
  itemId: string;
  uomId: string;
  onDate: string;
}

/** One level's write, after §5.1's server recompute. */
export interface BucketLevelWrite {
  level: PriceLevel;
  price: number;
  priceWot: number;
  markupPerc: number;
}

/**
 * One changed row, complete.
 *
 * ONE type for Q26, S1, S2 and S3 rather than a "candidate" and a "write",
 * because they are the same row at four moments and splitting them invites the
 * validated row and the written row to drift apart — which is precisely the
 * failure §5.3 guards against on the confirm round trip.
 *
 * `roundOff` is carried and stored, never applied here: §5.1 puts the rounding
 * at the client's price-with-tax step, and its unit (decimal places, or a
 * nearest multiple) is not settled in this repo.
 */
export interface BucketPriceCandidate {
  lineNo: number;
  companyId: string;
  itemId: string;
  uomId: string;
  /** The bucket the row was loaded with. NULL means S1 has nothing to match on but the identity. */
  bucketId: string | null;
  /** The identity dimensions. At least one is non-null or this is not a bucket row at all — §6. */
  mrp: number | null;
  salePrice: number | null;
  levels: BucketLevelWrite[];
  minPrice: number | null;
  roundOff: number | null;
  actor: string;
}

/**
 * EVERY statement this module runs against `stock.stock_mrp_price`, and nothing
 * else. One class, so that the day `schema/stock/16_stock.sql` §20 is deployed
 * to this database, one file changes.
 *
 * WHY IT IS EMPTY TODAY. Verified 2026-09-07: there is no `stock_mrp_price`
 * model, no migration, and no reference to `smp_`, `fn_smp_effective` or
 * Q23–Q27 anywhere in `src/` or `prisma/`. The table ships out of band from the
 * `schema/stock/` share, exactly as `stock.stock_voucher` does, and that share
 * is not in this repo. Its COLUMN LIST is unverified too (§0.2) — partitioned
 * or not, levels as columns or rows, the real name of the scope discriminator —
 * so a speculative implementation here would be a second answer to "what does
 * this item cost", and the two would disagree within a month.
 *
 * WHAT GOES IN EACH METHOD WHEN IT LANDS. Q23–Q27 and S1–S3 from `16q`, as
 * `$queryRaw` **verbatim**, parameters bound, unedited. If a query has to be
 * reshaped to fit one of these signatures, the signature is wrong: the reason
 * the screen reads prices only through `fn_smp_effective` is that a second
 * implementation of the resolution rule is a second answer to the same
 * question.
 *
 * Until then every method answers 503 with the same sentence, which is the
 * honest report — the endpoint exists, it is wired, and the table it reads is
 * not on this database. A 500 with a Prisma stack trace would say the same
 * thing far less usefully.
 */
@Injectable()
export class StockMrpPriceGateway {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Whether `stock.stock_mrp_price` is available to this process.
   *
   * A single constant rather than a runtime probe, deliberately: a probe would
   * make the module's behaviour depend on the order in which a deploy touched
   * the database, and would answer "yes" to a table that exists with the wrong
   * columns. Flip it in the same commit that fills the methods in.
   */
  readonly isDeployed: boolean = false;

  /**
   * 19q Q6, the price columns — the bucket an Opening Stock line is SEEDED
   * with when the item is picked. The one caller is OpeningStockLookupService,
   * which reads `isDeployed` first and puts 0 in both columns when this is not
   * available, because a picker that fails on every database lacking the table
   * is worse than a picker with no seed.
   *
   * It is a SEED, not an answer: the table is keyed BY MRP, so it cannot tell a
   * blank line which MRP the stock has — that is what the packet says and what
   * the operator types. Most specific scope first (this branch beats chain-wide,
   * this company beats every-company — the same resolution fn_stp_effective
   * uses), then the DEAREST bucket, deliberately: an item with several live
   * MRPs has no single right answer, and the highest is the one an operator
   * notices is wrong.
   *
   * Written from Q6 as reviewed, bound and otherwise unedited. STATUS: UNTESTED
   * — Q6's own note records that everything above its price join was verified
   * on 192.168.0.106 (2026-09-08) and the join itself could not be, because §20
   * has never been deployed there. Re-run against a cluster built from the
   * chain before flipping `isDeployed`.
   */
  async findOpeningSeedBucket(args: OpeningSeedBucketArgs): Promise<OpeningSeedBucket | null> {
    if (!this.isDeployed) {
      return this.notDeployed('19q Q6');
    }
    const [row] = await this.prisma.$queryRaw<
      Array<{ mrp: Prisma.Decimal | null; salePrice: Prisma.Decimal | null }>
    >`
      SELECT smp.smp_mrp        AS "mrp",
             smp.smp_sale_price AS "salePrice"
        FROM stock.stock_mrp_price smp
       WHERE smp.smp_item_id = ${args.itemId}::uuid
         AND smp.smp_uom_id  = ${args.uomId}::uuid
         AND (smp.smp_company_id = ${args.companyId}::uuid OR smp.smp_company_id IS NULL)
         AND (smp.smp_branch_id  = ${args.branchId}::uuid  OR smp.smp_branch_id  IS NULL)
         AND ${args.onDate}::date BETWEEN smp.smp_effective_from AND smp.smp_effective_to
         AND smp.smp_is_active  = true
         AND smp.smp_is_deleted = false
       ORDER BY (smp.smp_branch_id  IS NULL),
                (smp.smp_company_id IS NULL),
                smp.smp_mrp DESC NULLS LAST
       LIMIT 1
    `;
    if (!row) {
      return null;
    }
    return {
      mrp: row.mrp === null ? 0 : toNumber(row.mrp),
      salePrice: row.salePrice === null ? 0 : toNumber(row.salePrice),
    };
  }

  /** Q25 — one row per (item × uom × live bucket) with stock, plus §4.2's headline rows. */
  async listPrices(_args: ListSellingPricesArgs): Promise<PagedResult<SellingPriceRow>> {
    return this.notDeployed('16q Q25');
  }

  /** Q24 — every live bucket of one item, both dimensions grouped. §4. */
  async listBuckets(
    _itemId: string,
    _companyId: string,
    _branchId: string,
  ): Promise<SellingPriceRow[]> {
    return this.notDeployed('16q Q24');
  }

  /**
   * Q26 — the per-row verdict. §5.2.
   *
   * Runs inside the caller's transaction because §5.3 re-runs it on the
   * confirmed post: the first POST's verdicts are stale by definition, cost
   * moves when a purchase posts, and the confirm is the user agreeing to the
   * PRICE, not to a particular cost figure.
   */
  async validateRows(
    _tx: Prisma.TransactionClient,
    _candidates: readonly BucketPriceCandidate[],
    _scope: ScopeResolution[],
  ): Promise<SellingPriceProblem[]> {
    return this.notDeployed('16q Q26');
  }

  /**
   * S1 — find the row at the TARGET scope, `FOR UPDATE`.
   *
   * The scope is a predicate, not a filter on the result: searching at BRANCH
   * scope must not find the chain row, which is the whole mechanism behind
   * §5.5 row 2 (a *This branch* save over a CHAIN-sourced row creates an
   * override rather than editing the chain). Returns null when there is none,
   * and the caller inserts.
   */
  async findBucketRowForUpdate(
    _tx: Prisma.TransactionClient,
    _candidate: BucketPriceCandidate,
    _scope: ScopeResolution,
  ): Promise<{ smpId: string } | null> {
    return this.notDeployed('16q S1');
  }

  /** S2 — update the row S1 found. */
  async updateBucketPrice(
    _tx: Prisma.TransactionClient,
    _smpId: string,
    _candidate: BucketPriceCandidate,
  ): Promise<string> {
    return this.notDeployed('16q S2');
  }

  /**
   * S3 — insert a row at the target scope, returning its `smp_id`.
   *
   * Never sets the effective-from/to pair from a payload: §12 keeps the
   * scheduling feature dormant, this screen writes "now" rows only, and
   * `ex_smp_overlap` is what enforces that two of them cannot claim one bucket.
   */
  async insertBucketPrice(
    _tx: Prisma.TransactionClient,
    _candidate: BucketPriceCandidate,
    _scope: ScopeResolution,
  ): Promise<string> {
    return this.notDeployed('16q S3');
  }

  /** Q27 — of the rows just written, the ones with nothing on hand. §5.4. */
  async listNoStock(
    _tx: Prisma.TransactionClient,
    _smpIds: readonly string[],
    _branchId: string,
  ): Promise<SellingPriceNoStockRow[]> {
    return this.notDeployed('16q Q27');
  }

  private notDeployed(statement: string): never {
    throw new ServiceUnavailableException(
      buildStockErrorResponse<StockErrorDetail, StockErrorResponse>(STOCK_MRP_PRICE_NOT_DEPLOYED, [
        {
          field: 'stock.stock_mrp_price',
          message: `${STOCK_MRP_PRICE_NOT_DEPLOYED} Waiting on ${statement}.`,
        },
      ]),
    );
  }
}
