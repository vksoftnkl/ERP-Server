import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { deriveVoucherTotals } from '../accountVoucherHeader/voucher-totals.helper';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../common/txn-status-log/txn-status-log.helper';
import {
  DEFAULT_ACTOR,
  throwAccountsBadRequest,
  throwAccountsConflict,
} from 'src/common/utils/module-service.utils';
import {
  ReceiptService,
  STORED_HEADER_SELECT,
  statusOf,
  type StoredHeader,
} from './receipt.service';
import { assertAccYearWritable, assertHeaderScope } from './receipt.guards';
import { flipSide, toAmount, todayUtc, ZERO } from './receipt.utils';
import { CancelReceiptDto } from './dto/post-receipt.dto';
import { CANCELLABLE_PDC_STATUSES, DrCr, PdcStatus, VoucherStatus } from './types/receipt-enum';
import type { ReceiptCancelPayload, ReceiptErrorDetail } from './types/receipt-api.types';

/**
 * §5.3 — cancel, which is the only way money on a posted receipt changes (R3).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  REVERSE, NEVER DELETE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nothing this service touches is removed. Every voucher gets a REVERSAL
 * voucher with mirrored legs, every adjustment row gets a NEGATIVE row pointing
 * back at it (`abj_reversal_of_id`, which `ck_abj_reversal_sign` forces to be
 * negative), and the originals are marked CANCELLED and keep their numbers.
 *
 * Because an accountant's question is never "what does this bill owe" alone. It
 * is "what did it owe in March, and what happened since" — and a deleted row
 * answers neither. It is also why the reversal is a real, numbered, POSTED
 * voucher rather than a flag: the day book for the day of the cancellation has
 * to show it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE THREE REFUSALS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · A cheque past HELD. Once it has gone to the bank, the bank's record and
 *     ours have to agree, and a receipt that never existed cannot have produced
 *     a deposit slip. Deposited money is unwound on the Received Cheques
 *     screen (menu 51, next plan), not here.
 *
 *   · An ADVANCE bill that has been spent. The remainder of this receipt is
 *     already settling somebody else's invoice; taking it back would leave that
 *     invoice settled by money that no longer exists.
 *
 *   · A locked or closed accounting year, for the receipt AND for every
 *     post-dated cheque's voucher — the reversal has to land somewhere.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE POST-DATED MIRROR, WHICH IS EASY TO GET WRONG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A reversal row COPIES the original's `abj_is_post_dated` and `abj_adj_date`.
 * It is tempting to date it today so the bill reopens at once — and it would be
 * wrong: an un-matured post-dated row does not count, so a reversal that DID
 * count would drive `abl_alloc_amount` negative and `ck_abl_settled` would
 * refuse the write. Mirroring the flag means the pair nets to zero whether the
 * cheque has matured or not, which is true on every day.
 */

const CANCEL_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };

@Injectable()
export class ReceiptCancelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly receiptService: ReceiptService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async cancel(dto: CancelReceiptDto): Promise<ReceiptCancelPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;

    return this.prisma.$transaction(async (tx) => {
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

      if (statusOf(header) !== VoucherStatus.POSTED) {
        throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be cancelled', [
          {
            field: 'avhVoucherId',
            message:
              `${header.avhVoucherRefno ?? dto.avhVoucherId} is ${header.avhVoucherStatus}. ` +
              'Only a POSTED receipt is cancelled; a DRAFT is simply not posted.',
          },
        ]);
      }
      if (header.avhAgainstVoucherId) {
        // A post-dated cheque's voucher is part of its receipt. Cancelling it
        // on its own would leave the receipt claiming money that has no voucher.
        throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be cancelled', [
          {
            field: 'avhVoucherId',
            message:
              'This is a post-dated cheque voucher, not a receipt. Cancel the receipt it belongs ' +
              'to and both are reversed together.',
          },
        ]);
      }

      const pdcVouchers = await tx.accVoucherHeader.findMany({
        where: { avhAgainstVoucherId: header.avhVoucherId, avhIsDeleted: false },
        select: STORED_HEADER_SELECT,
      });
      const vouchers = [header, ...pdcVouchers];

      for (const voucher of vouchers) {
        await assertAccYearWritable(tx, voucher.avhCompanyId, voucher.avhAccYear, 'avhAccYear');
      }

      const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);
      const years = [...new Set(vouchers.map((voucher) => voucher.avhAccYear))];

      await this.assertChequesStillHeld(tx, voucherIds);
      const advanceBills = await this.assertAdvancesUntouched(tx, voucherIds, years);

      const reversals: ReceiptCancelPayload['reversals'] = [];
      const touchedBills: Array<{ billId: string; accYear: string }> = [];

      for (const voucher of vouchers) {
        const result = await this.reverseVoucher(tx, voucher, dto.reason, actor);
        reversals.push(result.summary);
        touchedBills.push(...result.bills);
      }

      // Soft delete, not delete: the row is what proves the advance once
      // existed, and fk_abj_against_bill may still name it from a reversal.
      const now = new Date();
      if (advanceBills.length > 0) {
        await tx.accBillBalance.updateMany({
          where: {
            OR: advanceBills.map((bill) => ({ ablId: bill.ablId, ablAccYear: bill.ablAccYear })),
          },
          data: {
            ablIsDeleted: true,
            ablIsActive: false,
            ablModifiedOn: now,
            ablModifiedBy: actor,
          },
        });
      }

      const cancelledCheques = await this.cancelCheques(tx, voucherIds, dto.reason, actor, now);
      await this.softDeleteTenders(tx, header.avhVoucherId, actor, now);

      // The bills the reversal rows touched, brought back up to date. The
      // negative rows are already written, so this is what actually re-opens
      // them — and it is the same recompute the post used, with the same rules.
      const recomputed = await this.recompute.recomputeBills(tx, touchedBills, todayUtc());

      for (const voucher of vouchers) {
        const reversal = reversals.find((row) => row.ofVoucherId === voucher.avhVoucherId)!;
        await tx.accVoucherHeader.update({
          where: {
            avhVoucherId_avhAccYear: {
              avhVoucherId: voucher.avhVoucherId,
              avhAccYear: voucher.avhAccYear,
            },
          },
          data: {
            avhVoucherStatus: VoucherStatus.CANCELLED,
            // ck_avh_cancel refuses a CANCELLED voucher with no reason.
            avhCancelReason: dto.reason,
            avhReversalVoucherId: reversal.reversalVoucherId,
            avhReversalAccYear: reversal.accYear,
            avhStatusOn: now,
            avhStatusBy: actor,
            avhModifiedOn: now,
            avhModifiedBy: actor,
          },
        });

        await appendTxnStatusLog(tx, {
          companyId: voucher.avhCompanyId,
          branchId: voucher.avhBranchId,
          tenantId: voucher.avhTenantId,
          accYear: voucher.avhAccYear,
          srcModule: TxnStatusSrcModule.ACCOUNTS,
          srcDocType: TxnStatusDocType.RECEIPT,
          srcDocId: voucher.avhVoucherId,
          srcDocRefno: voucher.avhVoucherRefno,
          event: TxnStatusEvent.CANCELLED,
          fromStatus: VoucherStatus.POSTED,
          toStatus: VoucherStatus.CANCELLED,
          changedBy: actor,
          changedOn: now,
          remarks: dto.reason,
        });
      }

      return {
        avhVoucherId: header.avhVoucherId,
        avhAccYear: header.avhAccYear,
        avhVoucherRefno: header.avhVoucherRefno,
        fromStatus: VoucherStatus.POSTED,
        toStatus: VoucherStatus.CANCELLED,
        avhStatusOn: now.toISOString(),
        avhStatusBy: actor,
        reversals,
        billsReopened: recomputed.map((bill) => ({
          billId: bill.billId,
          billAccYear: bill.accYear,
          docRefno: '',
          pendingAmount: toAmount(bill.pendingAmount),
        })),
        chequesCancelled: cancelledCheques,
        advanceBillsRemoved: advanceBills.map((bill) => bill.ablId),
      };
    }, CANCEL_TRANSACTION_OPTIONS);
  }

  // ─── The refusals ──────────────────────────────────────────────────────────

  private async assertChequesStillHeld(
    tx: Prisma.TransactionClient,
    voucherIds: readonly string[],
  ): Promise<void> {
    const moved = await tx.accPdcRegister.findMany({
      where: {
        apdVoucherId: { in: [...voucherIds] },
        apdIsDeleted: false,
        apdStatus: { notIn: [...CANCELLABLE_PDC_STATUSES] },
      },
      select: { apdInstrumentNo: true, apdStatus: true },
    });

    if (moved.length > 0) {
      const first = moved[0];
      throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be cancelled', [
        {
          field: 'avhVoucherId',
          message:
            `Cheque ${first.apdInstrumentNo} is ${first.apdStatus}. Once an instrument has left ` +
            'the drawer the receipt behind it cannot be unmade — unwind it on the Received ' +
            'Cheques screen first.',
        },
      ]);
    }
  }

  private async assertAdvancesUntouched(
    tx: Prisma.TransactionClient,
    voucherIds: readonly string[],
    years: readonly string[],
  ): Promise<Array<{ ablId: string; ablAccYear: string; ablDocRefno: string }>> {
    const advances = await tx.accBillBalance.findMany({
      where: {
        ablVoucherId: { in: [...voucherIds] },
        ablAccYear: { in: [...years] },
        ablBillType: 'ADVANCE',
        ablIsDeleted: false,
      },
      select: {
        ablId: true,
        ablAccYear: true,
        ablDocRefno: true,
        ablBillAmount: true,
        ablPendingAmount: true,
      },
    });

    for (const advance of advances) {
      const pending = advance.ablPendingAmount ?? ZERO;
      if (!pending.equals(advance.ablBillAmount)) {
        throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be cancelled', [
          {
            field: 'avhVoucherId',
            message:
              `The on-account balance from ${advance.ablDocRefno} has already been used — ` +
              `${advance.ablBillAmount.minus(pending).toFixed(2)} of it is settling another bill. ` +
              'Reverse that settlement first.',
          },
        ]);
      }
    }

    return advances.map((advance) => ({
      ablId: advance.ablId,
      ablAccYear: advance.ablAccYear,
      ablDocRefno: advance.ablDocRefno,
    }));
  }

  // ─── The reversal ──────────────────────────────────────────────────────────

  /**
   * One voucher's mirror: a new header, its legs with DR and CR swapped, and a
   * negative adjustment row for every row the original wrote.
   *
   * The legs are MIRRORED and not negated because `ck_av_amount` refuses an
   * amount at or below zero — which is the right rule, and it means a reversal
   * is an ordinary voucher that happens to move everything the other way.
   */
  private async reverseVoucher(
    tx: Prisma.TransactionClient,
    voucher: StoredHeader,
    reason: string,
    actor: string,
  ): Promise<{
    summary: ReceiptCancelPayload['reversals'][number];
    bills: Array<{ billId: string; accYear: string }>;
  }> {
    const now = new Date();
    const number = await this.receiptService.allocateNumber(tx, {
      companyId: voucher.avhCompanyId,
      branchId: voucher.avhBranchId,
      accYear: voucher.avhAccYear,
      voucherTypeId: voucher.avhVoucherTypeId,
      voucherDate: voucher.avhVoucherDate,
    });

    const reversal = await tx.accVoucherHeader.create({
      data: {
        avhCompanyId: voucher.avhCompanyId,
        avhBranchId: voucher.avhBranchId,
        avhTenantId: voucher.avhTenantId,
        avhAccYear: voucher.avhAccYear,
        avhVoucherTypeId: voucher.avhVoucherTypeId,
        avhVoucherNo: number.voucherNo,
        avhVoucherSlno: number.voucherSlno,
        avhVoucherRefno: number.voucherRefno,
        // Dated the ORIGINAL, not today. A reversal dated today would leave the
        // original month overstated and this month understated — the books
        // would balance overall and be wrong in both periods. Cancelling into a
        // closed period is prevented by the year check instead, which is the
        // honest place for that rule.
        avhVoucherDate: voucher.avhVoucherDate,
        avhPartyId: voucher.avhPartyId,
        avhEmployeeId: voucher.avhEmployeeId,
        avhDocAmount: voucher.avhDocAmount,
        avhAdjustAmount: voucher.avhAdjustAmount,
        avhRemarks: `Reversal of ${voucher.avhVoucherRefno}: ${reason}`,
        avhAgainstVoucherId: voucher.avhVoucherId,
        avhAgainstAccYear: voucher.avhAccYear,
        avhDeviceType: voucher.avhDeviceType,
        avhDeviceId: voucher.avhDeviceId,
        avhSessionId: voucher.avhSessionId,
        avhUserId: voucher.avhUserId,
        avhVoucherStatus: VoucherStatus.DRAFT,
        avhCreatedBy: actor,
      },
      select: { avhVoucherId: true },
    });

    const legs = await tx.accVoucher.findMany({
      where: {
        avVoucherId: voucher.avhVoucherId,
        avAccYear: voucher.avhAccYear,
        avIsDeleted: false,
      },
      orderBy: { avRowNo: 'asc' },
    });

    if (legs.length > 0) {
      await tx.accVoucher.createMany({
        data: legs.map((leg, index) => ({
          avVoucherId: reversal.avhVoucherId,
          avCompanyId: leg.avCompanyId,
          avBranchId: leg.avBranchId,
          avTenantId: leg.avTenantId,
          avAccYear: voucher.avhAccYear,
          avVoucherTypeId: leg.avVoucherTypeId,
          avVoucherNo: number.voucherNo,
          avRowNo: index + 1,
          avVoucherDate: leg.avVoucherDate,
          avVoucherRefno: number.voucherRefno,
          avDrCr: flipSide(leg.avDrCr, DrCr.DR, DrCr.CR),
          avLedgerId: leg.avLedgerId,
          avOppLedgerId: leg.avOppLedgerId,
          avAmount: leg.avAmount,
          // The role travels with the leg (§2.6). A TDS report that sums
          // av_role must see the reversal, or a cancelled receipt would leave
          // TDS on the books forever.
          avRole: leg.avRole,
          avRemarks: `Reversal of ${voucher.avhVoucherRefno}`,
          avSessionId: leg.avSessionId,
          avUserId: leg.avUserId,
          avCreatedBy: actor,
        })),
      });
    }

    const adjustments = await tx.accBillAdjustment.findMany({
      where: {
        abjVoucherId: voucher.avhVoucherId,
        abjVoucherAccYear: voucher.avhAccYear,
        abjIsDeleted: false,
        // A reversal OF a reversal is not something this path produces, and
        // sweeping one up would cancel the cancellation.
        abjReversalOfId: null,
      },
    });

    if (adjustments.length > 0) {
      await tx.accBillAdjustment.createMany({
        data: adjustments.map((row, index) => ({
          abjCompanyId: row.abjCompanyId,
          abjBranchId: row.abjBranchId,
          abjTenantId: row.abjTenantId,
          abjAccYear: row.abjAccYear,
          abjBillId: row.abjBillId,
          abjBillAccYear: row.abjBillAccYear,
          abjPartyId: row.abjPartyId,
          abjRowNo: index + 1,
          abjAgainstBillId: row.abjAgainstBillId,
          abjAgainstBillAccYear: row.abjAgainstBillAccYear,
          abjVoucherId: reversal.avhVoucherId,
          abjVoucherAccYear: voucher.avhAccYear,
          abjAdjType: row.abjAdjType,
          // The ORIGINAL's date and post-dated flag, mirrored exactly. See the
          // header note: anything else drives abl_alloc_amount negative on an
          // un-matured cheque and ck_abl_settled refuses the write.
          abjAdjDate: row.abjAdjDate,
          abjIsPostDated: row.abjIsPostDated,
          // The side flips: a row that credited the party now debits them.
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
          abjReversalReason: reason.slice(0, 250),
          abjUserId: row.abjUserId,
          abjSessionId: row.abjSessionId,
          abjCreatedBy: actor,
        })),
      });
    }

    const totals = await deriveVoucherTotals(tx, reversal.avhVoucherId, voucher.avhAccYear);
    if (!totals.difference.isZero()) {
      throwAccountsBadRequest<ReceiptErrorDetail>('The reversal does not balance', [
        {
          field: 'avhVoucherId',
          message:
            `The reversal of ${voucher.avhVoucherRefno} is out by ${totals.difference.toFixed(2)}. ` +
            'The original voucher is unbalanced; nothing has been changed.',
        },
      ]);
    }

    await tx.accVoucherHeader.update({
      where: {
        avhVoucherId_avhAccYear: {
          avhVoucherId: reversal.avhVoucherId,
          avhAccYear: voucher.avhAccYear,
        },
      },
      data: {
        avhVoucherStatus: VoucherStatus.POSTED,
        avhStatusOn: now,
        avhStatusBy: actor,
        avhPostedOn: now,
      },
    });

    return {
      summary: {
        ofVoucherId: voucher.avhVoucherId,
        reversalVoucherId: reversal.avhVoucherId,
        accYear: voucher.avhAccYear,
        voucherRefno: number.voucherRefno,
        legCount: legs.length,
        adjustmentCount: adjustments.length,
      },
      bills: adjustments.map((row) => ({
        billId: row.abjBillId,
        accYear: row.abjBillAccYear,
      })),
    };
  }

  // ─── The instruments ───────────────────────────────────────────────────────

  private async cancelCheques(
    tx: Prisma.TransactionClient,
    voucherIds: readonly string[],
    reason: string,
    actor: string,
    now: Date,
  ): Promise<string[]> {
    const cheques = await tx.accPdcRegister.findMany({
      where: {
        apdVoucherId: { in: [...voucherIds] },
        apdIsDeleted: false,
        apdStatus: PdcStatus.HELD,
      },
      select: { apdId: true, apdAccYear: true },
    });

    for (const cheque of cheques) {
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
        data: {
          apdStatus: PdcStatus.CANCELLED,
          // ck_apd_cancelled refuses a CANCELLED row with no reason. And the
          // status matters beyond the message: ux_apd_instrument excludes
          // CANCELLED, so the same cheque number can be keyed again on the
          // re-entered receipt.
          apdCancelReason: reason.slice(0, 250),
          apdCancelDate: now,
          apdStatusOn: now,
          apdStatusBy: actor,
          apdModifiedOn: now,
          apdModifiedBy: actor,
        },
      });
    }

    return cheques.map((cheque) => cheque.apdId);
  }

  private async softDeleteTenders(
    tx: Prisma.TransactionClient,
    voucherId: string,
    actor: string,
    now: Date,
  ): Promise<void> {
    await tx.accTenderDetail.updateMany({
      where: { tdSrcDocId: voucherId, tdIsDeleted: false },
      data: { tdIsDeleted: true, tdModifiedOn: now, tdModifiedBy: actor },
    });
  }
}
