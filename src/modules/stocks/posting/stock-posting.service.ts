import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  cancelStockVoucher,
  postStockVoucher,
} from '../stock-voucher/stock-voucher-posting.helper';
import type { StockLedgerSourceLabel } from '../stock-voucher/stock-voucher-posting.helper';
import { StockVoucherSource } from './stock-voucher.source';

/**
 * §3.1 — ONE stock engine, and one door into it.
 *
 * ── Why this service exists at all ─────────────────────────────────────────
 *
 * The posting phases — resolveLots → attachLotsToLines → writeLedger →
 * applyBalances → applyItemCost → assertNegativeStockPolicy → refreshLotTotals
 * — were written twice before: once as `stock.fn_svh_post` in plpgsql and once
 * in TypeScript, and the two drifted apart with nobody the wiser. A delivery
 * challan, a sale bill, a sale return and a DC return are about to need the
 * same seven phases. If each grows its own, the same thing happens again and
 * the next person cannot tell which engine a holding came from.
 *
 * So: every document posts stock through `post(tx, source)`, the phases live in
 * one place, and a `StockLineSource` is the only thing a new document has to
 * write.
 *
 * ── The freeze guard, which is NEW and is the point of the drop ────────────
 *
 * `fn_sml_freeze_guard` used to refuse a `stock_ledger` insert while a godown
 * was frozen for a count — and it tested **`now()`**: the moment the row
 * ARRIVED, not the moment the goods moved. A sale made at 10:00, before the
 * count began, that syncs at 14:00 during it, was refused although the shelf
 * was already short when the counter started counting. That is exactly the
 * offline failure `offline-sync-invariants.md` §7b describes.
 *
 * Migration `20260922060000` dropped the trigger. `assertNotFrozen` below is
 * its replacement, and it tests **`sml_doc_datetime`** — the movement's own
 * timestamp — so a movement that HAPPENED before the freeze is let through for
 * the count to reconcile, and one that happened inside it is still refused.
 */
@Injectable()
export class StockPostingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post one document's stock movement.
   *
   * Runs inside the CALLER's transaction — a document that says POSTED with no
   * ledger rows behind it is the inconsistency this prevents.
   *
   * Returns the number of LEDGER ROWS written, which is not always the line
   * count: a count line whose variance is zero moves nothing and posts no row.
   */
  async post(
    tx: Prisma.TransactionClient,
    source: StockVoucherSource,
    opts: { actor: string; postedOn: Date; ledgerSource?: StockLedgerSourceLabel },
  ): Promise<number> {
    await this.assertNotFrozen(tx, source);

    // The stock voucher keeps its own CTE chain, which reads
    // `stock_voucher_item` directly and IS the reference implementation of the
    // seven phases. Calling it from here rather than copying it is what makes
    // this a seam and not a second engine: its existing e2e suite is the
    // regression test for every phase.
    return postStockVoucher(tx, {
      rules: source.rules,
      svhId: source.svhId,
      accYear: source.accYear,
      actor: opts.actor,
      postedOn: opts.postedOn,
      ledgerSource: opts.ledgerSource,
    });
  }

  /**
   * Cancel by REVERSAL, never by delete: every ledger row the post wrote gets
   * a mirror with the opposite direction, and the balance, the moving average,
   * the negative-stock policy and the lot totals are then applied over those
   * mirrors exactly as they were over the originals.
   */
  async cancel(
    tx: Prisma.TransactionClient,
    source: StockVoucherSource,
    opts: { actor: string; reason: string; cancelledOn: Date },
  ): Promise<number> {
    await this.assertNotFrozen(tx, source);

    return cancelStockVoucher(tx, {
      rules: source.rules,
      svhId: source.svhId,
      accYear: source.accYear,
      actor: opts.actor,
      reason: opts.reason,
      cancelledOn: opts.cancelledOn,
    });
  }

  /**
   * The freeze guard, in the service, testing the movement's OWN timestamp.
   *
   * While a DRAFT PHYSICAL count with `svh_freeze_stock` is inside its window,
   * no ledger row may touch the godown being counted — except the count's own
   * posting, which is what lifts the freeze.
   *
   * Four details that all matter, and each was in the dropped trigger:
   *
   *  * the counted godown is `COALESCE(svh_from_godown_id, svh_to_godown_id)`
   *    on the PHYSICAL header — counts fill `from`;
   *  * DRAFT only. Posting or cancelling the count lifts the freeze by itself,
   *    even mid-window. Nothing to unlock and nothing to forget at 2 a.m.;
   *  * a freeze is per GODOWN. Other godowns of the same branch keep trading;
   *  * the document's own posting is excluded, or a count could never post.
   *
   * And the one detail that is DIFFERENT, deliberately: the window is tested
   * against the MOVEMENT's timestamp, not against `now()`.
   */
  private async assertNotFrozen(
    tx: Prisma.TransactionClient,
    source: StockVoucherSource,
  ): Promise<void> {
    const movedAt = await source.docDatetime(tx);
    if (!movedAt) {
      return;
    }

    const godowns = await source.godownIds(tx);
    if (godowns.length === 0) {
      return;
    }

    const blocking = await tx.$queryRaw<
      {
        svh_id: string;
        svh_refno: string | null;
        godown_id: string;
        svh_freeze_from: Date;
        svh_freeze_to: Date;
      }[]
    >`
      SELECT c.svh_id, c.svh_refno,
             COALESCE(c.svh_from_godown_id, c.svh_to_godown_id) AS godown_id,
             c.svh_freeze_from, c.svh_freeze_to
        FROM stock.stock_voucher c
       WHERE c.svh_company_id = ${source.companyId}::uuid
         AND c.svh_branch_id  = ${source.branchId}::uuid
         -- ix_svh_freeze_open covers exactly these four predicates.
         AND c.svh_voucher_type = 'PHYSICAL'
         AND c.svh_freeze_stock = true
         AND c.svh_status       = 'DRAFT'
         AND c.svh_is_deleted   = false
         -- The count's own posting must not be blocked by its own freeze.
         AND c.svh_id <> ${source.srcDocId}::uuid
         AND COALESCE(c.svh_from_godown_id, c.svh_to_godown_id) = ANY(${godowns}::uuid[])
         -- sml_doc_datetime, NOT now(). See the class note.
         AND ${movedAt}::timestamptz BETWEEN c.svh_freeze_from AND c.svh_freeze_to
       LIMIT 1`;

    if (blocking.length > 0) {
      const b = blocking[0];
      throw new ConflictException(
        `Godown ${b.godown_id} is frozen for physical count ${b.svh_refno ?? b.svh_id} ` +
          `from ${b.svh_freeze_from.toISOString()} to ${b.svh_freeze_to.toISOString()}, ` +
          `and this movement is timed ${movedAt.toISOString()}, inside that window. ` +
          `Post or cancel the count first.`,
      );
    }
  }
}
