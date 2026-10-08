import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { throwTill } from '../till-errors';
import { CLIENT_EVENT_CODES, TillErrorCode, type TillEventCode } from '../types/till-enum';
import type { TillEventBatchPayload } from '../types/till-api.types';

/** One journal row. Everything but the scope, the code and the year is optional. */
export interface TillEventInput {
  companyId: string;
  branchId: string;
  accYear: string;
  code: TillEventCode;
  /** Device time for a client fact; now() for the server's own. */
  eventOn?: Date;
  sessionId?: string | null;
  dayId?: string | null;
  counterId?: string | null;
  deviceId?: string | null;
  userId?: string | null;
  srcDocType?: string | null;
  srcDocId?: string | null;
  srcRefno?: string | null;
  amount?: Prisma.Decimal | null;
  reasonId?: string | null;
  approvalId?: string | null;
  clientSeq?: bigint | null;
  payload?: Prisma.InputJsonValue | null;
}

export interface ClientEventInput {
  code: string;
  eventOn: Date;
  clientSeq: bigint;
  sessionId?: string | null;
  srcDocType?: string | null;
  srcDocId?: string | null;
  srcRefno?: string | null;
  amount?: Prisma.Decimal | null;
  reasonId?: string | null;
  payload?: Prisma.InputJsonValue | null;
}

/**
 * THE writer of accounts.till_event (47 §8): INSERT only, never UPDATE, and no
 * other file writes the table — test/till-event-single-writer.e2e-spec.ts
 * reads the source tree and fails on a second writer, the stock_ledger pattern.
 *
 * The server writes a row as it acts (DAY_OPEN, SESSION_OPEN, SESSION_COUNT …).
 * A device reports what only it saw (a drawer kicked, a no-sale, an X read)
 * through ingestBatch: device time in tev_event_on, arrival in tev_created_on,
 * and (device, clientSeq) makes a re-sent batch a no-op (ux_tev_client_seq).
 */
@Injectable()
export class TillEventService {
  constructor(private readonly prisma: PrismaService) {}

  async log(tx: Prisma.TransactionClient, event: TillEventInput): Promise<void> {
    await tx.tillEvent.create({
      data: {
        tevCompanyId: event.companyId,
        tevBranchId: event.branchId,
        tevAccYear: event.accYear,
        tevEventCode: event.code,
        tevEventOn: event.eventOn ?? new Date(),
        tevSessionId: event.sessionId ?? null,
        tevDayId: event.dayId ?? null,
        tevCounterId: event.counterId ?? null,
        tevDeviceId: event.deviceId ?? null,
        tevUserId: event.userId ?? null,
        tevSrcDocType: event.srcDocType ?? null,
        tevSrcDocId: event.srcDocId ?? null,
        tevSrcRefno: event.srcRefno ?? null,
        tevAmount: event.amount ?? null,
        tevReasonId: event.reasonId ?? null,
        tevApprovalId: event.approvalId ?? null,
        tevClientSeq: event.clientSeq ?? null,
        tevPayload: event.payload ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * A device's batch. Only CLIENT_EVENT_CODES are accepted — a device must not
   * be able to write "SESSION_CLOSE" into the journal — and a session it names
   * must exist in that year (any status: a late batch for a closed session is
   * still the truth about what happened in it, and is never refused for that).
   */
  async ingestBatch(scope: {
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string;
    userId: string;
    events: ClientEventInput[];
  }): Promise<TillEventBatchPayload> {
    scope.events.forEach((event, index) => {
      if (!(CLIENT_EVENT_CODES as readonly string[]).includes(event.code)) {
        throwTill(
          TillErrorCode.EVENT_INVALID,
          `${event.code} is not an event a device may report (allowed: ${CLIENT_EVENT_CODES.join(', ')})`,
          `events.${index}.code`,
        );
      }
    });

    const sessionIds = [
      ...new Set(scope.events.map((e) => e.sessionId).filter((id): id is string => !!id)),
    ];
    if (sessionIds.length > 0) {
      const found = await this.prisma.tillSession.findMany({
        where: {
          tssId: { in: sessionIds },
          tssAccYear: scope.accYear,
          tssCompanyId: scope.companyId,
          tssBranchId: scope.branchId,
        },
        select: { tssId: true, tssCounterId: true },
      });
      const known = new Map(found.map((s) => [s.tssId, s.tssCounterId]));
      scope.events.forEach((event, index) => {
        if (event.sessionId && !known.has(event.sessionId)) {
          throwTill(
            TillErrorCode.SESSION_NOT_FOUND,
            `Session ${event.sessionId} is not a ${scope.accYear} session of this branch`,
            `events.${index}.sessionId`,
          );
        }
      });

      return this.insertBatch(scope, known);
    }
    return this.insertBatch(scope, new Map());
  }

  private async insertBatch(
    scope: {
      companyId: string;
      branchId: string;
      accYear: string;
      deviceId: string;
      userId: string;
      events: ClientEventInput[];
    },
    counterBySession: Map<string, string>,
  ): Promise<TillEventBatchPayload> {
    if (scope.events.length === 0) {
      return { accepted: 0, duplicates: 0 };
    }
    const values = scope.events.map(
      (e) => Prisma.sql`(
        ${scope.companyId}::uuid, ${scope.branchId}::uuid, ${scope.accYear}::char(9),
        ${e.code}, ${e.eventOn}::timestamptz,
        ${e.sessionId ?? null}::uuid,
        ${e.sessionId ? (counterBySession.get(e.sessionId) ?? null) : null}::uuid,
        ${scope.deviceId}::uuid, ${scope.userId}::uuid,
        ${e.srcDocType ?? null}, ${e.srcDocId ?? null}::uuid, ${e.srcRefno ?? null},
        ${e.amount ?? null}::numeric, ${e.reasonId ?? null}::uuid,
        ${e.clientSeq}::bigint,
        ${e.payload === undefined || e.payload === null ? null : JSON.stringify(e.payload)}::jsonb
      )`,
    );
    const inserted = await this.prisma.$executeRaw`
      INSERT INTO accounts.till_event (
        tev_company_id, tev_branch_id, tev_acc_year,
        tev_event_code, tev_event_on,
        tev_session_id, tev_counter_id,
        tev_device_id, tev_user_id,
        tev_src_doc_type, tev_src_doc_id, tev_src_refno,
        tev_amount, tev_reason_id,
        tev_client_seq, tev_payload
      ) VALUES ${Prisma.join(values)}
      ON CONFLICT (tev_device_id, tev_client_seq, tev_acc_year)
        WHERE tev_device_id IS NOT NULL AND tev_client_seq IS NOT NULL
        DO NOTHING`;
    return { accepted: inserted, duplicates: scope.events.length - inserted };
  }
}
