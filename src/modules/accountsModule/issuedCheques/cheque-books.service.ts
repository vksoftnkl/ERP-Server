import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { loadRights } from '../../../common/posting/rights';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { formatLeaf, leavesLeft, loadChequeBook } from '../vouchers/cheque-book.helper';
import { isBankLedger, loadLedgerFacts } from '../vouchers/voucher-facts';
import {
  throwInvalid,
  throwMissing,
  throwRight,
  throwState,
  VCH,
} from '../vouchers/vouchers.errors';

/** notes (58): Accounts → Cheque Books. Every /cheque-books/* route is judged here, not on 52. */
export const CHEQUE_BOOKS_MENU_ID = 263;
import type {
  ChequeBookKeysDto,
  CloseChequeBookDto,
  SaveChequeBookDto,
} from './dto/issued-cheques.dto';
import type { ChequeBookPayload } from './types/issued-cheques-api.types';

type Tx = Prisma.TransactionClient;

/**
 * notes (55) §4.9 — our cheque books. notes (58): a menu of their own, 263
 * (Accounts → Cheque Books); Issued Cheques' "Cheque books" button opens the
 * same screen, and the rights are 263's from either door: get = VIEW,
 * create = CREATE, edit / close = EDIT.
 *
 * A book is a bank account and a run of leaf numbers. The server hands the
 * leaves out (`takeNextLeaf`), so what the operator keeps here is the paper:
 * which book, which bank, which numbers. Two live books on one bank may not
 * share a leaf number — the register would refuse the second cheque
 * (ux_apd_issued_leaf) long after the book was keyed.
 */
@Injectable()
export class ChequeBooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  private caller(): { userId: string | null; actor: string } {
    const userId = this.requestContext.getUserId() ?? null;
    return { userId, actor: userId ?? DEFAULT_ACTOR };
  }

  private async require(tx: Tx, right: 'view' | 'create' | 'edit', code: string): Promise<void> {
    const { userId } = this.caller();
    const r = userId ? await loadRights(tx, userId, CHEQUE_BOOKS_MENU_ID) : null;
    if (!r?.[right]) {
      throwRight(`This user may not ${right} cheque books (menu ${CHEQUE_BOOKS_MENU_ID}, Cheque Books)`, code);
    }
  }

  async get(q: ChequeBookKeysDto): Promise<ChequeBookPayload> {
    const tx = this.prisma as unknown as Tx;
    await this.require(tx, 'view', VCH.RIGHT_VIEW);
    return this.load(tx, q.companyId, q.chequeBookId);
  }

  /** Upsert: no id opens a book, an id edits one. */
  async save(dto: SaveChequeBookDto): Promise<ChequeBookPayload> {
    const { actor } = this.caller();
    return this.prisma.$transaction(async (tx) => {
      await this.require(
        tx,
        dto.chequeBookId ? 'edit' : 'create',
        dto.chequeBookId ? VCH.RIGHT_EDIT : VCH.RIGHT_CREATE,
      );
      if (dto.leafTo < dto.leafFrom) {
        throwInvalid('The last leaf is before the first', VCH.BOOK_INVALID, 'leafTo');
      }
      const width = dto.leafWidth ?? 6;
      if (String(dto.leafTo).length > width) {
        throwInvalid(
          `Leaf ${dto.leafTo} has more than ${width} digits — widen leafWidth`,
          VCH.BOOK_INVALID,
          'leafWidth',
        );
      }
      const bank = (await loadLedgerFacts(tx, dto.companyId, [dto.bankLedgerId])).get(
        dto.bankLedgerId,
      );
      if (!bank || !isBankLedger(bank) || bank.isDeleted || !bank.isActive) {
        throwInvalid(
          `${bank?.name ?? 'That ledger'} is not a live bank account (Bank Accounts / Bank OD)`,
          VCH.BANK_REQUIRED,
          'bankLedgerId',
        );
      }

      let existing: Awaited<ReturnType<typeof loadChequeBook>> = null;
      if (dto.chequeBookId) {
        await tx.$queryRaw`SELECT 1 FROM accounts.acc_cheque_book WHERE acb_id = ${dto.chequeBookId}::uuid FOR UPDATE`;
        existing = await loadChequeBook(tx, dto.chequeBookId);
        if (!existing || existing.isDeleted || existing.companyId !== dto.companyId) {
          throwMissing(
            `No cheque book ${dto.chequeBookId} for this company`,
            VCH.BOOK_NOT_FOUND,
            'chequeBookId',
          );
        }
        if (existing.status === 'CLOSED') {
          throwState(`Book ${existing.bookNo} is closed`, VCH.BOOK_FINISHED, 'chequeBookId');
        }
        const used = existing.nextLeaf > existing.leafFrom;
        if (
          used &&
          (existing.bankLedgerId !== dto.bankLedgerId || existing.leafFrom !== dto.leafFrom)
        ) {
          throwState(
            `Book ${existing.bookNo} has handed out leaves already — its bank and first leaf are on paper`,
            VCH.BOOK_INVALID,
            existing.bankLedgerId !== dto.bankLedgerId ? 'bankLedgerId' : 'leafFrom',
          );
        }
        if (dto.leafTo < existing.nextLeaf - 1) {
          throwState(
            `Leaves up to ${formatLeaf(existing.nextLeaf - 1, existing.leafWidth)} are already used — the last leaf cannot be below that`,
            VCH.BOOK_INVALID,
            'leafTo',
          );
        }
      }

      // No two live books on one bank share a leaf.
      const [overlap] = await tx.$queryRaw<{ acb_book_no: string }[]>`
        SELECT acb_book_no FROM accounts.acc_cheque_book
         WHERE acb_company_id = ${dto.companyId}::uuid
           AND acb_bank_ledger_id = ${dto.bankLedgerId}::uuid
           AND acb_is_deleted = false AND acb_status <> 'CLOSED'
           AND (${dto.chequeBookId ?? null}::uuid IS NULL OR acb_id <> ${dto.chequeBookId ?? null}::uuid)
           AND acb_leaf_from <= ${dto.leafTo}::bigint AND acb_leaf_to >= ${dto.leafFrom}::bigint
         LIMIT 1`;
      if (overlap) {
        throwState(
          `Leaves ${dto.leafFrom}–${dto.leafTo} overlap book ${overlap.acb_book_no} on ${bank.name}`,
          VCH.BOOK_OVERLAP,
          'leafFrom',
        );
      }

      let id = dto.chequeBookId ?? null;
      try {
        if (!existing) {
          const [row] = await tx.$queryRaw<{ acb_id: string }[]>`
            INSERT INTO accounts.acc_cheque_book (
              acb_company_id, acb_branch_id, acb_bank_ledger_id, acb_book_no, acb_leaf_from, acb_leaf_to,
              acb_next_leaf, acb_leaf_width, acb_format, acb_remarks, acb_created_by
            ) VALUES (
              ${dto.companyId}::uuid, ${dto.branchId ?? null}::uuid, ${dto.bankLedgerId}::uuid, ${dto.bookNo},
              ${dto.leafFrom}::bigint, ${dto.leafTo}::bigint, ${dto.leafFrom}::bigint, ${width}::smallint,
              ${dto.format ?? null}, ${dto.remarks ?? null}, ${actor}
            ) RETURNING acb_id`;
          id = row.acb_id;
        } else {
          // Widening a finished book re-opens it; narrowing to the last used leaf finishes it.
          await tx.$executeRaw`
            UPDATE accounts.acc_cheque_book
               SET acb_branch_id = ${dto.branchId ?? null}::uuid,
                   acb_bank_ledger_id = ${dto.bankLedgerId}::uuid,
                   acb_book_no = ${dto.bookNo},
                   acb_leaf_from = ${dto.leafFrom}::bigint,
                   acb_leaf_to = ${dto.leafTo}::bigint,
                   acb_next_leaf = CASE WHEN acb_next_leaf = acb_leaf_from THEN ${dto.leafFrom}::bigint ELSE acb_next_leaf END,
                   acb_leaf_width = ${width}::smallint,
                   acb_format = ${dto.format ?? null},
                   acb_remarks = ${dto.remarks ?? null},
                   acb_status = CASE WHEN (CASE WHEN acb_next_leaf = acb_leaf_from THEN ${dto.leafFrom}::bigint ELSE acb_next_leaf END) > ${dto.leafTo}::bigint
                                     THEN 'FINISHED' ELSE 'ACTIVE' END,
                   acb_modified_on = now(), acb_modified_by = ${actor}
             WHERE acb_id = ${id}::uuid`;
        }
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          String(e.message).includes('ux_acb_book_no')
        ) {
          throwState(
            `${bank.name} already has a book numbered ${dto.bookNo}`,
            VCH.BOOK_OVERLAP,
            'bookNo',
          );
        }
        throw e;
      }
      return this.load(tx, dto.companyId, id!);
    });
  }

  async close(dto: CloseChequeBookDto): Promise<ChequeBookPayload> {
    const { actor } = this.caller();
    return this.prisma.$transaction(async (tx) => {
      await this.require(tx, 'edit', VCH.RIGHT_EDIT);
      await tx.$queryRaw`SELECT 1 FROM accounts.acc_cheque_book WHERE acb_id = ${dto.chequeBookId}::uuid FOR UPDATE`;
      const book = await loadChequeBook(tx, dto.chequeBookId);
      if (!book || book.isDeleted || book.companyId !== dto.companyId) {
        throwMissing(
          `No cheque book ${dto.chequeBookId} for this company`,
          VCH.BOOK_NOT_FOUND,
          'chequeBookId',
        );
      }
      if (book.status === 'CLOSED') {
        throwState(`Book ${book.bookNo} is already closed`, VCH.BOOK_FINISHED, 'chequeBookId');
      }
      await tx.$executeRaw`
        UPDATE accounts.acc_cheque_book
           SET acb_status = 'CLOSED', acb_closed_on = now(), acb_close_reason = ${dto.reason},
               acb_modified_on = now(), acb_modified_by = ${actor}
         WHERE acb_id = ${dto.chequeBookId}::uuid`;
      return this.load(tx, dto.companyId, dto.chequeBookId);
    });
  }

  private async load(tx: Tx, companyId: string, id: string): Promise<ChequeBookPayload> {
    const book = await loadChequeBook(tx, id);
    if (!book || book.isDeleted || book.companyId !== companyId) {
      throwMissing(`No cheque book ${id} for this company`, VCH.BOOK_NOT_FOUND, 'chequeBookId');
    }
    const [extra] = await tx.$queryRaw<
      { acb_closed_on: Date | null; acb_close_reason: string | null }[]
    >`
      SELECT acb_closed_on, acb_close_reason FROM accounts.acc_cheque_book WHERE acb_id = ${id}::uuid`;
    const leaves = await tx.$queryRaw<
      {
        apd_instrument_no: string;
        apd_id: string;
        apd_acc_year: string;
        led_name: string;
        apd_amount: Prisma.Decimal;
        apd_status: string;
        avh_voucher_refno: string | null;
      }[]
    >`
      SELECT p.apd_instrument_no, p.apd_id, p.apd_acc_year, l.led_name, p.apd_amount, p.apd_status,
             h.avh_voucher_refno
        FROM accounts.acc_pdc_register p
        JOIN accounts.acc_ledger_master l ON l.led_id = p.apd_party_id
        LEFT JOIN accounts.acc_voucher_header h
               ON h.avh_voucher_id = p.apd_voucher_id AND h.avh_acc_year = p.apd_voucher_acc_year
       WHERE p.apd_cheque_book_id = ${id}::uuid AND p.apd_is_deleted = false
       ORDER BY p.apd_instrument_no`;
    const finished = book.nextLeaf > book.leafTo;
    return {
      chequeBookId: book.chequeBookId,
      companyId: book.companyId,
      branchId: book.branchId,
      bankLedgerId: book.bankLedgerId,
      bankName: book.bankName,
      bookNo: book.bookNo,
      leafFrom: formatLeaf(book.leafFrom, book.leafWidth),
      leafTo: formatLeaf(book.leafTo, book.leafWidth),
      nextLeaf: finished ? null : formatLeaf(book.nextLeaf, book.leafWidth),
      left: leavesLeft(book),
      used: book.nextLeaf - book.leafFrom,
      leafWidth: book.leafWidth,
      format: book.format,
      status: book.status,
      closedOn: extra?.acb_closed_on?.toISOString() ?? null,
      closeReason: extra?.acb_close_reason ?? null,
      remarks: book.remarks,
      leaves: leaves.map((r) => ({
        leaf: r.apd_instrument_no,
        apdId: r.apd_id,
        apdAccYear: r.apd_acc_year.trim(),
        partyName: r.led_name,
        amount: Number(new Prisma.Decimal(r.apd_amount).toFixed(2)),
        status: r.apd_status,
        voucherRefno: r.avh_voucher_refno,
      })),
    };
  }
}
