import { Prisma } from '@prisma/client';

/**
 * "What belongs to this receipt?" — asked once, here, for the two things that
 * are NOT answered by a column pointing at the receipt.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY `apd_voucher_id` IS THE WRONG ANSWER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `acc_pdc_register.apd_voucher_id` names the voucher the instrument is
 * CURRENTLY carried by, and that column MOVES. `/cheques/re-present` (§4.5)
 * writes a fresh re-issue voucher — the bounce debited the party and relieved
 * Cheques in Hand, so putting the same paper back through the bank is a new act
 * of taking a cheque in — and repoints `apd_voucher_id` at it. From that moment
 * the receipt that took the cheque in looks, to any query built on that column,
 * as though it never held a cheque at all.
 *
 * That is not a cosmetic drift. `/receipts/amend` and `/receipts/cancel` refuse
 * on "a cheque of this receipt has gone past HELD", and a receipt whose cheque
 * has vanished from the query is waved through:
 *
 *     rct00821 posted, cheque 500 → bill A78561
 *     bounce, re-present, clear          apd_voucher_id now names the re-issue
 *     amend: cheque → cash               201, and NOTHING was reversed
 *     → bill A78561 settled 1,000 on a payment of 500
 *
 * The cheque's own settlement survived the amend because the amend did not
 * believe there was a cheque. Measured on live `rct00819`, twice reproduced.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHAT IS IMMUTABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `apd_tender_id` — the tender ROW the instrument was taken in on. A tender row
 * belongs to the document that keyed it (`td_src_doc_id`) and is never
 * repointed: the cheques module rewrites vouchers, statuses and dates, but it
 * has no reason to touch a tender line and does not. So the honest reading of
 * "this receipt's cheques" is the union of
 *
 *   · rows whose `apd_voucher_id` is one of the receipt's vouchers — the
 *     receipt itself and every post-dated cheque voucher raised under it; and
 *   · rows whose `apd_tender_id` is one of the receipt's tender rows.
 *
 * The first arm alone is the bug. The second alone would miss a register row
 * written before its tender link was made (`linkInstruments` is a later step of
 * the same transaction) and any row an import left without one. Both arms, and
 * the question is answered by what the cheque WAS TAKEN IN ON rather than by
 * who happens to own it now.
 *
 * `src/modules/sales/sale-order/order-pdc-posting.helper.ts` has always
 * resolved an order's instruments this way — "acc_pdc_register names the TENDER
 * row it came in on" — which is why that module never had this hole.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  A REPLACEMENT IS NOT A LOOPHOLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `/cheques/replace` (§4.6) creates a SEPARATE register row with no tender of
 * its own, and that row is deliberately not this receipt's: a different
 * instrument, for a possibly different amount, taken in by the cheques module.
 * The receipt is still protected, because its OWN row survives as REPLACED —
 * which is not HELD, so the unwind guards refuse on it.
 */
export interface ReceiptChequeScope {
  /**
   * The receipt DOCUMENT id — `td_src_doc_id` on every tender row it wrote.
   * This is the header's voucher id, never a post-dated cheque's voucher.
   */
  receiptVoucherId: string;
  /**
   * The receipt's voucher AND every post-dated cheque voucher raised under it.
   * A PDC's register row names its own voucher here, not the receipt's.
   */
  voucherIds: readonly string[];
}

/**
 * The `where` that finds them, built by reading the receipt's tender rows.
 *
 * Returned as a filter rather than as rows, because the four callers want
 * different things — a guard wants the status of whichever moved, the unwinds
 * want to update them, the detail read wants every column — and a filter is the
 * one thing all four can agree on.
 *
 * `apd_tender_id` has no foreign key (`acc_tender_detail` is partitioned on a
 * composite key the column cannot address on its own), so there is no relation
 * to join through and the tender ids are read first. Deleted tender rows are
 * INCLUDED: a cheque line dropped by an earlier amend is exactly the register
 * row that must still be found.
 */
export async function receiptChequeFilter(
  tx: Prisma.TransactionClient,
  scope: ReceiptChequeScope,
): Promise<Prisma.AccPdcRegisterWhereInput> {
  // By document id ALONE, which is how `tenderIdsByRow` and
  // `softDeleteTenders` in this module already read a receipt's tenders: the id
  // is a uuid of one voucher header and cannot mean a different document in
  // another module, while a module/type pair could go stale on a row written by
  // an older path.
  const tenders = await tx.accTenderDetail.findMany({
    where: { tdSrcDocId: scope.receiptVoucherId },
    select: { tdId: true },
  });

  const byVoucher: Prisma.AccPdcRegisterWhereInput = {
    apdVoucherId: { in: [...scope.voucherIds] },
  };

  if (tenders.length === 0) {
    return byVoucher;
  }

  return {
    OR: [byVoucher, { apdTenderId: { in: tenders.map((tender) => tender.tdId) } }],
  };
}

/**
 * "Which vouchers did this receipt RAISE?" — the post-dated cheque vouchers,
 * and nothing else that happens to point back at it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  `avh_against_voucher_id` IS NOT A PARENT LINK, IT IS AN "ANSWERS" LINK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `/receipts/post` raises one voucher per post-dated cheque (R2) and points it
 * at the receipt through `avh_against_voucher_id`, which is what keeps it off
 * the receipt list and under its parent (§4.6). Reading that column backwards
 * — "everything pointing at me is mine" — is where it goes wrong, because the
 * cheques module writes vouchers that ANSWER the receipt without being part of
 * it. A bounce is the plain case: `writeChequeVoucher` files the ChqBnc
 * against the voucher the cheque was carried by, which is the receipt.
 *
 * The receipt then treated the bounce as one of its own:
 *
 *   · `/receipts/get` listed it under `pdcVouchers` and folded the bounce's
 *     reversal rows into the receipt's own `allocations`, so a receipt that
 *     settled 500 painted a +500 and a −500 line and a post-dated cheque
 *     voucher it never had;
 *   · the `/amend` unwind swept it into the vouchers it takes apart — DRAFT,
 *     legs soft-deleted, header soft-deleted — which is where the three DRAFT
 *     bounce vouchers on the dev box came from. The bill kept counting while
 *     the entry that re-debited the party had left the books.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE DISCRIMINATOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The voucher TYPE. `receipt-posting.service.ts` raises a post-dated cheque's
 * voucher with `avhVoucherTypeId: header.avhVoucherTypeId` — the receipt's own
 * type, deliberately, because it IS another receipt document for the same
 * money arriving later. Everything the cheques module writes carries a type of
 * its own: `ChqClr` for a clearing, `ChqBnc` for a bounce and its charges.
 *
 * So: same type, pointed at me, alive. A voucher of a different type that
 * names this receipt is something that happened TO it afterwards, and the
 * receipt neither owns it nor may take it apart.
 *
 * ── What this does NOT try to be ─────────────────────────────────────────
 *
 * A complete ownership model. The re-issue voucher `/cheques/replace` raises
 * from a HELD cheque is an `Rct` filed against the receipt, so it passes this
 * filter — and is reachable only on a path where `assertChequesStillHeld`
 * refuses the unwind first, because that cheque is REPLACED by then. This
 * narrows the question from "everything that points at me" to "everything of
 * my own kind that points at me"; the guards are what make it safe.
 */
export function receiptPdcVoucherWhere(header: {
  avhVoucherId: string;
  avhVoucherTypeId: number;
}): Prisma.AccVoucherHeaderWhereInput {
  return {
    avhAgainstVoucherId: header.avhVoucherId,
    avhVoucherTypeId: header.avhVoucherTypeId,
    avhIsDeleted: false,
  };
}
