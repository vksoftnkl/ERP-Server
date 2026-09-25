import { Injectable } from '@nestjs/common';
import { assertBooksReconcile } from '../reconcile/books-reconcile.guard';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  isForeignKeyConstraintError,
  normalizeNullableString,
  throwAccountsBadRequest,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import { resolveOpeningDifferenceLedger } from './ledger-roles';
import {
  assertAccYearWritable,
  countBillsByOpening,
  isBalanceSheetNature,
  loadVisibleLedgers,
  staleLaterYears,
  type OpeningWriteClient,
  type VisibleLedger,
} from './opening-balance.guards';
import {
  isValidAccYear,
  money,
  previousAccYear,
  signedOpening,
  splitSigned,
  toAmount,
  toIsoString,
  toNullableAmount,
  ZERO,
} from './opening-balance.utils';
import { SaveOpeningBalanceDto, SaveOpeningBalanceRowDto } from './dto/save-opening-balance.dto';
import { ListOpeningBalanceQueryDto } from './dto/list-opening-balance-query.dto';
import {
  OpeningDrCr,
  OpeningSource,
  OpeningStaleReason,
  type OpeningBalanceDeletePayload,
  type OpeningBalanceErrorDetail,
  type OpeningBalanceListPayload,
  type OpeningBalanceRow,
  type OpeningBalanceSavePayload,
  type RetainedRow,
  type TrialBalancePayload,
  type UnclassifiedLedger,
} from './types/opening-balance-api.types';

/**
 * §5.1 — the CRUD half of the module: list, save, trial balance, delete.
 *
 * Carry-forward lives in its own service because it is a batch job, and the
 * bill-wise breakup lives in its own because it OWNS the figure of any party
 * that has one (§5.5 rule 2) — this service only echoes that figure back.
 */

const OPENING_ROW_SELECT = {
  opId: true,
  opLedgerId: true,
  opAmount: true,
  opDrCr: true,
  opSource: true,
  opIsStale: true,
  opStaleSince: true,
  opStaleReason: true,
  opRemarks: true,
} satisfies Prisma.AccOpeningBalanceSelect;

type StoredOpening = Prisma.AccOpeningBalanceGetPayload<{ select: typeof OPENING_ROW_SELECT }>;

@Injectable()
export class OpeningBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // ─── §4.1 list ─────────────────────────────────────────────────────────────

  /**
   * Every balance-sheet ledger the company can see, with its opening if it has
   * one. **No paging** (§8 rule 1): the screen computes a trial balance over
   * the whole set, and a capped list is a wrong trial balance, not a slow one.
   */
  async list(query: ListOpeningBalanceQueryDto): Promise<OpeningBalanceListPayload> {
    const accYear = this.requireAccYear(query.accYear, 'accYear');
    const branchId = query.branchId ?? null;
    const includeZero = query.includeZero ?? true;

    const ledgers = await loadVisibleLedgers(this.prisma, query.companyId);

    const [openings, priorOpenings, difference] = await Promise.all([
      this.prisma.accOpeningBalance.findMany({
        where: this.scopeWhere(query.companyId, branchId, accYear),
        select: OPENING_ROW_SELECT,
      }),
      // Last year's closing, so the screen can show it beside this year's
      // opening. Derived the same way carry-forward derives it (§5.2 step 1) —
      // one source of truth for "what was this worth at the year end".
      this.closingByLedger(this.prisma, query.companyId, branchId, previousAccYear(accYear)),
      resolveOpeningDifferenceLedger(this.prisma, query.companyId, branchId),
    ]);

    const openingByLedger = new Map(openings.map((row) => [row.opLedgerId, row]));
    const billCounts = await countBillsByOpening(
      this.prisma,
      accYear,
      openings.map((row) => row.opId),
    );

    const rows: OpeningBalanceRow[] = [];
    const unclassified: UnclassifiedLedger[] = [];

    for (const ledger of ledgers.values()) {
      if (ledger.groupNature === null) {
        // Reported, never dropped and never defaulted to Assets (§12). The
        // list empties once the chart of accounts is fixed.
        unclassified.push({
          ledId: ledger.ledId,
          ledName: ledger.ledName,
          groupName: ledger.groupName,
        });
        continue;
      }
      if (!isBalanceSheetNature(ledger.groupNature)) {
        // P&L ledgers always start at zero — they net into the year's result
        // instead (§5.2 step 3), so they are not part of this screen at all.
        continue;
      }

      const opening = openingByLedger.get(ledger.ledId) ?? null;
      const prior = priorOpenings.get(ledger.ledId) ?? null;

      // Defaults to the whole chart. An empty list is the dangerous answer
      // here: 0 = 0 balances, so a screen showing nothing looks exactly like a
      // company whose books are in order, and the first thing this screen is
      // ever used for is a company where every ledger is still empty.
      if (includeZero === false && opening === null && prior === null) {
        continue;
      }

      rows.push(this.toRow(ledger, opening, prior, billCounts.get(opening?.opId ?? '') ?? 0));
    }

    return {
      opCompanyId: query.companyId,
      opBranchId: branchId,
      opAccYear: accYear,
      rows,
      unclassified,
      trialBalance: this.summarise(openings, ledgers, difference),
    };
  }

  // ─── §4.3 trial balance ────────────────────────────────────────────────────

  /**
   * Its own endpoint rather than a field on the list: the screen shows it
   * permanently and recomputes as the operator types, and the save path checks
   * it server-side too (§7.1) so it never has to trust the screen's arithmetic.
   */
  async trialBalance(query: ListOpeningBalanceQueryDto): Promise<TrialBalancePayload> {
    const accYear = this.requireAccYear(query.accYear, 'accYear');
    const branchId = query.branchId ?? null;

    const [ledgers, openings, difference] = await Promise.all([
      loadVisibleLedgers(this.prisma, query.companyId),
      this.prisma.accOpeningBalance.findMany({
        where: this.scopeWhere(query.companyId, branchId, accYear),
        select: OPENING_ROW_SELECT,
      }),
      resolveOpeningDifferenceLedger(this.prisma, query.companyId, branchId),
    ]);

    return this.summarise(openings, ledgers, difference);
  }

  // ─── §4.2 save ─────────────────────────────────────────────────────────────

  /**
   * The whole set for one company-year, in one transaction. This is also the
   * edit endpoint — there is no other (§5.5), so the four rules that a plain
   * upsert would get wrong are enforced here.
   */
  async save(dto: SaveOpeningBalanceDto): Promise<OpeningBalanceSavePayload> {
    const accYear = this.requireAccYear(dto.opAccYear, 'opAccYear');
    const branchId = dto.opBranchId ?? null;
    const replace = dto.replace ?? false;
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;

    return this.prisma.$transaction(async (tx) => {
      await assertAccYearWritable(tx, dto.opCompanyId, accYear, 'opAccYear');

      const ledgers = await loadVisibleLedgers(tx, dto.opCompanyId);
      this.assertRowsAreWritable(dto.rows, ledgers);

      const stored = await tx.accOpeningBalance.findMany({
        where: this.scopeWhere(dto.opCompanyId, branchId, accYear),
        select: OPENING_ROW_SELECT,
      });
      const storedByLedger = new Map(stored.map((row) => [row.opLedgerId, row]));

      // A bill-wise party's figure is owned by its bills, so `create` may only
      // echo it back. Checked against what is stored, before anything is
      // written (§5.5 rule 2).
      await this.assertBillWiseRowsOnlyEcho(tx, dto.rows, ledgers, storedByLedger, accYear);

      const now = new Date();
      const seen = new Set<string>();
      const flippedToManual: string[] = [];
      // The ledgers whose figure this save actually moved — what the trial
      // check looks at. A row echoed back unchanged is not this save's doing.
      const moved = new Set<string>();
      let created = 0;
      let updated = 0;
      let skippedZero = 0;

      for (const row of dto.rows) {
        const existing = storedByLedger.get(row.opLedgerId) ?? null;
        const amount = money(row.opAmount);
        if (
          existing
            ? !existing.opAmount.equals(amount) || existing.opDrCr !== String(row.opDrCr)
            : !amount.isZero()
        ) {
          moved.add(row.opLedgerId);
        }

        if (amount.isZero()) {
          // Absence IS the zero. Writing a zero row would make ux_op_scope
          // meaningless and the list would show a figure where there is none.
          skippedZero += 1;
          if (existing) {
            await tx.accOpeningBalance.update({
              where: { opId_opAccYear: { opId: existing.opId, opAccYear: accYear } },
              data: { opIsDeleted: true, opModifiedAt: now, opModifiedBy: actor },
            });
          }
          continue;
        }

        seen.add(row.opLedgerId);
        const source = this.resolveSource(existing, row, amount, flippedToManual);

        if (existing) {
          await tx.accOpeningBalance.update({
            where: { opId_opAccYear: { opId: existing.opId, opAccYear: accYear } },
            data: {
              opAmount: amount,
              opDrCr: row.opDrCr,
              opSource: source,
              opRemarks: normalizeNullableString(row.opRemarks),
              opTenantId: dto.opTenantId ?? undefined,
              opModifiedAt: now,
              opModifiedBy: actor,
            },
          });
          updated += 1;
          continue;
        }

        await this.createOpening(tx, {
          companyId: dto.opCompanyId,
          branchId,
          accYear,
          tenantId: dto.opTenantId ?? null,
          ledgerId: row.opLedgerId,
          amount,
          drCr: row.opDrCr,
          source,
          // undefined means "the key was omitted", which on an INSERT is just
          // null. On the UPDATE path above it is passed through untouched, so
          // an omitted key leaves the stored remark alone (§8 rule 4).
          remarks: normalizeNullableString(row.opRemarks) ?? null,
          actor,
          now,
        });
        created += 1;
      }

      const { deleted, retainedWithBills } = replace
        ? await this.deleteAbsentRows(tx, stored, seen, ledgers, accYear, actor, now)
        : { deleted: 0, retainedWithBills: [] as RetainedRow[] };

      // §5.5 rule 4 — this write moved this year's closing, so every later
      // year's generated openings are now derived from a figure that is gone.
      //
      // Only when something actually changed: a screen that loads the set and
      // saves it back untouched has moved nothing, and staling a later year
      // over it would cry wolf on every visit.
      const wroteSomething = created > 0 || updated > 0 || deleted > 0;
      const staledAccYears = wroteSomething
        ? await staleLaterYears(tx, {
            companyId: dto.opCompanyId,
            branchId,
            accYear,
            reason: OpeningStaleReason.SOURCE_OPENING_EDITED,
            refId: null,
          })
        : [];

      // The trial check (notes 47), after every write — on the ledgers this
      // save moved. Only the bill-by-bill ones among them are checked; a
      // running-balance ledger has no bills to disagree with.
      await assertBooksReconcile(tx, {
        companyId: dto.opCompanyId,
        accYear,
        ledgerIds: [...moved],
      });

      const [after, difference] = await Promise.all([
        tx.accOpeningBalance.findMany({
          where: this.scopeWhere(dto.opCompanyId, branchId, accYear),
          select: OPENING_ROW_SELECT,
        }),
        resolveOpeningDifferenceLedger(tx, dto.opCompanyId, branchId),
      ]);

      return {
        opCompanyId: dto.opCompanyId,
        opBranchId: branchId,
        opAccYear: accYear,
        created,
        updated,
        skippedZero,
        deleted,
        retainedWithBills,
        flippedToManual,
        // DECISION 3, as recommended: an unbalanced set is REPORTED, not
        // refused. Refusing server-side blocks an operator halfway through
        // typing two hundred ledgers, which is every operator, every time.
        trialBalance: this.summarise(after, ledgers, difference),
        staledAccYears,
      };
    });
  }

  // ─── §4.4 delete ───────────────────────────────────────────────────────────

  async softDelete(opId: string, accYear: string): Promise<OpeningBalanceDeletePayload> {
    const year = this.requireAccYear(accYear, 'accYear');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accOpeningBalance.findFirst({
        where: { opId, opAccYear: year, opIsDeleted: false },
        select: { opId: true, opCompanyId: true, opBranchId: true, opLedgerId: true },
      });

      if (!existing) {
        throwAccountsNotFound<OpeningBalanceErrorDetail>(
          'Opening balance not found',
          'opId',
          `No live opening balance ${opId} in ${year}`,
        );
      }

      await assertAccYearWritable(tx, existing.opCompanyId, year, 'accYear');

      // Refused while OPENING bills still point at it: deleting the opening
      // would leave the bills orphaned against an abl_src_doc_id that is
      // deliberately un-FK'd, so nothing else would catch it.
      const billCounts = await countBillsByOpening(tx, year, [existing.opId]);
      const billCount = billCounts.get(existing.opId) ?? 0;
      if (billCount > 0) {
        throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
          {
            field: 'opId',
            message: `This opening still has ${billCount} opening bill(s). Delete the bills first.`,
          },
        ]);
      }

      await tx.accOpeningBalance.update({
        where: { opId_opAccYear: { opId: existing.opId, opAccYear: year } },
        data: {
          opIsDeleted: true,
          opModifiedAt: new Date(),
          opModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });

      await staleLaterYears(tx, {
        companyId: existing.opCompanyId,
        branchId: existing.opBranchId,
        accYear: year,
        reason: OpeningStaleReason.SOURCE_OPENING_EDITED,
        refId: null,
      });

      // The trial check (notes 47), after every write.
      await assertBooksReconcile(tx, {
        companyId: existing.opCompanyId,
        accYear: year,
        ledgerIds: [existing.opLedgerId],
      });

      return { opId: existing.opId, opAccYear: year, deleted: true as const };
    });
  }

  // ─── Shared internals ──────────────────────────────────────────────────────

  /**
   * The closing balance per ledger for a year: its opening plus every POSTED
   * voucher movement. Used by the list to show last year's closing and by
   * carry-forward to derive next year's opening — one definition, so the two
   * can never disagree.
   *
   * Only POSTED. `ck_avh_balanced` requires debit = credit only AT posting, so
   * an APPROVED voucher may be unbalanced and a closing built from one would be
   * wrong. Never from `led_total_*`, which is stamped and derived from nothing.
   */
  async closingByLedger(
    client: OpeningWriteClient,
    companyId: string,
    branchId: string | null,
    accYear: string,
  ): Promise<Map<string, { amount: Prisma.Decimal; drCr: OpeningDrCr }>> {
    if (!isValidAccYear(accYear)) {
      return new Map();
    }

    const [openings, movements] = await Promise.all([
      client.accOpeningBalance.findMany({
        where: this.scopeWhere(companyId, branchId, accYear),
        select: { opLedgerId: true, opAmount: true, opDrCr: true },
      }),
      client.$queryRaw<Array<{ led_id: string; signed: Prisma.Decimal | null }>>`
        SELECT v.av_ledger_id AS led_id,
               SUM(v.av_signed_amount) AS signed
          FROM accounts.acc_vouchers v
          JOIN accounts.acc_voucher_header h
            ON h.avh_voucher_id = v.av_voucher_id
           AND h.avh_acc_year   = v.av_acc_year
         WHERE v.av_company_id = ${companyId}::uuid
           AND v.av_acc_year   = ${accYear}
           AND v.av_is_deleted = false
           AND h.avh_voucher_status = 'POSTED'
           AND (${branchId}::uuid IS NULL OR v.av_branch_id = ${branchId}::uuid)
         GROUP BY v.av_ledger_id
      `,
    ]);

    const signedByLedger = new Map<string, Prisma.Decimal>();
    for (const opening of openings) {
      signedByLedger.set(opening.opLedgerId, signedOpening(opening.opAmount, opening.opDrCr));
    }
    for (const movement of movements) {
      const current = signedByLedger.get(movement.led_id) ?? ZERO;
      signedByLedger.set(movement.led_id, current.plus(movement.signed ?? ZERO));
    }

    const closings = new Map<string, { amount: Prisma.Decimal; drCr: OpeningDrCr }>();
    for (const [ledgerId, signed] of signedByLedger) {
      const rounded = money(signed);
      if (rounded.isZero()) {
        continue;
      }
      closings.set(ledgerId, splitSigned(rounded));
    }
    return closings;
  }

  /** The live rows for one company / branch-or-company-level / year. */
  private scopeWhere(
    companyId: string,
    branchId: string | null,
    accYear: string,
  ): Prisma.AccOpeningBalanceWhereInput {
    return {
      opCompanyId: companyId,
      opAccYear: accYear,
      // Null must mean "the company-level set", not "any branch". Prisma's
      // `equals: null` is the explicit IS NULL that a bare null would not be.
      opBranchId: branchId === null ? { equals: null } : branchId,
      opIsDeleted: false,
    };
  }

  private toRow(
    ledger: VisibleLedger,
    opening: StoredOpening | null,
    prior: { amount: Prisma.Decimal; drCr: OpeningDrCr } | null,
    billCount: number,
  ): OpeningBalanceRow {
    return {
      opId: opening?.opId ?? null,
      ledId: ledger.ledId,
      ledName: ledger.ledName,
      groupName: ledger.groupName,
      groupNature: ledger.groupNature,
      ledIsBillByBill: ledger.ledIsBillByBill,
      opAmount: toAmount(opening?.opAmount),
      opDrCr: (opening?.opDrCr as OpeningDrCr | undefined) ?? null,
      opSource: (opening?.opSource as OpeningSource | undefined) ?? null,
      opIsStale: opening?.opIsStale ?? false,
      opStaleSince: toIsoString(opening?.opStaleSince),
      opStaleReason: (opening?.opStaleReason as OpeningBalanceRow['opStaleReason']) ?? null,
      opRemarks: opening?.opRemarks ?? null,
      priorClosingAmount: toNullableAmount(prior?.amount ?? null),
      priorClosingDrCr: prior?.drCr ?? null,
      billCount,
    };
  }

  /**
   * §7.1. Debit total against credit total for the set.
   *
   * Ledgers under a NULL-nature group are counted but NOT totalled: their
   * figure is real, but which side of the balance sheet it belongs on is
   * unknown, and guessing would produce a trial balance that balances by
   * accident.
   */
  private summarise(
    openings: readonly StoredOpening[],
    ledgers: ReadonlyMap<string, VisibleLedger>,
    difference: { ledgerId: string; ledgerName: string } | null,
  ): TrialBalancePayload {
    let totalDebit = ZERO;
    let totalCredit = ZERO;
    let unmappedCount = 0;

    for (const opening of openings) {
      const ledger = ledgers.get(opening.opLedgerId);
      if (!ledger || ledger.groupNature === null) {
        unmappedCount += 1;
        continue;
      }
      if (opening.opDrCr === (OpeningDrCr.DEBIT as string)) {
        totalDebit = totalDebit.plus(opening.opAmount);
      } else {
        totalCredit = totalCredit.plus(opening.opAmount);
      }
    }

    const debit = money(totalDebit);
    const credit = money(totalCredit);
    const diff = money(debit.minus(credit));

    return {
      totalDebit: toAmount(debit),
      totalCredit: toAmount(credit),
      difference: toAmount(diff),
      isBalanced: diff.isZero(),
      unmappedCount,
      differenceLedgerId: difference?.ledgerId ?? null,
      differenceLedgerName: difference?.ledgerName ?? null,
    };
  }

  private requireAccYear(accYear: string, field: string): string {
    const trimmed = accYear.trim();
    if (!isValidAccYear(trimmed)) {
      throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
        {
          field,
          message: `"${accYear}" is not an accounting year — expected YYYY-YYYY with the second half one greater than the first`,
        },
      ]);
    }
    return trimmed;
  }

  /**
   * §5.1 rules 1–3, reported together rather than one round-trip at a time: an
   * operator fixing a two-hundred-line screen should see every problem at once.
   */
  private assertRowsAreWritable(
    rows: readonly SaveOpeningBalanceRowDto[],
    ledgers: ReadonlyMap<string, VisibleLedger>,
  ): void {
    const errors: OpeningBalanceErrorDetail[] = [];
    const seenLedgers = new Map<string, number>();

    for (const [index, row] of rows.entries()) {
      const ledger = ledgers.get(row.opLedgerId);

      if (!ledger) {
        // fk_op_ledger would refuse a ledger that does not exist, and nothing
        // at all would refuse another company's. Both land here, as a message.
        errors.push({
          field: `rows.${index}.opLedgerId`,
          message: `Ledger ${row.opLedgerId} does not exist or does not belong to this company`,
        });
        continue;
      }

      const firstIndex = seenLedgers.get(row.opLedgerId);
      if (firstIndex !== undefined) {
        // ux_op_scope would refuse the second write with a constraint name.
        errors.push({
          field: `rows.${index}.opLedgerId`,
          message: `"${ledger.ledName}" appears twice in this set (rows ${firstIndex} and ${index}) — one opening per ledger per year`,
        });
        continue;
      }
      seenLedgers.set(row.opLedgerId, index);

      if (row.opAmount < 0) {
        errors.push({
          field: `rows.${index}.opAmount`,
          message: `Opening amount cannot be negative for "${ledger.ledName}" — send a positive amount and put the side in opDrCr`,
        });
      }

      // A zero-amount row writes nothing (rule 4), so which side of the balance
      // sheet its ledger belongs on cannot matter. Checking it anyway would
      // refuse a save whose only sin is echoing back a ledger the operator
      // left empty — which is most of the chart, on most saves.
      if (row.opAmount === 0) {
        continue;
      }

      if (ledger.groupNature === null) {
        errors.push({
          field: `rows.${index}.opLedgerId`,
          message: `"${ledger.ledName}" is under a group with no nature — classify the group before opening it`,
        });
        continue;
      }

      if (!isBalanceSheetNature(ledger.groupNature)) {
        errors.push({
          field: `rows.${index}.opLedgerId`,
          message: `"${ledger.ledName}" is ${ledger.groupNature} — only Assets and Liabilities ledgers carry an opening balance`,
        });
      }
    }

    if (errors.length > 0) {
      throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', errors);
    }
  }

  /**
   * §5.5 rule 2, the other half: `create` may not type a bill-wise party's
   * figure, only echo the one its bills already produce. Two endpoints writing
   * the same number from different sources is exactly how the §7.2 tie breaks.
   */
  private async assertBillWiseRowsOnlyEcho(
    client: OpeningWriteClient,
    rows: readonly SaveOpeningBalanceRowDto[],
    ledgers: ReadonlyMap<string, VisibleLedger>,
    storedByLedger: ReadonlyMap<string, StoredOpening>,
    accYear: string,
  ): Promise<void> {
    const billWise = rows
      .map((row, index) => ({ row, index, ledger: ledgers.get(row.opLedgerId) }))
      .filter((entry) => entry.ledger?.ledIsBillByBill === true);

    if (billWise.length === 0) {
      return;
    }

    const opIds = billWise
      .map((entry) => storedByLedger.get(entry.row.opLedgerId)?.opId)
      .filter((opId): opId is string => typeof opId === 'string');

    const totals = await this.billTotalsByOpening(client, accYear, opIds);
    const errors: OpeningBalanceErrorDetail[] = [];

    for (const entry of billWise) {
      const stored = storedByLedger.get(entry.row.opLedgerId);
      const total = stored ? (totals.get(stored.opId) ?? ZERO) : ZERO;
      if (total.isZero()) {
        // No bills yet — nothing owns the figure, so this row is refused for a
        // different reason: the breakup panel is where a bill-wise party is
        // opened at all.
        errors.push({
          field: `rows.${entry.index}.opAmount`,
          message: `"${entry.ledger!.ledName}" is a bill-by-bill party — enter its opening as bills in the breakup panel, not as a figure`,
        });
        continue;
      }

      const sent = signedOpening(money(entry.row.opAmount), entry.row.opDrCr);
      if (!sent.equals(money(total))) {
        const expected = splitSigned(money(total));
        errors.push({
          field: `rows.${entry.index}.opAmount`,
          message: `"${entry.ledger!.ledName}" is bill-by-bill: its opening is the total of its bills, ${expected.amount.toFixed(2)} ${expected.drCr}. Change the bills, not this figure.`,
        });
      }
    }

    if (errors.length > 0) {
      throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', errors);
    }
  }

  /** Signed bill totals per opening row, keyed on the §5.3 source link. */
  async billTotalsByOpening(
    client: OpeningWriteClient,
    accYear: string,
    opIds: readonly string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (opIds.length === 0) {
      return new Map();
    }

    const bills = await client.accBillBalance.findMany({
      where: {
        ablSrcDocType: 'OPENING_BALANCE',
        ablSrcDocId: { in: [...opIds] },
        ablAccYear: accYear,
        ablIsDeleted: false,
      },
      select: { ablSrcDocId: true, ablBillAmount: true, ablDrCr: true },
    });

    const totals = new Map<string, Prisma.Decimal>();
    for (const bill of bills) {
      if (!bill.ablSrcDocId) {
        continue;
      }
      const current = totals.get(bill.ablSrcDocId) ?? ZERO;
      const signed = bill.ablDrCr === 'DR' ? bill.ablBillAmount : bill.ablBillAmount.negated();
      totals.set(bill.ablSrcDocId, current.plus(signed));
    }
    return totals;
  }

  /**
   * §5.5 rule 1. The client echoes `opSource` back as it received it, so
   * storing it as sent would leave an accountant's correction to a generated
   * figure marked CARRY_FORWARD — and the next regenerate, which spares only
   * MANUAL rows, would undo it without a word.
   *
   * `op_generated_at / _by` are deliberately left as they were: they record
   * what the figure was derived from BEFORE it was overridden, which is the
   * only remaining trace of that.
   */
  private resolveSource(
    existing: StoredOpening | null,
    row: SaveOpeningBalanceRowDto,
    amount: Prisma.Decimal,
    flippedToManual: string[],
  ): OpeningSource {
    if (!existing) {
      return row.opSource ?? OpeningSource.MANUAL;
    }

    if (existing.opSource !== (OpeningSource.CARRY_FORWARD as string)) {
      // MIGRATION rows stay MIGRATION — typing them is what migration IS.
      return existing.opSource as OpeningSource;
    }

    const figureChanged =
      !money(existing.opAmount).equals(amount) || existing.opDrCr !== (row.opDrCr as string);
    if (figureChanged) {
      flippedToManual.push(existing.opId);
      return OpeningSource.MANUAL;
    }
    return OpeningSource.CARRY_FORWARD;
  }

  /**
   * §5.1 rule 6. `replace: true` soft deletes what the array left out — except
   * a bill-wise party that still has OPENING bills, which is reported instead.
   * Deleting it would orphan the bills against an un-FK'd source id.
   */
  private async deleteAbsentRows(
    client: OpeningWriteClient,
    stored: readonly StoredOpening[],
    seen: ReadonlySet<string>,
    ledgers: ReadonlyMap<string, VisibleLedger>,
    accYear: string,
    actor: string,
    now: Date,
  ): Promise<{ deleted: number; retainedWithBills: RetainedRow[] }> {
    const absent = stored.filter((row) => !seen.has(row.opLedgerId));
    if (absent.length === 0) {
      return { deleted: 0, retainedWithBills: [] };
    }

    const billCounts = await countBillsByOpening(
      client,
      accYear,
      absent.map((row) => row.opId),
    );

    const retainedWithBills: RetainedRow[] = [];
    const deletable: string[] = [];

    for (const row of absent) {
      const billCount = billCounts.get(row.opId) ?? 0;
      if (billCount > 0) {
        retainedWithBills.push({
          opId: row.opId,
          ledId: row.opLedgerId,
          ledName: ledgers.get(row.opLedgerId)?.ledName ?? row.opLedgerId,
          billCount,
        });
        continue;
      }
      deletable.push(row.opId);
    }

    if (deletable.length > 0) {
      await client.accOpeningBalance.updateMany({
        where: { opId: { in: deletable }, opAccYear: accYear },
        data: { opIsDeleted: true, opModifiedAt: now, opModifiedBy: actor },
      });
    }

    return { deleted: deletable.length, retainedWithBills };
  }

  /** One insert, with the constraint failures turned back into messages (§5.1 rule 8). */
  private async createOpening(
    client: OpeningWriteClient,
    params: {
      companyId: string;
      branchId: string | null;
      accYear: string;
      tenantId: string | null;
      ledgerId: string;
      amount: Prisma.Decimal;
      drCr: string;
      source: OpeningSource;
      remarks: string | null;
      actor: string;
      now: Date;
    },
  ): Promise<string> {
    try {
      const created = await client.accOpeningBalance.create({
        data: {
          opCompanyId: params.companyId,
          opBranchId: params.branchId,
          opAccYear: params.accYear,
          opTenantId: params.tenantId,
          opLedgerId: params.ledgerId,
          opAmount: params.amount,
          opDrCr: params.drCr,
          opSource: params.source,
          opRemarks: params.remarks,
          opCreatedAt: params.now,
          opCreatedBy: params.actor,
        },
        select: { opId: true },
      });
      return created.opId;
    } catch (error) {
      if (isForeignKeyConstraintError(error)) {
        const message = String(
          (error as { meta?: { constraint?: string } }).meta?.constraint ?? '',
        );
        throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
          message.includes('branch')
            ? { field: 'opBranchId', message: 'Branch not found' }
            : message.includes('company')
              ? { field: 'opCompanyId', message: 'Company not found' }
              : { field: 'opLedgerId', message: 'Ledger no longer exists' },
        ]);
      }
      throw error;
    }
  }
}
