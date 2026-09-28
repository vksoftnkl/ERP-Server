import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_ACTOR,
  throwStockConflict,
  throwStockUnprocessable,
} from 'src/common/utils/module-service.utils';
import type {
  StockErrorDetail,
  StockErrorResponse,
  StockPostShape,
  StockVoucherTypeRules,
} from './types/stock-voucher.types';
/**
 * THE POSTING ENGINE, IN THE APPLICATION RATHER THAN IN THE DATABASE.
 *
 * Nothing about stock posting runs in Postgres any more: no `fn_svh_post`, no
 * `fn_sml_apply`, no trigger on `stock_ledger`. The 2026-09-22 rule is that the
 * database keeps only what is DECLARATIVE — GENERATED columns, CHECKs, unique
 * and partial indexes, foreign keys — and everything that decides, orders or
 * recomputes lives here, in one file, as the reference implementation of the
 * share's §17/§19/§20 behaviour (read on 2026-09-08 and kept as `.txt` beside
 * the plan).
 *
 * WHAT THE DATABASE STILL OWNS, all declarative:
 *   * `ux_sml_source` / `ux_sml_reversal`: one forward row per movement, one
 *     mirror per forward row, whichever way two posts or two cancels race.
 *   * `slt_key_batch` / `slt_key_serial` fold case and whitespace, and so do
 *     the identity keys built here — see `lotIdentityKeyColumns`.
 *   * `ck_stt_qty`, `ck_sbl_accum`, `ck_svh_status` and friends.
 *
 * WHAT MOVED OUT OF THE DATABASE and lives in this module now:
 *   * the append-only ledger: structural, ONE INSERT site in this file, no
 *     UPDATE or DELETE anywhere, asserted by
 *     `test/stock-ledger-single-writer.e2e-spec.ts`;
 *   * the freeze guard: `StockPostingService.assertNotFrozen`, tested against
 *     the movement's own timestamp rather than `now()`.
 *
 * WHAT THIS ENGINE MAINTAINS, in order, one set-based statement per phase:
 *   0. an outward line with no lot gets one PICKED by the issue strategy
 *                                                              (`pickIssueLots`)
 *   1. the lots the document needs                          (`resolveLots`)
 *   2. each line's lot and resolved cost                    (`attachLotsToLines`)
 *   3. the ledger — THE TRUTH; everything after is derived from it
 *      (a transfer also writes / settles `stock_transit` right after it)
 *   4. `stock_balance`: accumulators, ageing anchors, identity cache
 *   5. `stock_item_cost`, the branch's moving weighted average, and the
 *      distribution of that average onto every holding of the item
 *   6. the negative-stock policy: BLOCK refuses, WARN logs, ALLOW passes
 *   7. `slt_total_on_hand`, and the lot's ACTIVE / CLOSED status with it
 *   8. the header totals, re-summed from the rows just written
 *                                                       (`recomputeHeaderTotals`)
 *
 * A CANCELLATION IS THE SAME ENGINE RUN OVER REVERSAL ROWS. `cancelStockVoucher`
 * mirrors every ledger row the post wrote with its direction flipped
 * (`writeReversalLedger`) and then runs phases 4–8 over THOSE rows and no
 * others. The derived phases are therefore scoped by `ledgerRowsOf`, on
 * `sml_is_reversal`, so a cancel never re-applies the original movement.
 *
 * THE SHAPE of a document — SIMPLE, COUNT, TRANSFER_OUT, TRANSFER_IN — comes
 * from its rule record (`StockVoucherTypeRules.postShape`) and decides which
 * phases run and how the ledger rows are laid out. See each phase.
 *
 * RESERVED AND IN-TRANSIT QUANTITIES are not movements and have no ledger row;
 * they are RECOMPUTED from their source tables by `refreshReserved` and
 * `refreshTransitIn` below, which are the only writers of `sbl_reserved_qty`
 * and `sbl_transit_in_qty`. Recomputed, never incremented: an increment is right
 * until one write is lost, and after that it is wrong forever.
 *
 * Everything runs in the CALLER'S transaction and set-based — one statement per
 * phase, not one per line — so a four-hundred-line opening posts in a handful of
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
/** What `postStockVoucher` reports back. */
export interface PostStockVoucherResult {
  /** LEDGER rows written — not the line count. A zero-variance count line writes none. */
  rowsPosted: number;
  /** POSTED, or IN_TRANSIT for an inter-branch despatch. */
  status: 'POSTED' | 'IN_TRANSIT';
  /** `stock_transit` rows written (inter-branch despatch) or settled (receipt). */
  transitRows: number;
  /** TRANSFER_IN only: the despatch this receipt closed, when nothing was left. */
  closedOut: { svhId: string; accYear: string; refno: string } | null;
}
/**
 * What phases 4–8 need: the post's parameters plus WHICH of the document's
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
const isTransferShape = (shape: StockPostShape): boolean =>
  shape === 'TRANSFER_OUT' || shape === 'TRANSFER_IN';
/**
 * Posts one DRAFT voucher: lots picked and resolved, ledger written, balances
 * and the moving average applied, the negative-stock policy checked, lot totals
 * updated, header totals re-summed, lines stamped with their lot, header moved
 * to POSTED (or IN_TRANSIT for an inter-branch despatch).
 *
 * The caller has already asserted DRAFT and run `validate()`; the header is
 * still locked and re-read here, because two posts arriving together both pass
 * the service's pre-transaction check and the loser must read POSTED under the
 * lock rather than write a second set of rows.
 */
export async function postStockVoucher(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
): Promise<PostStockVoucherResult> {
  const { rules, svhId, accYear, actor, postedOn } = params;
  const author = auditColumnActor(actor);
  const shape = rules.postShape;
  const header = await lockHeaderInStatus(tx, params, 'DRAFT');

  let transit: TransferContext | null = null;
  if (shape === 'TRANSFER_OUT') {
    transit = await assertDespatchable(tx, params, header);
  } else if (shape === 'TRANSFER_IN') {
    transit = await assertReceivable(tx, params, header);
  } else {
    if (rules.quantityMode === 'QTY' && (!rules.isInward || rules.lineDirection === 'REASON')) {
      await pickIssueLots(tx, params);
    }
    await resolveLots(tx, params);
  }
  await attachLotsToLines(tx, params);
  if (!isTransferShape(shape) && !params.ledgerSource) {
    await assertInwardCost(tx, params);
  }
  const rowsPosted = await writeLedger(tx, params);

  let transitRows = 0;
  let closedOut: PostStockVoucherResult['closedOut'] = null;
  let status: PostStockVoucherResult['status'] = 'POSTED';
  if (shape === 'TRANSFER_OUT' && transit && !transit.sameBranch) {
    transitRows = await writeTransitRows(tx, params);
    await ensureBalanceRows(tx, transitHoldingsOf(svhId, accYear), actor);
    await refreshTransitIn(tx, transitHoldingsOf(svhId, accYear), actor, postedOn);
    status = 'IN_TRANSIT';
  } else if (shape === 'TRANSFER_IN' && transit) {
    const settled = await settleTransitRows(tx, params, transit);
    transitRows = settled.rows;
    closedOut = settled.closedOut;
    await refreshTransitIn(
      tx,
      transitHoldingsOf(transit.outId, transit.outAccYear),
      actor,
      postedOn,
    );
  }

  await applyLedgerRows(tx, { ...params, reversal: false });
  await recomputeHeaderTotals(tx, params);
  await tx.stockVoucher.update({
    where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
    data: {
      // The header carries the CURRENT state and nothing else. WHO posted it and
      // WHEN is the txn_status_log row the service appends in this same
      // transaction — the header has no posted_on/_by columns to stamp.
      svhStatus: status,
      svhVersionNo: { increment: 1 },
      svhModifiedOn: postedOn,
      svhModifiedBy: author,
    },
  });
  return { rowsPosted, status, transitRows, closedOut };
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
 * preflight and the post cannot disagree about which policy applies. It is
 * also the one policy resolver the reports use (former `fn_stp_effective`).
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
 * `policy AS (...)`: the six tracking flags per line plus the issue strategy,
 * resolved against the DOCUMENT's date and not today's. Expects a `line` CTE
 * carrying `svi_*` plus the document's `svh_company_id`, `svh_branch_id` and
 * `svh_doc_date`.
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
             COALESCE(stp.stp_track_supplier,   false) AS track_supplier,
             COALESCE(stp.stp_issue_strategy,   'FEFO') AS issue_strategy
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
 * The reason a line moves under: its own, else the header's. Expects a `line`
 * alias carrying `svi_reason_id` and `svh_reason_id`; exposes `rsn`.
 */
export function lineReasonJoin(): Prisma.Sql {
  return Prisma.sql`
          LEFT JOIN stock.stock_reason_master rsn
                 ON rsn.srm_id = COALESCE(line.svi_reason_id, line.svh_reason_id)
  `;
}
/** The issue txn types a reason may name for an ISSUE to take as its own. */
const ISSUE_TXN_TYPES = ['SAMPLE_ISSUE', 'GIFT_ISSUE', 'ADJUST_MINUS'];
/**
 * `line_direction` — which way THIS line moves (+1 / −1; 0 on a count, whose
 * lines take their sign from the variance).
 *
 *   lineDirection DOCUMENT   `isInward`, every line alike.
 *   lineDirection REASON     `svi_direction` when the API stamped one (a BOTH
 *                            reason with a signed quantity), else the reason's
 *                            `srm_direction` (line reason, then header
 *                            reason, through `lineReasonJoin`), else the
 *                            document's.
 *
 * Also `reason_txn_types`, so the txn type can follow the reason later in the
 * chain. Selects from `line` and `rsn`.
 */
export function lineDirectionColumn(rules: StockVoucherTypeRules): Prisma.Sql {
  const docDirection = rules.quantityMode === 'COUNT' ? 0 : rules.isInward ? 1 : -1;
  const byReason = rules.lineDirection === 'REASON';
  return Prisma.sql`
             CASE WHEN ${byReason}::boolean
                  THEN COALESCE(line.svi_direction,
                                CASE rsn.srm_direction WHEN 'IN' THEN 1 WHEN 'OUT' THEN -1 END,
                                ${docDirection}::int)
                  ELSE ${docDirection}::int END                                                  AS line_direction,
             rsn.srm_allowed_txn_types                                                          AS reason_txn_types,
             rsn.srm_code                                                                       AS reason_code
  `;
}
/**
 * `line_txn_type` — the ledger txn type of THIS line (19:93 `fn_svh_txn_map`,
 * with the two deliberate changes of the adjustments plan §0): an ADJUSTMENT
 * posts ADJUST_PLUS or ADJUST_MINUS by the line's direction; an ISSUE takes the
 * reason's own type only when the reason lists EXACTLY ONE type and it is an
 * issue type; every other document posts its rule record's first type.
 * Selects from an alias carrying `line_direction` and `reason_txn_types`.
 */
function lineTxnTypeColumn(rules: StockVoucherTypeRules, alias: string): Prisma.Sql {
  const a = Prisma.raw(alias);
  const [plus, minus] = [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[1] ?? rules.ledgerTxnTypes[0]];
  if (rules.lineDirection !== 'REASON') {
    return Prisma.sql`${plus}::text AS line_txn_type`;
  }
  if (rules.voucherType === 'ADJUSTMENT') {
    return Prisma.sql`
             CASE WHEN ${a}.line_direction > 0 THEN 'ADJUST_PLUS' ELSE 'ADJUST_MINUS' END AS line_txn_type`;
  }
  if (rules.voucherType === 'ISSUE') {
    return Prisma.sql`
             CASE WHEN cardinality(${a}.reason_txn_types) = 1
                   AND ${a}.reason_txn_types[1] = ANY(${ISSUE_TXN_TYPES}::text[])
                  THEN ${a}.reason_txn_types[1]
                  ELSE 'ADJUST_MINUS' END                                                  AS line_txn_type`;
  }
  return Prisma.sql`CASE WHEN ${a}.line_direction > 0 THEN ${plus}::text ELSE ${minus}::text END AS line_txn_type`;
}
/**
 * "This outward line names no lot and its identity is INCOMPLETE for what the
 * policy tracks" — the condition under which `pickIssueLots` chooses lots for
 * it, and under which `validate()` checks for stock instead of refusing the
 * missing dimension. Selects from a `keyed` alias (line + policy flags).
 */
export function lotlessOutwardLine(): Prisma.Sql {
  return Prisma.sql`
             keyed.svi_lot_id IS NULL
         AND (
               (keyed.track_batch      AND COALESCE(keyed.svi_batch_no, '')  = '')
            OR (keyed.track_expiry     AND keyed.svi_expiry_date IS NULL)
            OR (keyed.track_mrp        AND keyed.svi_mrp         IS NULL)
            OR (keyed.track_sale_price AND keyed.svi_sale_price  IS NULL)
            OR (keyed.track_serial     AND COALESCE(keyed.svi_serial_no, '') = '')
            OR (keyed.track_supplier   AND keyed.svi_supplier_id IS NULL)
         )
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
 * falls through to the document's rate source — AVG_COST and LAST_PURCHASE from
 * `stock_item_cost`, LOT_COST from the resolved lot's `slt_cost_rate`, MRP from
 * the line's own `svi_mrp` (19:413-415). A TRANSFER_IN line is the exception:
 * its cost is the transit row's `stt_cost_rate`, the figure stamped on the OUT
 * row when the goods left, and nothing the receiving branch typed can move it.
 *
 * A transfer whose header names no rate source is valued at AVG_COST: the cost
 * travels with the stock and is the branch's moving average at the moment it
 * left (20:93-96).
 */
function postingCte(svhId: string, accYear: string, rules: StockVoucherTypeRules): Prisma.Sql {
  const isCount = rules.quantityMode === 'COUNT';
  const shape = rules.postShape;
  const defaultRateSource =
    rules.defaultRateSource ?? (isTransferShape(shape) ? 'AVG_COST' : null);
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
             COALESCE(NULLIF(svh.svh_rate_source, ''), ${defaultRateSource}::varchar) AS svh_rate_source,
             svh.svh_from_godown_id,
             svh.svh_to_godown_id,
             svh.svh_to_branch_id,
             (svh.svh_to_branch_id IS NULL OR svh.svh_to_branch_id = svh.svh_branch_id) AS same_branch,
             svh.svh_link_src_doc_id,
             COALESCE(svh.svh_link_src_acc_year, svh.svh_acc_year) AS svh_link_src_acc_year
        FROM stock.stock_voucher svh
       WHERE svh.svh_id       = ${svhId}::uuid
         AND svh.svh_acc_year = ${accYear}::bpchar
    ),
    line AS (
      SELECT svi.*, doc.svh_doc_date, doc.svh_doc_datetime, doc.svh_rate_source,
             doc.svh_company_id, doc.svh_branch_id, doc.svh_tenant_id,
             doc.svh_refno, doc.svh_reason_id, doc.svh_supplier_id,
             doc.svh_to_godown_id, doc.svh_to_branch_id, doc.same_branch,
             doc.svh_link_src_doc_id, doc.svh_link_src_acc_year
        FROM stock.stock_voucher_item svi
        JOIN doc ON doc.svh_id = svi.svi_voucher_id AND doc.svh_acc_year = svi.svi_acc_year
       WHERE svi.svi_is_deleted = false
    ),
    ${effectivePolicyCte()},
    keyed AS (
      SELECT line.*,
             policy.track_batch, policy.track_mrp, policy.track_sale_price,
             policy.track_expiry, policy.track_serial, policy.track_supplier,
             policy.issue_strategy,
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
             CASE WHEN ${isCount}::boolean THEN 0 ELSE line.svi_free_base_qty END               AS move_free_base_qty,
             ${lineDirectionColumn(rules)}
        FROM line
        JOIN policy ON policy.svi_id = line.svi_id
        ${lineReasonJoin()}
    ),
    priced AS (
      SELECT keyed.*,
             ${lineTxnTypeColumn(rules, 'keyed')},
             stt.stt_id AS transit_id,
             CASE WHEN ${shape === 'TRANSFER_IN'}::boolean THEN COALESCE(stt.stt_cost_rate, 0)
                  -- AN OUTWARD LINE IS RELIEVED AT WHAT THE STOCK COST US — the
                  -- branch's moving average — whatever the document's rate
                  -- source says and whatever was keyed: a write-off, an issue
                  -- or a count shortage cannot value itself (physical plan
                  -- §3.3, adjustments plan §2). Only when the branch carries no
                  -- average yet does a keyed figure stand.
                  WHEN keyed.line_direction < 0
                    OR (${isCount}::boolean AND COALESCE(keyed.svi_diff_qty, 0) < 0)
                  THEN COALESCE(NULLIF(sic.sic_avg_cost_rate, 0), NULLIF(keyed.svi_cost_rate, 0), 0)
                  ELSE
             -- Only a zero falls through — see the note on this function.
             COALESCE(NULLIF(keyed.svi_cost_rate, 0),
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN sic.sic_avg_cost_rate
                        WHEN 'LAST_PURCHASE' THEN sic.sic_last_purchase_rate
                        WHEN 'LOT_COST'      THEN slc.slt_cost_rate
                        WHEN 'MRP'           THEN keyed.svi_mrp
                        ELSE NULL
                      END,
                      0) END                                 AS line_cost_rate,
             CASE WHEN ${shape === 'TRANSFER_IN'}::boolean THEN COALESCE(stt.stt_cost_rate_wot, 0)
                  WHEN keyed.line_direction < 0
                    OR (${isCount}::boolean AND COALESCE(keyed.svi_diff_qty, 0) < 0)
                  THEN COALESCE(NULLIF(sic.sic_avg_cost_rate_wot, 0), NULLIF(keyed.svi_cost_rate_wot, 0))
                  ELSE
             COALESCE(NULLIF(keyed.svi_cost_rate_wot, 0),
                      CASE keyed.svh_rate_source
                        WHEN 'AVG_COST'      THEN sic.sic_avg_cost_rate_wot
                        WHEN 'LOT_COST'      THEN slc.slt_cost_rate_wot
                        ELSE NULL
                      END) END                               AS stated_cost_rate_wot
        FROM keyed
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = keyed.svh_company_id
              AND sic.sic_branch_id  = keyed.svh_branch_id
              AND sic.sic_item_id    = keyed.svi_item_id
              AND sic.sic_is_deleted = false
        -- LOT_COST: the lot the line names, or the one its identity resolves to.
        LEFT JOIN LATERAL (
          SELECT l.slt_cost_rate, l.slt_cost_rate_wot
            FROM stock.stock_lot l
           WHERE l.slt_is_deleted = false
             AND (
                   (keyed.svi_lot_id IS NOT NULL AND l.slt_id = keyed.svi_lot_id)
                OR (keyed.svi_lot_id IS NULL
                    AND l.slt_company_id  = keyed.svh_company_id
                    AND l.slt_item_id     = keyed.svi_item_id
                    AND l.slt_key_batch   = keyed.key_batch
                    AND l.slt_key_mrp     = keyed.key_mrp
                    AND l.slt_key_sp      = keyed.key_sp
                    AND l.slt_key_expiry  = keyed.key_expiry
                    AND l.slt_key_serial  = keyed.key_serial
                    AND l.slt_key_supplier = keyed.key_supplier)
             )
           LIMIT 1
        ) slc ON true
        -- TRANSFER_IN: the transit row this line receives against. The matcher
        -- is (out voucher, item, lot, destination godown); the bucket only
        -- breaks a tie, and the save refuses a two-bucket shipment anyway.
        LEFT JOIN LATERAL (
          SELECT t.stt_id, t.stt_cost_rate, t.stt_cost_rate_wot
            FROM stock.stock_transit t
           WHERE ${shape === 'TRANSFER_IN'}::boolean
             AND t.stt_out_voucher_id = keyed.svh_link_src_doc_id
             AND t.stt_out_acc_year   = keyed.svh_link_src_acc_year
             AND t.stt_item_id        = keyed.svi_item_id
             AND t.stt_lot_id         = keyed.svi_lot_id
             AND t.stt_to_godown_id   = keyed.svi_godown_id
             AND t.stt_is_deleted     = false
           ORDER BY (t.stt_bucket = keyed.svi_bucket) DESC
           LIMIT 1
        ) stt ON true
    ),
    costed AS (
      -- The without-tax cost, when nothing stated one: the with-tax cost net
      -- of the line's own tax rate (20 at 5% → 19.047619), as
      -- fn_sml_cost_default derived it. No tax rate means the two are equal.
      SELECT priced.*,
             COALESCE(priced.stated_cost_rate_wot,
                      ROUND(priced.line_cost_rate / (1 + COALESCE(priced.svi_tax_perc, 0) / 100), 6),
                      0)                                     AS line_cost_rate_wot
        FROM priced
    )
  `;
}
// ──────────────────────────────────────────────────────────────────────────
// Phase 0 — an outward line with no lot gets one PICKED (README:171, §1.4)
// ──────────────────────────────────────────────────────────────────────────
interface PickableLine {
  svi_id: string;
  svi_line_no: number;
  svi_split_no: number;
  svi_item_id: string;
  item_name: string;
  svi_godown_id: string;
  svi_bucket: string;
  svi_base_qty: Prisma.Decimal;
  svi_free_base_qty: Prisma.Decimal;
  svi_to_base_factor: Prisma.Decimal;
  svh_company_id: string;
  svh_branch_id: string;
  issue_strategy: string;
  track_batch: boolean;
  track_mrp: boolean;
  track_sale_price: boolean;
  track_expiry: boolean;
  track_serial: boolean;
  track_supplier: boolean;
  key_batch: string;
  key_mrp: Prisma.Decimal;
  key_sp: Prisma.Decimal;
  key_expiry: Date;
  key_serial: string;
  key_supplier: string;
}
interface PickableLot {
  sbl_lot_id: string;
  available: Prisma.Decimal;
}
/**
 * Phase 0 — WHICH LOT an outward line issues from, when it does not say.
 *
 * An outward line finds its lot from its own identity keys or a supplied
 * `lotId`. When neither is complete — a bill line that arrived lotless from the
 * offline till, an adjustment keyed by item alone — the engine picks lots in
 * the FROM-godown by the effective policy's issue strategy (decision D1: pick
 * at post, because the offline till needs it):
 *
 *     FEFO   expiry ASC, then first-in ASC          (the default, README:171)
 *     FIFO   sbl_first_in_date ASC — first into THIS godown
 *     LIFO   sbl_first_in_date DESC
 *     MANUAL refused: the client must name the lot
 *
 * Only lots with available stock, and only lots matching whatever identity the
 * line DID supply (a batch number on an expiry-tracked item narrows the pick
 * to that batch's lots). The line is SPLIT across lots with `svi_split_no`,
 * which exists for exactly this; when the godown holds less than the line
 * needs, the last lot takes the remainder and the negative-stock policy (phase
 * 6) decides what that means. The picked lot's identity is copied onto the
 * line, so phases 1–2 find the same lot the pick did and open no phantom.
 *
 * Opening, count and transfer lines never come here: their lines carry
 * identity by construction. The sale bill sends the lot it picked.
 */
async function pickIssueLots(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
): Promise<void> {
  const { rules, svhId, accYear, actor, postedOn } = params;
  const author = auditColumnActor(actor);
  const lines = await tx.$queryRaw<PickableLine[]>`
    WITH ${postingCte(svhId, accYear, rules)}
    SELECT keyed.svi_id, keyed.svi_line_no, keyed.svi_split_no, keyed.svi_item_id,
           itm.item_name_en AS item_name,
           keyed.svi_godown_id, keyed.svi_bucket, keyed.svi_base_qty, keyed.svi_free_base_qty,
           keyed.svi_to_base_factor, keyed.svh_company_id, keyed.svh_branch_id,
           keyed.issue_strategy,
           keyed.track_batch, keyed.track_mrp, keyed.track_sale_price,
           keyed.track_expiry, keyed.track_serial, keyed.track_supplier,
           keyed.key_batch, keyed.key_mrp, keyed.key_sp, keyed.key_expiry, keyed.key_serial, keyed.key_supplier
      FROM keyed
      JOIN inventory.item_master itm ON itm.item_id = keyed.svi_item_id
     WHERE keyed.line_direction < 0
       AND ${lotlessOutwardLine()}
       AND (keyed.svi_base_qty + keyed.svi_free_base_qty) > 0
     ORDER BY keyed.svi_line_no, keyed.svi_split_no
  `;
  if (lines.length === 0) {
    return;
  }
  const errors: StockErrorDetail[] = [];
  for (const line of lines) {
    const strategy = line.issue_strategy?.toUpperCase() ?? 'FEFO';
    if (strategy === 'MANUAL') {
      errors.push({
        field: `lines.${line.svi_line_no}`,
        message: `Line ${line.svi_line_no} (${line.item_name}): the issue strategy for this item is MANUAL, so the line must name the lot it issues from.`,
      });
      continue;
    }
    const order =
      strategy === 'LIFO'
        ? Prisma.sql`b.sbl_first_in_date DESC NULLS LAST, slt.slt_created_on DESC`
        : strategy === 'FIFO'
          ? Prisma.sql`b.sbl_first_in_date ASC NULLS LAST, slt.slt_created_on ASC`
          : Prisma.sql`slt.slt_expiry_date ASC NULLS LAST, b.sbl_first_in_date ASC NULLS LAST, slt.slt_created_on ASC`;
    const lots = await tx.$queryRaw<PickableLot[]>`
      SELECT b.sbl_lot_id, b.sbl_available_qty AS available
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id AND slt.slt_is_deleted = false
       WHERE b.sbl_company_id = ${line.svh_company_id}::uuid
         AND b.sbl_branch_id  = ${line.svh_branch_id}::uuid
         AND b.sbl_godown_id  = ${line.svi_godown_id}::uuid
         AND b.sbl_item_id    = ${line.svi_item_id}::uuid
         AND b.sbl_bucket     = ${line.svi_bucket}
         AND b.sbl_is_deleted = false
         AND b.sbl_available_qty > 0
         AND slt.slt_status IN ('ACTIVE', 'CLOSED')
         -- Whatever identity the line DID supply narrows the pick.
         AND (NOT ${line.track_batch}::boolean      OR ${line.key_batch} = '~'  OR slt.slt_key_batch    = ${line.key_batch})
         AND (NOT ${line.track_mrp}::boolean        OR ${line.key_mrp}::numeric = -1 OR slt.slt_key_mrp = ${line.key_mrp}::numeric)
         AND (NOT ${line.track_sale_price}::boolean OR ${line.key_sp}::numeric = -1  OR slt.slt_key_sp  = ${line.key_sp}::numeric)
         AND (NOT ${line.track_expiry}::boolean     OR ${line.key_expiry}::date = DATE '0001-01-01' OR slt.slt_key_expiry = ${line.key_expiry}::date)
         AND (NOT ${line.track_serial}::boolean     OR ${line.key_serial} = '~' OR slt.slt_key_serial   = ${line.key_serial})
         AND (NOT ${line.track_supplier}::boolean   OR ${line.key_supplier}::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                                                     OR slt.slt_key_supplier = ${line.key_supplier}::uuid)
       ORDER BY ${order}
    `;
    if (lots.length === 0) {
      errors.push({
        field: `lines.${line.svi_line_no}`,
        message: `Line ${line.svi_line_no} (${line.item_name}): names no lot and this godown holds no stock of the item to issue from. Name the lot, or receive the stock first.`,
      });
      continue;
    }
    // Greedy walk in strategy order; the last lot takes whatever is left.
    const need = new Prisma.Decimal(line.svi_base_qty).plus(line.svi_free_base_qty);
    const factor = new Prisma.Decimal(line.svi_to_base_factor).gt(0)
      ? new Prisma.Decimal(line.svi_to_base_factor)
      : new Prisma.Decimal(1);
    const takes: Array<{ lotId: string; qty: Prisma.Decimal }> = [];
    let remaining = need;
    for (const [i, lot] of lots.entries()) {
      if (remaining.lte(0)) {
        break;
      }
      const last = i === lots.length - 1;
      const take = last ? remaining : Prisma.Decimal.min(remaining, new Prisma.Decimal(lot.available));
      if (take.lte(0)) {
        continue;
      }
      takes.push({ lotId: lot.sbl_lot_id, qty: take });
      remaining = remaining.minus(take);
    }
    // Free quantity is apportioned first, from the first split.
    let freeLeft = new Prisma.Decimal(line.svi_free_base_qty);
    const splits = takes.map((t) => {
      const free = Prisma.Decimal.min(freeLeft, t.qty);
      freeLeft = freeLeft.minus(free);
      const base = t.qty.minus(free);
      return {
        lotId: t.lotId,
        base,
        free,
        qty: base.div(factor).toDecimalPlaces(6),
        freeQty: free.div(factor).toDecimalPlaces(6),
      };
    });
    const [first, ...rest] = splits;
    await tx.$executeRaw`
      UPDATE stock.stock_voucher_item svi
         SET svi_lot_id        = slt.slt_id,
             svi_batch_no      = COALESCE(slt.slt_batch_no,    svi.svi_batch_no),
             svi_mfg_date      = COALESCE(slt.slt_mfg_date,    svi.svi_mfg_date),
             svi_expiry_date   = COALESCE(slt.slt_expiry_date, svi.svi_expiry_date),
             svi_mrp           = COALESCE(slt.slt_mrp,         svi.svi_mrp),
             svi_sale_price    = COALESCE(slt.slt_sale_price,  svi.svi_sale_price),
             svi_serial_no     = COALESCE(slt.slt_serial_no,   svi.svi_serial_no),
             svi_supplier_id   = COALESCE(slt.slt_supplier_id, svi.svi_supplier_id),
             svi_qty           = ${first.qty}::numeric,
             svi_base_qty      = ${first.base}::numeric,
             svi_free_qty      = ${first.freeQty}::numeric,
             svi_free_base_qty = ${first.free}::numeric,
             svi_modified_on   = ${postedOn},
             svi_modified_by   = ${author}
        FROM stock.stock_lot slt
       WHERE slt.slt_id       = ${first.lotId}::uuid
         AND svi.svi_id       = ${line.svi_id}::uuid
         AND svi.svi_acc_year = ${accYear}::bpchar
    `;
    for (const [k, split] of rest.entries()) {
      await tx.$executeRaw`
        INSERT INTO stock.stock_voucher_item (
          svi_voucher_id, svi_company_id, svi_branch_id, svi_tenant_id, svi_acc_year,
          svi_line_no, svi_split_no, svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
          svi_godown_id, svi_lot_id, svi_bucket, svi_barcode,
          svi_batch_no, svi_mfg_date, svi_expiry_date, svi_mrp, svi_sale_price, svi_serial_no, svi_supplier_id,
          svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty, svi_weight_qty,
          svi_cost_rate, svi_cost_rate_wot, svi_landed_rate, svi_tax_perc,
          svi_reason_id, svi_remarks, svi_sync_date, svi_created_on, svi_created_by
        )
        SELECT svi.svi_voucher_id, svi.svi_company_id, svi.svi_branch_id, svi.svi_tenant_id, svi.svi_acc_year,
               svi.svi_line_no,
               (SELECT MAX(x.svi_split_no) FROM stock.stock_voucher_item x
                 WHERE x.svi_voucher_id = svi.svi_voucher_id AND x.svi_acc_year = svi.svi_acc_year
                   AND x.svi_line_no = svi.svi_line_no) + 1,
               svi.svi_item_id, svi.svi_uom_id, svi.svi_base_uom_id, svi.svi_to_base_factor,
               svi.svi_godown_id, slt.slt_id, svi.svi_bucket, svi.svi_barcode,
               COALESCE(slt.slt_batch_no,    svi.svi_batch_no),
               COALESCE(slt.slt_mfg_date,    svi.svi_mfg_date),
               COALESCE(slt.slt_expiry_date, svi.svi_expiry_date),
               COALESCE(slt.slt_mrp,         svi.svi_mrp),
               COALESCE(slt.slt_sale_price,  svi.svi_sale_price),
               COALESCE(slt.slt_serial_no,   svi.svi_serial_no),
               COALESCE(slt.slt_supplier_id, svi.svi_supplier_id),
               ${split.qty}::numeric, ${split.base}::numeric, ${split.freeQty}::numeric, ${split.free}::numeric, 0,
               svi.svi_cost_rate, svi.svi_cost_rate_wot, svi.svi_landed_rate, svi.svi_tax_perc,
               svi.svi_reason_id,
               COALESCE(svi.svi_remarks, '') || CASE WHEN svi.svi_remarks IS NULL THEN '' ELSE ' ' END
                 || 'split ' || ${k + 2}::text || ' by ' || ${strategy},
               svi.svi_sync_date, ${postedOn}, ${author}
          FROM stock.stock_voucher_item svi
          JOIN stock.stock_lot slt ON slt.slt_id = ${split.lotId}::uuid
         WHERE svi.svi_id       = ${line.svi_id}::uuid
           AND svi.svi_acc_year = ${accYear}::bpchar
      `;
    }
    logger.log(
      `${rules.displayName} ${svhId}: line ${line.svi_line_no} picked ${splits.length} lot(s) by ${strategy}`,
    );
  }
  if (errors.length) {
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
      `This ${rules.displayName.toLowerCase()} cannot be posted`,
      errors,
    );
  }
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
 *
 * A transfer never comes here: it MOVES an existing lot and the destination
 * receives the same `slt_id`, so ageing does not reset (20:52-54).
 */
async function resolveLots(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
): Promise<void> {
  const { rules, svhId, accYear, actor } = params;
  await tx.$executeRaw`
    WITH ${postingCte(svhId, accYear, rules)}
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
     WHERE c.svi_lot_id IS NULL
       -- Under a per-line direction an OUTWARD line never opens a lot: stock
       -- that was never received cannot be issued, and the negative policy
       -- (BLOCK for the adjustment family) says so by name.
       AND (${rules.lineDirection !== 'REASON'}::boolean OR c.line_direction > 0)
     ORDER BY c.svh_company_id, c.svi_item_id, c.key_batch, c.key_mrp,
              c.key_sp, c.key_expiry, c.key_serial, c.key_supplier,
              c.svi_line_no, c.svi_split_no
    ON CONFLICT DO NOTHING
  `;
}
/**
 * Phase 2 — every line gets the `slt_id` its identity resolves to, and the
 * cost the ledger row will be valued at.
 *
 * COALESCE and not an assignment: a COUNT, a TRANSFER and a picked line already
 * carry one — their line names the holding it reconciles or moves — and
 * overwriting it would point a count at a different lot than the sheet was
 * generated against, when the whole point of the drift check is that it was not.
 *
 * The resolved cost IS written back on every line, lot or no lot, because it is
 * the figure the ledger row was valued at and a line that disagreed with its own
 * movement would be unexplainable afterwards.
 */
async function attachLotsToLines(
  tx: Prisma.TransactionClient,
  { rules, svhId, accYear, postedOn, actor }: PostStockVoucherParams,
): Promise<void> {
  await tx.$executeRaw`
    WITH ${postingCte(svhId, accYear, rules)}
    UPDATE stock.stock_voucher_item svi
       SET svi_lot_id        = COALESCE(svi.svi_lot_id, slt.slt_id),
           svi_cost_rate     = c.line_cost_rate,
           svi_cost_rate_wot = c.line_cost_rate_wot,
           svi_modified_on   = ${postedOn},
           svi_modified_by   = ${auditColumnActor(actor)}
      FROM costed c
      LEFT JOIN stock.stock_lot slt
        ON c.svi_lot_id IS NULL
       AND slt.slt_company_id  = c.svh_company_id
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
 * Phase 2b — 19's rule: an INWARD valued at nothing is refused, even after the
 * rate source had its chance. A free-goods line (no quantity, only free
 * quantity) is exempt: it is worth nothing on purpose.
 *
 * Only the stock module's own documents come here. A sales document's shadow
 * voucher (`ledgerSource` set) keeps posting at whatever the engine resolved:
 * a return of an item the branch never costed is the sales module's decision.
 */
async function assertInwardCost(
  tx: Prisma.TransactionClient,
  { rules, svhId, accYear }: PostStockVoucherParams,
): Promise<void> {
  const isCount = rules.quantityMode === 'COUNT';
  if (!isCount && !rules.isInward && rules.lineDirection !== 'REASON') {
    return;
  }
  // Read AFTER attachLotsToLines, so svi_cost_rate is the resolved figure; the
  // direction is the line's (the document's, or the reason's on an adjustment).
  const rows = await tx.$queryRaw<
    Array<{ svi_line_no: number; svi_split_no: number; item_name: string }>
  >`
    WITH ${postingCte(svhId, accYear, rules)}
    SELECT c.svi_line_no, c.svi_split_no, itm.item_name_en AS item_name
      FROM costed c
      JOIN inventory.item_master itm ON itm.item_id = c.svi_item_id
     WHERE c.line_cost_rate = 0
       AND CASE WHEN ${isCount}::boolean
                THEN COALESCE(c.svi_diff_qty, 0) > 0
                ELSE c.line_direction > 0 AND c.svi_base_qty > 0 END
     ORDER BY c.svi_line_no, c.svi_split_no
  `;
  if (rows.length) {
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
      `This ${rules.displayName.toLowerCase()} cannot be posted`,
      rows.map((r) => ({
        field: `lines.${r.svi_line_no}`,
        message: `Line ${r.svi_line_no}${r.svi_split_no > 1 ? ` split ${r.svi_split_no}` : ''} (${r.item_name}): brings stock in at a cost of 0 — the rate source resolved nothing. Set a cost on the line or a rate source the engine can derive one from.`,
      })),
    );
  }
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
 *
 * THE SHAPE decides how many rows a line writes and where they land:
 *   SIMPLE        one row, the document's direction, the LINE's godown;
 *   COUNT         one row, direction and txn type from the sign of the variance;
 *   TRANSFER_OUT  the OUT row (−1, line godown) always, and the IN row (+1, the
 *                 header's to-godown) only within one branch — so the pair is
 *                 written in ONE statement at ONE cost, which is what 20's
 *                 `RETURNING sml_cost_rate` achieved one row at a time;
 *   TRANSFER_IN   one row, +1, the LINE's godown (the destination), at the
 *                 transit row's cost. A line saved in the DAMAGED bucket lands
 *                 in DAMAGED.
 */
async function writeLedger(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
): Promise<number> {
  const { rules, svhId, accYear, actor, postedOn, ledgerSource } = params;
  const isCount = rules.quantityMode === 'COUNT';
  const shape = rules.postShape;
  // A count posts two txn types in one document, decided per line by the sign of
  // the variance; every other type posts one, decided by the document.
  const [plusTxnType, minusTxnType] = isCount
    ? [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[1] ?? rules.ledgerTxnTypes[0]]
    : [rules.ledgerTxnTypes[0], rules.ledgerTxnTypes[0]];
  const direction = rules.isInward ? DIRECTION_IN : DIRECTION_OUT;
  // (direction, txn type, lands in the header's to-godown, only within one
  // branch, from the line). A transfer's sides are fixed by the shape; every
  // other document's row takes the LINE's direction and txn type — the
  // document's under lineDirection DOCUMENT, the reason's under REASON.
  const sides: Prisma.Sql[] =
    shape === 'TRANSFER_OUT'
      ? [
          Prisma.sql`(${DIRECTION_OUT}::int, 'TRANSFER_OUT'::text, false, false, false)`,
          Prisma.sql`(${DIRECTION_IN}::int, 'TRANSFER_IN'::text, true, true, false)`,
        ]
      : shape === 'TRANSFER_IN'
        ? [Prisma.sql`(${DIRECTION_IN}::int, 'TRANSFER_IN'::text, false, false, false)`]
        : [Prisma.sql`(${direction}::int, ${plusTxnType}::text, false, false, true)`];
  return tx.$executeRaw`
    WITH ${postingCte(svhId, accYear, rules)}
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
    SELECT c.svh_company_id, c.svh_branch_id, c.svh_tenant_id, c.svi_acc_year,
           CASE WHEN side.to_godown THEN c.svh_to_godown_id ELSE c.svi_godown_id END,
           c.svi_item_id, svi.svi_lot_id, c.svi_uom_id, c.svi_base_uom_id, c.svi_to_base_factor,
           ${ledgerSource?.srcModule ?? STOCK_LEDGER_SRC_MODULE},
           ${ledgerSource?.srcDocType ?? rules.voucherType}, c.svi_voucher_id, c.svi_acc_year,
           COALESCE(${ledgerSource?.srcRefno ?? null}::varchar, c.svh_refno),
           c.svi_line_no, c.svi_split_no,
           CASE WHEN ${isCount}::boolean
                THEN CASE WHEN COALESCE(c.svi_diff_qty, 0) >= 0 THEN ${plusTxnType} ELSE ${minusTxnType} END
                WHEN side.from_line THEN c.line_txn_type
                ELSE side.txn_type END,
           CASE WHEN ${isCount}::boolean
                THEN CASE WHEN COALESCE(c.svi_diff_qty, 0) >= 0 THEN ${DIRECTION_IN} ELSE ${DIRECTION_OUT} END
                WHEN side.from_line THEN c.line_direction
                ELSE side.direction END,
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
      CROSS JOIN (VALUES ${Prisma.join(sides)}) AS side(direction, txn_type, to_godown, same_branch_only, from_line)
     WHERE (c.move_base_qty + c.move_free_base_qty) <> 0
       AND (NOT side.same_branch_only OR c.same_branch)
     ORDER BY c.svi_line_no, c.svi_split_no, side.direction DESC
  `;
}
// ──────────────────────────────────────────────────────────────────────────
// Transfers — the lorry (20:87-591, §1.1)
// ──────────────────────────────────────────────────────────────────────────
interface TransferContext {
  sameBranch: boolean;
  /** The despatch: the document itself on an OUT, the linked one on an IN. */
  outId: string;
  outAccYear: string;
  outRefno: string;
}
interface LockedHeader {
  status: string;
  refno: string;
  voucherType: string;
  branchId: string;
  toBranchId: string | null;
  toGodownId: string | null;
  linkSrcDocId: string | null;
  linkSrcAccYear: string | null;
}
/**
 * Despatch preconditions (20:~100-130): every line names its lot, and the
 * shape — same branch or another — is decided from the header alone.
 */
async function assertDespatchable(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
  header: LockedHeader,
): Promise<TransferContext> {
  const { rules, svhId, accYear } = params;
  const lotless = await tx.$queryRaw<Array<{ svi_line_no: number }>>`
    SELECT svi_line_no FROM stock.stock_voucher_item
     WHERE svi_voucher_id = ${svhId}::uuid AND svi_acc_year = ${accYear}::bpchar
       AND svi_is_deleted = false AND svi_lot_id IS NULL
     ORDER BY svi_line_no
  `;
  if (lotless.length) {
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
      `This ${rules.displayName.toLowerCase()} cannot be despatched`,
      lotless.map((r) => ({
        field: `lines.${r.svi_line_no}`,
        message: `Line ${r.svi_line_no} names no lot — a transfer moves existing stock; pick it from the balance.`,
      })),
    );
  }
  const sameBranch = header.toBranchId === null || header.toBranchId === header.branchId;
  if (!sameBranch && !header.toGodownId) {
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
      `This ${rules.displayName.toLowerCase()} cannot be despatched`,
      [{ field: 'toGodownId', message: 'An inter-branch transfer must name the destination godown.' }],
    );
  }
  return { sameBranch, outId: svhId, outAccYear: accYear, outRefno: header.refno };
}
/**
 * Receipt preconditions (20:316-380, REVIEW hole 2): the despatch is locked,
 * IN_TRANSIT, not deleted, addressed to this branch; every line matches one
 * open transit row and claims no more than remains. Refused as ONE 422 with a
 * per-line list, the way the save refuses, because a clerk forty lines in
 * should see every bad row at once.
 */
async function assertReceivable(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
  header: LockedHeader,
): Promise<TransferContext> {
  const { rules, svhId, accYear } = params;
  if (!header.linkSrcDocId) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>('Receipt links no transfer', [
      {
        field: 'linkSrcDocId',
        message: `${header.refno} names no despatch. A receipt cannot be posted without the transfer it is against.`,
      },
    ]);
  }
  const outAccYear = (header.linkSrcAccYear ?? accYear).trim();
  const [out] = await tx.$queryRaw<
    Array<{
      svh_status: string;
      svh_refno: string;
      svh_is_deleted: boolean;
      svh_to_branch_id: string | null;
    }>
  >`
    SELECT svh_status, svh_refno, svh_is_deleted, svh_to_branch_id
      FROM stock.stock_voucher
     WHERE svh_id = ${header.linkSrcDocId}::uuid
       AND svh_acc_year = ${outAccYear}::bpchar
       AND svh_voucher_type = 'TRANSFER_OUT'
       FOR UPDATE
  `;
  if (!out) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>('Transfer not found', [
      {
        field: 'linkSrcDocId',
        message: `${header.refno} answers a despatch that does not exist.`,
      },
    ]);
  }
  if (out.svh_is_deleted) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>('Transfer is deleted', [
      {
        field: 'linkSrcDocId',
        message: `${out.svh_refno} has been deleted by the sending branch. Nothing can be received against it.`,
      },
    ]);
  }
  if (out.svh_to_branch_id !== header.branchId) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>('Transfer is for another branch', [
      {
        field: 'branchId',
        message: `${out.svh_refno} was sent to another branch. A transfer can only be received where it was addressed.`,
      },
    ]);
  }
  if (out.svh_status !== 'IN_TRANSIT') {
    throwStockConflict<StockErrorDetail, StockErrorResponse>(`Transfer is ${out.svh_status}`, [
      {
        field: 'linkSrcDocId',
        message:
          out.svh_status === 'RECEIVED'
            ? `${out.svh_refno} has already been received in full.`
            : `${out.svh_refno} is ${out.svh_status}; only a despatched transfer can be received.`,
      },
    ]);
  }
  // Every line against its transit row; the claim is per ROW, so two lines
  // (25 good + 3 broken) against one row are summed before the comparison.
  const claims = await tx.$queryRaw<
    Array<{
      svi_line_no: number;
      stt_id: string | null;
      matches: bigint;
      claimed: Prisma.Decimal;
      remaining: Prisma.Decimal | null;
    }>
  >`
    WITH line AS (
      SELECT svi.svi_line_no, svi.svi_item_id, svi.svi_lot_id, svi.svi_godown_id, svi.svi_bucket,
             svi.svi_base_qty + svi.svi_free_base_qty AS qty
        FROM stock.stock_voucher_item svi
       WHERE svi.svi_voucher_id = ${svhId}::uuid AND svi.svi_acc_year = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
    ),
    matched AS (
      SELECT line.*,
             (SELECT count(*) FROM stock.stock_transit t
               WHERE t.stt_out_voucher_id = ${header.linkSrcDocId}::uuid AND t.stt_out_acc_year = ${outAccYear}::bpchar
                 AND t.stt_item_id = line.svi_item_id AND t.stt_lot_id = line.svi_lot_id
                 AND t.stt_to_godown_id = line.svi_godown_id AND t.stt_is_deleted = false) AS matches,
             (SELECT t.stt_id FROM stock.stock_transit t
               WHERE t.stt_out_voucher_id = ${header.linkSrcDocId}::uuid AND t.stt_out_acc_year = ${outAccYear}::bpchar
                 AND t.stt_item_id = line.svi_item_id AND t.stt_lot_id = line.svi_lot_id
                 AND t.stt_to_godown_id = line.svi_godown_id AND t.stt_is_deleted = false
               ORDER BY (t.stt_bucket = line.svi_bucket) DESC LIMIT 1) AS stt_id
        FROM line
    )
    SELECT m.svi_line_no, m.stt_id, m.matches,
           SUM(m.qty) OVER (PARTITION BY m.stt_id) AS claimed,
           t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty AS remaining
      FROM matched m
      LEFT JOIN stock.stock_transit t ON t.stt_id = m.stt_id
     ORDER BY m.svi_line_no
  `;
  const errors: StockErrorDetail[] = [];
  const reported = new Set<string>();
  for (const c of claims) {
    const field = `lines.${c.svi_line_no}`;
    if (!c.stt_id) {
      errors.push({
        field,
        message: `Line ${c.svi_line_no}: nothing of this lot is in transit to this godown.`,
      });
      continue;
    }
    if (Number(c.matches) > 1) {
      errors.push({
        field,
        message: `Line ${c.svi_line_no}: this item and lot were shipped in more than one bucket, and the receipt cannot tell them apart. The sender must ship them as separate transfers.`,
      });
      continue;
    }
    if (!reported.has(c.stt_id) && new Prisma.Decimal(c.claimed).gt(c.remaining ?? 0)) {
      reported.add(c.stt_id);
      errors.push({
        field,
        message: `Line ${c.svi_line_no} receives ${c.claimed.toString()} but only ${(c.remaining ?? new Prisma.Decimal(0)).toString()} of that lot is still in transit. A second receipt opens with the remainder, not the original quantity.`,
      });
    }
  }
  if (errors.length) {
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
      `This ${rules.displayName.toLowerCase()} cannot be posted`,
      errors,
    );
  }
  return {
    sameBranch: false,
    outId: header.linkSrcDocId,
    outAccYear,
    outRefno: out.svh_refno,
  };
}
/**
 * Phase 3b (OUT, another branch) — one `stock_transit` row per (item, lot,
 * destination godown, bucket), carrying the cost the OUT row was stamped at
 * (both with and without tax — `stt_cost_rate_wot` is the column REVIEW asked
 * for, so a receipt no longer reads the lot's frozen first-arrival figure).
 *
 * At the source the stock is simply GONE; only the destination carries
 * transit (20:184-185). The rows are aggregated from the ledger rows just
 * written, never from the payload.
 */
async function writeTransitRows(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
): Promise<number> {
  const { actor, postedOn } = params;
  return tx.$executeRaw`
    INSERT INTO stock.stock_transit (
      stt_company_id, stt_tenant_id, stt_from_branch_id, stt_from_godown_id,
      stt_to_branch_id, stt_to_godown_id,
      stt_item_id, stt_lot_id, stt_base_uom_id, stt_bucket,
      stt_out_voucher_id, stt_out_acc_year, stt_out_refno,
      stt_sent_qty, stt_cost_rate, stt_cost_rate_wot, stt_transit_value,
      stt_sent_on, stt_status, stt_created_on, stt_created_by
    )
    SELECT sml.sml_company_id, sml.sml_tenant_id, sml.sml_branch_id, sml.sml_godown_id,
           doc.svh_to_branch_id, doc.svh_to_godown_id,
           sml.sml_item_id, sml.sml_lot_id, sml.sml_base_uom_id, sml.sml_bucket,
           sml.sml_src_doc_id, sml.sml_acc_year, doc.svh_refno,
           SUM(sml.sml_base_qty + sml.sml_free_base_qty),
           MAX(sml.sml_cost_rate), MAX(sml.sml_cost_rate_wot), SUM(sml.sml_cost_value),
           ${postedOn}, 'IN_TRANSIT', ${postedOn}, ${auditColumnActor(actor)}
      FROM stock.stock_ledger sml
      JOIN stock.stock_voucher doc
        ON doc.svh_id = sml.sml_src_doc_id AND doc.svh_acc_year = sml.sml_acc_year
     WHERE ${ledgerRowsOf({ ...params, reversal: false })}
       AND sml.sml_txn_type = 'TRANSFER_OUT'
     GROUP BY sml.sml_company_id, sml.sml_tenant_id, sml.sml_branch_id, sml.sml_godown_id,
              doc.svh_to_branch_id, doc.svh_to_godown_id,
              sml.sml_item_id, sml.sml_lot_id, sml.sml_base_uom_id, sml.sml_bucket,
              sml.sml_src_doc_id, sml.sml_acc_year, doc.svh_refno
  `;
}
/**
 * Phase 3b (IN) — the transit rows settled from the IN rows just written
 * (20:~420-540): received and damage accumulate, the status goes PARTIAL or
 * RECEIVED, and the OUT flips to RECEIVED only when no row of it has anything
 * left. A short keeps it open on purpose — that is the loss report.
 *
 * A DAMAGED line against a non-damaged shipment is DAMAGE; a DAMAGED line
 * against a damaged shipment is simply what arrived.
 */
async function settleTransitRows(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
  transit: TransferContext,
): Promise<{ rows: number; closedOut: PostStockVoucherResult['closedOut'] }> {
  const { svhId, accYear, actor, postedOn } = params;
  const author = auditColumnActor(actor);
  const rows = await tx.$executeRaw`
    WITH got AS (
      SELECT stt.stt_id, doc.svh_refno,
             SUM(CASE WHEN sml.sml_bucket = 'DAMAGED' AND stt.stt_bucket <> 'DAMAGED'
                      THEN 0 ELSE sml.sml_base_qty + sml.sml_free_base_qty END) AS received,
             SUM(CASE WHEN sml.sml_bucket = 'DAMAGED' AND stt.stt_bucket <> 'DAMAGED'
                      THEN sml.sml_base_qty + sml.sml_free_base_qty ELSE 0 END) AS damaged
        FROM stock.stock_ledger sml
        JOIN stock.stock_voucher doc
          ON doc.svh_id = sml.sml_src_doc_id AND doc.svh_acc_year = sml.sml_acc_year
        JOIN LATERAL (
          SELECT t.stt_id, t.stt_bucket
            FROM stock.stock_transit t
           WHERE t.stt_out_voucher_id = ${transit.outId}::uuid
             AND t.stt_out_acc_year   = ${transit.outAccYear}::bpchar
             AND t.stt_item_id        = sml.sml_item_id
             AND t.stt_lot_id         = sml.sml_lot_id
             AND t.stt_to_godown_id   = sml.sml_godown_id
             AND t.stt_is_deleted     = false
           ORDER BY (t.stt_bucket = sml.sml_bucket) DESC
           LIMIT 1
        ) stt ON true
       WHERE ${ledgerRowsOf({ ...params, reversal: false })}
         AND sml.sml_txn_type = 'TRANSFER_IN'
       GROUP BY stt.stt_id, doc.svh_refno
    )
    UPDATE stock.stock_transit t
       SET stt_received_qty = t.stt_received_qty + got.received,
           stt_damage_qty   = t.stt_damage_qty   + got.damaged,
           stt_status       = CASE WHEN t.stt_sent_qty - (t.stt_received_qty + got.received)
                                                       - (t.stt_damage_qty + got.damaged) <= 0
                                   THEN 'RECEIVED' ELSE 'PARTIAL' END,
           stt_in_voucher_id = ${svhId}::uuid,
           stt_in_acc_year   = ${accYear}::bpchar,
           stt_in_refno      = got.svh_refno,
           stt_received_on   = ${postedOn},
           stt_modified_on   = ${postedOn},
           stt_modified_by   = ${author}
      FROM got
     WHERE t.stt_id = got.stt_id
  `;
  const closed = await tx.$queryRaw<Array<{ svh_id: string; svh_acc_year: string; svh_refno: string }>>`
    UPDATE stock.stock_voucher o
       SET svh_status      = 'RECEIVED',
           svh_version_no  = o.svh_version_no + 1,
           svh_modified_on = ${postedOn},
           svh_modified_by = ${author}
     WHERE o.svh_id       = ${transit.outId}::uuid
       AND o.svh_acc_year = ${transit.outAccYear}::bpchar
       AND o.svh_status   = 'IN_TRANSIT'
       AND NOT EXISTS (
             SELECT 1 FROM stock.stock_transit t
              WHERE t.stt_out_voucher_id = o.svh_id AND t.stt_out_acc_year = o.svh_acc_year
                AND t.stt_is_deleted = false
                AND t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty > 0)
    RETURNING o.svh_id, o.svh_acc_year, o.svh_refno
  `;
  return {
    rows,
    closedOut: closed[0]
      ? { svhId: closed[0].svh_id, accYear: closed[0].svh_acc_year.trim(), refno: closed[0].svh_refno }
      : null,
  };
}
/**
 * Short-settle (the `fn_stt_settle_short` nobody wrote — REVIEW known gap 1):
 * flips every PARTIAL row of an IN_TRANSIT despatch to RECEIVED, KEEPING
 * `stt_short_qty` so the loss report still shows it, closes the OUT and takes
 * the remainder out of the destination's transit quantity.
 *
 * Returns what was written off, per row, so the caller can post the accounts
 * leg for `short × stt_cost_rate`. The header is locked and checked here for
 * the same reason every other status move is.
 */
export interface SettleShortParams {
  outId: string;
  outAccYear: string;
  companyId: string;
  branchId: string;
  reasonId: string;
  remarks: string | null;
  actor: string;
  settledOn: Date;
}
export interface SettledShortRow {
  sttId: string;
  itemId: string;
  lotId: string;
  toGodownId: string;
  bucket: string;
  shortQty: Prisma.Decimal;
  costRate: Prisma.Decimal;
  shortValue: Prisma.Decimal;
}
export async function settleTransitShort(
  tx: Prisma.TransactionClient,
  params: SettleShortParams,
): Promise<{ refno: string; rows: SettledShortRow[] }> {
  const { outId, outAccYear, companyId, branchId, reasonId, remarks, actor, settledOn } = params;
  const author = auditColumnActor(actor);
  const [out] = await tx.$queryRaw<
    Array<{ svh_status: string; svh_refno: string; svh_is_deleted: boolean; svh_voucher_type: string }>
  >`
    SELECT svh_status, svh_refno, svh_is_deleted, svh_voucher_type
      FROM stock.stock_voucher
     WHERE svh_id = ${outId}::uuid AND svh_acc_year = ${outAccYear}::bpchar
       AND svh_company_id = ${companyId}::uuid AND svh_branch_id = ${branchId}::uuid
       FOR UPDATE
  `;
  if (!out || out.svh_is_deleted || out.svh_voucher_type !== 'TRANSFER_OUT') {
    throwStockConflict<StockErrorDetail, StockErrorResponse>('Transfer not found', [
      { field: 'outVoucherId', message: `No live TRANSFER_OUT ${outId} in ${outAccYear} for this branch.` },
    ]);
  }
  if (out.svh_status !== 'IN_TRANSIT') {
    throwStockConflict<StockErrorDetail, StockErrorResponse>(`Transfer is ${out.svh_status}`, [
      {
        field: 'outVoucherId',
        message:
          out.svh_status === 'RECEIVED'
            ? `${out.svh_refno} is already closed: nothing is short.`
            : `${out.svh_refno} is ${out.svh_status}; only a despatched transfer can be short-settled.`,
      },
    ]);
  }
  const untouched = await tx.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::bigint AS n FROM stock.stock_transit
     WHERE stt_out_voucher_id = ${outId}::uuid AND stt_out_acc_year = ${outAccYear}::bpchar
       AND stt_is_deleted = false AND stt_status = 'IN_TRANSIT'
  `;
  if (Number(untouched[0]?.n ?? 0) > 0) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>('Nothing has been received yet', [
      {
        field: 'outVoucherId',
        message: `${out.svh_refno} has lines nothing has been received against. A short is settled after the receipt, not instead of it — receive what arrived first.`,
      },
    ]);
  }
  const rows = await tx.$queryRaw<
    Array<{
      stt_id: string;
      stt_item_id: string;
      stt_lot_id: string;
      stt_to_godown_id: string;
      stt_bucket: string;
      short_qty: Prisma.Decimal;
      stt_cost_rate: Prisma.Decimal;
    }>
  >`
    UPDATE stock.stock_transit t
       SET stt_status      = 'RECEIVED',
           stt_remarks     = COALESCE(${remarks}::varchar, t.stt_remarks),
           stt_received_on = COALESCE(t.stt_received_on, ${settledOn}),
           stt_modified_on = ${settledOn},
           stt_modified_by = ${author}
     WHERE t.stt_out_voucher_id = ${outId}::uuid AND t.stt_out_acc_year = ${outAccYear}::bpchar
       AND t.stt_is_deleted = false AND t.stt_status = 'PARTIAL'
    RETURNING t.stt_id, t.stt_item_id, t.stt_lot_id, t.stt_to_godown_id, t.stt_bucket,
              t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty AS short_qty, t.stt_cost_rate
  `;
  await tx.$executeRaw`
    UPDATE stock.stock_voucher
       SET svh_status = 'RECEIVED', svh_version_no = svh_version_no + 1,
           svh_reason_id = ${reasonId}::uuid,
           svh_modified_on = ${settledOn}, svh_modified_by = ${author}
     WHERE svh_id = ${outId}::uuid AND svh_acc_year = ${outAccYear}::bpchar
  `;
  await refreshTransitIn(tx, transitHoldingsOf(outId, outAccYear), actor, settledOn);
  return {
    refno: out.svh_refno,
    rows: rows.map((r) => ({
      sttId: r.stt_id,
      itemId: r.stt_item_id,
      lotId: r.stt_lot_id,
      toGodownId: r.stt_to_godown_id,
      bucket: r.stt_bucket,
      shortQty: new Prisma.Decimal(r.short_qty),
      costRate: new Prisma.Decimal(r.stt_cost_rate),
      shortValue: new Prisma.Decimal(r.short_qty).times(r.stt_cost_rate).toDecimalPlaces(2),
    })),
  };
}
// ──────────────────────────────────────────────────────────────────────────
// Balance rows that exist BEFORE a movement — reserved and in-transit (§1.3)
// ──────────────────────────────────────────────────────────────────────────
/**
 * A source of holdings: a subquery yielding
 * `(company_id, branch_id, tenant_id, godown_id, item_id, lot_id, base_uom_id, bucket)`.
 * The three writers below take one so a caller can say "the destination
 * holdings of this despatch" or "every holding this order reserved" without
 * the writer knowing which table the question came from.
 */
export type HoldingSource = Prisma.Sql;
/** The destination holdings of one despatch's transit rows. */
export function transitHoldingsOf(outId: string, outAccYear: string): HoldingSource {
  return Prisma.sql`
    SELECT DISTINCT t.stt_company_id AS company_id, t.stt_to_branch_id AS branch_id,
           t.stt_tenant_id AS tenant_id, t.stt_to_godown_id AS godown_id,
           t.stt_item_id AS item_id, t.stt_lot_id AS lot_id, t.stt_base_uom_id AS base_uom_id,
           t.stt_bucket AS bucket
      FROM stock.stock_transit t
     WHERE t.stt_out_voucher_id = ${outId}::uuid
       AND t.stt_out_acc_year   = ${outAccYear}::bpchar
       AND t.stt_is_deleted     = false
  `;
}
/** Every holding one document's reservations (any status) sit on. */
export function reservationHoldingsOf(srcDocType: string, srcDocId: string): HoldingSource {
  return Prisma.sql`
    SELECT DISTINCT r.srv_company_id AS company_id, r.srv_branch_id AS branch_id,
           r.srv_tenant_id AS tenant_id, r.srv_godown_id AS godown_id,
           r.srv_item_id AS item_id, r.srv_lot_id AS lot_id, r.srv_base_uom_id AS base_uom_id,
           r.srv_bucket AS bucket
      FROM stock.stock_reservation r
     WHERE r.srv_src_doc_type = ${srcDocType}
       AND r.srv_src_doc_id   = ${srcDocId}::uuid
       AND r.srv_is_deleted   = false
  `;
}
/** Every holding with an OPEN or PARTIAL reservation in a company (the migration's one-time fix). */
export function openReservationHoldings(companyId?: string | null): HoldingSource {
  return Prisma.sql`
    SELECT DISTINCT r.srv_company_id AS company_id, r.srv_branch_id AS branch_id,
           r.srv_tenant_id AS tenant_id, r.srv_godown_id AS godown_id,
           r.srv_item_id AS item_id, r.srv_lot_id AS lot_id, r.srv_base_uom_id AS base_uom_id,
           r.srv_bucket AS bucket
      FROM stock.stock_reservation r
     WHERE (${companyId ?? null}::uuid IS NULL OR r.srv_company_id = ${companyId ?? null}::uuid)
       AND r.srv_is_deleted = false
  `;
}
/**
 * The per-(company, branch, item) advisory lock, IN SORTED ORDER, before any
 * balance write — the same key `applyItemCost` takes, so a reservation and a
 * posting on one item never deadlock (REVIEW MUST-FIX 1's lesson). Its own
 * statement, for the reason on `applyItemCost`.
 */
async function lockHoldingItems(tx: Prisma.TransactionClient, holdings: HoldingSource): Promise<void> {
  await tx.$queryRaw`
    SELECT count(pg_advisory_xact_lock(hashtextextended(
             t.company_id::text || ':' || t.branch_id::text || ':' || t.item_id::text, 0)))::int AS locked
      FROM (SELECT DISTINCT h.company_id, h.branch_id, h.item_id
              FROM (${holdings}) h
             ORDER BY 1, 2, 3) t
  `;
}
/**
 * A zero balance row for every holding that has none yet, `ON CONFLICT DO
 * NOTHING` — so a reservation or a transit can exist before the holding's
 * first movement, and the inbound quantity is visible before the goods arrive
 * (the commonest first-transfer case, 20:206-208). Former `fn_sbl_ensure_row`.
 */
export async function ensureBalanceRows(
  tx: Prisma.TransactionClient,
  holdings: HoldingSource,
  actor: string,
): Promise<void> {
  await lockHoldingItems(tx, holdings);
  await tx.$executeRaw`
    INSERT INTO stock.stock_balance (
      sbl_company_id, sbl_branch_id, sbl_tenant_id, sbl_godown_id, sbl_item_id,
      sbl_lot_id, sbl_base_uom_id, sbl_bucket,
      sbl_batch_no, sbl_mrp, sbl_sale_price, sbl_expiry_date, sbl_supplier_id,
      sbl_created_by
    )
    SELECT h.company_id, h.branch_id, h.tenant_id, h.godown_id, h.item_id,
           h.lot_id, h.base_uom_id, h.bucket,
           slt.slt_batch_no, slt.slt_mrp, slt.slt_sale_price, slt.slt_expiry_date, slt.slt_supplier_id,
           ${auditColumnActor(actor)}
      FROM (${holdings}) h
      JOIN stock.stock_lot slt ON slt.slt_id = h.lot_id
    ON CONFLICT (sbl_company_id, sbl_branch_id, sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket)
    WHERE sbl_is_deleted = false
    DO NOTHING
  `;
}
/**
 * `sbl_reserved_qty = Σ open reservations of the holding` — RECOMPUTED for the
 * holdings given, never incremented. Former `fn_sbl_refresh_reserved` /
 * `fn_srv_refresh`. `sbl_available_qty` is GENERATED from it, so the billing
 * screen's figure follows.
 */
export async function refreshReserved(
  tx: Prisma.TransactionClient,
  holdings: HoldingSource,
  actor: string,
  on: Date,
): Promise<number> {
  await lockHoldingItems(tx, holdings);
  return tx.$executeRaw`
    UPDATE stock.stock_balance b
       SET sbl_reserved_qty = COALESCE(r.qty, 0),
           sbl_row_version  = b.sbl_row_version + 1,
           sbl_modified_on  = ${on},
           sbl_modified_by  = ${auditColumnActor(actor)}
      FROM (${holdings}) h
      LEFT JOIN LATERAL (
        SELECT SUM(x.srv_open_qty) AS qty
          FROM stock.stock_reservation x
         WHERE x.srv_company_id = h.company_id AND x.srv_branch_id = h.branch_id
           AND x.srv_godown_id  = h.godown_id  AND x.srv_item_id   = h.item_id
           AND x.srv_lot_id     = h.lot_id     AND x.srv_bucket    = h.bucket
           AND x.srv_is_deleted = false
           AND x.srv_status IN ('OPEN', 'PARTIAL')
      ) r ON true
     WHERE b.sbl_company_id = h.company_id AND b.sbl_branch_id = h.branch_id
       AND b.sbl_godown_id  = h.godown_id  AND b.sbl_item_id   = h.item_id
       AND b.sbl_lot_id     = h.lot_id     AND b.sbl_bucket    = h.bucket
       AND b.sbl_is_deleted = false
       AND b.sbl_reserved_qty IS DISTINCT FROM COALESCE(r.qty, 0)
  `;
}
/**
 * `sbl_transit_in_qty = Σ (sent − received − damage)` over the holding's transit
 * rows still IN_TRANSIT or PARTIAL — RECOMPUTED. Former `fn_stt_refresh`. A
 * short-settled row is RECEIVED and drops out, which is what makes the ghost
 * inbound quantity of 20:344-349 go away.
 */
export async function refreshTransitIn(
  tx: Prisma.TransactionClient,
  holdings: HoldingSource,
  actor: string,
  on: Date,
): Promise<number> {
  await lockHoldingItems(tx, holdings);
  return tx.$executeRaw`
    UPDATE stock.stock_balance b
       SET sbl_transit_in_qty = COALESCE(t.qty, 0),
           sbl_row_version    = b.sbl_row_version + 1,
           sbl_modified_on    = ${on},
           sbl_modified_by    = ${auditColumnActor(actor)}
      FROM (${holdings}) h
      LEFT JOIN LATERAL (
        SELECT SUM(x.stt_sent_qty - x.stt_received_qty - x.stt_damage_qty) AS qty
          FROM stock.stock_transit x
         WHERE x.stt_company_id   = h.company_id AND x.stt_to_branch_id = h.branch_id
           AND x.stt_to_godown_id = h.godown_id  AND x.stt_item_id      = h.item_id
           AND x.stt_lot_id       = h.lot_id     AND x.stt_bucket       = h.bucket
           AND x.stt_is_deleted   = false
           AND x.stt_status IN ('IN_TRANSIT', 'PARTIAL')
      ) t ON true
     WHERE b.sbl_company_id = h.company_id AND b.sbl_branch_id = h.branch_id
       AND b.sbl_godown_id  = h.godown_id  AND b.sbl_item_id   = h.item_id
       AND b.sbl_lot_id     = h.lot_id     AND b.sbl_bucket    = h.bucket
       AND b.sbl_is_deleted = false
       AND b.sbl_transit_in_qty IS DISTINCT FROM COALESCE(t.qty, 0)
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
 * A same-branch transfer is the shape where this is exactly neutral: −560 out
 * at the average, +560 in at the same figure, and the branch row does not move
 * (20:127-136). An internal move is not a revaluation.
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
 * rate, exactly as the trigger does.
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
 * A TRANSFER is BLOCK whatever the item's policy says (decision D2): a lorry
 * cannot carry negative stock, and a despatch that left the source below zero
 * would deliver goods to the destination that were never there.
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
  const forceBlock = (isTransferShape(rules.postShape) || rules.blockNegative === true) && !params.reversal;
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
           CASE WHEN ${forceBlock}::boolean THEN 'BLOCK'
                ELSE COALESCE(stp.stp_allow_negative, 'ALLOW') END AS "allowNegative"
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
       AND (${forceBlock}::boolean OR COALESCE(stp.stp_allow_negative, 'ALLOW') <> 'ALLOW')
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
/**
 * Phase 8 — the header totals, re-summed from the ledger rows the document
 * wrote (former `fn_svh_recompute`, 16:3532-3606), never from the payload.
 *
 * Forward rows count once, reversal rows count once the other way, so a
 * cancelled document re-totals to 0 (REVIEW SHOULD-FIX). Per shape:
 *   COUNT         the NET variance — signed quantity and signed value of the
 *                 PLUS/MINUS rows (README:189-193; +1 / 86.00 in the worked
 *                 count), so it may be negative and the screen labels it so;
 *   TRANSFER_OUT  the OUT rows only — a same-branch pair moved 20, not 40;
 *   everything else   every row, as a magnitude.
 * `svh_line_count` is the document's live line count: a count sheet that
 * varied on two of three lines still counted three.
 *
 * A DRAFT keeps the payload's figures, flagged provisional: nothing has been
 * valued yet, and the grid is the only thing that has an opinion.
 */
async function recomputeHeaderTotals(
  tx: Prisma.TransactionClient,
  params: PostStockVoucherParams,
): Promise<void> {
  const { rules, svhId, accYear } = params;
  const isCount = rules.quantityMode === 'COUNT';
  // A document whose lines move both ways (a count, an adjustment under
  // per-line reasons) carries the NET of them; everything else a magnitude.
  const netted = isCount || rules.lineDirection === 'REASON';
  const outOnly = rules.postShape === 'TRANSFER_OUT';
  await tx.$executeRaw`
    WITH led AS (
      SELECT sml.sml_line_no, sml.sml_is_reversal,
             CASE WHEN sml.sml_is_reversal THEN -1 ELSE 1 END                                     AS rev_sign,
             CASE WHEN ${netted}::boolean THEN sml.sml_direction ELSE 1 END                      AS doc_sign,
             sml.sml_base_qty + sml.sml_free_base_qty                                            AS qty,
             sml.sml_cost_value, sml.sml_cost_value_wot
        FROM stock.stock_ledger sml
       WHERE sml.sml_src_doc_id = ${svhId}::uuid
         AND sml.sml_acc_year   = ${accYear}::bpchar
         AND sml.sml_is_deleted = false
         AND (NOT ${outOnly}::boolean OR sml.sml_txn_type = 'TRANSFER_OUT')
    ),
    totals AS (
      SELECT (SELECT count(*) FROM stock.stock_voucher_item svi
               WHERE svi.svi_voucher_id = ${svhId}::uuid AND svi.svi_acc_year = ${accYear}::bpchar
                 AND svi.svi_is_deleted = false)                                                  AS line_count,
             -- On a COUNT the ledger signs the variance and a reversal flips the
             -- direction, so the direction alone already nets a cancel to 0.
             COALESCE(SUM(CASE WHEN ${netted}::boolean THEN doc_sign ELSE rev_sign END * qty), 0)               AS total_qty,
             COALESCE(SUM(CASE WHEN ${netted}::boolean THEN doc_sign ELSE rev_sign END * sml_cost_value), 0)    AS total_value,
             COALESCE(SUM(CASE WHEN ${netted}::boolean THEN doc_sign ELSE rev_sign END * sml_cost_value_wot), 0) AS total_value_wot
        FROM led
    )
    UPDATE stock.stock_voucher svh
       SET svh_line_count      = t.line_count,
           svh_total_qty       = t.total_qty,
           svh_total_value     = t.total_value,
           svh_total_value_wot = t.total_value_wot
      FROM totals t
     WHERE svh.svh_id       = ${svhId}::uuid
       AND svh.svh_acc_year = ${accYear}::bpchar
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
 * the moving average, the negative-stock policy, the lot totals and the header
 * totals are then applied over those mirrors exactly as they were over the
 * originals.
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
 * WHAT A TRANSFER REFUSES (20:592-625, the guard `tr_svh_transfer_cancel_guard`
 * used to be), checked BEFORE the header lock with the clerk's sentence:
 *   * an IN_TRANSIT or RECEIVED despatch — goods on a lorry cannot be un-sent;
 *   * a POSTED receipt — un-receiving is a reverse transfer, not a cancel;
 *   * a same-branch POSTED pair cancels normally, both halves mirrored, since
 *     both rows carry the document's id.
 *
 * WHAT CAN LEGITIMATELY REFUSE IT, both as 409:
 *   * the negative-stock policy (phase 6): cancelling an opening after stock
 *     has been sold from it drives the holding negative, and BLOCK refuses
 *     that. The fix is an ADJUSTMENT with a reason, not a retry.
 *   * the freeze guard in `StockPostingService`: a DRAFT PHYSICAL count is
 *     freezing the godown. Post or delete the count first.
 *
 * THE HEADER IS LOCKED FIRST, `FOR UPDATE`, and its status re-read under the
 * lock. The service checks the status before the transaction opens, but two
 * cancels arriving together would both pass that check; the loser here waits
 * on the lock, then reads CANCELLED and is refused.
 */
export async function cancelStockVoucher(
  tx: Prisma.TransactionClient,
  params: CancelStockVoucherParams,
): Promise<number> {
  const { rules, svhId, accYear, actor, cancelledOn } = params;
  const author = auditColumnActor(actor);
  await assertTransferCancellable(tx, params);
  await lockHeaderInStatus(tx, params, 'POSTED');
  const rowsReversed = await writeReversalLedger(tx, params);
  const apply = { rules, svhId, accYear, actor, postedOn: cancelledOn };
  await applyLedgerRows(tx, { ...apply, reversal: true });
  await recomputeHeaderTotals(tx, apply);
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
/** The transfer guard — see `cancelStockVoucher`. */
async function assertTransferCancellable(
  tx: Prisma.TransactionClient,
  { rules, svhId, accYear }: CancelStockVoucherParams,
): Promise<void> {
  if (!isTransferShape(rules.postShape)) {
    return;
  }
  const [header] = await tx.$queryRaw<Array<{ status: string; refno: string }>>`
    SELECT svh_status AS status, svh_refno AS refno
      FROM stock.stock_voucher
     WHERE svh_id = ${svhId}::uuid AND svh_acc_year = ${accYear}::bpchar AND svh_is_deleted = false
  `;
  if (!header) {
    return;
  }
  if (rules.postShape === 'TRANSFER_OUT' && (header.status === 'IN_TRANSIT' || header.status === 'RECEIVED')) {
    throwStockConflict<StockErrorDetail, StockErrorResponse>(`${rules.displayName} is ${header.status}`, [
      {
        field: 'svhId',
        message: `${header.refno} is ${header.status}: goods that left cannot be cancelled on paper. Receive what arrived and transfer it back, or short-settle what never arrived.`,
      },
    ]);
  }
  if (rules.postShape === 'TRANSFER_IN' && header.status === 'POSTED') {
    throwStockConflict<StockErrorDetail, StockErrorResponse>(`${rules.displayName} is POSTED`, [
      {
        field: 'svhId',
        message: `${header.refno} has been received: un-receiving is a reverse transfer back to the sender, not a cancellation.`,
      },
    ]);
  }
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
 *   * `ix_svh_freeze_open` and the freeze guard key on DRAFT, so cancelling a
 *     draft PHYSICAL count lifts the godown freeze it was holding. An
 *     abandoned count must not go on blocking every movement in the godown
 *     until its freeze window expires.
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
 * the next request would. Returns the locked header's facts for the caller.
 */
async function lockHeaderInStatus(
  tx: Prisma.TransactionClient,
  { rules, svhId, accYear }: { rules: StockVoucherTypeRules; svhId: string; accYear: string },
  expected: 'POSTED' | 'DRAFT',
): Promise<LockedHeader> {
  const [header] = await tx.$queryRaw<
    Array<{
      status: string;
      refno: string;
      voucher_type: string;
      branch_id: string;
      to_branch_id: string | null;
      to_godown_id: string | null;
      link_src_doc_id: string | null;
      link_src_acc_year: string | null;
    }>
  >`
    SELECT svh.svh_status AS status, svh.svh_refno AS refno, svh.svh_voucher_type AS voucher_type,
           svh.svh_branch_id AS branch_id, svh.svh_to_branch_id AS to_branch_id,
           svh.svh_to_godown_id AS to_godown_id,
           svh.svh_link_src_doc_id AS link_src_doc_id, svh.svh_link_src_acc_year AS link_src_acc_year
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
        message: `${svhId} no longer exists in ${accYear}, so there is nothing to ${expected === 'DRAFT' ? 'post' : 'cancel'}.`,
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
                `${header.refno} is ${header.status}, not ${expected}: it changed while this request was waiting. Reload it and decide again.`,
        },
      ],
    );
  }
  return {
    status: header.status,
    refno: header.refno,
    voucherType: header.voucher_type,
    branchId: header.branch_id,
    toBranchId: header.to_branch_id,
    toGodownId: header.to_godown_id,
    linkSrcDocId: header.link_src_doc_id,
    linkSrcAccYear: header.link_src_acc_year,
  };
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
