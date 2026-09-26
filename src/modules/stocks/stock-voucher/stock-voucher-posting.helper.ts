import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_ACTOR, throwStockConflict } from 'src/common/utils/module-service.utils';
import type {
  StockErrorDetail,
  StockErrorResponse,
  StockVoucherTypeRules,
} from './types/stock-voucher.types';
/**
 * THE POSTING ENGINE, IN THE APPLICATION RATHER THAN IN THE DATABASE.
 *
 * The models describe a different arrangement, and it is worth being explicit
 * about the departure rather than letting a reader discover it: `stock_balance`,
 * `stock_lot` and `stock_item_cost` all say in their own doc comments that they
 * are TRIGGER-MAINTAINED by `fn_sml_apply`, and that application code writing
 * their accumulators "has moved stock without a ledger row to explain it".
 *
 * `stock.fn_svh_post`, `fn_slt_resolve` and `fn_sml_apply` are not installed
 * here. They live in an external `schema/stock/` share; its §17 trigger layer
 * was read on 2026-09-08, and this module is the DECISION to keep posting from
 * the service, with that SQL as the reference for what each phase must do.
 * Installing the share's `tr_sml_apply` on top of this engine would apply every
 * ledger row a second time — the two must never run together.
 *
 * WHAT THE DATABASE STILL OWNS — the rules that must hold whatever writes the
 * ledger, installed by migration 20260908110000 from the same share:
 *   * `tr_sml_forbid_delete` / `tr_sml_immutable`: the ledger is append-only.
 *   * `tr_sml_freeze_guard`: no movement into a godown that a DRAFT PHYSICAL
 *     count is freezing, except the count's own. It raises restrict_violation,
 *     which StockVoucherExceptionFilter answers as 409; `validate()` reports the
 *     same freeze per line first, so the screen sees it before the post.
 *   * `slt_key_batch` / `slt_key_serial` fold case and whitespace, and so do
 *     the identity keys built here — see `lotIdentityKeyColumns`.
 *
 * WHAT THIS ENGINE MAINTAINS, in order, one set-based statement per phase:
 *   1. the lots the document needs                          (`resolveLots`)
 *   2. each line's lot and resolved cost                    (`attachLotsToLines`)
 *   3. the ledger — THE TRUTH; everything after is derived from it
 *   4. `stock_balance`: accumulators, ageing anchors, identity cache
 *   5. `stock_item_cost`, the branch's moving weighted average, and the
 *      distribution of that average onto every holding of the item
 *   6. the negative-stock policy: BLOCK refuses, WARN logs, ALLOW passes
 *   7. `slt_total_on_hand`, and the lot's ACTIVE / CLOSED status with it
 *
 * A CANCELLATION IS THE SAME ENGINE RUN OVER REVERSAL ROWS. `cancelStockVoucher`
 * mirrors every ledger row the post wrote with its direction flipped
 * (`writeReversalLedger`) and then runs phases 4–7 over THOSE rows and no
 * others — which is what `stock.fn_svh_cancel` did by inserting reversals and
 * letting `tr_sml_apply` fire on each. The four derived phases are therefore
 * scoped by `ledgerRowsOf`, on `sml_is_reversal`, so a cancel never re-applies
 * the original movement it is undoing.
 *
 * Each phase is the matching step of the share's `fn_sml_apply` (§17.3), done
 * once per document instead of once per ledger row. Where a set-based phase
 * has to choose an order the trigger got from row order, the choice and its
 * reason are on the phase.
 *
 * WHAT THAT COSTS, so it is not rediscovered as a bug:
 *   * Anything that writes `stock_ledger` WITHOUT coming through here leaves
 *     the balance and the average stale. Today nothing does.
 *   * The transfer routes are not implemented here; they keep calling their
 *     engine functions and keep failing until those exist — see
 *     `usesInProcessPosting`.
 *
 * Everything runs in the CALLER'S transaction and set-based — one statement per
 * phase, not one per line — so a four-hundred-line opening posts in seven
 * statements and either all of it commits or none of it does.
 */
const logger = new Logger('StockVoucherPosting');
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
 * True when `post()` and `cancel()` must run this engine instead of calling
 * `rules.postFunction` / `stock.fn_svh_cancel`.
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
/**
 * How a NON-stock document (a sale bill, a challan, a return) labels the ledger
 * rows its shadow voucher writes. The engine keys every phase on the shadow's
 * own `svh_id` — that never changes — but `sml_src_module` / `sml_src_doc_type`
 * / `sml_src_refno` are what stock reports read, and a sale that showed up as
 * `STOCK / ISSUE` would vanish from every "sales by item" report. So the sales
 * module says who it is here and the engine writes it verbatim. Absent means
 * the classic `STOCK / <voucherType>`.
 */
export interface StockLedgerSourceLabel {
  srcModule: 'SALES' | 'PURCHASE' | 'STOCK';
  srcDocType: string;
  /** The printable number of the OWNING document, e.g. `bil00042`. */
  srcRefno?: string | null;
  partyId?: string | null;
}
export interface PostStockVoucherParams {
  rules: StockVoucherTypeRules;
  svhId: string;
  accYear: string;
  ledgerSource?: StockLedgerSourceLabel;
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
 * What phases 4–7 need: the post's parameters plus WHICH of the document's
 * ledger rows they derive from. A post applies the rows it wrote
 * (`reversal: false`); a cancel applies the reversals it wrote
 * (`reversal: true`). Both sets carry the document's own `sml_src_doc_id`, so
 * without this flag a cancel would sum the original movement back in.
 */
interface ApplyParams extends PostStockVoucherParams {
  reversal: boolean;
}
/**
 * The ledger rows one engine run derives everything from: this document's, in
 * this year, live, and on the requested side of `sml_is_reversal`. Expects the
 * ledger aliased `sml`. ONE definition for phases 4–7, so the balance, the
 * average, the policy check and the lot totals cannot disagree about which
 * rows a run is applying.
 */
function ledgerRowsOf({ svhId, accYear, reversal }: ApplyParams): Prisma.Sql {
  return Prisma.sql`
             sml.sml_src_doc_id  = ${svhId}::uuid
         AND sml.sml_acc_year    = ${accYear}::bpchar
         AND sml.sml_is_deleted  = false
         AND sml.sml_is_reversal = ${reversal}::boolean
  `;
}
/**
 * Posts one DRAFT voucher: lots resolved, ledger written, balances and the
 * moving average applied, the negative-stock policy checked, lot totals
 * updated, lines stamped with their lot, header moved to POSTED.
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
  await applyLedgerRows(tx, { ...params, reversal: false });
  await tx.stockVoucher.update({
    where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
    data: {
      // The header carries the CURRENT state and nothing else. WHO posted it and
      // WHEN is the txn_status_log row the service appends in this same
      // transaction — the header has no posted_on/_by columns to stamp.
      svhStatus: 'POSTED',
      svhVersionNo: { increment: 1 },
      svhModifiedOn: postedOn,
      svhModifiedBy: author,
    },
  });
  return rowsPosted;
}
/**
 * Phases 4–7, in order, over one side of the document's ledger rows. The one
 * sequence both a post and a cancel run once their rows are in the ledger.
 */
async function applyLedgerRows(tx: Prisma.TransactionClient, params: ApplyParams): Promise<void> {
  await applyBalances(tx, params);
  await applyItemCost(tx, params);
  await assertNegativeStockPolicy(tx, params);
  await refreshLotTotals(tx, params);
}
/**
 * The effective StockTrackPolicy for one item on one date, as a LATERAL join
 * that leaves `stp` NULL when no row matches. ONE definition, used by every
 * query in the module that resolves a lot identity — `postingCte` here,
 * `validate()` in the service, the negative-stock check below — so the
 * preflight and the post cannot disagree about which policy applies.
 *
 * PRECEDENCE IS SCOPE FIRST, then branch, then company — transcribed from the
 * share's `fn_stp_effective`: an ITEM row beats a GROUP row whatever their
 * branches or companies; within one scope a branch-specific row beats a
 * branch-wide one; company-specific breaks the remaining tie over global. An
 * earlier version here sorted branch-first, so a branch-level GROUP rule could
 * override a company-wide ITEM rule and open a lot under the wrong identity.
 * The lot is what every answer is keyed on, so every reader must sort the same.
 *
 * No row at all is a complete answer — track nothing, WAVG, FEFO, ALLOW — and
 * the correct default for a grocery line: an item needs no policy row to post.
 *
 * The scope expressions are column references from the caller's own aliases,
 * never values from a request, which is why they are `Prisma.raw`.
 */
export function effectivePolicyLateral(scope: {
  companyId: Prisma.Sql;
  branchId: Prisma.Sql;
  itemId: Prisma.Sql;
  itemGroupId: Prisma.Sql;
  onDate: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`
    LEFT JOIN LATERAL (
      SELECT p.*
        FROM stock.stock_track_policy p
       WHERE p.stp_is_active  = true
         AND p.stp_is_deleted = false
         AND ${scope.onDate} BETWEEN p.stp_effective_from AND p.stp_effective_to
         AND (p.stp_company_id IS NULL OR p.stp_company_id = ${scope.companyId})
         AND (p.stp_branch_id  IS NULL OR p.stp_branch_id  = ${scope.branchId})
         AND (
               (p.stp_scope = 'ITEM'    AND p.stp_scope_id = ${scope.itemId})
            OR (p.stp_scope = 'GROUP'   AND p.stp_scope_id = ${scope.itemGroupId})
            OR  p.stp_scope = 'COMPANY'
         )
       ORDER BY CASE
                  WHEN p.stp_scope = 'ITEM'  AND p.stp_branch_id IS NOT NULL THEN 1
                  WHEN p.stp_scope = 'ITEM'                                  THEN 2
                  WHEN p.stp_scope = 'GROUP' AND p.stp_branch_id IS NOT NULL THEN 3
                  WHEN p.stp_scope = 'GROUP'                                 THEN 4
                  WHEN p.stp_branch_id IS NOT NULL                           THEN 5
                  ELSE 6
                END,
                (p.stp_company_id IS NULL),
                p.stp_effective_from DESC
       LIMIT 1
    ) stp ON true
  `;
}

/**
 * `policy AS (...)`: the six tracking flags per line, resolved against the
 * DOCUMENT's date and not today's. Expects a `line` CTE carrying `svi_*` plus
 * the document's `svh_company_id`, `svh_branch_id` and `svh_doc_date`.
 */
export function effectivePolicyCte(): Prisma.Sql {
  return Prisma.sql`
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
        ${effectivePolicyLateral({
          companyId: Prisma.raw('line.svh_company_id'),
          branchId: Prisma.raw('line.svh_branch_id'),
          itemId: Prisma.raw('line.svi_item_id'),
          itemGroupId: Prisma.raw('itm.item_group_id'),
          onDate: Prisma.raw('line.svh_doc_date'),
        })}
    )
  `;
}
/**
 * The six identity dimensions, blanked wherever `policy` does not track them
 * and collapsed onto the sentinels `ux_slt_identity` is built over ('~', -1,
 * 0001-01-01, the nil uuid). Selects from a `line` and a `policy` alias.
 *
 * Batch and serial are UPPER-CASED AND TRIMMED, exactly as `slt_key_batch` and
 * `slt_key_serial` are generated (migration 20260908110000) and as the share's
 * `fn_slt_resolve` looks them up: a batch number is a label read off a carton,
 * and 'b-2604', 'B-2604' and 'B-2604 ' are one carton. The original spelling
 * is what the lot STORES (`lot_batch_no` in `postingCte`); only the key folds.
 */
export function lotIdentityKeyColumns(): Prisma.Sql {
  return Prisma.sql`
             COALESCE(CASE WHEN policy.track_batch      THEN NULLIF(upper(btrim(line.svi_batch_no)), '') END, '~')   AS key_batch,
             COALESCE(CASE WHEN policy.track_mrp        THEN line.svi_mrp         END, -1)                             AS key_mrp,
             COALESCE(CASE WHEN policy.track_sale_price THEN line.svi_sale_price  END, -1)                             AS key_sp,
             COALESCE(CASE WHEN policy.track_expiry     THEN line.svi_expiry_date END, DATE '0001-01-01')              AS key_expiry,
             COALESCE(CASE WHEN policy.track_serial     THEN NULLIF(upper(btrim(line.svi_serial_no)), '') END, '~')   AS key_serial,
             COALESCE(CASE WHEN policy.track_supplier   THEN line.svi_supplier_id END,
                      '00000000-0000-0000-0000-000000000000'::uuid)                                                    AS key_supplier
  `;
}
/**
 * The ledger rows that STILL COUNT: live, forward, and not reversed by a
 * cancel. Expects the ledger aliased `sml`.
 *
 * `sml_is_reversal = false` on its own is not enough, and believing it was is
 * the whole of the bug this fragment exists to end. A cancel does not touch the
 * original row — the table is append-only — it writes a mirror beside it with
 * the direction flipped. So the forward side of a cancelled document is still
 * there, still live, still `sml_is_reversal = false`, and any check that reads
 * only that side reads a cancelled movement as a live one.
 *
 * What that cost on an OPENING: a holding opened by mistake, cancelled, and
 * then re-opened correctly was refused for ever — "this holding already has an
 * opening in this year" — with no way out short of inventing a batch number,
 * which corrupts lot identity permanently to work around a query. The ledger
 * itself was never wrong: one forward row, one reversal, net zero.
 *
 * The NOT EXISTS probes `ux_sml_reversal (sml_acc_year, sml_reverses_id)` and
 * repeats that index's partial predicate, so it costs one index lookup per row
 * rather than a scan.
 *
 * ONE definition, shared: the preflight, the post guard, the item lookup badge
 * and the pending-items report must agree about what "already opened" means, or
 * the screen says a holding is free and the post then refuses it.
 */
export function unreversedLedgerRow(): Prisma.Sql {
  return Prisma.sql`
             sml.sml_is_deleted  = false
         AND sml.sml_is_reversal = false
         AND NOT EXISTS (
               SELECT 1
                 FROM stock.stock_ledger rev
                WHERE rev.sml_reverses_id = sml.sml_id
                  AND rev.sml_acc_year    = sml.sml_acc_year
                  AND rev.sml_is_reversal = true
                  AND rev.sml_is_deleted  = false)
  `;
}
/**
 * The CTE chain every phase below starts from, built from the same exported
 * fragments `validate()` builds its own from: the effective StockTrackPolicy
 * per line, then the six identity dimensions keyed exactly as `ux_slt_identity`
 * is.
 *
 * IT MUST STAY IDENTICAL TO validate()'s in what it keys on. The preflight
 * tells the user "this holding already has an opening in this year" by keying
 * exactly this way; a post that keyed differently would open a second lot for a
 * holding the preflight just said was already open. Sharing the fragments is
 * what makes that a property rather than a hope.
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
    ${effectivePolicyCte()},
    keyed AS (
      SELECT line.*,
             policy.track_batch, policy.track_mrp, policy.track_sale_price,
             policy.track_expiry, policy.track_serial, policy.track_supplier,
             -- What the lot STORES: the original spelling, trimmed. The key
             -- below folds case; the label on the carton is kept as read.
             CASE WHEN policy.track_batch      THEN NULLIF(btrim(line.svi_batch_no), '') END  AS lot_batch_no,
             CASE WHEN policy.track_mrp        THEN line.svi_mrp         END                   AS lot_mrp,
             CASE WHEN policy.track_sale_price THEN line.svi_sale_price  END                   AS lot_sale_price,
             CASE WHEN policy.track_expiry     THEN line.svi_expiry_date END                   AS lot_expiry_date,
             CASE WHEN policy.track_serial     THEN NULLIF(btrim(line.svi_serial_no), '') END  AS lot_serial_no,
             CASE WHEN policy.track_supplier   THEN line.svi_supplier_id END                   AS lot_supplier_id,
             ${lotIdentityKeyColumns()},
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
             ''), 'N')                                                                          AS track_signature,
             -- THE VARIANCE IS THE MOVEMENT ON A COUNT. svi_diff_qty is
             -- GENERATED (counted - book) and is the only quantity a count
             -- line moves; svi_qty is 0 on every count line by construction.
             CASE WHEN ${isCount}::boolean
                  THEN ABS(COALESCE(line.svi_diff_qty, 0))
                  ELSE line.svi_base_qty END                                                    AS move_base_qty,
             CASE WHEN ${isCount}::boolean
                  THEN ABS(COALESCE(line.svi_diff_qty, 0))
                  ELSE line.svi_qty      END                                                    AS move_qty,
             CASE WHEN ${isCount}::boolean THEN 0 ELSE line.svi_free_qty      END               AS move_free_qty,
             CASE WHEN ${isCount}::boolean THEN 0 ELSE line.svi_free_base_qty END               AS move_free_base_qty
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
  params: PostStockVoucherParams,
): Promise<void> {
  const { rules, svhId, accYear, actor } = params;
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
           ${params.ledgerSource?.srcModule ?? STOCK_LEDGER_SRC_MODULE},
           ${params.ledgerSource?.srcDocType ?? rules.voucherType}, c.svi_voucher_id,
           c.svi_acc_year, COALESCE(${params.ledgerSource?.srcRefno ?? null}::varchar, c.svh_refno),
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
  params: PostStockVoucherParams,
): Promise<number> {
  const { rules, svhId, accYear, actor, postedOn, ledgerSource } = params;
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
      sml_reason_id, sml_doc_rate, sml_party_id, sml_created_by
    )
    SELECT c.svh_company_id, c.svh_branch_id, c.svh_tenant_id, c.svi_acc_year, c.svi_godown_id,
           c.svi_item_id, svi.svi_lot_id, c.svi_uom_id, c.svi_base_uom_id, c.svi_to_base_factor,
           ${ledgerSource?.srcModule ?? STOCK_LEDGER_SRC_MODULE},
           ${ledgerSource?.srcDocType ?? rules.voucherType}, c.svi_voucher_id, c.svi_acc_year,
           COALESCE(${ledgerSource?.srcRefno ?? null}::varchar, c.svh_refno),
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
           COALESCE(c.svi_reason_id, c.svh_reason_id),
           -- What the owning document charged (a sale's rate): the moving
           -- average's last-sale stamp reads it. Stock vouchers have none, and
           -- the column is NOT NULL DEFAULT 0, so "none" is written as 0 and
           -- phase 5 reads 0 as "no rate" (NULLIF there), never as a price.
           COALESCE(c.svi_sale_price, 0),
           ${ledgerSource?.partyId ?? null}::uuid,
           ${auditColumnActor(actor)}
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
 * VALUE IS NOT WRITTEN HERE. `sbl_avg_cost_rate` and `sbl_stock_value` are the
 * branch's moving average distributed over what is on this shelf — in the
 * model's own words, "a distribution of stock_item_cost, not a separate truth" —
 * and phase 5 stamps them on every holding of the item once the average is
 * known. A per-holding average written here would only be overwritten there,
 * and would let a transfer between two godowns of one branch move value.
 *
 * The identity cache and the ageing anchors are refreshed from the lot on every
 * apply, which is what `fn_sml_apply` does with them.
 */
async function applyBalances(tx: Prisma.TransactionClient, params: ApplyParams): Promise<void> {
  const { actor, postedOn } = params;
  await tx.$executeRaw`
    WITH moved AS (
      SELECT sml.sml_company_id, sml.sml_branch_id, sml.sml_tenant_id,
             sml.sml_godown_id, sml.sml_item_id, sml.sml_lot_id,
             sml.sml_base_uom_id, sml.sml_bucket,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_base_qty      ELSE 0 END) AS in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_base_qty      ELSE 0 END) AS out_qty,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_free_base_qty ELSE 0 END) AS free_in_qty,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_free_base_qty ELSE 0 END) AS free_out_qty,
             MAX(sml.sml_doc_date) FILTER (WHERE sml.sml_direction > 0)                 AS last_in_date,
             MAX(sml.sml_doc_date) FILTER (WHERE sml.sml_direction < 0)                 AS last_out_date,
             MIN(sml.sml_doc_date) FILTER (WHERE sml.sml_direction > 0)                 AS first_in_date
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
       GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
    )
    INSERT INTO stock.stock_balance (
      sbl_company_id, sbl_branch_id, sbl_tenant_id, sbl_godown_id, sbl_item_id,
      sbl_lot_id, sbl_base_uom_id, sbl_bucket,
      sbl_in_qty, sbl_out_qty, sbl_free_in_qty, sbl_free_out_qty,
      sbl_first_in_date, sbl_last_in_date, sbl_last_out_date,
      sbl_batch_no, sbl_mrp, sbl_sale_price, sbl_expiry_date, sbl_supplier_id,
      sbl_created_by
    )
    SELECT m.sml_company_id, m.sml_branch_id, m.sml_tenant_id, m.sml_godown_id, m.sml_item_id,
           m.sml_lot_id, m.sml_base_uom_id, m.sml_bucket,
           m.in_qty, m.out_qty, m.free_in_qty, m.free_out_qty,
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
 * Phase 5 — `stock_item_cost`, the branch's moving weighted average, and its
 * distribution onto the holdings. Two statements: the MERGE, then the stamp.
 *
 * THE DEFINITION, from the model and from the share's `fn_sml_apply`: an inward
 * adds quantity and value at the row's own cost and recomputes the average; an
 * outward removes quantity at the CURRENT average and leaves the rate alone —
 * which is what "moving average" means, and why an outward can never change the
 * cost of what remains. The average is STORED and survives quantity reaching
 * zero: the next inward of an item that went to nil is not a fresh start.
 *
 * ORDER WITHIN ONE DOCUMENT: outwards first, at the average the branch carried
 * BEFORE the document, then inwards re-average. The trigger applies rows one at
 * a time in insertion order; a set-based phase has to choose, and this choice
 * makes an outward's relief the same figure `costed` in `postingCte` stamped on
 * its ledger row under AVG_COST — the ledger and the average agree about what
 * the shortage cost. A count that is over on one lot and short on another of
 * the same item is the only shape where the orders differ, and there the
 * difference is which side of a rounding boundary the average lands on.
 *
 * A FRESH ROW NEVER STARTS BELOW ZERO. The trigger's seed clamps the first
 * movement's quantity at 0 and takes its rate from that row's own cost, so an
 * item whose first-ever movement is an outward (ALLOW, a sale keyed before its
 * receipt) leaves the branch quantity at 0 and the negative on the balance,
 * and the next receipt starts the average clean instead of dividing a real
 * value by a quantity dragged down by stock that was never costed in. The
 * same rule here: with no current row, outwards are swallowed, the average is
 * the inward's rate when there is one and the outward's own cost when there is
 * not. `sic_max_cost_rate` is the exception — it stays "highest rate ever
 * RECEIVED at", as the model defines it, and an outward never sets it.
 *
 * An outward SALE row stamps `sic_last_sale_rate` / `_date` from its document
 * rate, exactly as the trigger does. No stock voucher posts a SALE, so today
 * this is the sales module's hook, not a live path.
 *
 * ONE ROW PER (company, branch, item), on `ux_sic_scope`. The current row is
 * locked FOR UPDATE inside the CTE before the arithmetic reads it, so two
 * documents posting the same item serialise on it and the second computes from
 * the first's committed figures. The first-ever movement of an item has no row
 * to lock, which is the race the trigger's lock-or-seed loop exists for; here a
 * transaction-scoped advisory lock per (company, branch, item), taken in item
 * order in its OWN statement before the MERGE, plays that part — the loser
 * blocks until the winner commits, and its MERGE then sees a row to MATCH. The
 * lock has to be a separate statement: a statement's snapshot is taken before
 * anything in it runs, so a lock acquired inside the MERGE could not make the
 * winner's row visible to it.
 *
 * MERGE rather than INSERT … ON CONFLICT because the update needs the OLD row
 * and the document's inward and outward sides SEPARATELY, and EXCLUDED can carry
 * only one row's worth of columns.
 *
 * THE STAMP is the trigger's "carry the branch average onto the holdings" step:
 * a weighted average is a property of the item, so when a receipt moves it,
 * every lot of that item in the branch is worth a different amount. Revaluing
 * only the lot that moved would leave the others carrying the old rate, and the
 * sum of `sbl_stock_value` would silently stop agreeing with `sic_total_value`.
 * The row count is the number of lots of one item in one branch — small.
 */
async function applyItemCost(tx: Prisma.TransactionClient, params: ApplyParams): Promise<void> {
  const { actor, postedOn } = params;
  // The first-movement lock — see the note on this function. The subquery's
  // ORDER BY is what makes two documents take these in the same order, and
  // the count() is only because the lock function returns void, which Prisma
  // cannot read back; it still runs once per row, in that order.
  await tx.$queryRaw`
    SELECT count(pg_advisory_xact_lock(hashtextextended(
             t.sml_company_id::text || ':' || t.sml_branch_id::text || ':' || t.sml_item_id::text, 0)))::int AS locked
      FROM (
            SELECT DISTINCT sml.sml_company_id, sml.sml_branch_id, sml.sml_item_id
              FROM stock.stock_ledger sml
             WHERE ${ledgerRowsOf(params)}
             ORDER BY 1, 2, 3
           ) t
  `;
  await tx.$executeRaw`
    WITH moves AS (
      SELECT sml.sml_company_id, sml.sml_branch_id, sml.sml_item_id,
             (array_agg(sml.sml_base_uom_id ORDER BY sml.sml_line_no, sml.sml_split_no))[1]                AS base_uom_id,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_base_qty + sml.sml_free_base_qty ELSE 0 END) AS qty_in,
             SUM(CASE WHEN sml.sml_direction < 0 THEN sml.sml_base_qty + sml.sml_free_base_qty ELSE 0 END) AS qty_out,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_cost_value     ELSE 0 END)                    AS value_in,
             SUM(CASE WHEN sml.sml_direction > 0 THEN sml.sml_cost_value_wot ELSE 0 END)                    AS value_in_wot,
             COALESCE(MAX(sml.sml_cost_rate) FILTER (WHERE sml.sml_direction > 0), 0)                       AS max_in_rate,
             -- The document's LAST inward line, by line order, is its "last purchase".
             (array_agg(sml.sml_cost_rate     ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction > 0))[1]                                                   AS last_in_rate,
             (array_agg(sml.sml_cost_rate_wot ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction > 0))[1]                                                   AS last_in_rate_wot,
             (array_agg(sml.sml_doc_date      ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction > 0))[1]                                                   AS last_in_date,
             -- The document's last OUTWARD line: the rate a fresh row takes
             -- when nothing was received (the trigger's seed from an outward).
             (array_agg(sml.sml_cost_rate     ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction < 0))[1]                                                   AS last_out_rate,
             (array_agg(sml.sml_cost_rate_wot ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction < 0))[1]                                                   AS last_out_rate_wot,
             -- An outward SALE stamps the last sale, from the DOCUMENT rate.
             -- 0 is "no rate" (the column is NOT NULL): it must not overwrite
             -- the stamp a priced sale left, so it reads as NULL here.
             (array_agg(NULLIF(sml.sml_doc_rate, 0) ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction < 0 AND sml.sml_txn_type = 'SALE'))[1]                     AS last_sale_rate,
             (array_agg(sml.sml_doc_date      ORDER BY sml.sml_line_no DESC, sml.sml_split_no DESC)
                 FILTER (WHERE sml.sml_direction < 0 AND sml.sml_txn_type = 'SALE'))[1]                     AS last_sale_date
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
       GROUP BY 1, 2, 3
    ),
    cur AS (
      SELECT c.sic_company_id, c.sic_branch_id, c.sic_item_id,
             c.sic_total_qty, c.sic_total_value, c.sic_total_value_wot,
             c.sic_avg_cost_rate, c.sic_avg_cost_rate_wot, c.sic_max_cost_rate,
             c.sic_last_purchase_rate, c.sic_last_purchase_date,
             c.sic_last_sale_rate, c.sic_last_sale_date
        FROM stock.stock_item_cost c
        JOIN moves m
          ON m.sml_company_id = c.sic_company_id
         AND m.sml_branch_id  = c.sic_branch_id
         AND m.sml_item_id    = c.sic_item_id
       WHERE c.sic_is_deleted = false
         FOR UPDATE OF c
    ),
    step AS (
      -- Outwards first, at the average the branch carried before this document.
      -- A fresh row swallows them: it never starts below zero.
      SELECT m.*,
             (c.sic_company_id IS NOT NULL)                                                                AS has_row,
             CASE WHEN c.sic_company_id IS NOT NULL THEN c.sic_total_qty - m.qty_out ELSE 0 END + m.qty_in AS new_qty,
             GREATEST(COALESCE(c.sic_total_value, 0)
                      - ROUND(m.qty_out * COALESCE(c.sic_avg_cost_rate, 0), 2), 0) + m.value_in          AS new_value,
             GREATEST(COALESCE(c.sic_total_value_wot, 0)
                      - ROUND(m.qty_out * COALESCE(c.sic_avg_cost_rate_wot, 0), 2), 0) + m.value_in_wot  AS new_value_wot,
             COALESCE(c.sic_avg_cost_rate, 0)                                                              AS old_avg,
             COALESCE(c.sic_avg_cost_rate_wot, 0)                                                          AS old_avg_wot,
             GREATEST(COALESCE(c.sic_max_cost_rate, 0), m.max_in_rate)                                     AS new_max,
             CASE WHEN m.qty_in > 0 THEN m.last_in_rate ELSE c.sic_last_purchase_rate END                  AS new_last_rate,
             CASE WHEN m.qty_in > 0 THEN m.last_in_date ELSE c.sic_last_purchase_date END                  AS new_last_date,
             COALESCE(m.last_sale_rate, c.sic_last_sale_rate, 0)                                           AS new_sale_rate,
             COALESCE(m.last_sale_date, c.sic_last_sale_date)                                              AS new_sale_date
        FROM moves m
        LEFT JOIN cur c
               ON c.sic_company_id = m.sml_company_id
              AND c.sic_branch_id  = m.sml_branch_id
              AND c.sic_item_id    = m.sml_item_id
    ),
    next AS (
      -- Then inwards re-average. Quantity at or below zero keeps a rate: the
      -- document's last inward if it had one, otherwise the rate as it stood —
      -- and a fresh row with nothing received takes its outward's own cost.
      SELECT step.*,
             CASE WHEN step.new_qty > 0 THEN ROUND(step.new_value     / step.new_qty, 6)
                  WHEN step.qty_in  > 0 THEN step.last_in_rate
                  WHEN NOT step.has_row THEN COALESCE(step.last_out_rate, 0)
                  ELSE step.old_avg END                                                                    AS new_avg,
             CASE WHEN step.new_qty > 0 THEN ROUND(step.new_value_wot / step.new_qty, 6)
                  WHEN step.qty_in  > 0 THEN step.last_in_rate_wot
                  WHEN NOT step.has_row THEN COALESCE(step.last_out_rate_wot, 0)
                  ELSE step.old_avg_wot END                                                                AS new_avg_wot
        FROM step
    )
    MERGE INTO stock.stock_item_cost c
    USING next n
       ON c.sic_company_id = n.sml_company_id
      AND c.sic_branch_id  = n.sml_branch_id
      AND c.sic_item_id    = n.sml_item_id
      AND c.sic_is_deleted = false
    WHEN MATCHED THEN UPDATE SET
         sic_total_qty          = n.new_qty,
         sic_total_value        = n.new_value,
         sic_total_value_wot    = n.new_value_wot,
         sic_avg_cost_rate      = n.new_avg,
         sic_avg_cost_rate_wot  = n.new_avg_wot,
         sic_max_cost_rate      = n.new_max,
         sic_last_purchase_rate = COALESCE(n.new_last_rate, 0),
         sic_last_purchase_date = n.new_last_date,
         sic_last_sale_rate     = n.new_sale_rate,
         sic_last_sale_date     = n.new_sale_date,
         sic_row_version        = c.sic_row_version + 1,
         sic_modified_on        = ${postedOn},
         sic_modified_by        = ${auditColumnActor(actor)}
    WHEN NOT MATCHED THEN INSERT (
         sic_company_id, sic_branch_id, sic_item_id, sic_base_uom_id,
         sic_total_qty, sic_total_value, sic_total_value_wot,
         sic_avg_cost_rate, sic_avg_cost_rate_wot, sic_max_cost_rate,
         sic_last_purchase_rate, sic_last_purchase_date,
         sic_last_sale_rate, sic_last_sale_date, sic_created_by)
       VALUES (
         n.sml_company_id, n.sml_branch_id, n.sml_item_id, n.base_uom_id,
         n.new_qty, n.new_value, n.new_value_wot,
         n.new_avg, n.new_avg_wot, n.new_max,
         COALESCE(n.new_last_rate, 0), n.new_last_date,
         n.new_sale_rate, n.new_sale_date, ${auditColumnActor(actor)})
  `;
  // The stamp. Only the four value columns, the way the trigger writes them: a
  // revaluation is not a movement, so the row version and audit columns of a
  // holding that did not move are left alone.
  await tx.$executeRaw`
    WITH touched AS (
      SELECT DISTINCT sml.sml_company_id, sml.sml_branch_id, sml.sml_item_id
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
    )
    UPDATE stock.stock_balance b
       SET sbl_avg_cost_rate     = c.sic_avg_cost_rate,
           sbl_avg_cost_rate_wot = c.sic_avg_cost_rate_wot,
           sbl_stock_value       = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate,     2),
           sbl_stock_value_wot   = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate_wot, 2)
      FROM touched t
      JOIN stock.stock_item_cost c
        ON c.sic_company_id = t.sml_company_id
       AND c.sic_branch_id  = t.sml_branch_id
       AND c.sic_item_id    = t.sml_item_id
       AND c.sic_is_deleted = false
     WHERE b.sbl_company_id = c.sic_company_id
       AND b.sbl_branch_id  = c.sic_branch_id
       AND b.sbl_item_id    = c.sic_item_id
       AND b.sbl_is_deleted = false
  `;
}
/** One holding this document drove below zero, with the policy that decides what that means. */
interface NegativeHolding {
  itemName: string;
  batchNo: string | null;
  godownName: string | null;
  onHand: string;
  allowNegative: string;
}
/**
 * Phase 6 — the negative-stock policy, `fn_sml_apply`'s last step.
 *
 * Every holding this document touched is re-read AFTER the balances landed, and
 * any that is now below zero is judged by the item's effective policy on the
 * document's date:
 *
 *     BLOCK   refuse the whole document, as one 409 naming every such holding —
 *             the transaction rolls back with it. The caller's fix is an
 *             ADJUSTMENT with a reason (or a receipt keyed first), not a retry.
 *     WARN    let it through and say so in the log. An offline till that must
 *             keep billing is a real business choice.
 *     ALLOW   nothing to say. The exception report reads ix_sbl_negative.
 *
 * Checked here rather than left to `ck_sbl_accum`, which only keeps the four
 * accumulators non-negative: on-hand is allowed to go below zero by design, so
 * the database cannot know whether THIS item may.
 */
async function assertNegativeStockPolicy(
  tx: Prisma.TransactionClient,
  params: ApplyParams,
): Promise<void> {
  const { rules, svhId } = params;
  const holdings = await tx.$queryRaw<NegativeHolding[]>`
    WITH touched AS (
      SELECT DISTINCT sml.sml_company_id, sml.sml_branch_id, sml.sml_godown_id,
             sml.sml_item_id, sml.sml_lot_id, sml.sml_bucket, sml.sml_doc_date
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
    )
    SELECT itm.item_name_en                             AS "itemName",
           slt.slt_batch_no                             AS "batchNo",
           gdl.gdl_name                                 AS "godownName",
           sbl.sbl_on_hand_qty::text                    AS "onHand",
           COALESCE(stp.stp_allow_negative, 'ALLOW')    AS "allowNegative"
      FROM touched t
      JOIN stock.stock_balance sbl
        ON sbl.sbl_company_id = t.sml_company_id
       AND sbl.sbl_branch_id  = t.sml_branch_id
       AND sbl.sbl_godown_id  = t.sml_godown_id
       AND sbl.sbl_item_id    = t.sml_item_id
       AND sbl.sbl_lot_id     = t.sml_lot_id
       AND sbl.sbl_bucket     = t.sml_bucket
       AND sbl.sbl_is_deleted = false
      JOIN inventory.item_master itm ON itm.item_id = t.sml_item_id
      JOIN stock.stock_lot slt        ON slt.slt_id  = t.sml_lot_id
      LEFT JOIN inventory.godown_locations gdl ON gdl.gdl_id = t.sml_godown_id
      ${effectivePolicyLateral({
        companyId: Prisma.raw('t.sml_company_id'),
        branchId: Prisma.raw('t.sml_branch_id'),
        itemId: Prisma.raw('t.sml_item_id'),
        itemGroupId: Prisma.raw('itm.item_group_id'),
        onDate: Prisma.raw('t.sml_doc_date'),
      })}
     WHERE sbl.sbl_on_hand_qty < 0
       AND COALESCE(stp.stp_allow_negative, 'ALLOW') <> 'ALLOW'
     ORDER BY itm.item_name_en, slt.slt_batch_no
  `;
  const describe = (row: NegativeHolding): string =>
    `${row.itemName}${row.batchNo ? ` batch ${row.batchNo}` : ''}: stock would go negative ` +
    `(${row.onHand} on hand) in ${row.godownName ?? 'this godown'}`;
  for (const row of holdings) {
    if (row.allowNegative === 'WARN') {
      logger.warn(
        `${rules.displayName} ${svhId}: negative stock allowed under WARN — ${describe(row)}`,
      );
    }
  }
  const blocked = holdings.filter((row) => row.allowNegative === 'BLOCK');
  if (blocked.length) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>(
      `This ${rules.displayName.toLowerCase()} would drive stock negative — policy is BLOCK`,
      blocked.map((row) => ({ field: 'lines', message: `${describe(row)} — policy is BLOCK` })),
    );
  }
}
/**
 * Phase 7 — `slt_total_on_hand`, the lot's chain-wide total across every branch
 * and godown, and the lot's status with it.
 *
 * The total is recomputed from the balance rows rather than incremented,
 * because that is the definition of the column and a re-derivation cannot
 * drift. Only the lots this document touched are recomputed.
 *
 * STATUS, as the trigger keeps it: an outward that leaves the lot at or below
 * zero CLOSES an ACTIVE lot and stamps `slt_closed_on`; an inward to a CLOSED
 * lot reopens it, whatever the total, and clears the stamp. BLOCKED and
 * EXPIRED are somebody's decision and are never touched. The trigger sees one
 * row at a time; for the one shape where a document both receives into and
 * issues from the same lot, ending empty wins — a lot with nothing in it is
 * closed, whichever line came last.
 */
async function refreshLotTotals(tx: Prisma.TransactionClient, params: ApplyParams): Promise<void> {
  const { actor, postedOn } = params;
  await tx.$executeRaw`
    WITH touched AS (
      SELECT sml.sml_lot_id                AS lot_id,
             bool_or(sml.sml_direction > 0) AS had_in,
             bool_or(sml.sml_direction < 0) AS had_out
        FROM stock.stock_ledger sml
       WHERE ${ledgerRowsOf(params)}
       GROUP BY sml.sml_lot_id
    ),
    totals AS (
      SELECT t.lot_id, t.had_in, t.had_out,
             COALESCE(SUM(sbl.sbl_on_hand_qty), 0) AS on_hand
        FROM touched t
        LEFT JOIN stock.stock_balance sbl
               ON sbl.sbl_lot_id     = t.lot_id
              AND sbl.sbl_is_deleted = false
       GROUP BY t.lot_id, t.had_in, t.had_out
    ),
    verdict AS (
      SELECT totals.*,
             (totals.on_hand <= 0 AND totals.had_out) AS ends_empty
        FROM totals
    )
    UPDATE stock.stock_lot slt
       SET slt_total_on_hand = v.on_hand,
           slt_status        = CASE
                                 WHEN v.ends_empty AND slt.slt_status = 'ACTIVE' THEN 'CLOSED'
                                 WHEN v.had_in AND slt.slt_status = 'CLOSED' AND NOT v.ends_empty THEN 'ACTIVE'
                                 ELSE slt.slt_status
                               END,
           slt_closed_on     = CASE
                                 WHEN v.ends_empty AND slt.slt_status = 'ACTIVE' THEN ${postedOn}
                                 WHEN v.had_in AND slt.slt_status = 'CLOSED' AND NOT v.ends_empty THEN NULL
                                 ELSE slt.slt_closed_on
                               END,
           slt_row_version   = slt.slt_row_version + 1,
           slt_modified_on   = ${postedOn},
           slt_modified_by   = ${auditColumnActor(actor)}
      FROM verdict v
     WHERE slt.slt_id = v.lot_id
  `;
}
// ──────────────────────────────────────────────────────────────────────────
// Cancel — reversal rows, then the same engine over them
// ──────────────────────────────────────────────────────────────────────────
export interface CancelStockVoucherParams {
  rules: StockVoucherTypeRules;
  svhId: string;
  accYear: string;
  /** As on `PostStockVoucherParams`: never null, and folded to NULL for audit columns. */
  actor: string;
  /** Already trimmed and non-empty — the service refuses an empty one first. */
  reason: string;
  /** One instant for every reversal row, the header stamp and the trail row. */
  cancelledOn: Date;
}
/**
 * Cancels one POSTED voucher by REVERSAL, never by delete: every ledger row the
 * post wrote gets a mirror row with the opposite direction, and the balance,
 * the moving average, the negative-stock policy and the lot totals are then
 * applied over those mirrors exactly as they were over the originals.
 *
 * Returns the number of REVERSAL ROWS written, which is what `fn_svh_cancel`
 * returned and what the API reports as `rowsReversed`. A posted count whose
 * lines all had zero variance wrote no ledger row and reverses none; the
 * header still moves to CANCELLED.
 *
 * WHAT THE REVERSAL ROW CARRIES, and why:
 *   * the ORIGINAL `sml_doc_date`, `sml_doc_datetime` and `sml_acc_year`, so
 *     an as-on-date report reads "this document never moved stock" — and so
 *     the row lands in the original's partition. `sml_posted_on` is the audit
 *     trail of WHEN the cancellation happened.
 *   * the original's txn type, quantities, lot, godown, bucket and cost
 *     figures, unchanged; only `sml_direction` flips. `sml_signed_base_qty`
 *     is generated from it, so the two rows sum to nothing.
 *   * `sml_is_reversal = true` and `sml_reverses_id = the original's sml_id`
 *     — the pair `ck_sml_reversal` demands, and what `ux_sml_reversal` keys
 *     on so the same movement can never be reversed twice, whichever way two
 *     cancels race. `ux_sml_source` excludes reversals, which is why the mirror
 *     may share the original's (doc type, doc id, line, split).
 *   * the reason, in `sml_narration`. The CANCELLED row on txn_status_log
 *     carries it too; a ledger reader should not have to join back to find out
 *     why stock moved.
 *
 * WHAT CAN LEGITIMATELY REFUSE IT, both as 409:
 *   * the negative-stock policy (phase 6): cancelling an opening after stock
 *     has been sold from it drives the holding negative, and BLOCK refuses
 *     that. The fix is an ADJUSTMENT with a reason, not a retry.
 *   * `tr_sml_freeze_guard`: a DRAFT PHYSICAL count is freezing the godown.
 *     Post or delete the count first.
 *
 * THE HEADER IS LOCKED FIRST, `FOR UPDATE`, and its status re-read under the
 * lock. The service checks the status before the transaction opens, but two
 * cancels arriving together would both pass that check; the loser here waits
 * on the lock, then reads CANCELLED and is refused. `fn_svh_cancel` took the
 * same lock for the same reason.
 */
export async function cancelStockVoucher(
  tx: Prisma.TransactionClient,
  params: CancelStockVoucherParams,
): Promise<number> {
  const { rules, svhId, accYear, actor, cancelledOn } = params;
  const author = auditColumnActor(actor);
  await lockHeaderInStatus(tx, params, 'POSTED');
  const rowsReversed = await writeReversalLedger(tx, params);
  await applyLedgerRows(tx, {
    rules,
    svhId,
    accYear,
    actor,
    postedOn: cancelledOn,
    reversal: true,
  });
  await tx.stockVoucher.update({
    where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
    data: {
      // As in postStockVoucher: only the current state lands here. Who cancelled
      // it, when, and the reason are the CANCELLED row on txn_status_log, which
      // the service writes in this transaction.
      svhStatus: 'CANCELLED',
      svhVersionNo: { increment: 1 },
      svhModifiedOn: cancelledOn,
      svhModifiedBy: author,
    },
  });
  return rowsReversed;
}
/**
 * Cancels one DRAFT voucher: the header moves to CANCELLED and NOTHING else
 * happens, because nothing else has happened yet. A draft has written no
 * `stock_ledger` row, so there is nothing to mirror, no balance to re-apply
 * and no negative-stock policy to satisfy — which is why this cannot fail the
 * way `cancelStockVoucher` legitimately can, and why it returns 0.
 *
 * WHY CANCEL A DRAFT AT ALL, when `softDelete` exists: the two say different
 * things and both are wanted. A soft delete takes the document out of play as
 * though it had never been raised; a cancellation leaves it listed, numbered
 * and readable with a reason attached, which is what an operator wants for a
 * draft that was abandoned for a reason worth recording. The trail row the
 * service writes carries that reason either way.
 *
 * TWO SIDE EFFECTS OF THE STATUS MOVE, both wanted:
 *   * `ix_svh_freeze_open` and `fn_sml_freeze_guard` key on DRAFT, so
 *     cancelling a draft PHYSICAL count lifts the godown freeze it was
 *     holding. An abandoned count must not go on blocking every movement in
 *     the godown until its freeze window expires.
 *   * `post()` and `update()` accept DRAFT only, so a cancelled draft can no
 *     longer be edited or posted. That is the point: re-raise it instead.
 *
 * THE HEADER IS LOCKED FIRST, `FOR UPDATE`, and re-read under the lock for the
 * same reason the posted path does it — two cancels arriving together both
 * pass the service's pre-transaction status check, and the loser must read
 * CANCELLED here rather than write a second trail row.
 */
export async function cancelDraftVoucher(
  tx: Prisma.TransactionClient,
  params: CancelStockVoucherParams,
): Promise<number> {
  const { svhId, accYear, actor, cancelledOn } = params;
  await lockHeaderInStatus(tx, params, 'DRAFT');
  await tx.stockVoucher.update({
    where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
    data: {
      // As in cancelStockVoucher: only the current state lands on the header.
      svhStatus: 'CANCELLED',
      svhVersionNo: { increment: 1 },
      svhModifiedOn: cancelledOn,
      svhModifiedBy: auditColumnActor(actor),
    },
  });
  return 0;
}
/**
 * Takes the header lock and refuses anything but `expected` under it — see the
 * note on `cancelStockVoucher`. The wording matches the service's own
 * pre-transaction refusals so the loser of a race reads the same sentence
 * the next request would.
 */
async function lockHeaderInStatus(
  tx: Prisma.TransactionClient,
  { rules, svhId, accYear }: CancelStockVoucherParams,
  expected: 'POSTED' | 'DRAFT',
): Promise<void> {
  const [header] = await tx.$queryRaw<Array<{ status: string; refno: string }>>`
    SELECT svh.svh_status AS status, svh.svh_refno AS refno
      FROM stock.stock_voucher svh
     WHERE svh.svh_id         = ${svhId}::uuid
       AND svh.svh_acc_year   = ${accYear}::bpchar
       AND svh.svh_is_deleted = false
       FOR UPDATE
  `;
  if (!header) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>(`${rules.displayName} not found`, [
      {
        field: 'svhId',
        message: `${svhId} no longer exists in ${accYear}, so there is nothing to cancel.`,
      },
    ]);
  }
  if (header.status !== expected) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>(
      `${rules.displayName} is ${header.status}`,
      [
        {
          field: 'svhId',
          message:
            header.status === 'CANCELLED'
              ? `${header.refno} was already cancelled.`
              : // The status changed between the service's check and this lock —
                // a concurrent post or cancel got in. Naming both states beats
                // "only a POSTED one can be cancelled", which would read as a
                // rule the caller had broken rather than a race it lost.
                `${header.refno} is ${header.status}, not ${expected}: it changed while this cancellation was waiting. Reload it and decide again.`,
        },
      ],
    );
  }
}
/**
 * The mirror rows — see `cancelStockVoucher` for what each column carries and
 * why. One INSERT … SELECT over the document's live, non-reversal rows;
 * `ux_sml_reversal` refuses a second mirror of any of them.
 */
async function writeReversalLedger(
  tx: Prisma.TransactionClient,
  { svhId, accYear, actor, reason, cancelledOn }: CancelStockVoucherParams,
): Promise<number> {
  return tx.$executeRaw`
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
      sml_doc_rate, sml_doc_rate_wot, sml_doc_amount_wot,
      sml_mrp, sml_batch_no, sml_expiry_date,
      sml_is_reversal, sml_reverses_id,
      sml_reason_id, sml_party_id, sml_narration, sml_created_by
    )
    SELECT sml.sml_company_id, sml.sml_branch_id, sml.sml_tenant_id, sml.sml_acc_year, sml.sml_godown_id,
           sml.sml_item_id, sml.sml_lot_id, sml.sml_uom_id, sml.sml_base_uom_id, sml.sml_to_base_factor,
           sml.sml_src_module, sml.sml_src_doc_type, sml.sml_src_doc_id, sml.sml_src_acc_year, sml.sml_src_refno,
           sml.sml_line_no, sml.sml_split_no,
           sml.sml_txn_type, -sml.sml_direction, sml.sml_bucket,
           sml.sml_doc_date, sml.sml_doc_datetime, ${cancelledOn},
           sml.sml_qty, sml.sml_base_qty, sml.sml_free_qty, sml.sml_free_base_qty, sml.sml_weight_qty,
           sml.sml_cost_rate, sml.sml_cost_value, sml.sml_cost_rate_wot, sml.sml_cost_value_wot,
           sml.sml_landed_rate, sml.sml_landed_value,
           sml.sml_doc_rate, sml.sml_doc_rate_wot, sml.sml_doc_amount_wot,
           sml.sml_mrp, sml.sml_batch_no, sml.sml_expiry_date,
           true, sml.sml_id,
           sml.sml_reason_id, sml.sml_party_id, ${reason}, ${auditColumnActor(actor)}
      FROM stock.stock_ledger sml
     WHERE sml.sml_src_doc_id  = ${svhId}::uuid
       AND sml.sml_acc_year    = ${accYear}::bpchar
       AND sml.sml_is_deleted  = false
       AND sml.sml_is_reversal = false
     ORDER BY sml.sml_line_no, sml.sml_split_no
  `;
}
