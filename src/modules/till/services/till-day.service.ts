import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import type { TillSettings } from '../till.settings';
import { TillEventService } from './till-event.service';
import { TillDayStatus, TillErrorCode, TillEventCode, TillSessionStatus } from '../types/till-enum';
import type { TillDayPayload } from '../types/till-api.types';

type Tx = Prisma.TransactionClient;

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
 * close, its checklist and the store Z are phase 4.
 */
@Injectable()
export class TillDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TillEventService,
  ) {}

  /**
   * The OPEN day for the current business date, opening it when the setting
   * allows. A day already CLOSING takes no new session; a CLOSED one takes no
   * money at all (SALES_DAY_CLOSED — the error /bills/retender already speaks).
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
      throwTill(
        TillErrorCode.SALES_DAY_CLOSED,
        `Business day ${businessDate} is closed`,
        'businessDate',
        { businessDate },
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
      throwTillNotFound('Business day', 'tbdId', scope.tbdId ?? 'for today');
    }
    const counts = await this.prisma.tillSession.groupBy({
      by: ['tssStatus'],
      where: { tssDayId: day.tbdId, tssAccYear: day.tbdAccYear, tssIsDeleted: false },
      _count: { _all: true },
    });
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
      tbdZNo: day.tbdZNo,
      tbdReopenCount: day.tbdReopenCount,
      sessions: counts.map((c) => ({
        status: c.tssStatus as TillSessionStatus,
        count: c._count._all,
      })),
    };
  }
}
