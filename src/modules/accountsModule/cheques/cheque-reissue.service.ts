import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { DEFAULT_ACTOR, throwAccountsBadRequest } from 'src/common/utils/module-service.utils';
import {
  DrCr,
  PdcInstrumentType,
  PdcPostingMode,
  PdcStatus,
  PdcTraType,
} from '../receipt/types/receipt-enum';
import { accYearOf } from '../receipt/receipt.guards';
import {
  daysBetween,
  money,
  toAmount,
  toDateOnly,
  toDateString,
  todayUtc,
} from '../receipt/receipt.utils';
import {
  assertDateOnOrAfter,
  assertNotInFuture,
  assertStatus,
  loadBankLedger,
  lockChequeOrThrow,
  resolveChequesInHand,
  type LockedCheque,
} from './cheques.guards';
import { logChequeStatus, reloadChequeRow } from './cheques.utils';
import { loadVoucherRef, writeChequeVoucher, type ChequeLegSpec } from './cheque-voucher.helper';
import {
  allocateChequeMoney,
  namedOrAutoFifo,
  type ChequeAllocationRequest,
} from './cheque-allocation';
import { allocationsReversedBy } from './cheque-reversal.helper';
import { ChequeReturnService } from './cheque-return.service';
import {
  RECEIPT_VOUCHER_TYPE_CODE,
  REPLACEABLE_STATUSES,
  REPRESENTABLE_STATUSES,
} from './types/cheque-enum';
import { RepresentChequeDto, ReplaceChequeDto } from './dto/cheque-actions.dto';
import type { ChequeAllocationDto } from './dto/cheque-keys.dto';
import type {
  ChequeBillRef,
  ChequeErrorDetail,
  ChequeRepresentPayload,
  ChequeReplacePayload,
} from './types/cheque-api.types';

/**
 * §4.5 and §4.6 — the two ways a bounced cheque becomes money again. They
 * share one idea, which is why they share a service.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE RE-ISSUE VOUCHER, AND WHY IT EXISTS (C5)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     DR  Cheques in Hand      amount
 *     CR  the party            amount
 *
 * When a cheque bounces, the bounce debits the party and relieves Cheques in
 * Hand: we no longer hold anything, and they owe us again. That is the true
 * position and it has to be recorded, because between the bounce and whatever
 * happens next the party genuinely is in debt.
 *
 * So putting the SAME paper back through the bank is not "undo the bounce". It
 * is a fresh act of taking a cheque in — the party is credited again, Cheques
 * in Hand is debited again, and the bills are allocated again from scratch.
 *
 * §10 states the consequence as a rule: **no clearing straight to the party
 * after a bounce — re-issue first.** That is what keeps `/cheques/clear` with
 * ONE shape. Without it, clearing would have to ask "was this cheque bounced
 * before?" and post a completely different voucher if so — and every later
 * report would have to ask the same question.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHAT SEPARATES THE TWO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Re-present is the SAME instrument going back to the bank: one register row,
 * `apd_present_count` goes to 2, straight to DEPOSITED.
 *
 * Replace is a DIFFERENT instrument: a new register row, HELD, and the old one
 * marked REPLACED pointing at it. The amount may differ — a party often
 * replaces a bounced cheque with a smaller one and pays the rest another way —
 * and a post-dated replacement gets a voucher dated the cheque, which is the
 * receipt module's own R2 rule applied here.
 */

const REISSUE_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };

@Injectable()
export class ChequeReissueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly recompute: BillBalanceRecomputeService,
    private readonly returnService: ChequeReturnService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.5 — re-present
  // ═════════════════════════════════════════════════════════════════════════

  async represent(dto: RepresentChequeDto): Promise<ChequeRepresentPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const depositDate = toDateOnly(dto.depositDate);

    return this.prisma.$transaction(async (tx) => {
      const cheque = await lockChequeOrThrow(tx, dto);
      assertStatus(cheque, REPRESENTABLE_STATUSES, 're-presented');

      assertNotInFuture(depositDate, 'A deposit', 'depositDate');
      assertDateOnOrAfter(
        depositDate,
        cheque.apdInstrumentDate,
        `Deposit ${cheque.apdInstrumentNo}`,
        'the date on the cheque',
        'depositDate',
      );
      // The same paper cannot go back before it came back.
      assertDateOnOrAfter(
        depositDate,
        cheque.apdBounceDate!,
        `Re-present ${cheque.apdInstrumentNo}`,
        'the day it bounced',
        'depositDate',
      );

      const bank = await loadBankLedger(tx, cheque.apdCompanyId, dto.bankLedgerId);

      const reissue = await this.reissue(tx, {
        cheque,
        // The SAME instrument, so the same amount. There is nothing to choose.
        amount: cheque.apdAmount,
        instrumentNo: cheque.apdInstrumentNo,
        instrumentDate: cheque.apdInstrumentDate,
        // Dated the day it goes back to the bank: that is when the party is
        // credited again, and it is on or after the bounce by the check above.
        voucherDate: depositDate,
        againstVoucherId: cheque.apdBounceVoucherId,
        againstAccYear: cheque.apdBounceAccYear,
        allocations: dto.allocations,
        // ── The fix at the heart of §4.5 ────────────────────────────────
        // With no `allocations` the money goes back on the bills the BOUNCE
        // took it off, to the paisa, and not onto whatever the party's oldest
        // open invoice happens to be. A re-presentation is the same money for
        // the same debt; the bills are not a choice the caller is making, they
        // are a fact the reversal rows already hold. `allocations` stays as the
        // explicit override for the rare case where the operator really is
        // re-pointing it.
        restoreReversedBy: {
          voucherId: cheque.apdBounceVoucherId,
          accYear: cheque.apdBounceAccYear,
        },
        registerRow: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear },
        actor,
        what: 're-presented',
      });

      const now = new Date();
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
        data: {
          apdStatus: PdcStatus.DEPOSITED,
          apdDepositDate: depositDate,
          apdDepositSlipNo: dto.slipNo,
          apdBankLedgerId: bank.ledgerId,
          // §7: "status DEPOSITED, apd_present_count 2".
          apdPresentCount: { increment: 1 },
          apdRemarks: dto.remarks ?? cheque.apdRemarks,
          apdStatusOn: now,
          apdStatusBy: actor,
          apdModifiedOn: now,
          apdModifiedBy: actor,
          // ── The one column that HAS to move, and why ──────────────────
          // ck_apd_seq is
          //     bounce_date IS NULL OR deposit_date IS NULL
          //                         OR bounce_date >= deposit_date
          // and a re-presentation is always banked AFTER the bounce that
          // caused it. So the previous cycle's bounce DATE cannot stand
          // beside the new deposit date; one of the two has to give, and it
          // is the one describing the cycle that has closed.
          //
          // The register carries ONE set of deposit / clear / bounce dates
          // and a cheque can go to the bank many times: those columns
          // describe the CURRENT presentation, and apd_present_count is what
          // says there were earlier ones.
          //
          // Everything that is history rather than state SURVIVES — §7's
          // "the bounce voucher untouched". apd_bounce_voucher_id,
          // apd_bounce_acc_year, apd_bounce_reason, apd_bounce_charges and
          // apd_charge_voucher_id are all left exactly as the bounce set
          // them, the ChqBnc voucher and its five legs are not touched, and
          // txn_status_log still holds the BOUNCED step with its date, its
          // reason and who recorded it. Nothing about the party's payment
          // history is lost; only the claim "this cheque is currently
          // bounced, as of that date" is, which is no longer true.
          apdBounceDate: null,
        },
      });

      await logChequeStatus(tx, cheque, {
        fromStatus: cheque.apdStatus,
        toStatus: PdcStatus.DEPOSITED,
        remarks:
          `Re-presented into ${bank.ledgerName} on slip ${dto.slipNo} ` +
          `(presentation ${cheque.apdPresentCount + 1})`,
        actor,
        changedOn: now,
      });

      return {
        cheque: await reloadChequeRow(tx, cheque.apdId, cheque.apdAccYear),
        reissueVoucher: reissue.voucher,
        legs: reissue.legs,
        billsAllocated: reissue.bills,
        slip: {
          bankLedgerId: bank.ledgerId,
          bankLedgerName: bank.ledgerName,
          depositDate: toDateString(depositDate) ?? dto.depositDate,
          slipNo: dto.slipNo,
          chequeCount: 1,
          totalAmount: toAmount(cheque.apdAmount),
        },
      };
    }, REISSUE_TRANSACTION_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.6 — replace
  // ═════════════════════════════════════════════════════════════════════════

  async replace(dto: ReplaceChequeDto): Promise<ChequeReplacePayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const instrumentDate = toDateOnly(dto.newCheque.instrumentDate);
    const amount = money(dto.newCheque.amount);
    const today = todayUtc();

    return this.prisma.$transaction(async (tx) => {
      const old = await lockChequeOrThrow(tx, dto);
      assertStatus(old, REPLACEABLE_STATUSES, 'replaced');

      if (amount.lessThanOrEqualTo(0)) {
        // ck_apd_amount refuses it anyway; this names the box.
        throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
          { field: 'newCheque.amount', message: 'A cheque has to be for more than nothing' },
        ]);
      }
      this.assertInstrumentDateUsable(instrumentDate, today);

      const reason =
        dto.reason?.trim() ||
        `Replaced by cheque ${dto.newCheque.instrumentNo} dated ${dto.newCheque.instrumentDate}`;

      // ── From HELD: return it first (§4.6), with no charges ──────────────
      // A HELD cheque was never dishonoured — the party simply swapped the
      // paper — so what has to come off the books is exactly a return, and the
      // return service owns that code. From BOUNCED the bounce has already
      // taken it off, and doing it twice would credit Cheques in Hand for a
      // cheque it no longer holds.
      const reversal =
        old.apdStatus === PdcStatus.HELD
          ? await this.returnService.unwind(tx, old, { reason, actor, asOf: today })
          : null;

      // ── The re-issue, and the new row it makes possible ─────────────────
      //
      // The VOUCHER is written first and the row is created inside the hook,
      // because `ck_apd_posting` refuses an ON_RECEIPT register row that does
      // not already name its voucher — at the INSERT, not on a later update.
      // The allocation that follows then has the row's id for `abj_cheque_id`.
      const now = new Date();
      const newAccYear = accYearOf(today);
      // §4.6 — "dated the new instrument date when post-dated (own voucher,
      // the receipt's rule)". R2: a post-dated cheque's voucher is dated the
      // CHEQUE, so the bills settle on maturity rather than today.
      const isPostDated = instrumentDate.getTime() > today.getTime();

      let created!: { apdId: string; apdAccYear: string };
      let newCheque!: LockedCheque;

      const reissue = await this.reissue(tx, {
        // The OLD row stands in for the new one until the new one exists: what
        // `reissue` needs before the hook runs is the party, the company, the
        // branch and the posting mode, and the replacement inherits all four.
        cheque: { ...old, apdAmount: amount, apdInstrumentNo: dto.newCheque.instrumentNo },
        amount,
        instrumentNo: dto.newCheque.instrumentNo,
        instrumentDate,
        voucherDate: isPostDated ? instrumentDate : today,
        againstVoucherId: old.apdBounceVoucherId ?? old.apdVoucherId,
        againstAccYear: old.apdBounceAccYear ?? old.apdVoucherAccYear,
        allocations: dto.allocations,
        actor,
        what: 'replaced',
        // The old row's tender ledger is where the new cheque sits too: it is
        // the same arrangement with the same party, and the new row has no
        // tender of its own to read it from.
        inHandFrom: old,
        isPostDated,
        onVoucherWritten: async (voucher) => {
          created = await tx.accPdcRegister.create({
            data: {
              apdCompanyId: old.apdCompanyId,
              apdBranchId: old.apdBranchId,
              apdTenantId: old.apdTenantId,
              // The year it is RECEIVED in — today's, not the old row's. A
              // cheque replaced in April 2027 for one taken in March is a new
              // instrument that arrived in the new year, and it belongs in
              // that partition beside the voucher that carries it.
              apdAccYear: newAccYear,
              apdTraType: PdcTraType.RECEIVED,
              apdPartyId: old.apdPartyId,
              apdSalesmanId: old.apdSalesmanId,
              apdInstrumentType: PdcInstrumentType.CHEQUE,
              apdInstrumentNo: dto.newCheque.instrumentNo,
              apdInstrumentDate: instrumentDate,
              apdAmount: amount,
              apdBankName: dto.newCheque.bankName ?? old.apdBankName,
              apdBankBranch: dto.newCheque.bankBranch ?? old.apdBankBranch,
              apdIfsc: dto.newCheque.ifsc ?? old.apdIfsc,
              apdMicr: dto.newCheque.micr ?? old.apdMicr,
              apdDrawerName: dto.newCheque.drawerName ?? old.apdDrawerName,
              apdReceivedOn: today,
              apdBankLedgerId: old.apdBankLedgerId,
              // Copied from the OLD row, never re-read from the setting. §5:
              // the mode is a property of how this money was taken in, and the
              // replacement inherits the arrangement the original was under.
              apdPostingMode: old.apdPostingMode,
              // ck_apd_posting — the whole reason the voucher comes first.
              apdVoucherId: voucher.voucherId,
              apdVoucherAccYear: voucher.accYear,
              // §4.6 — the new row starts with no tender row of its own: no
              // receipt keyed it, this module did.
              apdTenderId: null,
              apdStatus: PdcStatus.HELD,
              apdPresentCount: 0,
              apdStatusOn: now,
              apdStatusBy: actor,
              apdRemarks: `Replaces cheque ${old.apdInstrumentNo}`,
              apdCreatedBy: actor,
            },
            select: { apdId: true, apdAccYear: true },
          });
          newCheque = await this.reloadLocked(tx, created.apdId, created.apdAccYear);
          return { cheque: newCheque, registerRow: created };
        },
      });

      // ON_CLEARING never writes a voucher, so the hook never ran and the row
      // still has to be made — without one, which ck_apd_posting allows.
      if (!reissue.voucher) {
        created = await tx.accPdcRegister.create({
          data: {
            apdCompanyId: old.apdCompanyId,
            apdBranchId: old.apdBranchId,
            apdTenantId: old.apdTenantId,
            apdAccYear: newAccYear,
            apdTraType: PdcTraType.RECEIVED,
            apdPartyId: old.apdPartyId,
            apdSalesmanId: old.apdSalesmanId,
            apdInstrumentType: PdcInstrumentType.CHEQUE,
            apdInstrumentNo: dto.newCheque.instrumentNo,
            apdInstrumentDate: instrumentDate,
            apdAmount: amount,
            apdBankName: dto.newCheque.bankName ?? old.apdBankName,
            apdBankBranch: dto.newCheque.bankBranch ?? old.apdBankBranch,
            apdIfsc: dto.newCheque.ifsc ?? old.apdIfsc,
            apdMicr: dto.newCheque.micr ?? old.apdMicr,
            apdDrawerName: dto.newCheque.drawerName ?? old.apdDrawerName,
            apdReceivedOn: today,
            apdBankLedgerId: old.apdBankLedgerId,
            apdPostingMode: old.apdPostingMode,
            apdTenderId: null,
            apdStatus: PdcStatus.HELD,
            apdPresentCount: 0,
            apdStatusOn: now,
            apdStatusBy: actor,
            apdRemarks: `Replaces cheque ${old.apdInstrumentNo}`,
            apdCreatedBy: actor,
          },
          select: { apdId: true, apdAccYear: true },
        });
        newCheque = await this.reloadLocked(tx, created.apdId, created.apdAccYear);
      }

      // ── The old row, pointing at its replacement ────────────────────────
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: old.apdId, apdAccYear: old.apdAccYear } },
        data: {
          apdStatus: PdcStatus.REPLACED,
          // ck_apd_replaced: a REPLACED row must name what replaced it, and
          // ck_apd_replaced_pair: the id and the year move together.
          apdReplacedById: created.apdId,
          apdReplacedByAccYear: created.apdAccYear,
          apdCancelReason: reason.slice(0, 250),
          apdStatusOn: now,
          apdStatusBy: actor,
          apdModifiedOn: now,
          apdModifiedBy: actor,
        },
      });

      // A step on BOTH rows (§4.6 "log on both rows"): the old cheque's story
      // ends here and the new one's begins, and each has to read on its own.
      await logChequeStatus(tx, old, {
        fromStatus: old.apdStatus,
        toStatus: PdcStatus.REPLACED,
        remarks: reason,
        actor,
        changedOn: now,
      });
      await logChequeStatus(tx, newCheque, {
        fromStatus: null,
        toStatus: PdcStatus.HELD,
        remarks: `Replaces cheque ${old.apdInstrumentNo} — ${reason}`,
        actor,
        changedOn: now,
      });

      return {
        oldCheque: await reloadChequeRow(tx, old.apdId, old.apdAccYear),
        newCheque: await reloadChequeRow(tx, created.apdId, created.apdAccYear),
        reversalVoucher: reversal?.voucher ?? null,
        reissueVoucher: reissue.voucher,
        legs: [...(reversal?.legs ?? []), ...reissue.legs],
        billsAllocated: reissue.bills,
        cascade: reversal?.cascade ?? {
          advanceBillsRemoved: [],
          advanceApplicationsReversed: 0,
          advancesLeftMixed: [],
        },
      };
    }, REISSUE_TRANSACTION_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The shared half
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The re-issue voucher and its allocations — the part §4.5 and §4.6 share.
   *
   * Under ON_CLEARING it does nothing and says so: the party was never
   * credited, so there is nothing to credit again. The register move is the
   * whole of the event, which is exactly what that mode means.
   */
  private async reissue(
    tx: Prisma.TransactionClient,
    params: {
      cheque: LockedCheque;
      amount: Prisma.Decimal;
      instrumentNo: string;
      instrumentDate: Date;
      voucherDate: Date;
      againstVoucherId: string | null;
      againstAccYear: string | null;
      allocations: readonly ChequeAllocationDto[];
      /**
       * The bounce whose reversal is to be UNDONE when `allocations` is empty —
       * §4.5, and the difference between the two re-issues.
       *
       * Re-present gives it: the same paper for the same debt, so an empty list
       * means "back where it was", and the rows that bounce wrote are the only
       * record of the per-bill split.
       *
       * Replace does NOT, and that is not an oversight. The new cheque may be
       * for a DIFFERENT amount — a party very often replaces a bounced 18,500
       * with 12,000 and pays the rest another way — so there is no arithmetic
       * that puts "what the bounce reversed" back without inventing which bill
       * loses the difference. An empty list there stays auto-FIFO, and an
       * operator who wants the old split sends it.
       */
      restoreReversedBy?: { voucherId: string | null; accYear: string | null } | null;
      /**
       * The register row the voucher belongs to. Given directly by re-present,
       * where the row already exists; created by `onVoucherWritten` in replace,
       * where it does NOT — see the note on the hook below.
       */
      registerRow?: { apdId: string; apdAccYear: string };
      /**
       * Runs after the voucher is POSTED and before anything is allocated.
       *
       * `ck_apd_posting` is
       *     posting_mode <> 'ON_RECEIPT' OR (voucher_id IS NOT NULL AND
       *                                      voucher_acc_year IS NOT NULL)
       * so an ON_RECEIPT register row cannot be INSERTED without its voucher —
       * not updated into place afterwards, refused at the insert. A replacement
       * therefore has to write the voucher first and create the row already
       * pointing at it, while the allocation that follows needs the row's id
       * for `abj_cheque_id`. This hook is the only order that satisfies all
       * three.
       */
      onVoucherWritten?: (voucher: {
        voucherId: string;
        accYear: string;
      }) => Promise<{ cheque: LockedCheque; registerRow: { apdId: string; apdAccYear: string } }>;
      actor: string;
      what: string;
      /** Where to read Cheques in Hand from when the row has no tender of its own. */
      inHandFrom?: LockedCheque;
      isPostDated?: boolean;
    },
  ): Promise<{
    voucher: ChequeRepresentPayload['reissueVoucher'];
    legs: ChequeRepresentPayload['legs'];
    bills: ChequeBillRef[];
  }> {
    const { cheque } = params;

    if (cheque.apdPostingMode === PdcPostingMode.ON_CLEARING) {
      if (params.allocations.length > 0) {
        throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
          {
            field: 'allocations',
            message:
              `${params.instrumentNo} is an ON_CLEARING cheque, so its bills are settled when it ` +
              'clears and not before. Allocate on /cheques/clear.',
          },
        ]);
      }
      return { voucher: null, legs: [], bills: [] };
    }

    const inHand = await resolveChequesInHand(tx, params.inHandFrom ?? cheque);
    const voucherAccYear = accYearOf(params.voucherDate);

    const legs: ChequeLegSpec[] = [
      {
        drCr: DrCr.DR,
        ledgerId: inHand.ledgerId,
        amount: params.amount,
        remarks: `Cheque ${params.instrumentNo} ${params.what}`,
      },
      {
        drCr: DrCr.CR,
        ledgerId: cheque.apdPartyId,
        amount: params.amount,
        remarks: `Cheque ${params.instrumentNo} ${params.what}`,
      },
    ];

    const written = await writeChequeVoucher(tx, {
      // An Rct: the party is being credited for an instrument they have handed
      // over, which is what a receipt is. The clearing type would be a claim
      // that a bank had paid, and no bank has.
      typeCode: RECEIPT_VOUCHER_TYPE_CODE,
      field: 'apdId',
      companyId: cheque.apdCompanyId,
      branchId: cheque.apdBranchId,
      tenantId: cheque.apdTenantId,
      accYear: voucherAccYear,
      voucherDate: params.voucherDate,
      partyId: cheque.apdPartyId,
      employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
      docAmount: params.amount,
      remarks: `Cheque ${params.instrumentNo} ${params.what}`,
      againstVoucherId: params.againstVoucherId,
      againstAccYear: params.againstAccYear,
      userId: params.actor,
      actor: params.actor,
      legs,
    });

    const request = await this.allocationRequest(tx, params);

    // The register row: either the one the caller already has, or the one the
    // hook creates now that there is a voucher for it to name.
    const placed = params.onVoucherWritten
      ? await params.onVoucherWritten({
          voucherId: written.ref.voucherId,
          accYear: voucherAccYear,
        })
      : { cheque, registerRow: params.registerRow! };

    const outcome = await allocateChequeMoney(
      tx,
      {
        voucherId: written.ref.voucherId,
        accYear: voucherAccYear,
        voucherTypeId: written.voucherTypeId,
        voucherNo: written.voucherNo,
        voucherRefno: written.ref.voucherRefno,
        companyId: cheque.apdCompanyId,
        branchId: cheque.apdBranchId,
        tenantId: cheque.apdTenantId,
        partyId: cheque.apdPartyId,
        salesmanId: cheque.apdSalesmanId,
        userId: params.actor,
        sessionId: null,
        actor: params.actor,
        adjDate: params.voucherDate,
        // R2 — a post-dated row is written TODAY and counts LATER. The bill
        // stays open until the cheque matures, with nothing re-posted on the
        // day: the row was always there, it simply started counting.
        isPostDated: params.isPostDated ?? false,
        cheque: { ...placed.cheque, apdAmount: params.amount },
        tenderId: cheque.apdTenderId,
        tenderAccYear: cheque.apdTenderId ? cheque.apdAccYear : null,
      },
      request,
    );

    // Re-present's row predates its voucher, so it is pointed at it here. A
    // replacement's row was created naming it already and needs nothing.
    if (!params.onVoucherWritten) {
      await tx.accPdcRegister.update({
        where: {
          apdId_apdAccYear: {
            apdId: placed.registerRow.apdId,
            apdAccYear: placed.registerRow.apdAccYear,
          },
        },
        data: { apdVoucherId: written.ref.voucherId, apdVoucherAccYear: voucherAccYear },
      });
    }

    const recomputed = await this.recompute.recomputeBills(tx, outcome.bills, todayUtc());
    const pendingByBill = new Map(
      recomputed.map((bill) => [`${bill.billId}|${bill.accYear}`, bill]),
    );

    return {
      voucher: await loadVoucherRef(tx, written.ref.voucherId, voucherAccYear),
      legs: written.legs,
      bills: outcome.refs.map((ref) => {
        const bill = pendingByBill.get(`${ref.billId}|${ref.billAccYear}`);
        return {
          ...ref,
          billAmount: bill ? toAmount(bill.billAmount) : 0,
          pendingAmount: bill ? toAmount(bill.pendingAmount) : 0,
        };
      }),
    };
  }

  /**
   * Where this re-issue's bills come from — the one decision `allocateChequeMoney`
   * refuses to make for itself.
   *
   * Sent allocations win, always: an operator who has named the bills is
   * re-pointing the money on purpose, and §4.5 keeps that door open.
   *
   * Otherwise a re-present restores what its bounce reversed. Note that an
   * empty restore is passed THROUGH as a restore rather than collapsing back to
   * auto-FIFO: a cheque whose money went wholly on account settled no bill the
   * first time, and it settles none this time either. Falling back to FIFO on
   * an empty result would put that cheque on somebody's oldest invoice, which
   * is the bug this whole path is here to prevent.
   */
  private async allocationRequest(
    tx: Prisma.TransactionClient,
    params: {
      cheque: LockedCheque;
      allocations: readonly ChequeAllocationDto[];
      restoreReversedBy?: { voucherId: string | null; accYear: string | null } | null;
    },
  ): Promise<ChequeAllocationRequest> {
    if (params.allocations.length > 0) {
      return { mode: 'NAMED', rows: params.allocations };
    }

    const bounce = params.restoreReversedBy;
    if (!bounce?.voucherId || !bounce.accYear) {
      // Replace, or a BOUNCED row whose bounce wrote no voucher — which under
      // ON_RECEIPT cannot happen, since the bounce posts five legs before it
      // touches a single adjustment row.
      return namedOrAutoFifo(params.allocations);
    }

    return {
      mode: 'RESTORE',
      rows: await allocationsReversedBy(tx, params.cheque, {
        voucherId: bounce.voucherId,
        accYear: bounce.accYear,
      }),
    };
  }

  /**
   * `ck_apd_dates` in words: within three months before and one year after the
   * day the row is received, which for a replacement is today.
   *
   * The window is not arbitrary. Three months back is the statutory validity
   * of a cheque in India — a date older than that is already stale and the
   * bank will refuse it. A year forward is as far ahead as a post-dated cheque
   * is worth registering; anything beyond it is a typo in the year.
   */
  private assertInstrumentDateUsable(instrumentDate: Date, today: Date): void {
    const daysBack = daysBetween(instrumentDate, today);
    if (daysBack > 92) {
      throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
        {
          field: 'newCheque.instrumentDate',
          message:
            `${toDateString(instrumentDate)} is more than three months old, so the bank would ` +
            'refuse it as stale. Ask for a cheque dated within the last three months.',
        },
      ]);
    }
    if (daysBack < -366) {
      throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
        {
          field: 'newCheque.instrumentDate',
          message:
            `${toDateString(instrumentDate)} is more than a year away. Check the year on the ` +
            'cheque.',
        },
      ]);
    }
  }

  /** The row just created, in the locked shape everything else here speaks. */
  private async reloadLocked(
    tx: Prisma.TransactionClient,
    apdId: string,
    apdAccYear: string,
  ): Promise<LockedCheque> {
    const row = await tx.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId, apdAccYear } },
    });
    return {
      ...row,
      apdAmount: new Prisma.Decimal(row.apdAmount),
      apdBounceCharges: new Prisma.Decimal(row.apdBounceCharges),
      apdPostingMode: row.apdPostingMode as PdcPostingMode,
      apdStatus: row.apdStatus as PdcStatus,
    };
  }
}
