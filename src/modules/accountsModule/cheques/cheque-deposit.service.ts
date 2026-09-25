import { Injectable } from '@nestjs/common';
import { assertBooksReconcile } from '../reconcile/books-reconcile.guard';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  throwAccountsBadRequest,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import { PdcStatus } from '../receipt/types/receipt-enum';
import { accYearOf, assertAccYearWritable } from '../receipt/receipt.guards';
import { sum, toAmount, toDateOnly, toDateString } from '../receipt/receipt.utils';
import {
  assertDateOnOrAfter,
  assertNotInFuture,
  assertStatus,
  chequeKey,
  loadBankLedger,
  lockCheques,
  type LockedCheque,
} from './cheques.guards';
import { logChequeStatus, reloadChequeRow } from './cheques.utils';
import { DEPOSITABLE_STATUSES } from './types/cheque-enum';
import { DepositChequesDto } from './dto/deposit-cheques.dto';
import type { ChequeDepositPayload, ChequeErrorDetail } from './types/cheque-api.types';

/**
 * §4.2 — the deposit. A batch, and NO voucher.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY NOTHING IS POSTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handing a bundle of cheques over the counter at a bank moves no money. The
 * bank has not paid us; it has taken custody of some paper and will tell us in
 * two days whether it was good. Under ON_RECEIPT the money is already in
 * 'Cheques in Hand' and stays there until the clearing moves it to the bank;
 * under ON_CLEARING nothing has been posted at all and nothing is posted here
 * either.
 *
 * A voucher on deposit would credit the bank two days before the bank agrees,
 * and every bank reconciliation afterwards would have a permanent
 * unexplained difference of whatever was in transit that night. So: the
 * register row moves to DEPOSITED, a status step is filed, and that is the
 * whole of it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  A BATCH, BECAUSE A DEPOSIT SLIP IS A BATCH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * One slip, one bank, one date, many cheques — that is the piece of paper the
 * operator is filling in, and the endpoint is shaped like it. All or nothing:
 * a slip that half-committed would print lines for cheques the register does
 * not think were deposited.
 *
 * §7: "a third that is CLEARED is refused by name and nothing is written."
 */

const DEPOSIT_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 60_000 };

@Injectable()
export class ChequeDepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async deposit(dto: DepositChequesDto): Promise<ChequeDepositPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const depositDate = toDateOnly(dto.depositDate);

    return this.prisma.$transaction(async (tx) => {
      assertNotInFuture(depositDate, 'A deposit', 'depositDate');

      // Locked first, before anything is read for the arithmetic (§6.2). Every
      // row of the batch, in one statement, ordered by id — so two slips naming
      // an overlapping set take them in the same order and cannot deadlock.
      const locked = await lockCheques(tx, dto.cheques);
      const cheques = dto.cheques.map((key, index) =>
        this.pick(locked, key, index, dto.apdCompanyId, dto.apdBranchId),
      );

      const bank = await loadBankLedger(tx, dto.apdCompanyId, dto.bankLedgerId);

      for (const [index, cheque] of cheques.entries()) {
        // A BOUNCED row reaching here is a re-presentation, which is a
        // different endpoint because it may have a voucher to write (§4.5).
        // Routing it silently would post nothing and leave the party credited
        // for money that came back.
        if (cheque.apdStatus === PdcStatus.BOUNCED) {
          throwAccountsBadRequest<ChequeErrorDetail>('Use re-present instead', [
            {
              field: `cheques.${index}`,
              message:
                `${cheque.apdInstrumentNo} has already bounced once. Send it back to the bank ` +
                'through /cheques/re-present, which re-issues it to the party first.',
            },
          ]);
        }
        assertStatus(cheque, DEPOSITABLE_STATUSES, 'deposited', `cheques.${index}`);

        // §7: "deposit dated before a cheque's instrument date is refused".
        // The cheque is not payable until the day written on it; banking it
        // early is how a cheque comes back marked "post-dated presented early"
        // with a charge attached.
        assertDateOnOrAfter(
          depositDate,
          cheque.apdInstrumentDate,
          `Deposit ${cheque.apdInstrumentNo}`,
          'the date on the cheque',
          `cheques.${index}`,
        );

        await assertAccYearWritable(tx, cheque.apdCompanyId, cheque.apdAccYear, `cheques.${index}`);
      }

      const now = new Date();
      for (const cheque of cheques) {
        await tx.accPdcRegister.update({
          where: {
            apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear },
          },
          data: {
            apdStatus: PdcStatus.DEPOSITED,
            // ck_apd_deposited: a DEPOSITED row must carry its date.
            apdDepositDate: depositDate,
            apdDepositSlipNo: dto.slipNo,
            // The bank it actually went into, which may not be the one the
            // receipt guessed when the cheque was taken.
            apdBankLedgerId: bank.ledgerId,
            // What distinguishes a first bounce from a repeat (§4.5).
            apdPresentCount: { increment: 1 },
            apdRemarks: dto.remarks ?? cheque.apdRemarks,
            apdStatusOn: now,
            apdStatusBy: actor,
            apdModifiedOn: now,
            apdModifiedBy: actor,
          },
        });

        await logChequeStatus(tx, cheque, {
          fromStatus: cheque.apdStatus,
          toStatus: PdcStatus.DEPOSITED,
          remarks:
            `Deposited into ${bank.ledgerName} on slip ${dto.slipNo}` +
            (dto.remarks ? ` — ${dto.remarks}` : ''),
          actor,
          changedOn: now,
        });
      }

      // The trial check (notes 47): a deposit posts no voucher, so Cheques In
      // Hand must still equal the HELD + DEPOSITED register.
      await assertBooksReconcile(tx, {
        companyId: dto.apdCompanyId,
        accYear: accYearOf(depositDate),
        cheques: cheques.map((cheque) => ({ apdId: cheque.apdId, apdAccYear: cheque.apdAccYear })),
      });

      const rows = await Promise.all(
        cheques.map((cheque) => reloadChequeRow(tx, cheque.apdId, cheque.apdAccYear)),
      );

      return {
        rows,
        slip: {
          bankLedgerId: bank.ledgerId,
          bankLedgerName: bank.ledgerName,
          depositDate: toDateString(depositDate) ?? dto.depositDate,
          slipNo: dto.slipNo,
          chequeCount: cheques.length,
          totalAmount: toAmount(sum(cheques.map((cheque) => cheque.apdAmount))),
        },
      };
    }, DEPOSIT_TRANSACTION_OPTIONS);
  }

  /**
   * One row out of the locked set, scoped.
   *
   * The company and branch checks are here rather than in the SQL for the
   * reason `lockChequeOrThrow` gives: a uuid is a bearer token, and a caller
   * scoped elsewhere gets a 404 rather than learning the cheque exists.
   */
  private pick(
    locked: ReadonlyMap<string, LockedCheque>,
    key: { apdId: string; apdAccYear: string },
    index: number,
    companyId: string,
    branchId: string,
  ): LockedCheque {
    const cheque = locked.get(chequeKey(key.apdId, key.apdAccYear));
    if (
      !cheque ||
      cheque.apdIsDeleted ||
      cheque.apdCompanyId !== companyId ||
      cheque.apdBranchId !== branchId
    ) {
      throwAccountsNotFound<ChequeErrorDetail>(
        'Cheque not found',
        `cheques.${index}`,
        `No live cheque ${key.apdId} at this company / branch in ${key.apdAccYear}`,
      );
    }
    if (cheque.apdTraType !== 'R') {
      throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
        {
          field: `cheques.${index}`,
          message:
            `${cheque.apdInstrumentNo} is an ISSUED cheque, not a received one. ` +
            'It belongs to the Issued Cheques screen.',
        },
      ]);
    }
    return cheque;
  }
}

/** Re-exported so the reissue service can build the same slip block. */
export function buildSlipSummary(
  bank: { ledgerId: string; ledgerName: string },
  depositDate: Date,
  slipNo: string,
  amounts: readonly Prisma.Decimal[],
): ChequeDepositPayload['slip'] {
  return {
    bankLedgerId: bank.ledgerId,
    bankLedgerName: bank.ledgerName,
    depositDate: toDateString(depositDate) ?? '',
    slipNo,
    chequeCount: amounts.length,
    totalAmount: toAmount(sum(amounts)),
  };
}
