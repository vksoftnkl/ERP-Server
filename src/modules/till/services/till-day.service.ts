/**
 * till-day.service.ts — the business day (accounts.till_business_day, §5.3 / D2): one
 * row per branch per trading date, above every session. This file owns OPENING the day
 * and READING it. Its close, checklist, store Z and reopen are TillDayCloseService
 * (notes 117); its safe figures (tbd_safe_*) are refreshed by TillSafeService.refreshDay
 * (notes 118).
 *
 * Served by TillController: POST days/open (`open`) and GET days/get (`get`; the day
 * close and TillPrintService read `get` too). Called in-transaction by
 * TillSessionService.open and TillSafeService.dayFor (`ensureOpenDay`), so a session or
 * a cash-office document always lands on an OPEN day of today's business date.
 *
 * Flows
 * - Find / open the day: `ensureOpenDay` — businessDateNow (till.day_cutoff) →
 *   accYearOf → assertTillPartitions → INSERT … ON CONFLICT DO NOTHING when the caller
 *   may open it (a manager's Day Open always, a session only under till.day_auto_open)
 *   → the row read back → none TILL_DAY_NOT_OPEN · CLOSING TILL_DAY_CLOSING · CLOSED
 *   TILL_DAY_NOT_OPEN → DAY_OPEN journalled when this call created it.
 * - Day Open (POST days/open): `open` — `ensureOpenDay` as MANAGER in its own
 *   transaction, then `get` for the payload.
 * - days/get: `get` — the day by id, or today's by the cut-off (404 TILL_DAY_NOT_FOUND)
 *   → its sessions grouped by status → the branch's bags still AWAITING receipt
 *   (notes 113: thisDay / earlierDays / oldestOn, no amount) → the closer's name → the
 *   frozen totals and the safe block (tbd_safe_*, `belowZero`, notes 124 §3) with
 *   `awaitingAsOf`: the Till cash awaiting receipt ledger at the end of the day before
 *   and of the day.
 */
import { Injectable } from '@nestjs/common';
import { Prisma, type TillBusinessDay } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  accYearOf,
  assertTillPartitions,
  businessDateNow,
  dateParam,
  isoDateOf,
} from '../till-dates';
import { throwTill, throwTillNotFound } from '../till-errors';
import type { TillCaller } from '../till-context.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService } from './till-ledger.service';
import { TILL_SETTING_DEFAULTS, type TillSettings } from '../till.settings';
import {
  TILL_CASH_AWAITING_ROLE,
  TillDayStatus,
  TillErrorCode,
  TillEventCode,
  TillReceiptStatus,
  TillSessionStatus,
} from '../types/till-enum';
import { resolveRoleLedgers } from '../../accountsModule/ledgerRole/ledger-map.helper';
import type { TillDayPayload } from '../types/till-api.types';

type Tx = Prisma.TransactionClient;

/** What `ensureOpenDay` answers: the day's key and whether THIS call created the row. */
export interface OpenDay {
  tbdId: string;
  tbdAccYear: string;
  businessDate: string;
  created: boolean;
}

/**
 * The business day (§5.3, D2): one per branch per trading date, above every
 * session. Phase 1 owns opening it — automatically with the first session
 * (till.day_auto_open) or by a manager's Day Open — and reading it. The day
 * close, its checklist and the store Z are phase 4; the day already reports
 * the bags no supervisor has received (notes 113), which that close refuses on.
 */
@Injectable()
export class TillDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TillEventService,
    private readonly ledger: TillLedgerService,
  ) {}

  /**
   * The OPEN day for the current business date, opening it when the setting
   * allows. A day already CLOSING takes no new session; a CLOSED one takes no
   * session (TILL_DAY_NOT_OPEN, notes 117) and no money (SALES_DAY_CLOSED from
   * the sales guards).
   *
   * Race-free without a lock: ux_tbd_date is the arbiter. Two counters opening
   * their first sessions together both INSERT … ON CONFLICT DO NOTHING; one
   * row lands, both read it back.
   */
  async ensureOpenDay(
    tx: Tx,
    scope: { companyId: string; branchId: string; tenantId: string | null },
    settings: TillSettings,
    caller: TillCaller,
    /** SESSION = the first session opening it (needs till.day_auto_open); MANAGER = Day Open. */
    by: 'SESSION' | 'MANAGER',
  ): Promise<OpenDay> {
    const autoOpen = by === 'MANAGER' || settings.dayAutoOpen;
    const businessDate = await businessDateNow(tx, settings.dayCutoff);
    const accYear = accYearOf(businessDate);
    await assertTillPartitions(tx, accYear, 'businessDate');

    let created = false;
    if (autoOpen) {
      const inserted = await tx.$queryRaw<{ tbd_id: string }[]>`
        INSERT INTO accounts.till_business_day
               (tbd_company_id, tbd_branch_id, tbd_tenant_id, tbd_acc_year, tbd_business_date,
                tbd_status, tbd_opened_by, tbd_created_by)
        VALUES (${scope.companyId}::uuid, ${scope.branchId}::uuid, ${scope.tenantId}::uuid,
                ${accYear}::char(9), ${businessDate}::date,
                'OPEN', ${caller.userId}::uuid, ${caller.actorName})
        ON CONFLICT (tbd_company_id, tbd_branch_id, tbd_business_date, tbd_acc_year)
          WHERE tbd_is_deleted = false
          DO NOTHING
        RETURNING tbd_id`;
      created = inserted.length === 1;
    }

    const day = await tx.tillBusinessDay.findFirst({
      where: {
        tbdCompanyId: scope.companyId,
        tbdBranchId: scope.branchId,
        tbdAccYear: accYear,
        tbdBusinessDate: dateParam(businessDate),
        tbdIsDeleted: false,
      },
      select: { tbdId: true, tbdStatus: true },
    });
    if (!day) {
      throwTill(
        TillErrorCode.DAY_NOT_OPEN,
        `Business day ${businessDate} is not open. A manager opens it (Business Day, menu 274), or set till.day_auto_open.`,
        'businessDate',
        { businessDate },
      );
    }
    const status = day.tbdStatus as TillDayStatus;
    if (status === TillDayStatus.CLOSING) {
      throwTill(
        TillErrorCode.DAY_CLOSING,
        `Business day ${businessDate} is closing: no new session may open`,
        'businessDate',
        { businessDate },
      );
    }
    if (status === TillDayStatus.CLOSED) {
      // Notes 117: no session opens on a closed day (bills into it answer
      // SALES_DAY_CLOSED from the sales guards, which read this table).
      throwTill(
        TillErrorCode.DAY_NOT_OPEN,
        `Business day ${businessDate} is closed: a manager reopens it (days/reopen) before a session opens on it`,
        'businessDate',
        { businessDate, status },
      );
    }

    if (created) {
      await this.events.log(tx, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        accYear,
        code: TillEventCode.DAY_OPEN,
        dayId: day.tbdId,
        deviceId: caller.deviceId,
        userId: caller.userId,
        payload: { businessDate, openedBy: by },
      });
    }
    return { tbdId: day.tbdId, tbdAccYear: accYear, businessDate, created };
  }

  /** Day Open by a manager — the only way in when till.day_auto_open is false. */
  async open(
    scope: { companyId: string; branchId: string; tenantId: string | null },
    settings: TillSettings,
    caller: TillCaller,
  ): Promise<{ day: TillDayPayload; created: boolean }> {
    const opened = await this.prisma.$transaction((tx) =>
      this.ensureOpenDay(tx, scope, settings, caller, 'MANAGER'),
    );
    return {
      day: await this.get({ ...scope, accYear: opened.tbdAccYear, tbdId: opened.tbdId }),
      created: opened.created,
    };
  }

  /** One day by id, or the current business date's when no id is given. */
  async get(
    scope: { companyId: string; branchId: string; accYear: string; tbdId?: string | null },
    settings?: TillSettings,
  ): Promise<TillDayPayload> {
    let where: Prisma.TillBusinessDayWhereInput;
    if (scope.tbdId) {
      where = { tbdId: scope.tbdId, tbdAccYear: scope.accYear };
    } else {
      const businessDate = await businessDateNow(this.prisma, settings?.dayCutoff ?? '04:00');
      where = { tbdAccYear: accYearOf(businessDate), tbdBusinessDate: dateParam(businessDate) };
    }
    const day = await this.prisma.tillBusinessDay.findFirst({
      where: {
        ...where,
        tbdCompanyId: scope.companyId,
        tbdBranchId: scope.branchId,
        tbdIsDeleted: false,
      },
    });
    if (!day) {
      throwTillNotFound(
        TillErrorCode.DAY_NOT_FOUND,
        'Business day',
        'tbdId',
        scope.tbdId ?? 'for today',
      );
    }
    const counts = await this.prisma.tillSession.groupBy({
      by: ['tssStatus'],
      where: { tssDayId: day.tbdId, tssAccYear: day.tbdAccYear, tssIsDeleted: false },
      _count: { _all: true },
    });
    // Notes 113: every unreceived bag of the branch, this day's apart. A bag's
    // doc date is its session's business date, so "earlier" is by that date.
    const awaiting = await this.prisma.tillCashMovement.findMany({
      where: {
        tcmCompanyId: day.tbdCompanyId,
        tcmBranchId: day.tbdBranchId,
        tcmIsDeleted: false,
        tcmStatus: 'POSTED',
        tcmReceiptStatus: TillReceiptStatus.AWAITING,
        tcmDocDate: { lte: day.tbdBusinessDate },
      },
      select: { tcmDayId: true, tcmCreatedOn: true },
      orderBy: { tcmCreatedOn: 'asc' },
    });
    const thisDay = awaiting.filter((m) => m.tcmDayId === day.tbdId).length;
    const closer = day.tbdClosedBy
      ? await this.prisma.userMaster.findUnique({
          where: { usrId: day.tbdClosedBy },
          select: { usrLoginName: true, usrDisplayName: true },
        })
      : null;
    const num = (v: Prisma.Decimal | null) => (v === null ? 0 : Number(v.toFixed(2)));
    return {
      tbdId: day.tbdId,
      tbdAccYear: day.tbdAccYear,
      tbdCompanyId: day.tbdCompanyId,
      tbdBranchId: day.tbdBranchId,
      tbdBusinessDate: isoDateOf(day.tbdBusinessDate),
      tbdStatus: day.tbdStatus as TillDayStatus,
      tbdOpenedOn: day.tbdOpenedOn.toISOString(),
      tbdOpenedBy: day.tbdOpenedBy,
      tbdClosedOn: day.tbdClosedOn ? day.tbdClosedOn.toISOString() : null,
      tbdClosedBy: day.tbdClosedBy,
      tbdClosedByName: closer ? closer.usrDisplayName?.trim() || closer.usrLoginName : null,
      tbdZNo: day.tbdZNo,
      tbdReopenCount: day.tbdReopenCount,
      totals: {
        sessionCount: day.tbdSessionCount,
        billCount: day.tbdBillCount,
        netSales: num(day.tbdNetSales),
        cashExpected: num(day.tbdCashExpected),
        cashCounted: num(day.tbdCashCounted),
        cashVariance: num(day.tbdCashVariance),
        noncashVariance: num(day.tbdNoncashVariance),
      },
      tbdExceptionCount: day.tbdExceptionCount,
      tbdCloseApprovalId: day.tbdCloseApprovalId,
      tbdPrintCount: day.tbdPrintCount,
      tbdNotes: day.tbdNotes,
      sessions: counts.map((c) => ({
        status: c.tssStatus as TillSessionStatus,
        count: c._count._all,
      })),
      handoverReceipt: (settings ?? TILL_SETTING_DEFAULTS).handoverReceipt,
      awaitingReceipt: {
        thisDay,
        earlierDays: awaiting.length - thisDay,
        oldestOn: awaiting[0]?.tcmCreatedOn.toISOString() ?? null,
      },
      safe: {
        opening: num(day.tbdSafeOpening),
        expected: num(day.tbdSafeExpected),
        counted: day.tbdSafeCounted === null ? null : num(day.tbdSafeCounted),
        remitted: num(day.tbdRemitted),
        // Notes 124 §3: the books stand as they are; a safe below zero says
        // why — cash handed over and not yet received into it.
        belowZero:
          (day.tbdStatus === TillDayStatus.CLOSED && num(day.tbdSafeOpening) < 0) ||
          num(day.tbdSafeExpected) < 0,
        ...(await this.awaitingAsOf(day)),
      },
    };
  }

  /**
   * Notes 124 §3 — what the safe's book does not hold yet: cash handed over (a
   * close's hand-over, a drop) and not yet received into a safe, read as the
   * safe book is (notes 122 §6: vouchers by their date) — the branch's Till
   * cash awaiting receipt ledger at the end of the day before (`awaitingOpening`,
   * beside `opening`) and of the day (`awaiting`, beside `expected`). A
   * hand-over approved on a later day is in both until that day, so a safe
   * that gave out floats before it shows below zero by about this much.
   * 0 when the role has no ledger (no hand-over ever waited).
   */
  private async awaitingAsOf(
    day: TillBusinessDay,
  ): Promise<{ awaitingOpening: number; awaiting: number }> {
    const businessDate = isoDateOf(day.tbdBusinessDate);
    const dayBefore = isoDateOf(new Date(day.tbdBusinessDate.getTime() - 86_400_000));
    return this.prisma.$transaction(async (tx) => {
      const [hit] = [
        ...(
          await resolveRoleLedgers(tx, [{ role: TILL_CASH_AWAITING_ROLE }], {
            companyId: day.tbdCompanyId,
            branchId: day.tbdBranchId,
            where: 'till',
          })
        ).values(),
      ];
      if (!hit) {
        return { awaitingOpening: 0, awaiting: 0 };
      }
      // Generic plans make the books' SQL ~150x slower after five runs.
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      const at = async (upTo: string) => {
        const scope = {
          companyId: day.tbdCompanyId,
          branchId: day.tbdBranchId,
          accYear: day.tbdAccYear,
          upTo,
        };
        const bal = (await this.ledger.ledgerBalances(tx, scope, [hit.ledgerId])).get(
          hit.ledgerId,
        );
        return bal ? Number(bal.toFixed(2)) : 0;
      };
      return { awaitingOpening: await at(dayBefore), awaiting: await at(businessDate) };
    });
  }
}
