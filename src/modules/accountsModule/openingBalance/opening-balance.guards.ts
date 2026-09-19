import { Prisma } from '@prisma/client';
import {
  throwAccountsBadRequest,
  type AccountsWriteClient,
} from 'src/common/utils/module-service.utils';
import type { OpeningBalanceErrorDetail } from './types/opening-balance-api.types';
import {
  BALANCE_SHEET_NATURES,
  FiscalYearStatus,
  OPENING_SRC_DOC_TYPE,
  OpeningSource,
  OpeningStaleReason,
} from './types/opening-balance-enum';
import { isAccYearAfter, isValidAccYear } from './opening-balance.utils';

/**
 * The checks that are not any one endpoint's, shared by the three services so
 * that a rule is written once. Each is something ONLY the service can enforce
 * (§7) or something the database enforces with a message nobody can read
 * (§5.1 rule 8).
 */

export type OpeningWriteClient = AccountsWriteClient;

/** A ledger the company may open, with everything the rules need to judge it. */
export interface VisibleLedger {
  ledId: string;
  ledName: string;
  ledCompanyId: string | null;
  ledIsBillByBill: boolean;
  groupName: string | null;
  groupNature: string | null;
}

// ─── §7.4 — a closed or locked year is not writable ──────────────────────────

/**
 * `fy_status` and `fy_lock_date` are both on fiscal_years and, before this
 * module, nothing consulted either. A write into a year the accountant has
 * closed is exactly the kind of thing an opening-balance screen does by
 * accident, because the screen's whole job is to edit the past.
 *
 * A year with no fiscal_years row at all is allowed: plenty of companies are
 * opened before their years are set up, and refusing here would make this
 * module depend on a master screen nobody has run yet.
 */
export async function assertAccYearWritable(
  client: OpeningWriteClient,
  companyId: string,
  accYear: string,
  field: string,
): Promise<void> {
  if (!isValidAccYear(accYear)) {
    throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
      {
        field,
        message: `"${accYear}" is not an accounting year — expected YYYY-YYYY with the second half one greater than the first`,
      },
    ]);
  }

  const year = await client.fiscalYear.findFirst({
    where: { compId: companyId, fyYearName: accYear, isDeleted: false },
    select: { fyStatus: true, fyLockDate: true, fyYearName: true },
  });

  if (!year) {
    return;
  }

  if (year.fyStatus !== FiscalYearStatus.OPEN) {
    throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
      {
        field,
        message: `Accounting year ${year.fyYearName} is ${year.fyStatus} and cannot be written to`,
      },
    ]);
  }

  if (year.fyLockDate && year.fyLockDate.getTime() <= Date.now()) {
    throwAccountsBadRequest<OpeningBalanceErrorDetail>('Validation failed', [
      {
        field,
        message: `Accounting year ${year.fyYearName} was locked on ${year.fyLockDate
          .toISOString()
          .slice(0, 10)} and cannot be written to`,
      },
    ]);
  }
}

// ─── §4.1 / §5.1 rule 2 — which ledgers this company may open ────────────────

/**
 * DECISION 10, as the plan assumes it: **global ledgers plus this company's
 * own**. `led_company_id` is nullable — a ledger is global (NULL) or owned by
 * exactly one company — so without the second term one company's private
 * ledgers are listed to, and openable by, every other.
 *
 * fk_op_ledger proves a ledger EXISTS. It says nothing about whether this
 * company may use it, which is why this check cannot be left to the database.
 *
 * Returns every visible ledger including the unclassified ones; callers split
 * them by nature, because "unclassified" is reported rather than dropped
 * (§12).
 */
export async function loadVisibleLedgers(
  client: OpeningWriteClient,
  companyId: string,
): Promise<Map<string, VisibleLedger>> {
  const ledgers = await client.accLedgerMaster.findMany({
    where: {
      ledIsDeleted: false,
      OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
    },
    select: {
      ledId: true,
      ledName: true,
      ledCompanyId: true,
      ledIsBillByBill: true,
      accGroupMaster: { select: { accGroupName: true, accGroupNature: true } },
    },
    orderBy: { ledName: 'asc' },
  });

  return new Map(
    ledgers.map((ledger) => [
      ledger.ledId,
      {
        ledId: ledger.ledId,
        ledName: ledger.ledName,
        ledCompanyId: ledger.ledCompanyId,
        ledIsBillByBill: ledger.ledIsBillByBill,
        groupName: ledger.accGroupMaster?.accGroupName ?? null,
        groupNature: ledger.accGroupMaster?.accGroupNature ?? null,
      },
    ]),
  );
}

export function isBalanceSheetNature(nature: string | null): boolean {
  return nature !== null && (BALANCE_SHEET_NATURES as readonly string[]).includes(nature);
}

// ─── §5.5 rule 4 — editing year N stales N+1 ─────────────────────────────────

/**
 * An edit to year N's openings, or to an OPENING bill of N, moves N's closing.
 * Every CARRY_FORWARD row in a LATER year was derived from that closing, so it
 * is now derived from a figure that no longer exists.
 *
 * **Flag, never correct.** The later figure may already have been reported, and
 * silently moving it would change a number somebody has already signed. The
 * screen shows the flag and the accountant decides whether to regenerate.
 *
 * Only CARRY_FORWARD rows are touched: a MANUAL row in a later year is a human's
 * own figure and was never derived from anything (§7.3 is the same principle on
 * the write side).
 *
 * Scope: when this write is company-level (`branchId` null) every branch's rows
 * for the later year are staled, because a company-level closing feeds all of
 * them. A branch-level write stales that branch and the company-level rows.
 */
export async function staleLaterYears(
  client: OpeningWriteClient,
  params: {
    companyId: string;
    branchId: string | null;
    accYear: string;
    reason: OpeningStaleReason;
    refId: string | null;
  },
): Promise<string[]> {
  const laterYears = await client.accOpeningBalance.findMany({
    where: {
      opCompanyId: params.companyId,
      opIsDeleted: false,
      opSource: OpeningSource.CARRY_FORWARD,
      opIsStale: false,
      ...(params.branchId === null
        ? {}
        : { OR: [{ opBranchId: params.branchId }, { opBranchId: null }] }),
    },
    select: { opAccYear: true },
    distinct: ['opAccYear'],
  });

  const affected = laterYears
    .map((row) => row.opAccYear)
    .filter((year) => isAccYearAfter(year, params.accYear));

  if (affected.length === 0) {
    return [];
  }

  await client.accOpeningBalance.updateMany({
    where: {
      opCompanyId: params.companyId,
      opAccYear: { in: affected },
      opIsDeleted: false,
      opSource: OpeningSource.CARRY_FORWARD,
      opIsStale: false,
      ...(params.branchId === null
        ? {}
        : { OR: [{ opBranchId: params.branchId }, { opBranchId: null }] }),
    },
    data: {
      opIsStale: true,
      opStaleSince: new Date(),
      opStaleReason: params.reason,
      opStaleRefId: params.refId,
      opStaleRefAccYear: params.refId ? params.accYear : null,
    },
  });

  return affected.sort();
}

// ─── OPENING bills attached to an opening row ────────────────────────────────

/**
 * How many live OPENING bills point at each of these openings, keyed on the
 * source link rather than on (company, year, party) — which would also sweep up
 * the party's SALES bills of the same year and make the tie meaningless (§7.2).
 */
export async function countBillsByOpening(
  client: OpeningWriteClient,
  accYear: string,
  opIds: readonly string[],
): Promise<Map<string, number>> {
  if (opIds.length === 0) {
    return new Map();
  }

  const grouped = await client.accBillBalance.groupBy({
    by: ['ablSrcDocId'],
    where: {
      ablSrcDocType: OPENING_SRC_DOC_TYPE,
      ablSrcDocId: { in: [...opIds] },
      ablAccYear: accYear,
      ablIsDeleted: false,
    },
    _count: { _all: true },
  });

  return new Map(
    grouped
      .filter((row): row is typeof row & { ablSrcDocId: string } => row.ablSrcDocId !== null)
      .map((row) => [row.ablSrcDocId, row._count._all]),
  );
}

export type { Prisma };
