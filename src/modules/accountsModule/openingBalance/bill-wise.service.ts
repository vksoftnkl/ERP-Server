import { Injectable } from '@nestjs/common';
import { assertBooksReconcile } from '../reconcile/books-reconcile.guard';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  isUniqueConstraintError,
  normalizeNullableString,
  throwAccountsBadRequest,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import {
  assertAccYearWritable,
  loadVisibleLedgers,
  staleLaterYears,
  type OpeningWriteClient,
} from './opening-balance.guards';
import {
  isBillFrozen,
  isValidAccYear,
  money,
  settledTotal,
  signedBill,
  signedOpening,
  splitSigned,
  toAmount,
  toDateOnly,
  toDateString,
  ZERO,
} from './opening-balance.utils';
import {
  ListOpeningBillsQueryDto,
  SaveOpeningBillRowDto,
  SaveOpeningBillsDto,
} from './dto/save-opening-bill.dto';
import {
  BillDrCr,
  OPENING_BILL_TYPE,
  OPENING_SRC_DOC_TYPE,
  OPENING_SRC_MODULE,
  OpeningDrCr,
  OpeningSource,
  OpeningStaleReason,
  type OpeningBalanceErrorDetail,
  type OpeningBillRow,
  type OpeningBillsPayload,
  type OpeningBillsSavePayload,
} from './types/opening-balance-api.types';

/**
 * §4.6 / §5.3 — the bill-by-bill breakup.
 *
 * This service OWNS a bill-wise party's opening figure. `POST /bills` writes
 * the bills and recomputes `op_amount / op_dr_cr` from them in the same
 * transaction, which makes the §7.2 tie true by construction rather than by a
 * check that can fail (DECISION 4, answered in the service rather than in a
 * trigger — the write and the recompute are one statement sequence and belong
 * in one place).
 *
 * The other half of that rule lives in OpeningBalanceService: `POST /create`
 * refuses a hand-typed figure on a bill-wise ledger.
 */

const BILL_SELECT = {
  ablId: true,
  ablDocRefno: true,
  ablDocDate: true,
  ablDueDate: true,
  ablCreditDays: true,
  ablGraceDays: true,
  ablDrCr: true,
  ablBillAmount: true,
  ablAllocAmount: true,
  ablDiscAmount: true,
  ablWriteoffAmount: true,
  ablPendingAmount: true,
  ablStatus: true,
  ablNarration: true,
} satisfies Prisma.AccBillBalanceSelect;

type StoredBill = Prisma.AccBillBalanceGetPayload<{ select: typeof BILL_SELECT }>;

@Injectable()
export class BillWiseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // ─── §4.6 GET ──────────────────────────────────────────────────────────────

  async list(query: ListOpeningBillsQueryDto): Promise<OpeningBillsPayload> {
    const accYear = this.requireAccYear(query.accYear);
    const party = await this.requireParty(this.prisma, query.companyId, query.partyId);

    const opening = await this.findOpening(
      this.prisma,
      query.companyId,
      query.branchId,
      accYear,
      query.partyId,
    );

    const bills = opening
      ? await this.prisma.accBillBalance.findMany({
          where: this.billScope(opening.opId, accYear),
          select: BILL_SELECT,
          orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
        })
      : [];

    return this.toPayload(query, party.ledName, opening, bills);
  }

  // ─── §4.6 POST ─────────────────────────────────────────────────────────────

  async save(dto: SaveOpeningBillsDto): Promise<OpeningBillsSavePayload> {
    const accYear = this.requireAccYear(dto.accYear);
    const replace = dto.replace ?? false;
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;

    return this.prisma.$transaction(async (tx) => {
      await assertAccYearWritable(tx, dto.companyId, accYear, 'accYear');

      const party = await this.requireParty(tx, dto.companyId, dto.partyId);
      if (!party.ledIsBillByBill) {
        throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
          {
            field: 'partyId',
            message: `"${party.ledName}" is not a bill-by-bill ledger — open it with a figure on the opening balances screen instead`,
          },
        ]);
      }

      // The opening row every bill is linked to. Created here when the party is
      // being opened for the first time: the breakup panel is where a bill-wise
      // party is opened at all, so it cannot require the row to exist already.
      const opening = await this.resolveOpening(tx, dto, accYear, actor);

      const stored = await tx.accBillBalance.findMany({
        where: this.billScope(opening.opId, accYear),
        select: BILL_SELECT,
      });
      const storedById = new Map(stored.map((bill) => [bill.ablId, bill]));

      this.assertBillsAreWritable(dto.bills, storedById);

      const now = new Date();
      const seen = new Set<string>();
      let created = 0;
      let updated = 0;
      let frozenUnchanged = 0;

      for (const [index, row] of dto.bills.entries()) {
        const existing = row.ablId ? (storedById.get(row.ablId) ?? null) : null;

        if (existing && isBillFrozen(existing)) {
          // §5.5 rule 3 — settled against, so only the dates, the day counts
          // and the narration may move. Everything else would either fail
          // ck_abl_settled or invert a settlement that has already happened.
          await tx.accBillBalance.update({
            where: { ablId_ablAccYear: { ablId: existing.ablId, ablAccYear: accYear } },
            data: {
              ablDueDate:
                row.ablDueDate === undefined ? undefined : this.toNullableDate(row.ablDueDate),
              ablCreditDays: row.ablCreditDays ?? undefined,
              ablGraceDays: row.ablGraceDays ?? undefined,
              ablNarration: normalizeNullableString(row.ablNarration),
              ablModifiedOn: now,
              ablModifiedBy: actor,
            },
          });
          seen.add(existing.ablId);
          frozenUnchanged += 1;
          continue;
        }

        if (existing) {
          await tx.accBillBalance.update({
            where: { ablId_ablAccYear: { ablId: existing.ablId, ablAccYear: accYear } },
            data: {
              ablDocRefno: row.ablDocRefno.trim(),
              ablDocDate: toDateOnly(row.ablDocDate),
              ablDueDate: this.toNullableDate(row.ablDueDate),
              ablCreditDays: row.ablCreditDays ?? 0,
              ablGraceDays: row.ablGraceDays ?? 0,
              ablDrCr: row.ablDrCr,
              ablBillAmount: money(row.ablBillAmount),
              ablNarration: normalizeNullableString(row.ablNarration),
              ablModifiedOn: now,
              ablModifiedBy: actor,
            },
          });
          seen.add(existing.ablId);
          updated += 1;
          continue;
        }

        const inserted = await this.insertBill(tx, index, {
          data: {
            ablCompanyId: dto.companyId,
            ablBranchId: dto.branchId,
            ablTenantId: dto.tenantId ?? null,
            ablAccYear: accYear,
            ablPartyId: dto.partyId,
            ablBillType: OPENING_BILL_TYPE,
            // ck_abl_voucher FORCES both of these to be NULL on an OPENING
            // bill. Nothing is posted to acc_vouchers for an opening (§5.4),
            // and the constraint is the schema saying so.
            ablVoucherId: null,
            ablVoucherTypeId: null,
            // The link that makes the §7.2 tie a keyed lookup instead of a
            // join on (company, year, party) that would also sweep up this
            // party's SALES bills of the same year.
            ablSrcModule: OPENING_SRC_MODULE,
            ablSrcDocType: OPENING_SRC_DOC_TYPE,
            ablSrcDocId: opening.opId,
            ablSrcAccYear: accYear,
            // A typed opening bill has no predecessor. Carry-forward sets this
            // (§5.2 step 4); this endpoint never does.
            ablParentBillId: null,
            ablParentAccYear: null,
            ablDocRefno: row.ablDocRefno.trim(),
            ablDocDate: toDateOnly(row.ablDocDate),
            ablDueDate: this.toNullableDate(row.ablDueDate),
            ablCreditDays: row.ablCreditDays ?? 0,
            ablGraceDays: row.ablGraceDays ?? 0,
            ablDrCr: row.ablDrCr,
            ablBillAmount: money(row.ablBillAmount),
            ablNarration: normalizeNullableString(row.ablNarration) ?? null,
            ablCreatedOn: now,
            ablCreatedBy: actor,
          },
          select: { ablId: true },
        });
        seen.add(inserted.ablId);
        created += 1;
      }

      const deleted = replace
        ? await this.deleteAbsentBills(tx, stored, seen, accYear, actor, now)
        : 0;

      // §5.5 rule 2 — the bills have moved, so the party's figure moves with
      // them, in this same transaction. Nothing else may write it.
      const after = await tx.accBillBalance.findMany({
        where: this.billScope(opening.opId, accYear),
        select: BILL_SELECT,
        orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
      });
      await this.syncOpeningFromBills(tx, opening.opId, accYear, after, actor, now);

      const staledAccYears = await staleLaterYears(tx, {
        companyId: dto.companyId,
        branchId: dto.branchId,
        accYear,
        reason: OpeningStaleReason.SOURCE_OPENING_EDITED,
        refId: opening.opId,
      });

      // The trial check (notes 47), after every write: the party's opening
      // must still net its opening bills (and everything else it holds).
      await assertBooksReconcile(tx, {
        companyId: dto.companyId,
        accYear,
        ledgerIds: [dto.partyId],
      });

      const refreshed = await tx.accOpeningBalance.findFirst({
        where: { opId: opening.opId, opAccYear: accYear },
        select: { opId: true, opAmount: true, opDrCr: true, opIsDeleted: true },
      });

      return {
        ...this.toPayload(
          { ...dto, accYear },
          party.ledName,
          refreshed && !refreshed.opIsDeleted ? refreshed : null,
          after,
        ),
        created,
        updated,
        deleted,
        frozenUnchanged,
        staledAccYears,
      };
    });
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /**
   * The party's figure, rewritten from its bills. The sum is signed (DR
   * positive) and split back into the positive amount plus the one-character
   * side that `ck_op_amount` and `ck_op_dr_cr` will accept.
   *
   * A party whose bills all net to zero has its opening soft deleted rather
   * than stored as a zero — absence is the zero here too (§5.1 rule 4).
   */
  private async syncOpeningFromBills(
    client: OpeningWriteClient,
    opId: string,
    accYear: string,
    bills: readonly StoredBill[],
    actor: string,
    now: Date,
  ): Promise<void> {
    let signed = ZERO;
    for (const bill of bills) {
      signed = signed.plus(signedBill(bill.ablBillAmount, bill.ablDrCr));
    }
    const total = money(signed);

    if (total.isZero()) {
      await client.accOpeningBalance.update({
        where: { opId_opAccYear: { opId, opAccYear: accYear } },
        data: { opIsDeleted: true, opModifiedAt: now, opModifiedBy: actor },
      });
      return;
    }

    const split = splitSigned(total);
    await client.accOpeningBalance.update({
      where: { opId_opAccYear: { opId, opAccYear: accYear } },
      data: {
        opAmount: split.amount,
        opDrCr: split.drCr,
        opIsDeleted: false,
        opModifiedAt: now,
        opModifiedBy: actor,
      },
    });
  }

  /**
   * The opening row the bills hang off. `opId` is checked rather than trusted:
   * `abl_src_doc_id` is deliberately un-FK'd (it points at many tables), so an
   * id naming another party's opening — or a deleted one — would otherwise be
   * accepted and silently corrupt that party's figure instead.
   */
  private async resolveOpening(
    client: OpeningWriteClient,
    dto: SaveOpeningBillsDto,
    accYear: string,
    actor: string,
  ): Promise<{ opId: string }> {
    if (dto.opId) {
      const named = await client.accOpeningBalance.findFirst({
        where: { opId: dto.opId, opAccYear: accYear, opIsDeleted: false },
        select: { opId: true, opCompanyId: true, opBranchId: true, opLedgerId: true },
      });

      if (
        !named ||
        named.opCompanyId !== dto.companyId ||
        named.opLedgerId !== dto.partyId ||
        named.opBranchId !== dto.branchId
      ) {
        throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
          {
            field: 'opId',
            message: `opId ${dto.opId} is not this party's opening for ${accYear} at this branch`,
          },
        ]);
      }
      return { opId: named.opId };
    }

    const existing = await this.findOpening(
      client,
      dto.companyId,
      dto.branchId,
      accYear,
      dto.partyId,
    );
    if (existing) {
      return { opId: existing.opId };
    }

    // First save for this party. The figure is written by syncOpeningFromBills
    // a moment later in this same transaction; zero is a legal opening amount
    // (ck_op_amount is >= 0), so nothing has to be invented to get the row in.
    const created = await client.accOpeningBalance.create({
      data: {
        opCompanyId: dto.companyId,
        opBranchId: dto.branchId,
        opAccYear: accYear,
        opTenantId: dto.tenantId ?? null,
        opLedgerId: dto.partyId,
        opAmount: new Prisma.Decimal(0),
        opDrCr: OpeningDrCr.DEBIT,
        opSource: OpeningSource.MANUAL,
        opCreatedAt: new Date(),
        opCreatedBy: actor,
      },
      select: { opId: true },
    });
    return { opId: created.opId };
  }

  private findOpening(
    client: OpeningWriteClient,
    companyId: string,
    branchId: string,
    accYear: string,
    partyId: string,
  ) {
    return client.accOpeningBalance.findFirst({
      where: {
        opCompanyId: companyId,
        opBranchId: branchId,
        opAccYear: accYear,
        opLedgerId: partyId,
        opIsDeleted: false,
      },
      select: { opId: true, opAmount: true, opDrCr: true },
    });
  }

  private billScope(opId: string, accYear: string): Prisma.AccBillBalanceWhereInput {
    return {
      ablSrcDocType: OPENING_SRC_DOC_TYPE,
      ablSrcDocId: opId,
      ablAccYear: accYear,
      ablIsDeleted: false,
    };
  }

  /**
   * Everything wrong with the array, reported at once. The frozen-bill rules
   * are here rather than beside the write because an operator needs to see
   * every refusal before deciding what to change.
   */
  private assertBillsAreWritable(
    rows: readonly SaveOpeningBillRowDto[],
    storedById: ReadonlyMap<string, StoredBill>,
  ): void {
    const errors: OpeningBalanceErrorDetail[] = [];
    const seenRefnos = new Map<string, number>();

    for (const [index, row] of rows.entries()) {
      const refno = row.ablDocRefno.trim();
      if (refno.length === 0) {
        errors.push({
          field: `bills.${index}.ablDocRefno`,
          message: 'A bill reference is required — it is the original invoice number',
        });
      }

      const firstIndex = seenRefnos.get(refno.toUpperCase());
      if (firstIndex !== undefined) {
        // ux_abl_doc_refno would refuse the second one with a constraint name.
        errors.push({
          field: `bills.${index}.ablDocRefno`,
          message: `"${refno}" appears twice in this breakup (rows ${firstIndex} and ${index}) — one bill per reference per year`,
        });
      } else {
        seenRefnos.set(refno.toUpperCase(), index);
      }

      if (!(row.ablBillAmount > 0)) {
        // ck_abl_amount is strictly greater than zero: a zero bill is not a
        // bill, and a negative one is a side, not an amount.
        errors.push({
          field: `bills.${index}.ablBillAmount`,
          message: 'A bill amount must be greater than zero — put the side in ablDrCr',
        });
      }

      if (row.ablDueDate && row.ablDueDate < row.ablDocDate) {
        errors.push({
          field: `bills.${index}.ablDueDate`,
          message: `Due date ${row.ablDueDate} is before the bill date ${row.ablDocDate}`,
        });
      }

      if (!row.ablId) {
        continue;
      }

      const existing = storedById.get(row.ablId);
      if (!existing) {
        errors.push({
          field: `bills.${index}.ablId`,
          message: `Bill ${row.ablId} is not an opening bill of this party for this year`,
        });
        continue;
      }

      if (!isBillFrozen(existing)) {
        continue;
      }

      // §5.5 rule 3. This freezes ONE bill, not the party and not the screen —
      // every other row saves as normal and this one rides along unchanged.
      const settled = settledTotal(existing);
      const amountChanged = !money(row.ablBillAmount).equals(money(existing.ablBillAmount));
      const sideChanged = (row.ablDrCr as string) !== existing.ablDrCr;
      const refnoChanged = refno !== existing.ablDocRefno;
      const dateChanged = row.ablDocDate !== toDateString(existing.ablDocDate);

      if (amountChanged || sideChanged || refnoChanged || dateChanged) {
        errors.push({
          field: `bills.${index}.ablBillAmount`,
          message:
            `"${existing.ablDocRefno}" has ${settled.toFixed(2)} settled against it, so its amount, side, ` +
            'reference and date are fixed. Either add a correcting opening bill for the difference, ' +
            'or reverse the allocation in the receipt screen first and then edit this one.',
        });
      }
    }

    if (errors.length > 0) {
      throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', errors);
    }
  }

  /**
   * One insert, with ux_abl_doc_refno turned back into a message.
   *
   * A bill sent WITHOUT an ablId is an insert, so re-sending a grid the screen
   * loaded without echoing the ids back lands here — and the index refuses it
   * with a constraint name that means nothing to an operator. This says which
   * reference clashed instead.
   */
  private async insertBill(
    client: OpeningWriteClient,
    index: number,
    args: { data: Prisma.AccBillBalanceUncheckedCreateInput; select: { ablId: true } },
  ): Promise<{ ablId: string }> {
    try {
      return await client.accBillBalance.create(args);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
          {
            field: `bills.${index}.ablDocRefno`,
            message:
              `"${args.data.ablDocRefno}" is already an opening bill of this party for this year. ` +
              'Send its ablId to update it, or use a different reference.',
          },
        ]);
      }
      throw error;
    }
  }

  /**
   * `replace: true` soft deletes the bills the array left out — except the
   * frozen ones, whose removal would leave acc_bill_adjustment pointing at a
   * bill that is gone.
   */
  private async deleteAbsentBills(
    client: OpeningWriteClient,
    stored: readonly StoredBill[],
    seen: ReadonlySet<string>,
    accYear: string,
    actor: string,
    now: Date,
  ): Promise<number> {
    const absent = stored.filter((bill) => !seen.has(bill.ablId));
    const frozen = absent.filter((bill) => isBillFrozen(bill));

    if (frozen.length > 0) {
      throwAccountsBadRequest<OpeningBalanceErrorDetail>(
        'Validation failed',
        frozen.map((bill) => ({
          field: 'bills',
          message:
            `"${bill.ablDocRefno}" has ${settledTotal(bill).toFixed(2)} settled against it and cannot be ` +
            'removed from the breakup. Reverse the allocation in the receipt screen first.',
        })),
      );
    }

    const deletable = absent.map((bill) => bill.ablId);
    if (deletable.length === 0) {
      return 0;
    }

    await client.accBillBalance.updateMany({
      where: { ablId: { in: deletable }, ablAccYear: accYear },
      data: { ablIsDeleted: true, ablModifiedOn: now, ablModifiedBy: actor },
    });
    return deletable.length;
  }

  private async requireParty(
    client: OpeningWriteClient,
    companyId: string,
    partyId: string,
  ): Promise<{ ledName: string; ledIsBillByBill: boolean }> {
    const ledgers = await loadVisibleLedgers(client, companyId);
    const party = ledgers.get(partyId);
    if (!party) {
      throwAccountsNotFound<OpeningBalanceErrorDetail>(
        'Party not found',
        'partyId',
        `Ledger ${partyId} does not exist or does not belong to this company`,
      );
    }
    return { ledName: party.ledName, ledIsBillByBill: party.ledIsBillByBill };
  }

  private toPayload(
    scope: { companyId: string; branchId: string; accYear: string; partyId: string },
    partyName: string,
    opening: { opId: string; opAmount: Prisma.Decimal; opDrCr: string } | null,
    bills: readonly StoredBill[],
  ): OpeningBillsPayload {
    let signed = ZERO;
    for (const bill of bills) {
      signed = signed.plus(signedBill(bill.ablBillAmount, bill.ablDrCr));
    }
    const billTotal = money(signed);
    const billSplit = billTotal.isZero() ? null : splitSigned(billTotal);
    // Both totals brought onto the same signed scale before comparing — the
    // opening's flag is one character and the bills' is two.
    const openingSigned = opening ? money(signedOpening(opening.opAmount, opening.opDrCr)) : ZERO;

    return {
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: scope.accYear,
      partyId: scope.partyId,
      partyName,
      opId: opening?.opId ?? null,
      bills: bills.map((bill) => this.toBillRow(bill)),
      billTotalAmount: toAmount(billSplit?.amount ?? ZERO),
      billTotalDrCr: billSplit?.drCr ?? null,
      openingAmount: toAmount(opening?.opAmount ?? ZERO),
      openingDrCr: (opening?.opDrCr as OpeningDrCr | undefined) ?? null,
      isTied: billTotal.equals(openingSigned),
    };
  }

  private toBillRow(bill: StoredBill): OpeningBillRow {
    return {
      ablId: bill.ablId,
      ablDocRefno: bill.ablDocRefno,
      ablDocDate: toDateString(bill.ablDocDate) ?? '',
      ablDueDate: toDateString(bill.ablDueDate),
      ablCreditDays: bill.ablCreditDays,
      ablGraceDays: bill.ablGraceDays,
      ablDrCr: bill.ablDrCr as BillDrCr,
      ablBillAmount: toAmount(bill.ablBillAmount),
      ablAllocAmount: toAmount(bill.ablAllocAmount),
      ablDiscAmount: toAmount(bill.ablDiscAmount),
      ablWriteoffAmount: toAmount(bill.ablWriteoffAmount),
      ablPendingAmount: toAmount(bill.ablPendingAmount),
      ablStatus: bill.ablStatus,
      ablNarration: bill.ablNarration,
      isFrozen: isBillFrozen(bill),
    };
  }

  private toNullableDate(value: string | null | undefined): Date | null {
    return value ? toDateOnly(value) : null;
  }

  private requireAccYear(accYear: string): string {
    const trimmed = accYear.trim();
    if (!isValidAccYear(trimmed)) {
      throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
        {
          field: 'accYear',
          message: `"${accYear}" is not an accounting year — expected YYYY-YYYY with the second half one greater than the first`,
        },
      ]);
    }
    return trimmed;
  }
}
