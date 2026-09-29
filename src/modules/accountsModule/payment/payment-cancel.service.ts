import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { deriveVoucherTotals } from '../accountVoucherHeader/voucher-totals.helper';
import { assertVoucherBooksReconcile } from '../vouchers/voucher-books.helper';
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
import { flipSide, toAmount, todayUtc } from '../receipt/receipt.utils';
import {
  PaymentService,
  STORED_HEADER_SELECT,
  statusOf,
  type StoredHeader,
} from './payment.service';
import { assertAccYearWritable, assertHeaderScope } from './payment.guards';
import {
  assertAdvancesUntouched,
  assertIssuedChequesStillHeld,
  assertNoSettledTransfer,
} from './payment-unwind.guards';
import {
  paymentChequeFilter,
  paymentPdcVoucherWhere,
  type PaymentChequeScope,
} from './payment-cheque-links';
import { CancelPaymentDto } from './dto/post-payment.dto';
import { DrCr, PdcStatus, VoucherStatus } from './types/payment-enum';
import type { PaymentCancelPayload, PaymentErrorDetail } from './types/payment-api.types';

/**
 * §5.3 — cancel: unmaking a posted payment. `receipt-cancel.service.ts`,
 * mirrored: REVERSE, never delete — a numbered reversal voucher with mirrored
 * legs, a negative adjustment row per row the post wrote, the originals
 * CANCELLED keeping their numbers. The refusals (`payment-unwind.guards.ts`)
 * are the receipt's two plus the plan's one: a cheque past HELD, a SETTLED
 * transfer, an advance already spent.
 *
 * What the payment adds: the TDS register. Every live DEDUCTED row of the
 * payment gets a reversal row on the reversal voucher, so the quarter's 26Q
 * and the annual threshold both forget the deduction.
 */

const CANCEL_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };

@Injectable()
export class PaymentCancelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async cancel(dto: CancelPaymentDto): Promise<PaymentCancelPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT avh_voucher_id FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid AND avh_acc_year = ${dto.avhAccYear}::bpchar
           FOR UPDATE`;
      const header = await this.paymentService.loadHeaderOrThrow(
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
        throwAccountsConflict<PaymentErrorDetail>('Payment cannot be cancelled', [
          {
            field: 'avhVoucherId',
            message:
              `${header.avhVoucherRefno ?? dto.avhVoucherId} is ${header.avhVoucherStatus}. ` +
              'Only a POSTED payment is cancelled; a DRAFT is simply not posted.',
          },
        ]);
      }
      if (header.avhAgainstVoucherId) {
        throwAccountsConflict<PaymentErrorDetail>('Payment cannot be cancelled', [
          {
            field: 'avhVoucherId',
            message:
              'This is a post-dated cheque voucher, not a payment. Cancel the payment it belongs to ' +
              'and both are reversed together.',
          },
        ]);
      }

      const pdcVouchers: StoredHeader[] = (
        await tx.accVoucherHeader.findMany({
          where: paymentPdcVoucherWhere(header),
          select: STORED_HEADER_SELECT,
        })
      ).map((row) => ({ ...row, avhPartyId: row.avhPartyId ?? header.avhPartyId }));
      const vouchers = [header, ...pdcVouchers];
      for (const voucher of vouchers) {
        await assertAccYearWritable(tx, voucher.avhCompanyId, voucher.avhAccYear, 'avhAccYear');
      }
      const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);
      const years = [...new Set(vouchers.map((voucher) => voucher.avhAccYear))];
      const scope: PaymentChequeScope = { receiptVoucherId: header.avhVoucherId, voucherIds };

      await assertIssuedChequesStillHeld(tx, scope, 'cancelled');
      await assertNoSettledTransfer(tx, header.avhVoucherId, 'cancelled');
      const advanceBills = await assertAdvancesUntouched(tx, voucherIds, years, 'cancelled');

      const reversals: PaymentCancelPayload['reversals'] = [];
      const touchedBills: Array<{ billId: string; accYear: string }> = [];
      for (const voucher of vouchers) {
        const result = await this.reverseVoucher(tx, voucher, dto.reason, actor);
        reversals.push(result.summary);
        touchedBills.push(...result.bills);
      }

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
      const cancelledCheques = await this.cancelCheques(tx, scope, dto.reason, actor, now);
      await tx.accTenderDetail.updateMany({
        where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
        data: { tdIsDeleted: true, tdModifiedOn: now, tdModifiedBy: actor },
      });
      const recomputed = await this.recompute.recomputeBills(tx, touchedBills, todayUtc());

      const paymentReversal = reversals.find((row) => row.ofVoucherId === header.avhVoucherId)!;
      const tdsReversed = await this.reverseTds(
        tx,
        header,
        paymentReversal.reversalVoucherId,
        dto.reason,
        actor,
      );

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
          srcDocType: TxnStatusDocType.PAYMENT,
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

      // The trial check (notes 47) through the Voucher Register's helper, as
      // the post does (notes 61). This payment's post-dated pair nets to zero,
      // but the guard reads the PARTY: one holding an un-matured post-dated
      // cheque from another payment is already off by that amount on the
      // ledger side, and the shared guard would refuse this cancel for it.
      const movedLedgers = await tx.accVoucher.findMany({
        where: {
          avVoucherId: { in: vouchers.map((voucher) => voucher.avhVoucherId) },
          avIsDeleted: false,
        },
        select: { avLedgerId: true },
        distinct: ['avLedgerId'],
      });
      await assertVoucherBooksReconcile(tx, {
        companyId: header.avhCompanyId,
        accYear: header.avhAccYear,
        ledgerIds: [header.avhPartyId, ...movedLedgers.map((leg) => leg.avLedgerId)],
      });

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
        tdsReversed,
      };
    }, CANCEL_TRANSACTION_OPTIONS);
  }

  // ─── The reversal ──────────────────────────────────────────────────────────

  private async reverseVoucher(
    tx: Prisma.TransactionClient,
    voucher: StoredHeader,
    reason: string,
    actor: string,
  ): Promise<{
    summary: PaymentCancelPayload['reversals'][number];
    bills: Array<{ billId: string; accYear: string }>;
  }> {
    const now = new Date();
    const number = await this.paymentService.allocateNumber(tx, {
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
        // Dated the ORIGINAL, not today — see the receipt's reasoning.
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
          avRole: leg.avRole,
          avRemarks: `Reversal of ${voucher.avhVoucherRefno}`,
          avSessionId: leg.avSessionId,
          avUserId: leg.avUserId,
          avCreatedBy: actor,
        })),
      });
    }

    const forward = await tx.accBillAdjustment.findMany({
      where: {
        abjVoucherId: voucher.avhVoucherId,
        abjVoucherAccYear: voucher.avhAccYear,
        abjIsDeleted: false,
        abjReversalOfId: null,
      },
    });
    const reversed = await tx.accBillAdjustment.findMany({
      where: { abjReversalOfId: { in: forward.map((row) => row.abjId) }, abjIsDeleted: false },
      select: { abjReversalOfId: true },
    });
    const alreadyReversed = new Set(
      reversed.map((row) => row.abjReversalOfId).filter((id): id is string => id !== null),
    );
    const adjustments = forward.filter((row) => !alreadyReversed.has(row.abjId));
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
          abjAdjDate: row.abjAdjDate,
          abjIsPostDated: row.abjIsPostDated,
          abjDrCr: flipSide(row.abjDrCr, DrCr.DR, DrCr.CR),
          abjAmount: row.abjAmount.negated(),
          abjSettlementMode: row.abjSettlementMode,
          abjSettlementLedgerId: row.abjSettlementLedgerId,
          abjTenderId: row.abjTenderId,
          abjTenderAccYear: row.abjTenderAccYear,
          abjChequeId: row.abjChequeId,
          abjChequeAccYear: row.abjChequeAccYear,
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
      throwAccountsBadRequest<PaymentErrorDetail>('The reversal does not balance', [
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
      bills: forward.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear })),
    };
  }

  // ─── The instruments ───────────────────────────────────────────────────────

  private async cancelCheques(
    tx: Prisma.TransactionClient,
    scope: PaymentChequeScope,
    reason: string,
    actor: string,
    now: Date,
  ): Promise<string[]> {
    const cheques = await tx.accPdcRegister.findMany({
      where: {
        ...(await paymentChequeFilter(tx, scope)),
        apdIsDeleted: false,
        apdStatus: PdcStatus.HELD,
      },
      select: { apdId: true, apdAccYear: true },
    });
    for (const cheque of cheques) {
      // The leaf stays used: a cancelled cheque is VOID on the book, never reissued.
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
        data: {
          apdStatus: PdcStatus.CANCELLED,
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

  // ─── The TDS register ──────────────────────────────────────────────────────

  /** A reversal row per live DEDUCTED row of the payment, filed on the reversal voucher. */
  private async reverseTds(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    reversalVoucherId: string,
    reason: string,
    actor: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ atd_id: string; atd_challan_no: string | null }[]>`
      SELECT t.atd_id, t.atd_challan_no
        FROM accounts.acc_tds_register t
       WHERE t.atd_voucher_id = ${header.avhVoucherId}::uuid
         AND t.atd_voucher_acc_year = ${header.avhAccYear}::char(9)
         AND t.atd_is_deleted = false
         AND t.atd_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_tds_register r
                          WHERE r.atd_reversal_of_id = t.atd_id AND r.atd_is_deleted = false)`;
    const deposited = rows.find((row) => row.atd_challan_no);
    if (deposited) {
      throwAccountsConflict<PaymentErrorDetail>('Payment cannot be cancelled', [
        {
          field: 'avhVoucherId',
          message:
            `The TDS on ${header.avhVoucherRefno} was deposited under challan ${deposited.atd_challan_no} — ` +
            'correct it with a 26Q revision, not a cancel',
        },
      ]);
    }
    for (const row of rows) {
      // A reversal negates the TAX and keeps the BASE: ck_atd_base refuses a
      // negative base, ck_atd_reversal_sign wants the tax <= 0, and the annual
      // base (loadTdsAnnualBase) skips a row that has a live reversal. The
      // Voucher Register's cancel writes it the same way.
      await tx.$executeRaw`
        INSERT INTO accounts.acc_tds_register (
          atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
          atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
          atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
          atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_reversal_of_id,
          atd_remarks, atd_created_by
        )
        SELECT o.atd_company_id, o.atd_branch_id, o.atd_tenant_id, o.atd_acc_year, o.atd_quarter, o.atd_direction,
               o.atd_party_id, o.atd_pan, o.atd_party_name, o.atd_deductee_type, o.atd_section, o.atd_rate,
               o.atd_rate_source, o.atd_base_amount, -o.atd_tax_amount,
               ${reversalVoucherId}::uuid, o.atd_voucher_acc_year,
               o.atd_doc_refno, o.atd_doc_date, NULL, NULL, o.atd_id,
               ${`Reversal of ${header.avhVoucherRefno ?? ''}: ${reason}`.slice(0, 250)}, ${actor}
          FROM accounts.acc_tds_register o WHERE o.atd_id = ${row.atd_id}::uuid`;
    }
    return rows.length;
  }
}
