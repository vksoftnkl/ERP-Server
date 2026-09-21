import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { DEFAULT_ACTOR, throwAccountsBadRequest } from 'src/common/utils/module-service.utils';
import { DrCr, PdcPostingMode, PdcStatus } from '../receipt/types/receipt-enum';
import { accYearOf } from '../receipt/receipt.guards';
import { toAmount, toDateOnly, todayUtc } from '../receipt/receipt.utils';
import {
  assertDateOnOrAfter,
  assertNotInFuture,
  assertStatus,
  loadBankLedger,
  lockChequeOrThrow,
  resolveChequesInHand,
} from './cheques.guards';
import { logChequeStatus, reloadChequeRow } from './cheques.utils';
import { writeChequeVoucher } from './cheque-voucher.helper';
import { allocateChequeMoney, namedOrAutoFifo } from './cheque-allocation';
import {
  CLEARABLE_STATUSES,
  CLEARING_VOUCHER_TYPE_CODE,
  RECEIPT_VOUCHER_TYPE_CODE,
} from './types/cheque-enum';
import { ClearChequeDto } from './dto/cheque-actions.dto';
import type { ChequeClearPayload, ChequeErrorDetail } from './types/cheque-api.types';

/**
 * §4.3 — the bank paid. The happy ending, and the only one of the six that has
 * two genuinely different shapes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ON_RECEIPT — A CONTRA, AND NOTHING ELSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     DR  the bank              amount     av_recon_date = bankDate
 *     CR  Cheques in Hand       amount
 *
 * Two legs, no party, no bills. The party was credited and the bills were
 * settled when the receipt was keyed; all that has happened now is that an
 * asset of ours turned into a different asset of ours. Touching the party here
 * would credit them twice for one payment.
 *
 * `av_recon_date` goes on the BANK leg and carries `bankDate` — the date the
 * bank says it happened, which is not always the day we recorded it. That is
 * the hook bank reconciliation (out of this plan, §8) will hang off.
 *
 * ── The second clearing cannot happen ────────────────────────────────────
 * The header files ('ACCOUNTS', 'PDC', apdId) in `avh_src_*`, and `ux_avh_src`
 * is UNIQUE over that for every live non-cancelled row. So a duplicate is
 * refused by the INDEX, not by a check that could be raced — and the service
 * turns the 23505 into "already cleared on 22-09". Two operators clearing the
 * same cheque at the same moment are serialised by the row lock; the loser
 * gets that message.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ON_CLEARING — THIS IS WHERE THE RECEIPT ACTUALLY HAPPENS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     DR  the bank              amount
 *     CR  the party             amount
 *
 * plus the adjustment rows, through the receipt's own engine. Under this mode
 * nothing was posted when the cheque arrived — the party stayed outstanding
 * and the register row was the only record — so the clearing is the receipt,
 * arriving three weeks late.
 *
 * §5's second rule: the mode is honoured PER ROW, off `apd_posting_mode`, and
 * never off the setting. A cheque taken in March under ON_RECEIPT keeps
 * clearing that way after somebody flips the setting in April.
 */

const CLEAR_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 60_000 };

@Injectable()
export class ChequeClearService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async clear(dto: ClearChequeDto): Promise<ChequeClearPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const clearDate = toDateOnly(dto.clearDate);
    const bankDate = dto.bankDate ? toDateOnly(dto.bankDate) : clearDate;

    return this.prisma.$transaction(async (tx) => {
      const cheque = await lockChequeOrThrow(tx, dto);
      assertStatus(cheque, CLEARABLE_STATUSES, 'cleared');

      assertNotInFuture(clearDate, 'A clearing', 'clearDate');
      // ck_apd_seq in words: a cheque cannot clear before it was banked.
      assertDateOnOrAfter(
        clearDate,
        cheque.apdDepositDate!,
        `Clear ${cheque.apdInstrumentNo}`,
        'the day it was deposited',
        'clearDate',
      );

      // The bank it was deposited INTO. A clearing does not get to choose a
      // different one: the money arrived where the slip sent it, and letting
      // the caller name a bank here would be a way to credit the wrong account
      // for a deposit that has already happened.
      if (!cheque.apdBankLedgerId) {
        throwAccountsBadRequest<ChequeErrorDetail>('Cheque has no deposit bank', [
          {
            field: 'apdId',
            message:
              `${cheque.apdInstrumentNo} is DEPOSITED but names no bank ledger, so there is ` +
              'nowhere to credit the money. Re-deposit it to record which bank took it.',
          },
        ]);
      }
      const bank = await loadBankLedger(tx, cheque.apdCompanyId, cheque.apdBankLedgerId, 'apdId');

      // The voucher's year is the year of the CLEARING, which for a cheque
      // received in March and cleared in April is not the cheque's own year.
      // The register row stays in its partition; the voucher lands in its own.
      const voucherAccYear = accYearOf(clearDate);

      const payload =
        cheque.apdPostingMode === PdcPostingMode.ON_CLEARING
          ? await this.clearOnClearing(tx, { cheque, dto, clearDate, voucherAccYear, bank, actor })
          : await this.clearOnReceipt(tx, {
              cheque,
              dto,
              clearDate,
              bankDate,
              voucherAccYear,
              bank,
              actor,
            });

      const now = new Date();
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
        data: {
          apdStatus: PdcStatus.CLEARED,
          // ck_apd_cleared: a CLEARED row must carry BOTH the date and the
          // voucher. Under ON_CLEARING the voucher it names is the receipt
          // that has just been raised, which is the right answer — that is the
          // document that put the money in the bank.
          apdClearDate: clearDate,
          apdClearVoucherId: payload.voucher.voucherId,
          apdClearAccYear: payload.voucher.accYear,
          apdRemarks: dto.remarks ?? cheque.apdRemarks,
          apdStatusOn: now,
          apdStatusBy: actor,
          apdModifiedOn: now,
          apdModifiedBy: actor,
        },
      });

      await logChequeStatus(tx, cheque, {
        fromStatus: cheque.apdStatus,
        toStatus: PdcStatus.CLEARED,
        remarks:
          `Cleared into ${bank.ledgerName} — ${payload.voucher.voucherRefno ?? ''}` +
          (dto.remarks ? ` — ${dto.remarks}` : ''),
        actor,
        changedOn: now,
      });

      return {
        ...payload,
        cheque: await reloadChequeRow(tx, cheque.apdId, cheque.apdAccYear),
      };
    }, CLEAR_TRANSACTION_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  ON_RECEIPT — the contra
  // ═════════════════════════════════════════════════════════════════════════

  private async clearOnReceipt(
    tx: Parameters<typeof writeChequeVoucher>[0],
    params: {
      cheque: Awaited<ReturnType<typeof lockChequeOrThrow>>;
      dto: ClearChequeDto;
      clearDate: Date;
      bankDate: Date;
      voucherAccYear: string;
      bank: { ledgerId: string; ledgerName: string };
      actor: string;
    },
  ): Promise<Omit<ChequeClearPayload, 'cheque'>> {
    const { cheque, bank } = params;

    if (params.dto.allocations.length > 0) {
      // Refused, not ignored. Silently discarding them would let a screen
      // believe it had moved money it had not — and under ON_RECEIPT the bills
      // were settled by the receipt weeks ago.
      throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
        {
          field: 'allocations',
          message:
            `${cheque.apdInstrumentNo} was posted ON_RECEIPT, so its bills were already settled ` +
            'by the receipt. A clearing under this mode allocates nothing.',
        },
      ]);
    }

    const inHand = await resolveChequesInHand(tx, cheque);

    const written = await writeChequeVoucher(tx, {
      typeCode: CLEARING_VOUCHER_TYPE_CODE,
      field: 'apdId',
      companyId: cheque.apdCompanyId,
      branchId: cheque.apdBranchId,
      tenantId: cheque.apdTenantId,
      accYear: params.voucherAccYear,
      voucherDate: params.clearDate,
      partyId: cheque.apdPartyId,
      employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
      docAmount: cheque.apdAmount,
      remarks:
        `Cheque ${cheque.apdInstrumentNo} cleared into ${bank.ledgerName}` +
        (params.dto.remarks ? ` — ${params.dto.remarks}` : ''),
      // The idempotency key. See the header note.
      srcDocId: cheque.apdId,
      duplicateMessage:
        `${cheque.apdInstrumentNo} has already been cleared. ` +
        'A cheque clears once; if the bank reversed it, record a bounce.',
      userId: params.actor,
      actor: params.actor,
      legs: [
        {
          drCr: DrCr.DR,
          ledgerId: bank.ledgerId,
          amount: cheque.apdAmount,
          remarks: `Cheque ${cheque.apdInstrumentNo}`,
          // The hook for bank reconciliation, on the BANK leg and nowhere else.
          reconDate: params.bankDate,
        },
        {
          drCr: DrCr.CR,
          ledgerId: inHand.ledgerId,
          amount: cheque.apdAmount,
          remarks: `Cheque ${cheque.apdInstrumentNo} cleared`,
        },
      ],
    });

    return { voucher: written.ref, legs: written.legs, billsSettled: [] };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  ON_CLEARING — the receipt, three weeks late
  // ═════════════════════════════════════════════════════════════════════════

  private async clearOnClearing(
    tx: Parameters<typeof writeChequeVoucher>[0],
    params: {
      cheque: Awaited<ReturnType<typeof lockChequeOrThrow>>;
      dto: ClearChequeDto;
      clearDate: Date;
      voucherAccYear: string;
      bank: { ledgerId: string; ledgerName: string };
      actor: string;
    },
  ): Promise<Omit<ChequeClearPayload, 'cheque'>> {
    const { cheque, bank } = params;

    const written = await writeChequeVoucher(tx, {
      // An Rct and not a ChqClr: under this mode nothing was posted when the
      // cheque arrived, so this IS the receipt. Filing it as a contra would
      // leave the collection missing from every "money received" report.
      typeCode: RECEIPT_VOUCHER_TYPE_CODE,
      field: 'apdId',
      companyId: cheque.apdCompanyId,
      branchId: cheque.apdBranchId,
      tenantId: cheque.apdTenantId,
      accYear: params.voucherAccYear,
      voucherDate: params.clearDate,
      partyId: cheque.apdPartyId,
      employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
      docAmount: cheque.apdAmount,
      remarks:
        `Cheque ${cheque.apdInstrumentNo} cleared into ${bank.ledgerName} (ON_CLEARING)` +
        (params.dto.remarks ? ` — ${params.dto.remarks}` : ''),
      srcDocId: cheque.apdId,
      duplicateMessage:
        `${cheque.apdInstrumentNo} has already been cleared. ` +
        'A cheque clears once; if the bank reversed it, record a bounce.',
      userId: params.actor,
      actor: params.actor,
      legs: [
        {
          drCr: DrCr.DR,
          ledgerId: bank.ledgerId,
          amount: cheque.apdAmount,
          remarks: `Cheque ${cheque.apdInstrumentNo}`,
          reconDate: params.clearDate,
        },
        {
          drCr: DrCr.CR,
          // The party, and NOT Cheques in Hand: under ON_CLEARING they were
          // never credited, so this is the moment their debt is discharged.
          ledgerId: cheque.apdPartyId,
          amount: cheque.apdAmount,
          remarks: `Cheque ${cheque.apdInstrumentNo} cleared`,
        },
      ],
    });

    const outcome = await allocateChequeMoney(
      tx,
      {
        voucherId: written.ref.voucherId,
        accYear: params.voucherAccYear,
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
        adjDate: params.clearDate,
        // The money is HERE. Nothing about this settlement is in the future.
        isPostDated: false,
        cheque,
        tenderId: cheque.apdTenderId,
        tenderAccYear: cheque.apdTenderId ? cheque.apdAccYear : null,
      },
      // §4.3 — this money is landing for the FIRST time, so an empty list is
      // "nobody decided" and auto-FIFO is the answer. The re-issue paths read
      // the same empty list differently, and deliberately: see
      // `ChequeAllocationRequest`.
      namedOrAutoFifo(params.dto.allocations),
    );

    // §5.2 step 14's TypeScript replacement, run inside the same transaction
    // and the same snapshot as the rows it is summing.
    const recomputed = await this.recompute.recomputeBills(tx, outcome.bills, todayUtc());
    const pendingByBill = new Map(
      recomputed.map((bill) => [`${bill.billId}|${bill.accYear}`, bill]),
    );

    // The register points at the voucher that finally carried it, which under
    // this mode it never had before.
    await tx.accPdcRegister.update({
      where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
      data: {
        apdVoucherId: written.ref.voucherId,
        apdVoucherAccYear: params.voucherAccYear,
      },
    });

    return {
      voucher: written.ref,
      legs: written.legs,
      billsSettled: outcome.refs.map((ref) => {
        const bill = pendingByBill.get(`${ref.billId}|${ref.billAccYear}`);
        return {
          ...ref,
          billAmount: bill ? toAmount(bill.billAmount) : 0,
          pendingAmount: bill ? toAmount(bill.pendingAmount) : 0,
        };
      }),
    };
  }
}
