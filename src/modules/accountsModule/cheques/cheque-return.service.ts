import { Injectable } from '@nestjs/common';
import { assertBooksReconcile } from '../reconcile/books-reconcile.guard';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { DrCr, PdcPostingMode } from '../receipt/types/receipt-enum';
import { accYearOf } from '../receipt/receipt.guards';
import { toAmount, toDateString, todayUtc, ZERO } from '../receipt/receipt.utils';
import {
  assertStatus,
  lockChequeOrThrow,
  resolveChequesInHand,
  type LockedCheque,
} from './cheques.guards';
import { logChequeStatus, reloadChequeRow } from './cheques.utils';
import { writeChequeVoucher } from './cheque-voucher.helper';
import { cascadeAdvances, reverseChequeAdjustments } from './cheque-reversal.helper';
import {
  findSaleBillOfCheque,
  moveSaleBillHeader,
  moveSaleBillSettlement,
} from './sale-bill-cheque.helper';
import {
  CANCEL_REASON_MAX_LENGTH,
  RECEIPT_VOUCHER_TYPE_CODE,
  RETURNABLE_STATUSES,
} from './types/cheque-enum';
import { ReturnChequeDto } from './dto/cheque-actions.dto';
import type { ChequeCascadeReport, ChequeReturnPayload } from './types/cheque-api.types';

/**
 * §4.7 — the party wants their paper back, or it was never good to begin with.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  HELD ONLY, AND THAT IS THE WHOLE RULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Once a cheque has gone to the bank, the bank's record and ours have to
 * agree. A cheque that this system says was handed back cannot also appear on
 * a deposit slip the bank is holding. So a DEPOSITED cheque is refused here
 * and unwound the only honest way: wait for the bank to say cleared or
 * bounced, and act on that. §7: "from DEPOSITED → refused."
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  TWO WORDS FOR TWO DIFFERENT EVENTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   RETURNED  — the paper went back to the party. They have it, and they may
 *               present it somewhere else or destroy it. It stays in
 *               `ux_apd_instrument`, so the same number cannot be registered
 *               for them again this year — because it still exists.
 *
 *   CANCELLED — it is void. Nobody has it. `ux_apd_instrument` excludes
 *               CANCELLED, so the same cheque number CAN be keyed again, which
 *               is exactly what a mis-keyed cheque number needs.
 *
 * Both need a reason (`ck_apd_cancelled` covers both statuses).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE REVERSAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     DR  the party             amount
 *     CR  Cheques in Hand       amount
 *
 * — the exact mirror of what the receipt posted, and the same two legs a
 * bounce writes minus the charges. It is an `Rct`, not a voucher type of its
 * own, because that is what it reverses; `avh_against_voucher_id` points at
 * the receipt so the pair reads as one story.
 *
 * Under ON_CLEARING there is nothing to reverse and the register moves alone.
 */

const RETURN_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 60_000 };

@Injectable()
export class ChequeReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async return(dto: ReturnChequeDto): Promise<ChequeReturnPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;

    return this.prisma.$transaction(async (tx) => {
      const cheque = await lockChequeOrThrow(tx, dto);
      assertStatus(cheque, RETURNABLE_STATUSES, dto.action.toLowerCase());

      const outcome = await this.unwind(tx, cheque, {
        reason: dto.reason,
        actor,
        asOf: todayUtc(),
      });

      const now = new Date();
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
        data: {
          apdStatus: dto.action,
          // ck_apd_cancelled refuses either status with no reason.
          apdCancelReason: dto.reason.slice(0, CANCEL_REASON_MAX_LENGTH),
          apdCancelDate: now,
          apdRemarks: dto.remarks ?? cheque.apdRemarks,
          apdStatusOn: now,
          apdStatusBy: actor,
          apdModifiedOn: now,
          apdModifiedBy: actor,
        },
      });

      await logChequeStatus(tx, cheque, {
        fromStatus: cheque.apdStatus,
        toStatus: dto.action,
        remarks: dto.reason,
        actor,
        changedOn: now,
      });

      // The trial check (notes 47), after every write.
      await assertBooksReconcile(tx, {
        companyId: cheque.apdCompanyId,
        accYear: outcome.voucher?.accYear ?? accYearOf(todayUtc()),
        ledgerIds: [cheque.apdPartyId],
        cheques: [{ apdId: cheque.apdId, apdAccYear: cheque.apdAccYear }],
        vouchers: outcome.voucher ? [outcome.voucher] : [],
      });

      return {
        cheque: await reloadChequeRow(tx, cheque.apdId, cheque.apdAccYear),
        reversalVoucher: outcome.voucher,
        legs: outcome.legs,
        billsReopened: outcome.billsReopened,
        cascade: outcome.cascade,
      };
    }, RETURN_TRANSACTION_OPTIONS);
  }

  /**
   * The reversal, the adjustment rows and the cascade — everything except the
   * register update and the trail.
   *
   * Split out and exported to the module because `/cheques/replace` from HELD
   * needs exactly this and nothing else (§4.6: "From HELD: first the return
   * reversal of §4.7, no charges"). Two copies of a reversal is two chances to
   * get the post-dated mirror wrong.
   */
  async unwind(
    tx: Prisma.TransactionClient,
    cheque: LockedCheque,
    params: { reason: string; actor: string; asOf: Date },
  ): Promise<{
    voucher: ChequeReturnPayload['reversalVoucher'];
    legs: ChequeReturnPayload['legs'];
    billsReopened: ChequeReturnPayload['billsReopened'];
    cascade: ChequeCascadeReport;
  }> {
    const emptyCascade: ChequeCascadeReport = {
      advanceBillsRemoved: [],
      advanceApplicationsReversed: 0,
      advancesLeftMixed: [],
    };

    if (cheque.apdPostingMode === PdcPostingMode.ON_CLEARING || !cheque.apdVoucherId) {
      // Nothing was posted when it arrived, so there is nothing to take back.
      // The register moves alone — which is the whole of ON_CLEARING's point.
      return { voucher: null, legs: [], billsReopened: [], cascade: emptyCascade };
    }

    const inHand = await resolveChequesInHand(tx, cheque);
    // Dated the RECEIPT, not today, for the reason the receipt's own cancel
    // gives: a reversal dated today leaves the original month overstated and
    // this month understated. The books would balance overall and be wrong in
    // both periods. Writing into a closed year is prevented by the year check
    // inside writeChequeVoucher instead, which is the honest place for it.
    const voucherDate = cheque.apdReceivedOn;
    const voucherAccYear = accYearOf(voucherDate);

    const written = await writeChequeVoucher(tx, {
      typeCode: RECEIPT_VOUCHER_TYPE_CODE,
      field: 'apdId',
      companyId: cheque.apdCompanyId,
      branchId: cheque.apdBranchId,
      tenantId: cheque.apdTenantId,
      accYear: voucherAccYear,
      voucherDate,
      partyId: cheque.apdPartyId,
      employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
      docAmount: cheque.apdAmount,
      remarks: `Cheque ${cheque.apdInstrumentNo} returned to the party: ${params.reason}`,
      againstVoucherId: cheque.apdVoucherId,
      againstAccYear: cheque.apdVoucherAccYear,
      userId: params.actor,
      actor: params.actor,
      legs: [
        {
          drCr: DrCr.DR,
          ledgerId: cheque.apdPartyId,
          amount: cheque.apdAmount,
          remarks: `Cheque ${cheque.apdInstrumentNo} returned`,
        },
        {
          drCr: DrCr.CR,
          ledgerId: inHand.ledgerId,
          amount: cheque.apdAmount,
          remarks: `Cheque ${cheque.apdInstrumentNo} returned`,
        },
      ],
    });

    const scope = {
      voucherId: written.ref.voucherId,
      accYear: voucherAccYear,
      companyId: cheque.apdCompanyId,
      branchId: cheque.apdBranchId,
      tenantId: cheque.apdTenantId,
      userId: params.actor,
      sessionId: null,
      actor: params.actor,
      reason: `Cheque ${cheque.apdInstrumentNo} returned: ${params.reason}`,
    };

    const reversed = await reverseChequeAdjustments(tx, cheque, scope);
    const cascade = await cascadeAdvances(tx, cheque, scope, reversed.nextRowNo);

    const touched = [...reversed.bills, ...cascade.bills];
    const recomputed = await this.recompute.recomputeBills(tx, touched, params.asOf);
    const refs = await this.loadBillRefs(tx, touched);
    // A cheque tendered ON a sale bill: with its ALLOCATION row (notes 49) the
    // reversal above reopened the receivable and only the bill header moves
    // here; a bill without one is reopened through its tender as before
    // (sale-bill-cheque.helper).
    const saleBill = await findSaleBillOfCheque(tx, cheque);
    let saleBillReopened: Awaited<ReturnType<typeof moveSaleBillSettlement>> | null = null;
    if (saleBill?.hasCounterRow) {
      const given = reversed.amountByBill.get(`${saleBill.ablId}|${saleBill.ablAccYear}`);
      if (given?.greaterThan(0)) {
        await moveSaleBillHeader(tx, saleBill, given.negated());
      }
    } else if (saleBill) {
      saleBillReopened = await moveSaleBillSettlement(
        tx,
        saleBill,
        cheque.apdAmount.negated(),
        params.asOf,
        params.actor,
      );
    }

    return {
      voucher: written.ref,
      legs: written.legs,
      billsReopened: recomputed
        .map((bill) => {
          const ref = refs.get(`${bill.billId}|${bill.accYear}`);
          return {
            billId: bill.billId,
            billAccYear: bill.accYear,
            billType: ref?.billType ?? '',
            docRefno: ref?.docRefno ?? '',
            docDate: ref?.docDate ?? '',
            dueDate: ref?.dueDate ?? null,
            billAmount: toAmount(bill.billAmount ?? ZERO),
            pendingAmount: toAmount(bill.pendingAmount),
            settledByThisCheque: toAmount(
              reversed.amountByBill.get(`${bill.billId}|${bill.accYear}`) ?? ZERO,
            ),
          };
        })
        .concat(saleBillReopened ? [saleBillReopened] : []),
      cascade: cascade.report,
    };
  }

  private async loadBillRefs(
    tx: Prisma.TransactionClient,
    bills: readonly { billId: string; accYear: string }[],
  ): Promise<
    Map<string, { billType: string; docRefno: string; docDate: string; dueDate: string | null }>
  > {
    if (bills.length === 0) {
      return new Map();
    }
    const rows = await tx.accBillBalance.findMany({
      where: { OR: bills.map((bill) => ({ ablId: bill.billId, ablAccYear: bill.accYear })) },
      select: {
        ablId: true,
        ablAccYear: true,
        ablBillType: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablDueDate: true,
      },
    });
    return new Map(
      rows.map((row) => [
        `${row.ablId}|${row.ablAccYear}`,
        {
          billType: row.ablBillType,
          docRefno: row.ablDocRefno,
          docDate: toDateString(row.ablDocDate) ?? '',
          dueDate: toDateString(row.ablDueDate),
        },
      ]),
    );
  }
}
