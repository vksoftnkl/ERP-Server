import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  throwAccountsBadRequest,
} from 'src/common/utils/module-service.utils';
import { OpeningBalanceService } from './opening-balance.service';
import { resolveRetainedEarningsLedger } from './ledger-roles';
import {
  assertAccYearWritable,
  isBalanceSheetNature,
  loadVisibleLedgers,
  type OpeningWriteClient,
  type VisibleLedger,
} from './opening-balance.guards';
import {
  isBillFrozen,
  isValidAccYear,
  money,
  nextAccYear,
  signedOpening,
  splitSigned,
  toAmount,
  ZERO,
} from './opening-balance.utils';
import { CarryForwardDto } from './dto/carry-forward.dto';
import {
  OPENING_BILL_TYPE,
  OPENING_SRC_DOC_TYPE,
  OPENING_SRC_MODULE,
  OpeningDrCr,
  OpeningSource,
  type CarryForwardPayload,
  type OpeningBalanceErrorDetail,
} from './types/opening-balance-api.types';

/**
 * §5.2 — closing one year into the next.
 *
 * Its own service rather than a method on the CRUD one: it is a batch operation
 * over a whole company-year inside a single transaction, and it will grow a
 * scheduled caller. Everything it does is all-or-nothing — a half-carried year
 * is worse than an uncarried one, because it looks finished.
 */
@Injectable()
export class CarryForwardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openingBalanceService: OpeningBalanceService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async run(dto: CarryForwardDto): Promise<CarryForwardPayload> {
    const fromAccYear = this.requireAccYear(dto.fromAccYear, 'fromAccYear');
    const toAccYear = this.requireAccYear(dto.toAccYear, 'toAccYear');
    const branchId = dto.branchId ?? null;
    const overwriteManual = dto.overwriteManual ?? false;
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;

    if (nextAccYear(fromAccYear) !== toAccYear) {
      throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
        {
          field: 'toAccYear',
          message: `${toAccYear} does not follow ${fromAccYear} — a carry-forward moves one year at a time`,
        },
      ]);
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Only the year being WRITTEN to must be open. The year being read from
        // is normally closed — that is what makes it ready to carry.
        await assertAccYearWritable(tx, dto.companyId, toAccYear, 'toAccYear');

        const ledgers = await loadVisibleLedgers(tx, dto.companyId);

        // Step 1 — last year's closing per ledger: its opening plus every
        // POSTED movement. Shared with the list endpoint so "closing balance"
        // has exactly one definition in this module.
        const closings = await this.openingBalanceService.closingByLedger(
          tx,
          dto.companyId,
          branchId,
          fromAccYear,
        );

        // Step 3 — balance-sheet ledgers only. Income and expenses do not carry
        // a balance; they net into the year's result, handled below.
        const carried = new Map<string, { amount: Prisma.Decimal; drCr: OpeningDrCr }>();
        for (const [ledgerId, closing] of closings) {
          const ledger = ledgers.get(ledgerId);
          if (!ledger || !isBalanceSheetNature(ledger.groupNature)) {
            continue;
          }
          carried.set(ledgerId, closing);
        }

        // DECISION 2, on the Tally model: the year's income less expenses is a
        // real balance from the new year's point of view and has to land
        // somewhere, or the carried set cannot balance.
        const profitAndLoss = await this.profitAndLossResult(
          tx,
          dto.companyId,
          branchId,
          fromAccYear,
          ledgers,
        );

        const retainedEarnings = await resolveRetainedEarningsLedger(tx, dto.companyId, branchId);

        if (!money(profitAndLoss).isZero()) {
          if (!retainedEarnings) {
            // A company with a non-zero result and no mapping cannot be carried
            // forward: doing it anyway would produce a knowingly unbalanced
            // opening set and blame the accountant for it.
            throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
              {
                field: 'companyId',
                message:
                  `${fromAccYear} has a profit and loss result of ${money(profitAndLoss).abs().toFixed(2)} ` +
                  'that must be carried onto a ledger, but no ledger is mapped to the ' +
                  'RETAINED_EARNINGS role for this company. Map it in Posting Ledgers first.',
              },
            ]);
          }
          const existing = carried.get(retainedEarnings.ledgerId);
          const combined = money(
            (existing ? signedOpening(existing.amount, existing.drCr) : ZERO).plus(profitAndLoss),
          );
          if (combined.isZero()) {
            carried.delete(retainedEarnings.ledgerId);
          } else {
            carried.set(retainedEarnings.ledgerId, splitSigned(combined));
          }
        }

        // What is already in the target year — a regenerate is the normal case,
        // not the exception.
        const existingRows = await tx.accOpeningBalance.findMany({
          where: {
            opCompanyId: dto.companyId,
            opAccYear: toAccYear,
            opBranchId: branchId === null ? { equals: null } : branchId,
            opIsDeleted: false,
          },
          select: { opId: true, opLedgerId: true, opSource: true },
        });
        const existingByLedger = new Map(existingRows.map((row) => [row.opLedgerId, row]));

        const now = new Date();
        // Ledgers whose stored figure was left alone. A bill-wise party in here
        // must keep its bills too: carrying them would move the very figure the
        // skip just protected, and break the §7.2 tie on the way.
        const sparedLedgerIds = new Set<string>();
        let created = 0;
        let updated = 0;
        let skippedManual = 0;

        for (const [ledgerId, closing] of carried) {
          const existing = existingByLedger.get(ledgerId);

          if (existing && existing.opSource !== OpeningSource.CARRY_FORWARD && !overwriteManual) {
            // §7.3 — a MANUAL or MIGRATION row is a human's own figure. A
            // regenerate that quietly replaced it would undo a correction with
            // no trace at all, so it is skipped and counted.
            skippedManual += 1;
            sparedLedgerIds.add(ledgerId);
            continue;
          }

          if (existing) {
            await tx.accOpeningBalance.update({
              where: { opId_opAccYear: { opId: existing.opId, opAccYear: toAccYear } },
              data: {
                opAmount: closing.amount,
                opDrCr: closing.drCr,
                opSource: OpeningSource.CARRY_FORWARD,
                opGeneratedAt: now,
                opGeneratedBy: actor,
                // Step 5 — freshly derived, so whatever made it stale is
                // answered.
                opIsStale: false,
                opStaleSince: null,
                opStaleReason: null,
                opStaleRefId: null,
                opStaleRefAccYear: null,
                opModifiedAt: now,
                opModifiedBy: actor,
              },
            });
            updated += 1;
            continue;
          }

          await tx.accOpeningBalance.create({
            data: {
              opCompanyId: dto.companyId,
              opBranchId: branchId,
              opAccYear: toAccYear,
              opLedgerId: ledgerId,
              opAmount: closing.amount,
              opDrCr: closing.drCr,
              opSource: OpeningSource.CARRY_FORWARD,
              opGeneratedAt: now,
              opGeneratedBy: actor,
              opCreatedAt: now,
              opCreatedBy: actor,
            },
            select: { opId: true },
          });
          created += 1;
        }

        // A CARRY_FORWARD row for a ledger that no longer closes with anything
        // is removed, or a regenerate would leave last run's figure standing
        // for a ledger that has since gone to zero.
        const stale = existingRows.filter(
          (row) => row.opSource === OpeningSource.CARRY_FORWARD && !carried.has(row.opLedgerId),
        );
        if (stale.length > 0) {
          await tx.accOpeningBalance.updateMany({
            where: { opId: { in: stale.map((row) => row.opId) }, opAccYear: toAccYear },
            data: { opIsDeleted: true, opModifiedAt: now, opModifiedBy: actor },
          });
        }

        // Step 4 — the bills. Without this a carry-forward silently destroys
        // the ageing of every debtor.
        const bills = await this.carryBills(tx, {
          companyId: dto.companyId,
          branchId,
          fromAccYear,
          toAccYear,
          ledgers,
          sparedLedgerIds,
          overwriteManual,
          actor,
          now,
        });
        const billsCarried = bills.written;
        skippedManual += bills.skippedManual;

        // Step 6 — stamp the year. These three columns exist for exactly this.
        await this.stampFiscalYear(tx, dto.companyId, fromAccYear, toAccYear);

        const totals = await this.totals(tx, dto.companyId, branchId, toAccYear, ledgers);

        // Step 7 — record the run. A regenerate ADDS a row; it never overwrites
        // one, which is the whole point of the table.
        const run = await tx.accOpeningRun.create({
          data: {
            aorCompanyId: dto.companyId,
            aorBranchId: branchId,
            aorFromAccYear: fromAccYear,
            aorToAccYear: toAccYear,
            aorRunBy: actor,
            aorCreated: created,
            aorUpdated: updated,
            aorSkippedManual: skippedManual,
            aorTotalDebit: totals.debit,
            aorTotalCredit: totals.credit,
            aorOverwriteManual: overwriteManual,
          },
          select: { aorId: true },
        });

        const difference = money(totals.debit.minus(totals.credit));

        return {
          runId: run.aorId,
          companyId: dto.companyId,
          branchId,
          fromAccYear,
          toAccYear,
          created,
          updated,
          skippedManual,
          billsCarried,
          totalDebit: toAmount(totals.debit),
          totalCredit: toAmount(totals.credit),
          difference: toAmount(difference),
          isBalanced: difference.isZero(),
          profitAndLossResult: toAmount(money(profitAndLoss)),
          retainedEarningsLedgerId: retainedEarnings?.ledgerId ?? null,
        };
      },
      // A whole company-year of ledgers and bills in one statement sequence.
      // The defaults are tuned for a single-row save and time this out.
      { timeout: 120_000, maxWait: 15_000 },
    );
  }

  // ─── Step 3's other half — the P&L result ──────────────────────────────────

  /**
   * Income less expenses for the year, as a SIGNED figure on the same debit-
   * positive scale as everything else. A profit is net credit, so it comes back
   * negative and lands as a 'C' on retained earnings — which is what a profit
   * is: money the business owes its owners.
   *
   * Built from POSTED vouchers only, for the same reason step 1 is
   * (`ck_avh_balanced` only bites at POSTED). P&L ledgers carry no opening, so
   * there is nothing to add to the movement.
   */
  private async profitAndLossResult(
    client: OpeningWriteClient,
    companyId: string,
    branchId: string | null,
    accYear: string,
    ledgers: ReadonlyMap<string, VisibleLedger>,
  ): Promise<Prisma.Decimal> {
    const movements = await client.$queryRaw<Array<{ led_id: string; signed: Prisma.Decimal | null }>>`
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
    `;

    let result = ZERO;
    for (const movement of movements) {
      const ledger = ledgers.get(movement.led_id);
      if (!ledger || ledger.groupNature === null || isBalanceSheetNature(ledger.groupNature)) {
        continue;
      }
      result = result.plus(movement.signed ?? ZERO);
    }
    return result;
  }

  // ─── Step 4 — the bills ────────────────────────────────────────────────────

  /**
   * Every still-open bill of a bill-wise party becomes a NEW OPENING bill in
   * the target year, carrying what is left of it.
   *
   * Three links matter and each one is a separate kind of loss if omitted:
   *  - `abl_parent_bill_id / _acc_year` chains the bill to the one it
   *    continues, so a receipt history can be reconstructed across the
   *    year-end. `fk_abl_parent_*` already FK it across the partitions.
   *  - `abl_src_doc_id` names the party's NEW opening row, which is what makes
   *    the §7.2 tie a keyed lookup.
   *  - the source bill's own branch, because `abl_branch_id` is NOT NULL and a
   *    bill-wise party's company-level opening is the sum of its branch bills
   *    (DECISION 9a).
   */
  private async carryBills(
    client: OpeningWriteClient,
    params: {
      companyId: string;
      branchId: string | null;
      fromAccYear: string;
      toAccYear: string;
      ledgers: ReadonlyMap<string, VisibleLedger>;
      sparedLedgerIds: ReadonlySet<string>;
      overwriteManual: boolean;
      actor: string;
      now: Date;
    },
  ): Promise<{ written: number; skippedManual: number }> {
    const billWiseIds = [...params.ledgers.values()]
      .filter((ledger) => ledger.ledIsBillByBill && !params.sparedLedgerIds.has(ledger.ledId))
      .map((ledger) => ledger.ledId);

    if (billWiseIds.length === 0) {
      return { written: 0, skippedManual: 0 };
    }

    const openBills = await client.accBillBalance.findMany({
      where: {
        ablCompanyId: params.companyId,
        ablAccYear: params.fromAccYear,
        ablPartyId: { in: billWiseIds },
        ablIsDeleted: false,
        ...(params.branchId === null ? {} : { ablBranchId: params.branchId }),
      },
      select: {
        ablId: true,
        ablBranchId: true,
        ablTenantId: true,
        ablPartyId: true,
        ablSalesmanId: true,
        ablAgentId: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablDueDate: true,
        ablCreditDays: true,
        ablGraceDays: true,
        ablDrCr: true,
        ablPendingAmount: true,
        ablNarration: true,
      },
      orderBy: [{ ablPartyId: 'asc' }, { ablDocDate: 'asc' }],
    });

    // `abl_pending_amount` is GENERATED and nullable in the client's types; a
    // fully settled bill has nothing left to carry and ck_abl_amount would
    // refuse a zero anyway.
    const carriable = openBills.filter(
      (bill) => bill.ablPendingAmount !== null && bill.ablPendingAmount.greaterThan(0),
    );
    if (carriable.length === 0) {
      return { written: 0, skippedManual: 0 };
    }

    // The party's opening row in the TARGET year, which every carried bill
    // points at. Written first so abl_src_doc_id has something to name.
    const byParty = new Map<string, typeof carriable>();
    for (const bill of carriable) {
      const key = `${bill.ablPartyId}|${bill.ablBranchId}`;
      const bucket = byParty.get(key) ?? [];
      bucket.push(bill);
      byParty.set(key, bucket);
    }

    // What a previous run already carried out of this same source year, keyed
    // by the bill each one continues.
    const existingCarried = await client.accBillBalance.findMany({
      where: {
        ablCompanyId: params.companyId,
        ablAccYear: params.toAccYear,
        ablBillType: OPENING_BILL_TYPE,
        ablParentAccYear: params.fromAccYear,
        ablParentBillId: { in: carriable.map((bill) => bill.ablId) },
        ablIsDeleted: false,
      },
      select: {
        ablId: true,
        ablParentBillId: true,
        ablAllocAmount: true,
        ablDiscAmount: true,
        ablWriteoffAmount: true,
      },
    });
    const carriedByParent = new Map(
      existingCarried
        .filter((bill): bill is typeof bill & { ablParentBillId: string } => bill.ablParentBillId !== null)
        .map((bill) => [bill.ablParentBillId, { ablId: bill.ablId, frozen: isBillFrozen(bill) }]),
    );

    let written = 0;
    let skippedManual = 0;

    for (const [key, bills] of byParty) {
      const [partyId, billBranchId] = key.split('|');

      let signed = ZERO;
      for (const bill of bills) {
        signed = signed.plus(
          bill.ablDrCr === 'DR' ? bill.ablPendingAmount! : bill.ablPendingAmount!.negated(),
        );
      }
      const total = money(signed);
      if (total.isZero()) {
        continue;
      }
      const split = splitSigned(total);

      // The bills are branch-scoped, so the opening they tie to is too.
      //
      // Found and then written rather than upserted: ux_op_scope is a PARTIAL
      // unique index over a COALESCE expression, which neither Prisma's upsert
      // nor a plain ON CONFLICT on the four raw columns can address (§5.1
      // rule 5). Inside this transaction the read and the write cannot race.
      //
      // This deliberately runs AFTER the ledger loop above and overwrites what
      // that loop wrote for this party: for a bill-wise party the BILLS are the
      // figure (§5.2 step 4), and the closing-derived number is only a
      // fallback for parties that have none.
      const existingOpening = await client.accOpeningBalance.findFirst({
        where: {
          opCompanyId: params.companyId,
          opBranchId: billBranchId,
          opAccYear: params.toAccYear,
          opLedgerId: partyId,
          opIsDeleted: false,
        },
        select: { opId: true, opSource: true },
      });

      // §7.3 again, at the scope the ledger loop above cannot see: a bill-wise
      // party's opening is branch-scoped, so it never appears in `carried` and
      // was not covered by the skip there. Overwriting a MANUAL row here would
      // undo the same correction by a different route — and take its bills
      // with it.
      if (
        existingOpening &&
        existingOpening.opSource !== OpeningSource.CARRY_FORWARD &&
        !params.overwriteManual
      ) {
        skippedManual += 1;
        continue;
      }

      const opening = existingOpening
        ? await client.accOpeningBalance.update({
            where: { opId_opAccYear: { opId: existingOpening.opId, opAccYear: params.toAccYear } },
            data: {
              opAmount: split.amount,
              opDrCr: split.drCr,
              opSource: OpeningSource.CARRY_FORWARD,
              opGeneratedAt: params.now,
              opGeneratedBy: params.actor,
              opIsStale: false,
              opStaleSince: null,
              opStaleReason: null,
              opStaleRefId: null,
              opStaleRefAccYear: null,
              opModifiedAt: params.now,
              opModifiedBy: params.actor,
            },
            select: { opId: true },
          })
        : await client.accOpeningBalance.create({
            data: {
              opCompanyId: params.companyId,
              opBranchId: billBranchId,
              opAccYear: params.toAccYear,
              opLedgerId: partyId,
              opAmount: split.amount,
              opDrCr: split.drCr,
              opSource: OpeningSource.CARRY_FORWARD,
              opGeneratedAt: params.now,
              opGeneratedBy: params.actor,
              opCreatedAt: params.now,
              opCreatedBy: params.actor,
            },
            select: { opId: true },
          });

      for (const bill of bills) {
        // Idempotent on the parent link. A regenerate is the normal case, and
        // without this check the second run would write every debtor's bills a
        // second time and double the party's opening.
        const alreadyCarried = carriedByParent.get(bill.ablId);
        if (alreadyCarried) {
          if (alreadyCarried.frozen) {
            // Something has been receipted against the carried bill already.
            // Its amount is fixed (§5.5 rule 3) and re-deriving it would fail
            // ck_abl_settled; leave it exactly as it is.
            continue;
          }
          await client.accBillBalance.update({
            where: { ablId_ablAccYear: { ablId: alreadyCarried.ablId, ablAccYear: params.toAccYear } },
            data: {
              ablBillAmount: bill.ablPendingAmount!,
              ablDrCr: bill.ablDrCr,
              ablDueDate: bill.ablDueDate,
              ablSrcDocId: opening.opId,
              ablModifiedOn: params.now,
              ablModifiedBy: params.actor,
            },
          });
          written += 1;
          continue;
        }

        await client.accBillBalance.create({
          data: {
            ablCompanyId: params.companyId,
            ablBranchId: bill.ablBranchId,
            ablTenantId: bill.ablTenantId,
            ablAccYear: params.toAccYear,
            ablPartyId: bill.ablPartyId,
            ablSalesmanId: bill.ablSalesmanId,
            ablAgentId: bill.ablAgentId,
            ablBillType: OPENING_BILL_TYPE,
            ablVoucherId: null,
            ablVoucherTypeId: null,
            ablSrcModule: OPENING_SRC_MODULE,
            ablSrcDocType: OPENING_SRC_DOC_TYPE,
            ablSrcDocId: opening.opId,
            ablSrcAccYear: params.toAccYear,
            ablParentBillId: bill.ablId,
            ablParentAccYear: params.fromAccYear,
            // The ORIGINAL reference and date ride along: ageing measures from
            // when the money was invoiced, not from when the year turned.
            ablDocRefno: bill.ablDocRefno,
            ablDocDate: bill.ablDocDate,
            ablDueDate: bill.ablDueDate,
            ablCreditDays: bill.ablCreditDays,
            ablGraceDays: bill.ablGraceDays,
            ablDrCr: bill.ablDrCr,
            // What is LEFT of the bill becomes the new bill's full amount, and
            // the allocations start again at zero.
            ablBillAmount: bill.ablPendingAmount!,
            ablAllocAmount: new Prisma.Decimal(0),
            ablDiscAmount: new Prisma.Decimal(0),
            ablWriteoffAmount: new Prisma.Decimal(0),
            ablNarration: bill.ablNarration,
            ablCreatedOn: params.now,
            ablCreatedBy: params.actor,
          },
          select: { ablId: true },
        });
        written += 1;
      }
    }

    return { written, skippedManual };
  }

  // ─── Step 6 ────────────────────────────────────────────────────────────────

  private async stampFiscalYear(
    client: OpeningWriteClient,
    companyId: string,
    fromAccYear: string,
    toAccYear: string,
  ): Promise<void> {
    const [from, to] = await Promise.all([
      client.fiscalYear.findFirst({
        where: { compId: companyId, fyYearName: fromAccYear, isDeleted: false },
        select: { fyId: true },
      }),
      client.fiscalYear.findFirst({
        where: { compId: companyId, fyYearName: toAccYear, isDeleted: false },
        select: { fyId: true },
      }),
    ]);

    // Both ids are unambiguous thanks to uq_fiscal_years_comp_name. A company
    // whose years are not set up yet still carries forward — the opening rows
    // are the point, and the stamp is bookkeeping about the run.
    if (!to) {
      return;
    }

    await client.fiscalYear.update({
      where: { fyId: to.fyId },
      data: {
        fyIsCarriedForward: true,
        fyCarriedForwardAt: new Date(),
        fyPrevFyId: from?.fyId ?? undefined,
      },
    });
  }

  private async totals(
    client: OpeningWriteClient,
    companyId: string,
    branchId: string | null,
    accYear: string,
    ledgers: ReadonlyMap<string, VisibleLedger>,
  ): Promise<{ debit: Prisma.Decimal; credit: Prisma.Decimal }> {
    const rows = await client.accOpeningBalance.findMany({
      where: {
        opCompanyId: companyId,
        opAccYear: accYear,
        opBranchId: branchId === null ? { equals: null } : branchId,
        opIsDeleted: false,
      },
      select: { opLedgerId: true, opAmount: true, opDrCr: true },
    });

    let debit = ZERO;
    let credit = ZERO;
    for (const row of rows) {
      if (!ledgers.has(row.opLedgerId)) {
        continue;
      }
      if (row.opDrCr === OpeningDrCr.DEBIT) {
        debit = debit.plus(row.opAmount);
      } else {
        credit = credit.plus(row.opAmount);
      }
    }
    return { debit: money(debit), credit: money(credit) };
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
}
