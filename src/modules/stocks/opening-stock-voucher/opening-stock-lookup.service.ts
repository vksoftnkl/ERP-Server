import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { throwStockNotFound, toNumber } from 'src/common/utils/module-service.utils';
import { StockMrpPriceGateway } from '../selling-price-bulk/stock-mrp-price.gateway';
import {
  effectivePolicyLateral,
  unreversedLedgerRow,
} from '../stock-voucher/stock-voucher-posting.helper';
import type {
  StockErrorDetail,
  StockErrorResponse,
} from '../stock-voucher/types/stock-voucher.types';
import type {
  OpeningStockItemLookup,
  OpeningStockItemLookupArgs,
} from './types/opening-stock-lookup.types';

/** 19q Q6 as the driver returns it, before the Decimals are turned into numbers. */
interface LookupRow {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  barcode: string | null;
  uomId: string;
  unitName: string;
  toBaseFactor: Prisma.Decimal;
  baseUomId: string;
  taxPerc: Prisma.Decimal;
  cessPerc: Prisma.Decimal;
  cessUnit: Prisma.Decimal;
  trackSignature: string;
  alreadyOpened: boolean;
}

/** The second read, run only when Q6 came back empty — which of its causes applies. */
interface EmptyCauseRow {
  isActive: boolean;
  isDeleted: boolean;
  /** item_company_id, so the message can say the item belongs to another company or to nobody. */
  companyId: string | null;
  branchId: string | null;
  isService: boolean;
  conversions: number;
  hasDefault: boolean;
  uomFound: boolean;
}

/**
 * THE ITEM PICKER LOOKUP for the Opening Stock line grid — 19q Q6.
 *
 * Why this exists at all: the screen used to call the SALES lookup
 * (`/master-lookups/item-price`), which prices an item for a customer at a
 * price level. Two things it does not return, both of which an opening line
 * cannot be built without:
 *
 *   * `baseUomId`. `svi_base_uom_id` is NOT NULL and is NOT resolved
 *     server-side on save. A screen that guesses it from the selling unit is
 *     right only for single-unit items, and silently wrong for anything sold
 *     in boxes.
 *   * the tracking signature. Which of batch / MRP / sale price / expiry /
 *     serial / supplier the line must carry. Without it the grid either offers
 *     every identity column (and the values are discarded at post) or none.
 *
 * So the opening screen has its own lookup. It is not a variant of the sales
 * one and is not bolted onto it: a price level means nothing here, and a cost
 * means nothing there.
 *
 * THE POLICY IS RESOLVED BY THE ENGINE'S OWN FRAGMENT. `effectivePolicyLateral`
 * is the one definition of "which StockTrackPolicy applies" that the preflight
 * and the post already share; Q6's inlined CTE was that same rule transcribed
 * a third time, so the fragment is used here instead. The picker, the
 * preflight and the post therefore cannot disagree about a line's identity.
 *
 * PRICES GO THROUGH StockMrpPriceGateway. `stock.stock_mrp_price` is not on
 * every database (no Prisma model, ships out of band from the share), and a
 * LEFT JOIN to a relation that does not exist is not "no row", it is 42P01 —
 * the whole picker would fail on every database that lacks it. The seed is
 * therefore a second, gated read: skipped, with `mrp`/`salePrice` 0, wherever
 * the gateway says the table is not deployed. Everything above the price
 * columns was verified end to end on 192.168.0.106 (2026-09-08); the price
 * read itself is untested, per Q6's own status note.
 */
@Injectable()
export class OpeningStockLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mrpPrices: StockMrpPriceGateway,
  ) {}

  /**
   * One row, or a 404 that says WHICH of Q6's causes produced no row. Q6 is a
   * single empty result by design — the screen cannot act on the causes
   * differently, every one of them means the line cannot be built — but the
   * message must still name the right one: on 192.168.0.106 only 46 of 10,041
   * live items have any conversion row, so "no such item" would be a
   * misleading answer for almost all of them.
   */
  async lookupItem(args: OpeningStockItemLookupArgs): Promise<OpeningStockItemLookup> {
    const uomId = args.uomId ?? null;
    // Absent and null are one thing to the query: no restriction on that
    // dimension. Every predicate below is written as "param IS NULL OR ...",
    // so a null binds cleanly instead of turning `= NULL` into no rows.
    const companyId = args.companyId ?? null;
    const branchId = args.branchId ?? null;
    const [row] = await this.prisma.$queryRaw<LookupRow[]>`
      SELECT i.item_id                                         AS "itemId",
             i.item_code                                       AS "itemCode",
             i.item_name_en                                    AS "itemName",
             i.item_default_barcode                            AS "barcode",

             -- The unit the line is keyed in, and the unit it is STORED in.
             -- Both are iuc_ids, never unit_ids — svi_uom_id and
             -- svi_base_uom_id both point at the conversion row.
             u.iuc_id                                          AS "uomId",
             um.unit_name                                      AS "unitName",
             u.iuc_to_base_factor                              AS "toBaseFactor",
             b.iuc_id                                          AS "baseUomId",

             COALESCE(t.tax_gst_rate_total, 0)                 AS "taxPerc",
             COALESCE(t.tax_cess_perc, 0)                      AS "cessPerc",
             COALESCE(t.tax_cess_unit, 0)                      AS "cessUnit",

             -- Which identity columns the line must carry. 'N' when nothing
             -- matches at all is not a fallback, it is the rule: track nothing.
             COALESCE(stp.stp_track_signature, 'N')            AS "trackSignature",

             -- Scoped to whatever of company / branch was given; with
             -- neither it means "opened anywhere".
             -- Aliased sml because unreversedLedgerRow expects that name
             -- (and a backtick here would end the template literal). ONE
             -- definition of "still counts" across the badge, the preflight
             -- and the post, so the screen cannot call a holding opened that
             -- the post would let through, or the reverse.
             EXISTS (SELECT 1
                       FROM stock.stock_ledger sml
                      WHERE (${companyId}::uuid IS NULL OR sml.sml_company_id = ${companyId}::uuid)
                        AND (${branchId}::uuid  IS NULL OR sml.sml_branch_id  = ${branchId}::uuid)
                        AND sml.sml_item_id  = i.item_id
                        AND sml.sml_txn_type = 'OPENING'
                        AND ${unreversedLedgerRow()})          AS "alreadyOpened"

        FROM inventory.item_master i

        -- The keyed unit: the one asked for, or the item's default when none was.
        JOIN inventory.item_unit_conversion u
             ON u.iuc_item_id = i.item_id
            AND COALESCE(u.iuc_is_deleted, false) = false
            AND (u.iuc_id = ${uomId}::uuid
                 OR (${uomId}::uuid IS NULL AND u.iuc_is_default_unit = true))
        JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id

        -- The base unit, as a CONVERSION ROW. iuc_base_unit_id on the keyed
        -- row is a unit_id (item_unit_master); svi_base_uom_id is an iuc_id.
        -- Passing the pointer through does not store a nearly-right value, it
        -- fails fk_svi_base_uom. The factor is the keyed row's own; this join
        -- exists solely to turn base unit into base row, and is on the keyed
        -- row's own pointer rather than iuc_is_base_unit so that the factor
        -- and the base id always describe the same conversion.
        JOIN inventory.item_unit_conversion b
             ON b.iuc_item_id = i.item_id
            AND b.iuc_unit_id = u.iuc_base_unit_id
            AND COALESCE(b.iuc_is_deleted, false) = false

        -- LEFT: item_default_tax_id is nullable, and an item with no tax slab
        -- is still an item that can be opened.
        LEFT JOIN inventory.item_tax_master t ON t.tax_id = i.item_default_tax_id

        -- A null company or branch here matches only the policy rows that
        -- are themselves company-wide / branch-wide, which is the fragment's
        -- own "IS NULL OR =" shape doing the right thing unchanged.
        ${effectivePolicyLateral({
          companyId: Prisma.sql`${companyId}::uuid`,
          branchId: Prisma.sql`${branchId}::uuid`,
          itemId: Prisma.raw('i.item_id'),
          itemGroupId: Prisma.raw('i.item_group_id'),
          onDate: Prisma.sql`${args.onDate}::date`,
        })}

       WHERE i.item_id = ${args.itemId}::uuid
         -- Both flags are NOT NULL on item_master, so the strict form is safe.
         AND i.item_is_active  = true
         AND i.item_is_deleted = false
         -- SCOPE THE ITEM TO THE COMPANY WHEN ONE IS GIVEN. Without this the
         -- lookup will happily fill a line from another company's item:
         -- /master-lookups/item-by-barcode takes no company at all, and on
         -- 192.168.0.106 a scan of 2323232323 resolved to another company's
         -- item which this lookup then returned in full (confirmed
         -- 2026-09-08).
         --
         -- When a company IS given the match is STRICT, not "= company OR
         -- IS NULL". A null company means something definite for
         -- stock_track_policy, stock_ageing_slab and stock_reason_master
         -- (shared with every company) and nothing at all for an item;
         -- treating it as shared here would invent a rule. When NO company is
         -- given (the parameter is null or empty) the predicate is off
         -- altogether — the caller asked for the item regardless of who owns it.
         AND (NULLIF(${companyId}::text, '') IS NULL
              OR i.item_company_id = ${companyId}::uuid)
         -- BRANCH, on the other hand, IS nullable-means-shared: 10,010 of the
         -- 10,041 live items carry no branch and belong to the whole company,
         -- 31 are branch-specific. With a branch given: this branch's own
         -- items plus the company-wide ones, never another branch's — the
         -- same shape fn_stp_effective uses for stp_branch_id. The asymmetry
         -- with the company predicate is deliberate. With no branch given the
         -- predicate is off, like the company one.
         AND (NULLIF(${branchId}::text, '') IS NULL
              OR i.item_branch_id IS NULL
              OR i.item_branch_id = ${branchId}::uuid)
         -- ONLY GOODS ENTER STOCK. item_is_service, NOT item_stock_type: that
         -- column reads 'FG' on 10,038 of 10,041 live items and carries no
         -- agreed vocabulary, so a predicate on it would exclude every real
         -- item in the database.
         AND COALESCE(i.item_is_service, false) = false
       LIMIT 1
    `;

    if (!row) {
      return this.throwWhyEmpty(args);
    }

    const seed = this.mrpPrices.isDeployed
      ? await this.mrpPrices.findOpeningSeedBucket({
          companyId,
          branchId,
          itemId: row.itemId,
          uomId: row.uomId,
          onDate: args.onDate,
        })
      : null;

    return {
      itemId: row.itemId,
      itemCode: row.itemCode,
      itemName: row.itemName,
      barcode: row.barcode,
      uomId: row.uomId,
      unitName: row.unitName,
      toBaseFactor: toNumber(row.toBaseFactor),
      baseUomId: row.baseUomId,
      taxPerc: toNumber(row.taxPerc),
      cessPerc: toNumber(row.cessPerc),
      cessUnit: toNumber(row.cessUnit),
      trackSignature: row.trackSignature,
      mrp: seed?.mrp ?? 0,
      salePrice: seed?.salePrice ?? 0,
      alreadyOpened: row.alreadyOpened,
    };
  }

  /**
   * Q6 returned nothing. One more read, on the empty path only, to say which of
   * its causes applies — in the order the joins would have dropped the row.
   */
  private async throwWhyEmpty(args: OpeningStockItemLookupArgs): Promise<never> {
    const uomId = args.uomId ?? null;
    const companyId = args.companyId ?? null;
    const branchId = args.branchId ?? null;
    const [cause] = await this.prisma.$queryRaw<EmptyCauseRow[]>`
      SELECT i.item_is_active                                     AS "isActive",
             i.item_is_deleted                                    AS "isDeleted",
             i.item_company_id                                   AS "companyId",
             i.item_branch_id                                    AS "branchId",
             COALESCE(i.item_is_service, false)                  AS "isService",
             (SELECT count(*)::int
                FROM inventory.item_unit_conversion c
               WHERE c.iuc_item_id = i.item_id
                 AND COALESCE(c.iuc_is_deleted, false) = false)  AS "conversions",
             EXISTS (SELECT 1
                       FROM inventory.item_unit_conversion c
                      WHERE c.iuc_item_id = i.item_id
                        AND COALESCE(c.iuc_is_deleted, false) = false
                        AND c.iuc_is_default_unit = true)        AS "hasDefault",
             EXISTS (SELECT 1
                       FROM inventory.item_unit_conversion c
                      WHERE c.iuc_item_id = i.item_id
                        AND COALESCE(c.iuc_is_deleted, false) = false
                        AND c.iuc_id = ${uomId}::uuid)           AS "uomFound"
        FROM inventory.item_master i
       WHERE i.item_id = ${args.itemId}::uuid
    `;

    const notFound = (field: string, detail: string): never =>
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        'This item cannot be put on an opening line',
        field,
        detail,
      );

    if (!cause || cause.isDeleted) {
      return notFound('itemId', 'No such item.');
    }
    if (!cause.isActive) {
      return notFound('itemId', 'This item is inactive; activate it on the item master first.');
    }
    // Scope before everything else, in the order the WHERE drops the row —
    // but only the dimensions the caller actually restricted: with no company
    // given, the company predicate was off and cannot be why the row is gone.
    // An item with NO company is a row nobody owns, not a shared one — it is
    // named as such rather than folded into "another company's".
    if (companyId !== null && cause.companyId === null) {
      return notFound(
        'itemId',
        'This item has no company set, so no company can open it; set one on the item master.',
      );
    }
    if (companyId !== null && cause.companyId !== companyId) {
      return notFound('itemId', 'This item belongs to another company.');
    }
    if (branchId !== null && cause.branchId !== null && cause.branchId !== branchId) {
      return notFound('itemId', 'This item belongs to another branch of the company.');
    }
    if (cause.isService) {
      return notFound('itemId', 'This is a service item; a service has no stock to open.');
    }
    if (cause.conversions === 0) {
      return notFound(
        'itemId',
        'This item has no unit conversion, so there is no unit to key it in; set one on the item master.',
      );
    }
    if (uomId !== null && !cause.uomFound) {
      return notFound('uomId', "This unit is not one of the item's conversions.");
    }
    if (uomId === null && !cause.hasDefault) {
      return notFound(
        'uomId',
        'This item has no default unit; send uomId, or mark one of its conversions as the default.',
      );
    }
    // The keyed row exists but its base unit has no conversion row of its own,
    // so there is no iuc_id to store in svi_base_uom_id.
    return notFound(
      'uomId',
      "The unit's base unit has no conversion row of its own on this item; add it on the item master.",
    );
  }
}
