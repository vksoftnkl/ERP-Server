import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { DEFAULT_ACTOR, throwAccountsConflict } from 'src/common/utils/module-service.utils';
import { OpenItemsService } from './open-items.service';
import {
  ReceiptService,
  STORED_HEADER_SELECT,
  statusOf,
  type StoredHeader,
} from './receipt.service';
import { ReceiptPostingService, rethrowAllocationError } from './receipt-posting.service';
import { assertAdvancesUntouched, assertChequesStillHeld } from './receipt-unwind.guards';
import { assertAccYearWritable, assertHeaderScope } from './receipt.guards';
import { flipSide, todayUtc } from './receipt.utils';
import { AmendReceiptDto } from './dto/amend-receipt.dto';
import { DrCr, ReceiptSettingKey, VoucherStatus } from './types/receipt-enum';
import type { ReceiptAmendPayload, ReceiptErrorDetail } from './types/receipt-api.types';

/**
 * R20 — `POST /receipts/amend`, editing a POSTED receipt WHOLE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS, AND WHY IT WAS ARGUED AGAINST FIRST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The rest of this module assumes the person who keys a receipt is not the
 * person who approves it, so a mistake is corrected by cancelling and
 * re-entering (R3). That is right for a client with an accounts department and
 * wrong for a one-person shop: the owner keys the receipt, spots a wrong cheque
 * number a minute later, and has to unmake and re-key the whole document —
 * party, tenders, allocations — to change six characters.
 *
 * An in-place edit of posted money is unacceptable when nothing records what
 * changed. It becomes acceptable — better, in fact — once `audit.audit_log`
 * holds a before/after snapshot per row touched, because cancel-and-re-enter
 * leaves TWO documents and makes the reader infer the difference, while this
 * leaves one document and states it.
 *
 * So: **both**. `accounts.allow_posted_amend` off is the current model
 * unchanged, and is the default. On, the owner-operator restates the document.
 * The refusal list is identical either way (`receipt-unwind.guards.ts`), so no
 * client can amend past an instrument that has left the drawer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHAT THIS IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Not a second way to post — `/post` is still the only door a DRAFT goes
 * through, and this calls it rather than reproducing it. Not a way around the
 * instrument rules. Not available to a client who leaves the setting off. And
 * not a replacement for cancel: a receipt taken from the WRONG PARTY is
 * cancelled, not restated, because restating it would leave the right party's
 * account never having been credited at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE ORDER, AND WHY IT IS THE ORDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1  lock the header; refuse unless POSTED, permitted and current
 *   2  refuse on the facts — cheques, advances, years — BEFORE anything writes
 *   3  unwind IN PLACE: no reversal voucher, status does NOT become CANCELLED
 *   4  recompute the bills, so the re-apply reads what is pending NOW
 *   5  re-apply: §5.1's save and §5.2's fifteen steps, from the NEW payload
 *   6  the revision counter, the trail, the audit rows
 *
 * ── Step 3 is the whole difference from cancel ───────────────────────────
 *
 * Cancel writes a REVERSAL VOUCHER — a real, numbered, POSTED document — and
 * marks the original CANCELLED, because the day book for the day of the
 * cancellation has to show it and because an accountant's question is never
 * "what does this bill owe" alone.
 *
 * An amend writes no reversal voucher and changes no status. The document is
 * not being unmade, it is being restated: same `avh_voucher_id`, same
 * `avh_voucher_no`, same `avh_voucher_refno`, POSTED before and POSTED after.
 * `avh_revision_no` is what carries the change, and `audit.audit_log` is what
 * answers the accountant.
 *
 * **Numbering is not re-allocated.** A receipt is not a GST document; the
 * customer is holding a slip with that number on it, and issuing a second
 * number for the same money is how a shop ends up explaining two receipts for
 * one payment.
 *
 * ── Why the header goes back to DRAFT in the middle ──────────────────────
 *
 * Not cosmetic, and not a status the client ever sees — it is committed and
 * undone inside one transaction. There are two reasons, and the FIRST is the
 * load-bearing one:
 *
 *   · **The re-apply demands a DRAFT.** `saveInTransaction` admits only a
 *     DRAFT (`isEditableStatus`) and `assertStatusMayPost` demands one. That
 *     is what lets amend call them UNMODIFIED — nothing is relaxed for this
 *     route, and by the time it calls them the header honestly is a DRAFT.
 *     Without this step the re-apply would answer its own caller with the 409
 *     `/create` gives a POSTED voucher.
 *
 *   · **`ck_avh_balanced`, in the general case.** `tr_av_refresh_totals`
 *     re-derives `avh_total_debit` / `_credit` from the legs and the constraint
 *     refuses a POSTED header whose totals disagree.
 *
 * The second reason is worth stating precisely, because the obvious version of
 * it is wrong and was believed here first. PostgreSQL queues AFTER-ROW triggers
 * to the END of the statement, so the single `updateMany` below retires every
 * leg of a voucher at once and the trigger only ever sees the final state —
 * 0 debit, 0 credit, which BALANCES. Verified against a real posted receipt,
 * with the real trigger (installed by `20260917170000`): removing all five legs
 * of rct00039 while POSTED is allowed, and removing only its CR leg is refused
 * with `ck_avh_balanced`.
 *
 * So the constraint does not bite THIS unwind as written. It would bite the
 * moment the removal stopped being one statement — a per-voucher loop, a batch,
 * a future caller that retires one leg — and relying on "we happen to do it in
 * one statement" to stay inside a constraint is exactly the kind of thing that
 * is true until somebody refactors. The DRAFT window makes it not matter.
 *
 * The full cycle has been walked at SQL level against that trigger: POSTED
 * 400/400 → DRAFT → legs retired, totals 0/0 → new legs from row 1, totals
 * derived back to 400/400 → POSTED, refno unchanged, revision 0 → 1. The
 * control in that run is the part worth knowing: retiring a one-sided subset
 * WITHOUT the DRAFT step is refused outright, so this ordering is load-bearing
 * and not decoration.
 *
 * `/post`'s step 15 restores POSTED once the new legs exist and balance.
 *
 * ── Why everything is soft-deleted and nothing is dropped ────────────────
 *
 * Every uniqueness rule that could have stood in the way is partial on the
 * soft-delete flag — `ux_av_voucher_row`, `ux_apd_instrument`,
 * `ux_abl_doc_refno` — so retiring a row frees its number for the re-apply
 * while the row itself stays readable. That is what lets an operator correct a
 * cheque number to the one they first meant to key, and what lets the new
 * ADVANCE bill carry the same receipt reference as the old one.
 */

// The same envelope as the post and the cancel: an amend is both of them
// back to back, so it cannot be given less room than either.
const AMEND_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };

/** The audit screen these rows file under. Created on first write, by name. */
const AMEND_AUDIT_SCREEN = 'Receipt';

/** What the unwind took apart, for the payload and for the audit notes. */
interface UnwindTally {
  adjustmentsReversed: number;
  legsRemoved: number;
  pdcVouchersRemoved: number;
  chequesRemoved: number;
  advanceBillsRemoved: number;
  tendersRemoved: number;
}

@Injectable()
export class ReceiptAmendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly receiptService: ReceiptService,
    private readonly postingService: ReceiptPostingService,
    private readonly openItemsService: OpenItemsService,
    private readonly recompute: BillBalanceRecomputeService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async amend(dto: AmendReceiptDto): Promise<ReceiptAmendPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;

    try {
      return await this.prisma.$transaction(
        (tx) => this.amendInTransaction(tx, dto, actor),
        AMEND_TRANSACTION_OPTIONS,
      );
    } catch (error) {
      // The re-apply runs the allocation engine, so it fails the same two ways
      // a post does and must answer with the same 400 or 409 — never a 500
      // that says AllocationError.
      throw rethrowAllocationError(error);
    }
  }

  private async amendInTransaction(
    tx: Prisma.TransactionClient,
    dto: AmendReceiptDto,
    actor: string,
  ): Promise<ReceiptAmendPayload> {
    // ── 1 · The receipt, locked ────────────────────────────────────────────
    await tx.$queryRaw`
      SELECT avh_voucher_id
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid
         AND avh_acc_year   = ${dto.avhAccYear}::bpchar
         FOR UPDATE`;

    const header = await this.receiptService.loadHeaderOrThrow(
      tx,
      dto.avhVoucherId,
      dto.avhAccYear,
    );
    assertHeaderScope(header, {
      companyId: dto.avhCompanyId,
      branchId: dto.avhBranchId,
      accYear: dto.avhAccYear,
      voucherId: dto.avhVoucherId,
    });

    const settings = await this.openItemsService.loadSettings(
      header.avhCompanyId,
      header.avhBranchId,
    );
    this.assertAmendPermitted(settings.allowPostedAmend);
    this.assertStatusMayAmend(header);
    this.assertRevisionIsCurrent(header, dto.baseRevision);

    // ── 2 · Everything refused on the FACTS, before anything is written ────
    const pdcHeaders = await tx.accVoucherHeader.findMany({
      where: { avhAgainstVoucherId: header.avhVoucherId, avhIsDeleted: false },
      select: STORED_HEADER_SELECT,
    });
    const vouchers = [header, ...pdcHeaders];
    const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);
    const years = [...new Set(vouchers.map((voucher) => voucher.avhAccYear))];

    // The period lock, for the receipt AND for every post-dated cheque's
    // voucher — the unwind has to land somewhere, and a cheque dated 2 April
    // put its voucher in the next year. Added now rather than when a day-close
    // lock finally exists, because amend is the route that will need it first:
    // it is the one that rewrites a document somebody may already have
    // reported on.
    for (const voucher of vouchers) {
      await assertAccYearWritable(tx, voucher.avhCompanyId, voucher.avhAccYear, 'avhAccYear');
    }

    await assertChequesStillHeld(tx, voucherIds, 'amended');
    const advanceBills = await assertAdvancesUntouched(tx, voucherIds, years, 'amended');

    // ── 3 · The unwind, in place ───────────────────────────────────────────
    const before = await this.receiptService.loadFullReceipt(tx, header);
    const tendersBefore = await tx.accTenderDetail.findMany({
      where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
      select: { tdId: true },
    });

    const unwound = await this.unwind(tx, {
      header,
      vouchers,
      advanceBills,
      editRemark: dto.editRemark,
      actor,
    });

    // ── 4 · The bills, brought back up to date ─────────────────────────────
    // The negative rows are written but `abl_alloc_amount` is a CACHE that the
    // recompute owns (§2.1), so without this the re-apply would lock the bills
    // and read them as still settled — and refuse a payload that is correct.
    // Same recompute, same rules, same `asOf` as a post.
    await this.recompute.recomputeBills(tx, unwound.touchedBills, todayUtc());

    // ── 5 · The re-apply, from the NEW payload ─────────────────────────────
    // §5.1 then §5.2, both in THIS transaction, both unmodified. Everything
    // 5.1 validates is re-validated; the identity is re-run to the paisa; the
    // allocation engine is re-run against what is pending NOW; new register
    // rows, new legs, new adjustments, new ADVANCE and new tender rows are
    // written. The header is a DRAFT with its number still on it, so
    // `planVouchers` keeps that number and step 15 puts it back to POSTED.
    //
    // `replace: true` is FORCED and not taken from the payload. On `/create`
    // that flag is a real choice — a screen may save one tender row without
    // meaning to drop the others. On an amend it is not: the payload IS the
    // document, every stored row was written by the post being replaced, and
    // honouring `replace: false` here would leave the old tender rows beside
    // the new ones with no voucher to belong to.
    await this.receiptService.saveInTransaction(tx, { ...dto, replace: true }, actor);
    const posted = await this.postingService.postInTransaction(tx, dto, actor);

    const tendersRemoved = await tx.accTenderDetail.count({
      where: { tdId: { in: tendersBefore.map((row) => row.tdId) }, tdIsDeleted: true },
    });

    // ── 6 · The revision, the trail and the audit ──────────────────────────
    const now = new Date();
    const toRevision = header.avhRevisionNo + 1;
    await tx.accVoucherHeader.update({
      where: {
        avhVoucherId_avhAccYear: {
          avhVoucherId: header.avhVoucherId,
          avhAccYear: header.avhAccYear,
        },
      },
      // The ONLY column this service writes on the header itself. Everything
      // else about it was written by the save and the post, which is the point
      // of orchestrating them rather than reproducing them.
      data: { avhRevisionNo: toRevision, avhModifiedOn: now, avhModifiedBy: actor },
    });

    await this.writeTrail(tx, { header, dto, actor, now, toRevision });

    const after = await this.receiptService.loadHeaderOrThrow(
      tx,
      header.avhVoucherId,
      header.avhAccYear,
    );
    await this.writeAuditRows(tx, {
      header,
      after,
      before,
      dto,
      actor,
      tally: { ...unwound.tally, tendersRemoved },
      toRevision,
    });

    return {
      ...posted,
      fromRevision: dto.baseRevision,
      toRevision,
      editRemark: dto.editRemark,
      unwound: { ...unwound.tally, tendersRemoved },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 1 — the three gates a cancel does not have
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The setting, which is the only thing in this module that decides whether a
   * ROUTE exists rather than how one behaves.
   *
   * A 409 and not a 403: nothing is wrong with the caller's rights, the
   * business has simply not chosen this way of working. The message says which
   * key turns it on and what to do meanwhile, because an operator who has just
   * been refused needs the alternative, not the reason.
   */
  private assertAmendPermitted(allowed: boolean): void {
    if (allowed) {
      return;
    }
    throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be amended', [
      {
        field: ReceiptSettingKey.ALLOW_POSTED_AMEND,
        message:
          'Editing a posted receipt is switched off for this company ' +
          `(${ReceiptSettingKey.ALLOW_POSTED_AMEND} is false). Cancel the receipt and re-enter ` +
          'it, or switch the setting on if the person who keys a receipt is also the person who ' +
          'is accountable for it.',
      },
    ]);
  }

  /**
   * POSTED, and a receipt rather than one of its cheques.
   *
   * A DRAFT is edited by `/create` — which is the whole reason this is a
   * separate route — and a CANCELLED receipt is history: restating it would
   * put money back that a reversal voucher has already taken out, with no
   * document saying so.
   */
  private assertStatusMayAmend(header: StoredHeader): void {
    const status = statusOf(header);
    if (status !== VoucherStatus.POSTED) {
      throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be amended', [
        {
          field: 'avhVoucherId',
          message:
            `${header.avhVoucherRefno ?? header.avhVoucherId} is ${status}. Only a POSTED ` +
            'receipt is amended' +
            (status === VoucherStatus.DRAFT
              ? ' — a draft is edited with /receipts/create.'
              : status === VoucherStatus.CANCELLED
                ? ' — a cancelled receipt is history, and re-entering is the way back.'
                : '.'),
        },
      ]);
    }
    if (header.avhAgainstVoucherId) {
      // A post-dated cheque's voucher is part of its receipt. Amending it on
      // its own would leave the receipt claiming money whose voucher now says
      // something else.
      throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be amended', [
        {
          field: 'avhVoucherId',
          message:
            'This is a post-dated cheque voucher, not a receipt. Amend the receipt it belongs ' +
            'to and its cheques are rewritten with it.',
        },
      ]);
    }
  }

  /**
   * The optimistic lock (§1), and the reason `baseRevision` is mandatory.
   *
   * Two people have rct00015 open. A amends the cheque number and saves. B, who
   * loaded it before that, amends the party's name and saves. Without this
   * check B's payload is the whole receipt, so it silently puts the wrong
   * cheque number back — and the audit log faithfully records that B did it on
   * purpose.
   *
   * A last-writer-wins race is survivable on a master record. On a posted
   * voucher it rewrites ledger legs, so it is not.
   *
   * The message says what the revision NOW is, because the client's correct
   * response is to reload and re-apply the change by hand — never to retry
   * with the number it was just told, which would defeat the whole point.
   */
  private assertRevisionIsCurrent(header: StoredHeader, baseRevision: number): void {
    if (header.avhRevisionNo === baseRevision) {
      return;
    }
    throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be amended', [
      {
        field: 'baseRevision',
        message:
          `This receipt has been amended since you opened it (now revision ` +
          `${header.avhRevisionNo}, you sent ${baseRevision}). Reload it and make the change ` +
          'again — your copy does not have whatever was corrected in between, and saving it ' +
          'would undo that correction.',
      },
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 3 — the unwind
  // ═════════════════════════════════════════════════════════════════════════

  private async unwind(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      vouchers: readonly StoredHeader[];
      advanceBills: ReadonlyArray<{ ablId: string; ablAccYear: string }>;
      editRemark: string;
      actor: string;
    },
  ): Promise<{
    tally: Omit<UnwindTally, 'tendersRemoved'>;
    touchedBills: Array<{ billId: string; accYear: string }>;
  }> {
    const { header, vouchers, actor } = params;
    const now = new Date();
    const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);

    // ── a · Out of POSTED, so the legs may go ──────────────────────────────
    // See the header note. This is committed and undone inside one
    // transaction; no client ever observes it.
    for (const voucher of vouchers) {
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: voucher.avhVoucherId,
            avhAccYear: voucher.avhAccYear,
          },
        },
        // The NUMBER stays. ck_avh_no permits a DRAFT to carry one, and
        // `planVouchers` reads it back to decide not to allocate another —
        // which is how the receipt keeps its identity across the amend.
        data: { avhVoucherStatus: VoucherStatus.DRAFT },
      });
    }

    // ── b · A negative row per live adjustment ─────────────────────────────
    const adjustmentsReversed = await this.reverseAdjustments(tx, {
      header,
      voucherIds,
      years: [...new Set(vouchers.map((voucher) => voucher.avhAccYear))],
      editRemark: params.editRemark,
      actor,
    });

    // ── c · The advances, retired ──────────────────────────────────────────
    // Proven unspent above. Soft delete, not delete: the row is what proves
    // the advance once existed, and `ux_abl_doc_refno` is partial on the flag,
    // so retiring it frees the receipt's reference for the new one.
    if (params.advanceBills.length > 0) {
      await tx.accBillBalance.updateMany({
        where: {
          OR: params.advanceBills.map((bill) => ({
            ablId: bill.ablId,
            ablAccYear: bill.ablAccYear,
          })),
        },
        data: { ablIsDeleted: true, ablIsActive: false, ablModifiedOn: now, ablModifiedBy: actor },
      });
    }

    // ── d · The register rows, retired ─────────────────────────────────────
    // Soft-deleted and NOT marked CANCELLED, which is where this parts company
    // with cancel. A cancelled register row says the instrument was cancelled;
    // these instruments were not — they are being re-keyed, very often to the
    // same cheque number, which is the commonest reason to amend at all.
    // `ux_apd_instrument` excludes deleted rows as well as cancelled ones, so
    // the number is free either way and this is the honest one.
    const chequesRemoved = await tx.accPdcRegister.updateMany({
      where: { apdVoucherId: { in: voucherIds }, apdIsDeleted: false },
      data: { apdIsDeleted: true, apdModifiedOn: now, apdModifiedBy: actor },
    });

    // ── e · The legs, retired ──────────────────────────────────────────────
    // `ux_av_voucher_row` is partial on the flag, so the re-apply numbers its
    // legs from 1 again with no collision. The headers are DRAFT by now, so
    // the totals the trigger derives from the vanishing legs break no check.
    const legsRemoved = await tx.accVoucher.updateMany({
      where: { avVoucherId: { in: voucherIds }, avIsDeleted: false },
      data: { avIsDeleted: true, avModifiedOn: now, avModifiedBy: actor },
    });

    // ── f · The old cheque vouchers, retired ───────────────────────────────
    // Their numbers are NOT reused: the re-apply allocates fresh ones for
    // whatever cheques the new payload carries, because a post-dated voucher's
    // number belongs to the cheque it was raised for, and that cheque may not
    // be on the receipt any more. The receipt's OWN number is the one that
    // survives, and it is the only one a customer is holding.
    let pdcVouchersRemoved = 0;
    for (const voucher of vouchers) {
      if (voucher.avhVoucherId === header.avhVoucherId) {
        continue;
      }
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: voucher.avhVoucherId,
            avhAccYear: voucher.avhAccYear,
          },
        },
        data: { avhIsDeleted: true, avhModifiedOn: now, avhModifiedBy: actor },
      });
      pdcVouchersRemoved += 1;
    }

    // The tender rows are deliberately NOT touched here. `syncDocumentTenders`
    // owns them, its array IS the document, and the re-apply hands it the new
    // one — so a row the new payload keeps is updated in place (keeping its
    // id, and its own audit trail), and a row it drops is soft-deleted by the
    // same code that drops one from a draft. Retiring them here would leave
    // the client's tdIds pointing at dead rows for the save that follows.

    const touched = await this.billsTouchedBy(tx, voucherIds);
    return {
      tally: {
        adjustmentsReversed,
        legsRemoved: legsRemoved.count,
        pdcVouchersRemoved,
        chequesRemoved: chequesRemoved.count,
        advanceBillsRemoved: params.advanceBills.length,
      },
      touchedBills: touched,
    };
  }

  /**
   * One negative row per adjustment row the old post wrote, exactly as cancel
   * does — and for the same reason. The negative is what reopens the bill;
   * nothing is edited and nothing is deleted.
   *
   * ── Two things here are not obvious ──────────────────────────────────────
   *
   * **The reversal is dated the ORIGINAL, and copies its post-dated flag.** It
   * is tempting to date it today so the bill reopens at once, and it would be
   * wrong: an un-matured post-dated row does not count towards
   * `abl_alloc_amount`, so a reversal that DID count would drive that negative
   * and `ck_abl_settled` would refuse the write. Mirroring the flag means the
   * pair nets to zero whether the cheque has matured or not, which is true on
   * every day.
   *
   * **Every negative is filed against the RECEIPT**, even when it undoes a row
   * a post-dated cheque's voucher wrote. There is no reversal voucher to file
   * them against — that is the difference from cancel — and the cheque's own
   * voucher is being retired, so it is the one voucher guaranteed to survive
   * the amend. It is also the honest answer: the receipt is the document being
   * restated, and it is the receipt that un-did the settlement.
   * `abj_acc_year` still follows the row being undone, so each negative stays
   * in the partition of the thing it reverses.
   */
  private async reverseAdjustments(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      voucherIds: readonly string[];
      years: readonly string[];
      editRemark: string;
      actor: string;
    },
  ): Promise<number> {
    const rows = await tx.accBillAdjustment.findMany({
      where: {
        abjVoucherId: { in: [...params.voucherIds] },
        abjVoucherAccYear: { in: [...params.years] },
        abjIsDeleted: false,
      },
      orderBy: { abjRowNo: 'asc' },
    });

    // A row that is itself a reversal, and a row something has ALREADY
    // reversed, are both left alone. The second case is what makes a receipt
    // amendable twice: after one amend the voucher carries the first post's
    // rows, their negatives, and the second post's rows, and only the last of
    // those three is still live money. Sweeping up the first pair again would
    // double back the balance — and `ux_abj_reversal` would refuse the write
    // anyway, as a 23505 naming nothing anybody could act on.
    const alreadyReversed = new Set(
      rows.map((row) => row.abjReversalOfId).filter((id): id is string => id !== null),
    );
    const live = rows.filter(
      (row) => row.abjReversalOfId === null && !alreadyReversed.has(row.abjId),
    );
    if (live.length === 0) {
      return 0;
    }

    // Continue the receipt's own numbering rather than restarting at 1, so the
    // unwind reads in order beside what it undoes. `abj_row_no` is not unique
    // per voucher, so this is legibility rather than a constraint.
    const highest = rows.reduce((max, row) => Math.max(max, row.abjRowNo), 0);

    await tx.accBillAdjustment.createMany({
      data: live.map((row, index) => ({
        abjCompanyId: row.abjCompanyId,
        abjBranchId: row.abjBranchId,
        abjTenantId: row.abjTenantId,
        abjAccYear: row.abjAccYear,
        abjBillId: row.abjBillId,
        abjBillAccYear: row.abjBillAccYear,
        abjPartyId: row.abjPartyId,
        abjRowNo: highest + index + 1,
        abjAgainstBillId: row.abjAgainstBillId,
        abjAgainstBillAccYear: row.abjAgainstBillAccYear,
        abjVoucherId: params.header.avhVoucherId,
        abjVoucherAccYear: params.header.avhAccYear,
        abjAdjType: row.abjAdjType,
        abjAdjDate: row.abjAdjDate,
        abjIsPostDated: row.abjIsPostDated,
        abjDrCr: flipSide(row.abjDrCr, DrCr.DR, DrCr.CR),
        // ck_abj_reversal_sign: a row naming abj_reversal_of_id MUST be
        // negative, and one that does not MUST be positive.
        abjAmount: row.abjAmount.negated(),
        abjSettlementMode: row.abjSettlementMode,
        abjSettlementLedgerId: row.abjSettlementLedgerId,
        abjTenderId: row.abjTenderId,
        abjTenderAccYear: row.abjTenderAccYear,
        abjChequeId: row.abjChequeId,
        abjChequeAccYear: row.abjChequeAccYear,
        // ck_abj_writeoff_approval: a WRITEOFF row needs an approver, and the
        // reversal of one is still a WRITEOFF row.
        abjApprovedBy: row.abjApprovedBy,
        abjReversalOfId: row.abjId,
        abjReversalReason: `Amended: ${params.editRemark}`.slice(0, 250),
        abjUserId: row.abjUserId,
        abjSessionId: row.abjSessionId,
        abjCreatedBy: params.actor,
      })),
    });

    return live.length;
  }

  /** Every bill the old post touched, so the recompute can reopen them. */
  private async billsTouchedBy(
    tx: Prisma.TransactionClient,
    voucherIds: readonly string[],
  ): Promise<Array<{ billId: string; accYear: string }>> {
    const rows = await tx.accBillAdjustment.findMany({
      where: { abjVoucherId: { in: [...voucherIds] }, abjIsDeleted: false },
      select: { abjBillId: true, abjBillAccYear: true },
    });

    const seen = new Map<string, { billId: string; accYear: string }>();
    for (const row of rows) {
      seen.set(`${row.abjBillId}|${row.abjBillAccYear}`, {
        billId: row.abjBillId,
        accYear: row.abjBillAccYear,
      });
    }
    return [...seen.values()];
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 6 — the trail
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * `POSTED -> AMENDED -> POSTED`, as two rows.
   *
   * Two and not one, because both halves really happened: the old money left
   * the books and the new money arrived, inside one transaction. A single row
   * saying POSTED -> POSTED would be a status trail recording no status.
   *
   * AMENDED is a `tsl_event` and never an `avh_voucher_status` — `ck_avh_status`
   * admits four values and this is not one of them. The distinction is the
   * whole R20 decision in one line: the voucher was POSTED throughout, and
   * only its contents changed.
   */
  private async writeTrail(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      dto: AmendReceiptDto;
      actor: string;
      now: Date;
      toRevision: number;
    },
  ): Promise<void> {
    const { header, dto, actor, now } = params;
    const common = {
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      tenantId: header.avhTenantId,
      accYear: header.avhAccYear,
      srcModule: TxnStatusSrcModule.ACCOUNTS,
      srcDocType: TxnStatusDocType.RECEIPT,
      srcDocId: header.avhVoucherId,
      srcDocRefno: header.avhVoucherRefno,
      changedBy: actor,
      changedOn: now,
      deviceId: header.avhDeviceId,
      sessionId: header.avhSessionId,
    };

    await appendTxnStatusLog(tx, {
      ...common,
      event: TxnStatusEvent.AMENDED,
      fromStatus: VoucherStatus.POSTED,
      toStatus: TxnStatusEvent.AMENDED,
      // The WHY, which is the reason editRemark is mandatory: the trail has to
      // say it, and nobody writes it afterwards.
      remarks: dto.editRemark,
    });

    await appendTxnStatusLog(tx, {
      ...common,
      event: TxnStatusEvent.POSTED,
      fromStatus: TxnStatusEvent.AMENDED,
      toStatus: VoucherStatus.POSTED,
      remarks: `Re-posted as revision ${params.toRevision}`,
    });
  }

  /**
   * `audit.audit_log`, one row per money table the amend touched.
   *
   * **This is the point on which amend was argued against and then accepted.**
   * An in-place edit of posted money is unacceptable when nothing records what
   * changed; with a before/after snapshot the same edit is BETTER evidence than
   * cancel-and-re-enter, which leaves two documents and makes the reader infer
   * the difference.
   *
   * `acc_vouchers`, `acc_bill_adjustment` and `acc_pdc_register` had no audit
   * coverage before this route — `receipt tender` and the masters did. Nothing
   * had to be migrated to add them: `logEntityChange` resolves its screen by
   * NAME and creates the row on first write, so registering a table is a
   * matter of writing to it.
   *
   * One row per TABLE and not per row touched: the before and after are the
   * whole receipt as `/receipts/get` renders it, which is the shape a reader
   * of this trail actually wants — a reviewer asks "what did this receipt look
   * like before, and after", not "what happened to leg 3". The per-row detail
   * is recoverable from the money tables themselves, where every old row is
   * still present and soft-deleted rather than removed.
   *
   * A failure here must not take the amend down, and cannot: it is the last
   * thing in the transaction, so anything it throws rolls back the whole
   * restatement rather than leaving money changed with no record of it. That is
   * the right way round.
   */
  private async writeAuditRows(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      after: StoredHeader;
      before: Awaited<ReturnType<ReceiptService['loadFullReceipt']>>;
      dto: AmendReceiptDto;
      actor: string;
      tally: UnwindTally;
      toRevision: number;
    },
  ): Promise<void> {
    const { header, dto, actor, tally } = params;
    const after = await this.receiptService.loadFullReceipt(tx, params.after);
    const displayName = header.avhVoucherRefno ?? header.avhVoucherId;
    const notes =
      `Receipt amended to revision ${params.toRevision}: ${dto.editRemark} ` +
      `(${tally.adjustmentsReversed} adjustment(s) reversed, ${tally.legsRemoved} leg(s), ` +
      `${tally.chequesRemoved} cheque(s), ${tally.pdcVouchersRemoved} PDC voucher(s), ` +
      `${tally.advanceBillsRemoved} advance bill(s), ${tally.tendersRemoved} tender row(s) replaced)`;

    const tables: ReadonlyArray<{ tableName: string; original: unknown; modified: unknown }> = [
      {
        tableName: 'acc_voucher_header',
        original: params.before.header,
        modified: after.header,
      },
      {
        tableName: 'acc_vouchers',
        original: { legs: params.before.legs, pdcVouchers: params.before.pdcVouchers },
        modified: { legs: after.legs, pdcVouchers: after.pdcVouchers },
      },
      {
        tableName: 'acc_bill_adjustment',
        original: {
          allocations: params.before.allocations,
          creditsApplied: params.before.creditsApplied,
          advanceBills: params.before.advanceBills,
        },
        modified: {
          allocations: after.allocations,
          creditsApplied: after.creditsApplied,
          advanceBills: after.advanceBills,
        },
      },
      {
        tableName: 'acc_pdc_register',
        original: { cheques: params.before.cheques, tenders: params.before.tenders },
        modified: { cheques: after.cheques, tenders: after.tenders },
      },
    ];

    for (const table of tables) {
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: table.tableName,
          screenName: AMEND_AUDIT_SCREEN,
          screenType: 'transaction',
          pk: header.avhVoucherId,
          displayName,
          accYear: header.avhAccYear,
          originalRecord: table.original,
          modifiedRecord: table.modified,
          userId: actor,
          branchId: header.avhBranchId,
          notes,
        },
        tx,
      );
    }
  }
}
