import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type WaConnection } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WaRelayError } from './wa-errors';
import { normalisedOrNull } from './wa-phone';
import { WaRelayClient, type RelayEvent } from './wa-relay.client';
import { mergeStatus, statusChanged, type RelayStatus, type StatusRowState } from './wa-status';
import { WaSendService } from './wa-send.service';
import { WaStore } from './wa-store.service';
import { WA_POLL, type WaStatus } from './wa.constants';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: RelayStatus[] = ['SENT', 'DELIVERED', 'READ', 'FAILED'];
export const WA_AUDIT_SCREEN = 'WhatsApp';

/** A message the event poll moved off SENDING: its status step is filed after the pull's commit. */
interface Settled {
  wmlId: string;
  accYear: string;
  result: 'SENT' | 'FAILED';
}

export interface PullResult {
  pulled: boolean;
  applied: number;
  cursor: string;
  state: string | null;
  error: string | null;
}

/**
 * Decision 20 / plan §5.2 "Events applied by the poller": GET /v1/events after
 * the stored cursor, apply each event idempotently and in any order, store the
 * cursor IN THE SAME transaction, then ack. Only the process holding the lease
 * on the wa_connection row pulls (the dev box runs the API twice on one DB).
 * After a TEMPLATE / ACCOUNT event, and every 30 minutes, /v1/connection is
 * read again and mirrored.
 */
@Injectable()
export class WaEventsService {
  private readonly logger = new Logger(WaEventsService.name);
  /** Pulls that failed in a row, per company (this process). */
  readonly failures = new Map<string, number>();
  private readonly lastConnectionRead = new Map<string, number>();

  constructor(
    private readonly store: WaStore,
    private readonly relay: WaRelayClient,
    private readonly audit: AuditLogService,
    private readonly sends: WaSendService,
  ) {}

  /**
   * Take the lease (WA_POLL.LEASE_SECONDS, longer than a worst-case pull);
   * false while ANY pull holds it — another process, or this one (review N5:
   * not re-entrant, so the poller and a /connection/refresh never pull the same
   * company at once).
   */
  async takeLease(wacId: string): Promise<boolean> {
    const rows = await this.store.prisma.$queryRaw<{ wac_id: string }[]>`
      UPDATE public.wa_connection
         SET wac_poll_lease_until = now() + (${WA_POLL.LEASE_SECONDS}::int * interval '1 second'),
             wac_poll_lease_by = ${this.store.processName}
       WHERE wac_id = ${wacId}::uuid
         AND (wac_poll_lease_until IS NULL OR wac_poll_lease_until < now())
      RETURNING wac_id`;
    return rows.length === 1;
  }

  async releaseLease(wacId: string): Promise<void> {
    await this.store.prisma.$executeRaw`
      UPDATE public.wa_connection SET wac_poll_lease_until = NULL, wac_poll_lease_by = NULL
       WHERE wac_id = ${wacId}::uuid AND wac_poll_lease_by = ${this.store.processName}`;
  }

  /**
   * One pull for one company. `force` (POST /connection/refresh, the activation)
   * also re-reads /v1/connection whatever happened.
   */
  async pullOnce(companyId: string, opts: { force?: boolean } = {}): Promise<PullResult> {
    const row = await this.store.row(companyId);
    if (!row) {
      return { pulled: false, applied: 0, cursor: '0', state: null, error: null };
    }
    if (!(await this.takeLease(row.wacId))) {
      return { pulled: false, applied: 0, cursor: row.wacEventCursor.toString(), state: row.wacState, error: 'lease held elsewhere' };
    }
    let applied = 0;
    let cursor = row.wacEventCursor;
    let error: string | null = null;
    const started = Date.now();
    try {
      const key = this.store.keyOf(row);
      let refresh =
        opts.force === true ||
        row.wacState === 'CONNECTING' ||
        Date.now() - (this.lastConnectionRead.get(companyId) ?? 0) > WA_POLL.CONNECTION_EVERY_MS;
      // Review N5: no new page after PULL_BUDGET_MS, so the pull ends inside its lease.
      for (let page = 0; page < 50 && Date.now() - started < WA_POLL.PULL_BUDGET_MS; page++) {
        const { events, more } = await this.relay.events(row.wacRelayUrl, key, cursor, 200);
        if (events.length === 0) break;
        const maxId = events.reduce((m, e) => Math.max(m, Number(e.id)), Number(cursor));
        const settled: Settled[] = [];
        await this.store.prisma.$transaction(async (tx) => {
          for (const ev of events.sort((a, b) => Number(a.id) - Number(b.id))) {
            if (await this.apply(tx, row, ev, settled)) applied++;
            if (ev.kind === 'TEMPLATE' || ev.kind === 'ACCOUNT') refresh = true;
          }
          await tx.$executeRaw`
            UPDATE public.wa_connection
               SET wac_event_cursor = GREATEST(wac_event_cursor, ${BigInt(maxId)}::bigint)
             WHERE wac_id = ${row.wacId}::uuid`;
        });
        cursor = BigInt(Math.max(Number(cursor), maxId));
        // A send the relay could not confirm (review S3) files its status step once an event settles it.
        for (const x of settled) {
          await this.sends.statusStepForRow(x.wmlId, x.accYear, x.result);
        }
        try {
          await this.relay.ack(row.wacRelayUrl, key, maxId);
        } catch (e) {
          this.logger.warn(`ack ${maxId} for ${row.wacShopCode} failed: ${String(e)}`);
        }
        if (!more) break;
      }
      if (refresh) {
        const conn = await this.relay.connection(row.wacRelayUrl, key);
        await this.store.mirror(row, conn, 'poller');
        this.lastConnectionRead.set(companyId, Date.now());
      }
      this.failures.delete(companyId);
      await this.store.prisma.$executeRaw`
        UPDATE public.wa_connection
           SET wac_last_poll_on = now(), wac_last_poll_ok_on = now(), wac_last_poll_error = NULL
         WHERE wac_id = ${row.wacId}::uuid`;
    } catch (e) {
      error =
        e instanceof WaRelayError ? `${e.waCode}: ${e.message}` : e instanceof Error ? e.message : String(e);
      this.failures.set(companyId, (this.failures.get(companyId) ?? 0) + 1);
      await this.store.noteRelayError(row, e, 'poller');
      await this.store.prisma.$executeRaw`
        UPDATE public.wa_connection
           SET wac_last_poll_on = now(), wac_last_poll_error = ${error.slice(0, 200)}
         WHERE wac_id = ${row.wacId}::uuid`;
      if (opts.force) {
        throw e;
      }
    } finally {
      await this.releaseLease(row.wacId).catch(() => undefined);
    }
    return { pulled: true, applied, cursor: cursor.toString(), state: row.wacState, error };
  }

  /**
   * One event, inside the pull's transaction. True when it changed something.
   * A row that leaves SENDING here is pushed on `settled` (its step is filed
   * after the commit).
   */
  async apply(tx: Prisma.TransactionClient, conn: WaConnection, ev: RelayEvent, settled: Settled[] = []): Promise<boolean> {
    const at = ev.at ? new Date(ev.at) : new Date();
    switch (ev.kind) {
      case 'STATUS':
        return this.applyStatus(tx, conn.wacCompanyId, ev, at, settled);
      case 'TAP':
        return this.applyTap(tx, conn.wacCompanyId, ev, at);
      case 'STOP':
        return this.applyStop(tx, conn.wacCompanyId, ev, at);
      default:
        return false;
    }
  }

  private async findRow(
    tx: Prisma.TransactionClient,
    companyId: string,
    ev: RelayEvent,
  ): Promise<
    | (StatusRowState & { wml_id: string; wml_acc_year: string; wml_party_id: string | null; wml_party_name: string | null })
    | null
  > {
    const byRef = ev.clientRef && UUID.test(ev.clientRef);
    const rows = await tx.$queryRaw<
      {
        wml_id: string;
        wml_acc_year: string;
        wml_status: WaStatus;
        wml_sent_on: Date | null;
        wml_delivered_on: Date | null;
        wml_read_on: Date | null;
        wml_failed_on: Date | null;
        wml_error_code: string | null;
        wml_meta_error_code: number | null;
        wml_error_text: string | null;
        wml_party_id: string | null;
        wml_party_name: string | null;
      }[]
    >`
      SELECT wml_id, wml_acc_year, wml_status, wml_sent_on, wml_delivered_on, wml_read_on, wml_failed_on,
             wml_error_code, wml_meta_error_code, wml_error_text, wml_party_id, wml_party_name
        FROM public.wa_message_log
       WHERE wml_company_id = ${companyId}::uuid
         AND ${byRef ? Prisma.sql`wml_id = ${ev.clientRef}::uuid` : Prisma.sql`wml_meta_message_id = ${ev.wamid ?? ''}`}
       ORDER BY wml_created_on DESC
       LIMIT 1
       FOR UPDATE`;
    const r = rows[0];
    if (!r) return null;
    return {
      ...r,
      status: r.wml_status,
      sentOn: r.wml_sent_on,
      deliveredOn: r.wml_delivered_on,
      readOn: r.wml_read_on,
      failedOn: r.wml_failed_on,
      errorCode: r.wml_error_code,
      metaErrorCode: r.wml_meta_error_code,
      errorText: r.wml_error_text,
    };
  }

  private async applyStatus(
    tx: Prisma.TransactionClient,
    companyId: string,
    ev: RelayEvent,
    at: Date,
    settled: Settled[],
  ): Promise<boolean> {
    const status = (ev.status ?? '').toUpperCase() as RelayStatus;
    if (!STATUSES.includes(status)) return false;
    const row = await this.findRow(tx, companyId, ev);
    if (!row) {
      this.logger.warn(`STATUS ${status} for ${ev.clientRef ?? ev.wamid} matches no message of this company`);
      return false;
    }
    const next = mergeStatus(row, {
      status,
      at,
      metaErrorCode: ev.metaErrorCode,
      metaErrorTitle: ev.metaErrorTitle,
    });
    if (!statusChanged(row, next)) return false;
    await tx.$executeRaw`
      UPDATE public.wa_message_log
         SET wml_status = ${next.status}, wml_sent_on = ${next.sentOn}, wml_delivered_on = ${next.deliveredOn},
             wml_read_on = ${next.readOn}, wml_failed_on = ${next.failedOn},
             wml_error_code = ${next.errorCode}, wml_meta_error_code = ${next.metaErrorCode}::int,
             wml_error_text = ${next.errorText},
             wml_meta_message_id = COALESCE(wml_meta_message_id, ${ev.wamid ? ev.wamid.slice(0, 128) : null}),
             wml_modified_on = now()
       WHERE wml_id = ${row.wml_id}::uuid AND wml_acc_year = ${row.wml_acc_year}::bpchar`;
    if (row.status === 'SENDING' && next.status !== 'SENDING') {
      settled.push({ wmlId: row.wml_id, accYear: row.wml_acc_year, result: next.status === 'FAILED' ? 'FAILED' : 'SENT' });
    }
    return true;
  }

  private async applyTap(tx: Prisma.TransactionClient, companyId: string, ev: RelayEvent, at: Date): Promise<boolean> {
    const reply = ev.reply === 'PAID_ALREADY' || ev.reply === 'STOP_REMINDERS' ? ev.reply : null;
    if (!reply) return false;
    const row = await this.findRow(tx, companyId, ev);
    if (!row) return false;
    await tx.$executeRaw`
      UPDATE public.wa_message_log
         SET wml_reply = ${reply}, wml_reply_on = COALESCE(wml_reply_on, ${at}), wml_modified_on = now()
       WHERE wml_id = ${row.wml_id}::uuid AND wml_acc_year = ${row.wml_acc_year}::bpchar`;
    if (reply === 'STOP_REMINDERS' && row.wml_party_id) {
      const changed = await tx.$queryRaw<{ led_id: string; led_name: string }[]>`
        UPDATE accounts.acc_ledger_master SET led_wa_reminders_off_on = ${at}
         WHERE led_id = ${row.wml_party_id}::uuid AND led_wa_reminders_off_on IS NULL
        RETURNING led_id, led_name`;
      for (const l of changed) {
        await this.auditLedger(tx, l.led_id, l.led_name, { ledWaRemindersOffOn: null }, { ledWaRemindersOffOn: at.toISOString() },
          'WhatsApp: the customer tapped "Stop reminders"');
      }
    }
    return true;
  }

  /**
   * Typed STOP (to every install): every ledger of this company whose
   * WhatsApp / phone 1 / phone 2 is that number stops getting any WhatsApp.
   * Prefiltered in SQL on the last 10 digits, then confirmed by the normaliser.
   */
  private async applyStop(tx: Prisma.TransactionClient, companyId: string, ev: RelayEvent, at: Date): Promise<boolean> {
    const phone = normalisedOrNull(ev.fromPhone);
    if (!phone) return false;
    const tail = phone.slice(-10);
    const candidates = await tx.$queryRaw<
      { led_id: string; led_name: string; led_whatsapp_no: string | null; led_phone1: string | null; led_phone2: string | null; led_wa_all_off_on: Date | null }[]
    >`
      SELECT led_id, led_name, led_whatsapp_no, led_phone1, led_phone2, led_wa_all_off_on
        FROM accounts.acc_ledger_master
       WHERE led_is_deleted = false
         AND (led_company_id = ${companyId}::uuid OR led_company_id IS NULL)
         AND (right(regexp_replace(COALESCE(led_whatsapp_no, ''), '\\D', '', 'g'), 10) = ${tail}
           OR right(regexp_replace(COALESCE(led_phone1, ''), '\\D', '', 'g'), 10) = ${tail}
           OR right(regexp_replace(COALESCE(led_phone2, ''), '\\D', '', 'g'), 10) = ${tail})`;
    const matched = candidates.filter((l) =>
      [l.led_whatsapp_no, l.led_phone1, l.led_phone2].some((n) => normalisedOrNull(n) === phone),
    );
    for (const l of matched) {
      if (!l.led_wa_all_off_on) {
        const stopped = await tx.$executeRaw`
          UPDATE accounts.acc_ledger_master SET led_wa_all_off_on = ${at}
           WHERE led_id = ${l.led_id}::uuid AND led_wa_all_off_on IS NULL`;
        // Review N5: audited only when this UPDATE stopped it (not already stopped meanwhile).
        if (stopped > 0) {
          await this.auditLedger(tx, l.led_id, l.led_name, { ledWaAllOffOn: null }, { ledWaAllOffOn: at.toISOString() },
            'WhatsApp: the customer typed STOP');
        }
      }
      await tx.$executeRaw`
        UPDATE public.wa_message_log SET wml_reply = 'STOP_ALL', wml_reply_on = ${at}, wml_modified_on = now()
         WHERE (wml_id, wml_acc_year) IN (
               SELECT wml_id, wml_acc_year FROM public.wa_message_log
                WHERE wml_company_id = ${companyId}::uuid AND wml_party_id = ${l.led_id}::uuid
                ORDER BY wml_created_on DESC LIMIT 1)`;
    }
    return matched.length > 0;
  }

  async auditLedger(
    tx: Prisma.TransactionClient,
    ledId: string,
    name: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    notes: string,
    userId: string | null = null,
  ): Promise<void> {
    await this.audit.logEntityChange(
      {
        action: 'update',
        tableName: 'acc_ledger_master',
        screenName: WA_AUDIT_SCREEN,
        screenType: 'master',
        pk: ledId,
        displayName: name,
        originalRecord: before,
        modifiedRecord: after,
        userId,
        notes,
      },
      tx,
    );
  }
}
