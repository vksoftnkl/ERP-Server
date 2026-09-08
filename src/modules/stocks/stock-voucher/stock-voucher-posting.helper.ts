import { Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import type { StockVoucherTypeRules } from './types/stock-voucher.types';

/**
 * THE POSTING ENGINE, IN THE APPLICATION RATHER THAN IN THE DATABASE.
 *
 * The models describe a different arrangement, and it is worth being explicit
 * about the departure rather than letting a reader discover it: `stock_balance`
 * says in its own doc comment that it is TRIGGER-MAINTAINED, that `fn_sml_apply`
 * owns it, and that application code writing the four accumulators "has moved
 * stock without a ledger row to explain it". `stock_lot.slt_total_on_hand` says
 * the same.
 *
 * Neither `stock.fn_svh_post`, `stock.fn_slt_resolve` nor `stock.fn_sml_apply`
 * exists — not in this repo, not on the database. They live in an external
 * `schema/stock/19_stock_posting.sql` share that has never been deployed here,
 * so `post()` calling `fn_svh_post` failed with an undefined-function 42883 and
 * nothing has ever maintained a balance row. This module is the decision to post
 * from the service instead.
 *
 * WHAT THAT COSTS, so it is not rediscovered as a bug:
 *   * The ledger is still written FIRST and the balance is still derived from
 *     the rows this function just inserted — the direction of truth is
 *     unchanged, only the place the arithmetic happens.
 *   * Anything that writes `stock_ledger` WITHOUT coming through here leaves the
 *     balance stale. Today nothing does.
 *   * If the external share is ever deployed, `tr_sml_apply` will fire on these
 *     same inserts and apply every movement A SECOND TIME. Deploying it means
 *     routing `post()` back to `fn_svh_post` in the same change — see
 *     `usesInProcessPosting`.
 *   * `stock_item_cost` (the moving weighted average `fn_sml_apply` also
 *     maintains) is NOT written here. `AVG_COST` reads it, so an average that
 *     was never seeded stays unseeded; `validate()` already refuses to post a
 *     document that depends on one.
 *
 * Everything runs in the CALLER'S transaction and set-based — one statement per
 * phase, not one per line — so a four-hundred-line opening posts in six
 * statements and either all of it commits or none of it does.
 */

/** +1 brings stock in, -1 takes it out. `sml_signed_base_qty` is generated from it. */
const DIRECTION_IN = 1;
const DIRECTION_OUT = -1;

/**
 * `sml_src_module` / `slt_inward_src_module` for every row this engine writes.
 *
 * 'STOCK', NOT 'INVENTORY'. The two tables speak different vocabularies and the
 * mistake is invisible until a 23514 at post time: `ck_sml_src_module` allows
 * SALES | PURCHASE | STOCK | LOYALTY | PRODUCTION | MIGRATION, while
 * `txn_status_log`'s `ck_tsl_src_module` allows SALES | PURCHASE | INVENTORY |
 * ACCOUNTS | POS | SERVICE | OTHER — which has no STOCK. One document therefore
 * files itself under two different module names in two different tables, on
 * purpose, and neither constant may be reused for the other table.
 */
export const STOCK_LEDGER_SRC_MODULE = 'STOCK';

/**
 * True when `post()` must run this engine instead of calling `rules.postFunction`.
 *
 * Keyed on the function NAME rather than on the voucher type because that is
 * exactly the discriminator `postFunction` already exists to be: the generic
 * entry point is reimplemented here, while `fn_svh_post_transfer` and
 * `fn_svh_receive_transfer` are NOT — a transfer also writes `stock_transit` and
 * a paired document, and half-implementing that would move stock out of a branch
 * with nothing recording that it is on a lorry. Those routes keep calling their
 * engine functions and keep failing until the share is deployed, which is the
 * honest outcome.
 */
export function usesInProcessPosting(rules: StockVoucherTypeRules): boolean {
  return rules.postFunction === 'stock.fn_svh_post';
}

/**
 * DEFAULT_ACTOR IS "NOBODY", NOT A USER, and must never be stamped into an audit
 * column.
 *
 * `resolveActor` returns the nil uuid when a request carries no authenticated
 * user, and every audit write elsewhere in the service passes it through
 * `StockVoucherService.auditActor` to collapse that to NULL. Writing it raw
 * leaves `svh_modified_by = 00000000-0000-0000-0000-000000000000` on the header
 * and on every line — a row that looks attributed and is not, which is worse
 * than an empty column because a reader has no way to tell the two apart.
 */
function auditColumnActor(actor: string): string | null {
  return actor === DEFAULT_ACTOR ? null : actor;
}

export interface PostStockVoucherParams {
  rules: StockVoucherTypeRules;
  svhId: string;
  accYear: string;
  /**
   * The resolved actor. Never null — `resolveActor` falls back to DEFAULT_ACTOR,
   * the nil uuid — so it is passed through `auditColumnActor` before it reaches
   * any audit column. See that function for why writing it raw is wrong.
   */
  actor: string;
  /** One instant for every row the post writes, so a trail sorts unambiguously. */
  postedOn: Date;
}

/**
 * Posts one DRAFT voucher: lots resolved, ledger written, balances applied,
 * lot totals updated, lines stamped with their lot, header moved to POSTED.
 *
 * Returns the number of LEDGER ROWS written, which is what `fn_svh_post`
 * returned and what the API reports as `rowsPosted`. It is not always the line
 * count: a count line whose variance is zero moves nothing and posts no row.
 *
 * The caller has already taken the header lock, asserted DRAFT and run
 * `validate()`. This function assumes all three.
 */
export async function postStockVoucher(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
): Promise<number> {
  const { svhId, accYear, actor, postedOn } = params;
  const author = auditColumnActor(actor);

  await resolveLots(tx, params);
  await attachLotsToLines(tx, params);
  const rowsPosted = await writeLedger(tx, params);
  await applyBalances(tx, params);
  await refreshLotTotals(tx, params);

  await tx.stockVoucher.update({
    where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
    data: {
      svhStatus: 'POSTED',
      svhPostedOn: postedOn,
      // NULL rather than the nil uuid when nobody is authenticated: "posted by
      // nobody" is the truth, and svh_posted_by is nullable to say it.
      svhPostedBy: author,
      svhVersionNo: { increment: 1 },
      svhModifiedOn: postedOn,
      svhModifiedBy: author,
    },
  });

  return rowsPosted;
}

/**
 * The CTE chain every phase below starts from, and a deliberate copy of the one
 * `validate()` builds: the effective StockTrackPolicy per line, then the six
 * identity dimensions blanked wherever the policy does not track them and
 * collapsed onto the sentinels `ux_slt_identity` is built over ('~', -1,
 * 0001-01-01, the nil uuid).
 *
 * IT MUST STAY IDENTICAL TO validate()'s. The preflight tells the user "this
 * holding already has an opening in this year" by keying exactly this way; a
 * post that keyed differently would open a second lot for a holding the
 * preflight just said was already open.
 *
 * `line_cost_rate` is where `fn_sml_cost_default` used to sit. It fills a GAP
 * and never overrides: a line that states its own cost keeps it, and only a zero
 * falls through to the document's rate source. That ordering matters on a
 * transfer-like document, where an honoured client rate produces a silently
 * wrong ledger.
 */
function postingCte(svhId: string, accYear: string, isCount: boolean): Prisma.Sql {
  return Prisma.sql`
    doc AS (
      SELECT svh.svh_id,
             svh.svh_acc_year,
             svh.svh_company_id,
             svh.svh_branch_id,
             svh.svh_tenant_id,
             svh.svh_doc_date,
             svh.svh_doc_datetime,
             svh.svh_refno,
             svh.svh_reason_id,
             svh.svh_supplier_id,
             svh.svh_rate_source
        FROM stock.stock_voucher svh
       WHERE svh.svh_id       = ${svhId}::uuid
         AND svh.svh_acc_year = ${accYear}::bpchar
    ),
    line AS (
      SELECT svi.*, doc.svh_doc_date, doc.svh_doc_datetime, doc.svh_rate_source,
             doc.svh_company_id, doc.svh_branch_id, doc.svh_tenant_id,
             doc.svh_refno, doc.svh_reason_id, doc.svh_supplier_id
        FROM stock.stock_voucher_item svi
        JOIN doc ON doc.svh_id = svi.svi_voucher_id AND doc.svh_acc_year = svi.svi_acc_year
       WHERE svi.svi_is_deleted = false
    ),
    policy AS (
      SELECT line.svi_id,
             COALESCE(stp.stp_track_batch,      false) AS track_batch,
             COALESCE(stp.stp_track_mrp,        false) AS track_mrp,
             COALESCE(stp.stp_track_sale_price, false) AS track_sale_price,
             COALESCE(stp.stp_track_expiry,     false) AS track_expiry,
             COALESCE(stp.stp_track_serial,     false) AS track_serial,
             COALESCE(stp.stp_track_supplier,   false) AS track_supplier
        FROM line
        JOIN inventory.item_master itm ON itm.item_id = line.svi_item_id
        LEFT JOIN LATERAL (
          SELECT p.*
            FROM stock.stock_track_policy p
           WHERE p.stp_is_active  = true
             AND p.stp_is_deleted = false
             AND line.svh_doc_date BETWEEN p.stp_effective_from AND p.stp_effective_to
             AND (p.stp_company_id IS NULL OR p.stp_company_id = line.svh_company_id)
             AND (p.stp_branch_id  IS NULL OR p.stp_branch_id  = line.svh_branch_id)
             AND (
                   (p.stp_scope = 'ITEM'    AND p.stp_scope_id = line.svi_item_id)
                OR (p.stp_scope = 'GROUP'   AND p.stp_scope_id = itm.item_group_id)
                OR  p.stp_scope = 'COMPANY'
             )
           ORDER BY (p.stp_branch_id IS NOT NULL) DESC,
                    (p.stp_company_id IS NOT NULL) DESC,
                    CASE p.stp_scope WHEN 'ITEM' THEN 0 WHEN 'GROUP' THEN 1 ELSE 2 END,
                    p.stp_effective_from DESC
           LIMIT 1
        ) stp ON true
    ),
    keyed AS (
      SELECT line.*,
             policy.track_batch, policy.track_mrp, policy.track_sale_price,
             policy.track_expiry, policy.track_serial, policy.track_supplier,
             CASE WHEN policy.track_batch      THEN NULLIF(line.svi_batch_no, '') END AS lot_batch_no,
             CASE WHEN policy.track_mrp        THEN line.svi_mrp         END          AS lot_mrp,
             CASE WHEN policy.track_sale_price THEN line.svi_sale_price  END          AS lot_sale_price,
             CASE WHEN policy.track_expiry     THEN line.svi_expiry_date END          AS lot_expiry_date,
             CASE WHEN policy.track_serial     THEN NULLIF(line.svi_serial_no, '') END AS lot_serial_no,
             CASE WHEN policy.track_supplier   THEN line.svi_supplier_id END          AS lot_supplier_id,
             COALESCE(CASE WHEN policy.track_batch      THEN NULLIF(line.svi_batch_no, '') END, '~')          AS key_batch,
             COALESCE(CASE WHEN policy.track_mrp        THEN line.svi_mrp         END, -1)                    AS key_mrp,
             COALESCE(CASE WHEN policy.track_sale_price THEN line.svi_sale_price  END, -1)                    AS key_sp,
             COALESCE(CASE WHEN policy.track_expiry     THEN line.svi_expiry_date END, DATE '0001-01-01')     AS key_expiry,
             COALESCE(CASE WHEN policy.track_serial     THEN NULLIF(line.svi_serial_no, '') END, '~')         AS key_serial,
             COALESCE(CASE WHEN policy.track_supplier   THEN line.svi_supplier_id END,
                      '00000000-0000-0000-0000-000000000000'::uuid)                                           AS key_supplier,
             -- 'B/M/S/E/R/P' in a fixed order, 'N' when the policy tracks
             -- nothing. Stamped on the lot so a policy change tomorrow cannot
             -- make today's lots unreadable.
             COALESCE(NULLIF(
               CASE WHEN policy.track_batch      THEN 'B' ELSE '' END ||
               CASE WHEN policy.track_mrp        THEN 'M' ELSE '' END ||
               CASE WHEN policy.track_sale_price THEN 'S' ELSE '' END ||
               CASE WHEN policy.track_expiry     THEN 'E' ELSE '' END ||
               CASE WHEN policy.track_serial     THEN 'R' ELSE '' END ||
               CASE WHEN policy.track_supplier   THEN 'P' ELSE '' END,
             ''), 'N')                                                                                        AS track_signature,
             -- THE VARIANCE IS THE MOVEMENT ON A COUNT. svi_diff_qty is
             -- GENERATED (counted - book) and is the only quantity a count
             -- line moves; svi_qty is 0 on every count line by construction.
             CASE WHEN ${isCount}::boolean
                  THEN ABS(COALESCE(line.svi_diff_qty, 0))
                  ELSE line.svi_base_qty END                                                                  AS move_base_qty,
             CASE WHEN ${isCount}::boolean
                  THEN ABS(COALESCE(line.svi_diff_qty, 0))
                  ELSE line.svi_qty      END                                                                  AS move_qty,
             CASE WHEN ${isCount}::boolean THEN 0 ELSE line.svi_free_qty      END                             AS move_free_qty,
             CASE WHEN ${isCount}::boolean THEN 0 ELSE line.svi_free_base_qty END                              AS move_free_base_qty
        FROM line
        JOIN policy ON policy.svi_id = line.svi_id
    ),
    costed AS (
      SELECT keyed.*,
             -- Only a zero falls through — see the note on this function.
             COALESCE(NULLIF(keyed.svi_cost_rate, 0),
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN sic.sic_avg_cost_rate
                        WHEN 'LAST_PURCHASE' THEN sic.sic_last_purchase_rate
                        ELSE NULL
                      END,
                      0)                                     AS line_cost_rate,
             COALESCE(NULLIF(keyed.svi_cost_rate_wot, 0),
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN sic.sic_avg_cost_rate_wot
                        ELSE NULL
                      END,
                      0)                                     AS line_cost_rate_wot
        FROM keyed
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = keyed.svh_company_id
              AND sic.sic_branch_id  = keyed.svh_branch_id
              AND sic.sic_item_id    = keyed.svi_item_id
              AND sic.sic_is_deleted = false
    )
  `;
}

/**
 * Phase 1 — the lots this document needs, created if they do not exist.
 *
 * `ON CONFLICT DO NOTHING` against `ux_slt_identity` rather than a read-then-
 * write: two tills opening the same holding at the same instant would both read
 * "no lot" and both insert, and it is the unique index — not a SELECT — that
 * decides which one wins. The conflict target is left unspecified so the partial
 * predicate on the index does not have to be restated.
 *
 * DISTINCT ON collapses the document's own duplicates first, because a statement
 * cannot conflict-resolve against a row it is inserting in the same command.
 */
async function resolveLots(
  tx: Prisma.TransactionClient,
  { rules, svhId, accYear, actor }: PostStockVoucherParams,
): Promise<void> {
  const isCount = rules.quantityMode === 'COUNT';
  await tx.$executeRaw`
    WITH ${postingCte(svhId, accYear, isCount)}
    INSERT INTO stock.stock_lot (
      slt_company_id, slt_tenant_id, slt_item_id, slt_base_uom_id,
      slt_batch_no, slt_mrp, slt_sale_price, slt_mfg_date, slt_expiry_date,
      slt_serial_no, slt_supplier_id, slt_track_signature,
      slt_first_inward_date, slt_first_inward_branch,
      slt_inward_src_module, slt_inward_src_doc_type, slt_inward_src_doc_id,
      slt_inward_src_acc_year, slt_inward_refno,
      slt_purchase_rate, slt_cost_rate, slt_cost_rate_wot, slt_landed_rate, slt_tax_rate,
      slt_created_by
    )
    SELECT DISTINCT ON (c.svh_company_id, c.svi_item_id, c.key_batch, c.key_mrp,
                        c.key_sp, c.key_expiry, c.key_serial, c.key_supplier)
           c.svh_company_id, c.svh_tenant_id, c.svi_item_id, c.svi_base_uom_id,
           c.lot_batch_no, c.lot_mrp, c.lot_sale_price, c.svi_mfg_date, c.lot_expiry_date,
           c.lot_serial_no, c.lot_supplier_id, c.track_signature,
           -- The CHAIN's ageing anchor, from the document's own date rather than
           -- today's: a March opening keyed in April is March-old stock.
           c.svh_doc_date, c.svh_branch_id,
           ${STOCK_LEDGER_SRC_MODULE}, ${rules.voucherType}, c.svi_voucher_id,
           c.svi_acc_year, c.svh_refno,
           c.line_cost_rate, c.line_cost_rate, c.line_cost_rate_wot, c.svi_landed_rate, c.svi_tax_perc,
           ${auditColumnActor(actor)}
      FROM costed c
     ORDER BY c.svh_company_id, c.svi_item_id, c.key_batch, c.key_mrp,
              c.key_sp, c.key_expiry, c.key_serial, c.key_supplier,
              c.svi_line_no, c.svi_split_no
    ON CONFLICT DO NOTHING
  `;
}

/**
 * Phase 2 — every line gets the `slt_id` its identity resolves to.
 *
 * COALESCE and not an assignment: a COUNT and a TRANSFER already carry one —
 * their line names the holding it reconciles or moves — and overwriting it would
 * point a count at a different lot than the sheet was generated against, when the
 * whole point of the drift check is that it was not.
 *
 * The resolved cost IS written back on every line, lot or no lot, because it is
 * the figure the ledger row was valued at and a line that disagreed with its own
 * movement would be unexplainable afterwards.
 */
async function attachLotsToLines(
  tx: Prisma.TransactionClient,
  { rules, svhId, accYear, postedOn, actor }: PostStockVoucherParams,
): Promise<void> {
  const isCount = rules.quantityMode === 'COUNT';
  await tx.$executeRaw`
    WITH ${postingCte(svhId, accYear, isCount)}
    UPDATE stock.stock_voucher_item svi
       SET svi_lot_id        = COALESCE(svi.svi_lot_id, slt.slt_id),
           svi_cost_rate     = c.line_cost_rate,
           svi_cost_rate_wot = c.line_cost_rate_wot,
           svi_modified_on   = ${postedOn},
           svi_modified_by   = ${auditColumnActor(actor)}
      FROM costed c
      JOIN stock.stock_lot slt
        ON slt.slt_company_id  = c.svh_company_id
       AND slt.slt_item_id     = c.svi_item_id
       AND slt.slt_key_batch   = c.key_batch
       AND slt.slt_key_mrp     = c.key_mrp
       AND slt.slt_key_sp      = c.key_sp
       AND slt.slt_key_expiry  = c.key_expiry
       AND slt.slt_key_serial  = c.key_serial
       AND slt.slt_key_supplier = c.key_supplier
       AND slt.slt_is_deleted  = false
     WHERE svi.svi_id       = c.svi_id
       AND svi.svi_acc_year = c.svi_acc_year
  `;
}

/**
 * Phase 3 — the ledger. THE TRUTH, and everything after this is derived from it.
 *
 * A zero-variance count line is skipped rather than posted as a zero row: it
 * records that nothing moved, which the count sheet already says, and a ledger
 * full of them makes every quantity report scan rows that sum to nothing.
 *
 * `sml_signed_base_qty` is GENERATED from direction and the base quantities and
 * is deliberately absent from the column list — Postgres rejects any write to it.
 */
async function writeLedger(
  tx: Prisma.TransactionClient,
  { rules, svhId, accYear, actor, postedOn }: PostStockVoucherParams,
): Promise<number> {
  const isCount = rules.quantityMode === 'COUNT';
  // A count posts two txn types in one document, decided per line by the sign of
  // the variance; every other type posts one, decided by the document.
  const [plusTxnType, minusTxnType] = isCount
    ? [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[1] ?? rules.ledgerTxnTypes[0]]
    : [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[0]];
  const direction = rules.isInward ? DIRECTION_IN : DIRECTION_OUT;

  return tx.$executeRaw`
    WITH ${postingCte(svhId, accYear, isCount)}
    INSERT INTO stock.stock_ledger (
      sml_company_id, sml_branch_id, sml_tenant_id, sml_acc_year, sml_godown_id,
      sml_item_id, sml_lot_id, sml_uom_id, sml_base_uom_id, sml_to_base_factor,
      sml_src_module, sml_src_doc_type, sml_src_doc_id, sml_src_acc_year, sml_src_refno,
      sml_line_no, sml_split_no,
      sml_txn_type, sml_direction, sml_bucket,
      sml_doc_date, sml_doc_datetime, sml_posted_on,
      sml_qty, sml_base_qty, sml_free_qty, sml_free_base_qty, sml_weight_qty,
      sml_cost_rate, sml_cost_value, sml_cost_rate_wot, sml_cost_value_wot,
      sml_landed_rate, sml_landed_value,
      sml_mrp, sml_batch_no, sml_expiry_date,
      sml_reason_id, sml_created_by
    )
    SELECT c.svh_company_id, c.svh_branch_id, c.svh_tenant_id, c.svi_acc_year, c.svi_godown_id,
           c.svi_item_id, svi.svi_lot_id, c.svi_uom_id, c.svi_base_uom_id, c.svi_to_base_factor,
           ${STOCK_LEDGER_SRC_MODULE}, ${rules.voucherType}, c.svi_voucher_id, c.svi_acc_year, c.svh_refno,
           c.svi_line_no, c.svi_split_no,
           CASE WHEN ${isCount}::boolean
                THEN CASE WHEN COALESCE(c.svi_diff_qty, 0) >= 0 THEN ${plusTxnType} ELSE ${minusTxnType} END
                ELSE ${plusTxnType} END,
           CASE WHEN ${isCount}::boolean
                THEN CASE WHEN COALESCE(c.svi_diff_qty, 0) >= 0 THEN ${DIRECTION_IN} ELSE ${DIRECTION_OUT} END
                ELSE ${direction} END,
           c.svi_bucket,
           c.svh_doc_date, c.svh_doc_datetime, ${postedOn},
           c.move_qty, c.move_base_qty, c.move_free_qty, c.move_free_base_qty, c.svi_weight_qty,
           c.line_cost_rate,     ROUND(c.line_cost_rate     * (c.move_base_qty + c.move_free_base_qty), 2),
           c.line_cost_rate_wot, ROUND(c.line_cost_rate_wot * (c.move_base_qty + c.move_free_base_qty), 2),
           c.svi_landed_rate,    ROUND(c.svi_landed_rate    * (c.move_base_qty + c.move_free_base_qty), 2),
           c.svi_mrp, c.svi_batch_no, c.svi_expiry_date,
           COALESCE(c.svi_reason_id, c.svh_reason_id), ${auditColumnActor(actor)}
      FROM costed c
      JOIN stock.stock_voucher_item svi
        ON svi.svi_id = c.svi_id AND svi.svi_acc_year = c.svi_acc_year
     WHERE (c.move_base_qty + c.move_free_base_qty) <> 0
  `;
}

/**
 * Phase 4 — the balance, from the rows phase 3 just wrote and from nothing else.
 *
 * Aggregated per HOLDING first, so a document with four lines against one
 * holding produces one conflicting insert rather than four that fight over the
 * same row. The conflict target restates `ux_sbl_scope`'s predicate because a
 * partial unique index cannot be inferred without it.
 *
 * The accumulators are ADDED to on conflict, never assigned: a balance is the
 * running total of every movement ever posted against the holding, and the
 * generated `sbl_on_hand_qty` / `sbl_available_qty` fall out of them. Neither is
 * written here — Postgres rejects any write to a generated column.
 *
 * `sml_cost_value` IS A MAGNITUDE, NOT A SIGNED AMOUNT. The ledger's own doc
 * says it: "on an inward these are what it cost. On an outward they are the
 * COGS" — both positive. Summing it flat would make an issue INCREASE the value
 * on the shelf, so the sum applies `sml_direction` the way `sml_signed_base_qty`
 * already applies it to quantity. All-inward documents never showed this; a
 * count with a negative variance does.
 *
 * `sbl_avg_cost_rate` is DERIVED FROM THE TWO COLUMNS BESIDE IT — the new value
 * over the new on-hand — and not accumulated, because an average of an average
 * is not an average. `stock_balance` says these are trigger-maintained and must
 * never be written from application code; that rule assumed `fn_sml_apply`,
 * which is not deployed, and leaving them is not neutral — they stay at their
 * DEFAULT 0 while `sbl_stock_value` is right, so every reader that costs an
 * issue off the average silently values stock at nothing.
 *
 * WHEN ON-HAND IS NOT POSITIVE THE EXISTING RATE IS KEPT, never overwritten
 * with a division by zero or with the negative that a short balance would
 * produce: the last unit leaving the shelf does not make the next inward a
 * fresh start, which is the same rule `stock_item_cost` states for itself.
 *
 * The outward is taken out at the LEDGER'S OWN cost value rather than re-valued
 * at the running average, keeping "the balance is derived from the rows phase 3
 * just wrote and from nothing else" literally true. On an `AVG_COST` document
 * the two are the same figure. On a `MANUAL` one they are not, and a book that
 * must issue at the average needs `stock_item_cost` — which nothing maintains
 * yet, and which is the separate gap named at the top of this file.
 *
 * The identity cache and the ageing anchors are refreshed from the lot on every
 * apply, which is what `fn_sml_apply` did with them.
 */
async function applyBalances(
  tx: Prisma.TransactionClient,
  { svhId, accYear, actor, postedOn }: PostStockVoucherParams,
): Promise<void> {
  // The holding's on-hand AFTER this document, written out so the conflict
  // branch can divide by it: the existing row's generated total plus the four
  // deltas the refused insert proposed.
  const newOnHand = Prisma.sql`(COALESCE(stock.stock_balance.sbl_on_hand_qty, 0)
                                 + EXCLUDED.sbl_in_qty  + EXCLUDED.sbl_free_in_qty
                                 - EXCLUDED.sbl_out_qty - EXCLUDED.sbl_free_out_qty)`;

  await tx.$executeRaw`
    WITH moved AS (
      SELECT sml.sml_company_id, sml.sml_branch_id, sml.sml_tenant_id,
             sml.sml_godown_id, sml.sml_item_id, sml.sml_lot_id,
             sml.sml_base_uom_id, sml.sml_bucket,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_base_qty      ELSE 0 END) AS in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_base_qty      ELSE 0 END) AS out_qty,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_free_base_qty ELSE 0 END) AS free_in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_free_base_qty ELSE 0 END) AS free_out_qty,
             SUM(sml.sml_signed_base_qty)                                               AS signed_qty,
             SUM(sml.sml_cost_value     * sml.sml_direction)                            AS cost_value,
             SUM(sml.sml_cost_value_wot * sml.sml_direction)                            AS cost_value_wot,
             MAX(sml.sml_doc_date) FILTER (WHERE sml.sml_direction > 0)                 AS last_in_date,
             MAX(sml.sml_doc_date) FILTER (WHERE sml.sml_direction < 0)                 AS last_out_date,
             MIN(sml.sml_doc_date) FILTER (WHERE sml.sml_direction > 0)                 AS first_in_date
        FROM stock.stock_ledger sml
       WHERE sml.sml_src_doc_id = ${svhId}::uuid
         AND sml.sml_acc_year   = ${accYear}::bpchar
         AND sml.sml_is_deleted = false
       GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
    )
    INSERT INTO stock.stock_balance (
      sbl_company_id, sbl_branch_id, sbl_tenant_id, sbl_godown_id, sbl_item_id,
      sbl_lot_id, sbl_base_uom_id, sbl_bucket,
      sbl_in_qty, sbl_out_qty, sbl_free_in_qty, sbl_free_out_qty,
      sbl_stock_value, sbl_stock_value_wot,
      sbl_avg_cost_rate, sbl_avg_cost_rate_wot,
      sbl_first_in_date, sbl_last_in_date, sbl_last_out_date,
      sbl_batch_no, sbl_mrp, sbl_sale_price, sbl_expiry_date, sbl_supplier_id,
      sbl_created_by
    )
    SELECT m.sml_company_id, m.sml_branch_id, m.sml_tenant_id, m.sml_godown_id, m.sml_item_id,
           m.sml_lot_id, m.sml_base_uom_id, m.sml_bucket,
           m.in_qty, m.out_qty, m.free_in_qty, m.free_out_qty,
           m.cost_value, m.cost_value_wot,
           -- A row being created has no prior rate to keep, so a non-positive
           -- opening on-hand can only be 0.
           CASE WHEN m.signed_qty > 0 THEN ROUND(m.cost_value     / m.signed_qty, 6) ELSE 0 END,
           CASE WHEN m.signed_qty > 0 THEN ROUND(m.cost_value_wot / m.signed_qty, 6) ELSE 0 END,
           m.first_in_date, m.last_in_date, m.last_out_date,
           slt.slt_batch_no, slt.slt_mrp, slt.slt_sale_price, slt.slt_expiry_date, slt.slt_supplier_id,
           ${auditColumnActor(actor)}
      FROM moved m
      JOIN stock.stock_lot slt ON slt.slt_id = m.sml_lot_id
    ON CONFLICT (sbl_company_id, sbl_branch_id, sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket)
    WHERE sbl_is_deleted = false
    DO UPDATE SET
      sbl_in_qty        = stock.stock_balance.sbl_in_qty        + EXCLUDED.sbl_in_qty,
      sbl_out_qty       = stock.stock_balance.sbl_out_qty       + EXCLUDED.sbl_out_qty,
      sbl_free_in_qty   = stock.stock_balance.sbl_free_in_qty   + EXCLUDED.sbl_free_in_qty,
      sbl_free_out_qty  = stock.stock_balance.sbl_free_out_qty  + EXCLUDED.sbl_free_out_qty,
      sbl_stock_value     = stock.stock_balance.sbl_stock_value     + EXCLUDED.sbl_stock_value,
      sbl_stock_value_wot = stock.stock_balance.sbl_stock_value_wot + EXCLUDED.sbl_stock_value_wot,
      -- Every SET expression reads the PRE-UPDATE row, so these two see the old
      -- value and the old on-hand however Postgres orders the clauses. The new
      -- on-hand is spelled out from EXCLUDED's four plain accumulators rather
      -- than read off EXCLUDED.sbl_on_hand_qty: that column is generated from
      -- the deltas alone, so it holds this document's movement, not the total.
      sbl_avg_cost_rate = CASE
        WHEN ${newOnHand} > 0
        THEN ROUND((stock.stock_balance.sbl_stock_value + EXCLUDED.sbl_stock_value) / ${newOnHand}, 6)
        ELSE stock.stock_balance.sbl_avg_cost_rate
      END,
      sbl_avg_cost_rate_wot = CASE
        WHEN ${newOnHand} > 0
        THEN ROUND((stock.stock_balance.sbl_stock_value_wot + EXCLUDED.sbl_stock_value_wot) / ${newOnHand}, 6)
        ELSE stock.stock_balance.sbl_avg_cost_rate_wot
      END,
      -- The FIRST inward on this shelf never moves once set; the last two do.
      sbl_first_in_date = LEAST(stock.stock_balance.sbl_first_in_date, EXCLUDED.sbl_first_in_date),
      sbl_last_in_date  = GREATEST(stock.stock_balance.sbl_last_in_date, EXCLUDED.sbl_last_in_date),
      sbl_last_out_date = GREATEST(stock.stock_balance.sbl_last_out_date, EXCLUDED.sbl_last_out_date),
      sbl_batch_no      = EXCLUDED.sbl_batch_no,
      sbl_mrp           = EXCLUDED.sbl_mrp,
      sbl_sale_price    = EXCLUDED.sbl_sale_price,
      sbl_expiry_date   = EXCLUDED.sbl_expiry_date,
      sbl_supplier_id   = EXCLUDED.sbl_supplier_id,
      sbl_row_version   = stock.stock_balance.sbl_row_version + 1,
      sbl_modified_on   = ${postedOn},
      sbl_modified_by   = ${auditColumnActor(actor)}
  `;
}

/**
 * Phase 5 — `slt_total_on_hand`, the lot's chain-wide total across every branch
 * and godown.
 *
 * Recomputed from the balance rows rather than incremented, because that is the
 * definition of the column and a re-derivation cannot drift. Only the lots this
 * document touched are recomputed.
 */
async function refreshLotTotals(
  tx: Prisma.TransactionClient,
  { svhId, accYear, actor, postedOn }: PostStockVoucherParams,
): Promise<void> {
  await tx.$executeRaw`
    WITH touched AS (
      SELECT DISTINCT sml.sml_lot_id AS lot_id
        FROM stock.stock_ledger sml
       WHERE sml.sml_src_doc_id = ${svhId}::uuid
         AND sml.sml_acc_year   = ${accYear}::bpchar
         AND sml.sml_is_deleted = false
    ),
    totals AS (
      SELECT t.lot_id,
             COALESCE(SUM(sbl.sbl_on_hand_qty), 0) AS on_hand
        FROM touched t
        LEFT JOIN stock.stock_balance sbl
               ON sbl.sbl_lot_id     = t.lot_id
              AND sbl.sbl_is_deleted = false
       GROUP BY t.lot_id
    )
    UPDATE stock.stock_lot slt
       SET slt_total_on_hand = totals.on_hand,
           slt_row_version   = slt.slt_row_version + 1,
           slt_modified_on   = ${postedOn},
           slt_modified_by   = ${auditColumnActor(actor)}
      FROM totals
     WHERE slt.slt_id = totals.lot_id
  `;
}
