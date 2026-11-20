import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { WaCryptoService } from './wa-crypto.service';
import { WaEventsService } from './wa-events.service';
import { WaSendService } from './wa-send.service';
import { WaSettingsService } from './wa-settings.service';
import { WaStore } from './wa-store.service';
import { WA_CODES, WA_POLL } from './wa.constants';

interface DueRow {
  wac_company_id: string;
  wac_state: string;
  wac_last_poll_on: Date | null;
  wac_fast_poll_until: Date | null;
}

/** Decision 20 — is this company due a pull now? Pure, for the unit tests. */
export function pollDue(row: DueRow, failures: number, now: number): boolean {
  if (row.wac_state !== 'CONNECTED' && row.wac_state !== 'CONNECTING') return false;
  const last = row.wac_last_poll_on ? row.wac_last_poll_on.getTime() : 0;
  const since = now - last;
  if (failures >= WA_POLL.BACKOFF_AFTER_FAILS) return since >= WA_POLL.BACKOFF_MS;
  const fast = row.wac_fast_poll_until !== null && row.wac_fast_poll_until.getTime() > now;
  return since >= (fast ? WA_POLL.FAST_MS : WA_POLL.SLOW_MS) - 500;
}

/**
 * The background side of the WhatsApp module (the BackendUpdateService timer
 * pattern): every 10 s it pulls relay events for each company that is due
 * (60 s, or 10 s for 5 min after a send / Connect, 5 min after 3 failed pulls),
 * only while CONNECTED / CONNECTING, under the DB lease; every minute it fails
 * rows stuck SENDING for 10 minutes (WA_SEND_INTERRUPTED); once a day it purges
 * message details past whatsapp.log_retention_years.
 *
 * Off under NODE_ENV=test unless WA_POLL_IN_TEST=1, on an offline site (Q1),
 * and while WA_CRED_KEY / WA_RELAY_URL are unset.
 */
@Injectable()
export class WaPollerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WaPollerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastSweep = 0;
  private lastRetention = 0;

  constructor(
    private readonly store: WaStore,
    private readonly events: WaEventsService,
    private readonly sends: WaSendService,
    private readonly settings: WaSettingsService,
    private readonly crypto: WaCryptoService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test' && process.env.WA_POLL_IN_TEST !== '1') {
      this.logger.log('NODE_ENV=test: WhatsApp poller off');
      return;
    }
    if (this.store.offlineSite()) {
      this.logger.log('Offline site: WhatsApp poller off (WhatsApp runs on the main server)');
      return;
    }
    // The first retention pass a minute after boot, then daily.
    this.lastRetention = Date.now() - WA_POLL.RETENTION_EVERY_MS + 60_000;
    this.timer = setInterval(() => void this.tick(), WA_POLL.TICK_MS);
    this.timer.unref();
    this.logger.log(`WhatsApp poller on (${this.store.processName})`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(now = Date.now()): Promise<void> {
    if (this.running) return;
    if (!this.crypto.isConfigured() || !process.env.WA_RELAY_URL?.trim()) return;
    this.running = true;
    try {
      const rows = await this.store.prisma.$queryRaw<DueRow[]>`
        SELECT wac_company_id, wac_state, wac_last_poll_on, wac_fast_poll_until
          FROM public.wa_connection
         WHERE wac_is_deleted = false AND wac_state IN ('CONNECTED', 'CONNECTING')`;
      for (const row of rows) {
        if (!pollDue(row, this.events.failures.get(row.wac_company_id) ?? 0, now)) continue;
        const r = await this.events.pullOnce(row.wac_company_id).catch((e) => {
          this.logger.warn(`pull for ${row.wac_company_id} failed: ${String(e)}`);
          return null;
        });
        if (r?.error && r.error !== 'lease held elsewhere') {
          this.logger.warn(`pull for ${row.wac_company_id}: ${r.error}`);
        }
      }
      if (now - this.lastSweep >= 60_000) {
        this.lastSweep = now;
        await this.sweepSending();
      }
      if (now - this.lastRetention >= WA_POLL.RETENTION_EVERY_MS) {
        this.lastRetention = now;
        await this.purge();
      }
    } catch (e) {
      this.logger.warn(`WhatsApp poller tick failed: ${String(e)}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Risk 6 — a send cut off by a restart (or one the relay never confirmed and
   * no event settled): SENDING for 10 minutes → FAILED WA_SEND_INTERRUPTED, and,
   * like the send path, a WHATSAPP_FAILED status step on its document (review N6).
   */
  async sweepSending(): Promise<number> {
    const busy = [...this.sends.inFlight];
    const swept = await this.store.prisma.$queryRaw<{ wml_id: string; wml_acc_year: string; wml_src_doc_id: string | null }[]>`
      UPDATE public.wa_message_log
         SET wml_status = 'FAILED', wml_error_code = ${WA_CODES.SEND_INTERRUPTED},
             wml_error_text = 'The server stopped while this message was being sent',
             wml_failed_on = COALESCE(wml_failed_on, now()), wml_modified_on = now()
       WHERE wml_status = 'SENDING'
         AND wml_created_on < now() - (${WA_POLL.SENDING_SWEEP_MINUTES}::int * interval '1 minute')
         AND NOT (wml_id = ANY(${busy}::uuid[]))
      RETURNING wml_id, wml_acc_year, wml_src_doc_id`;
    if (swept.length > 0) {
      this.logger.warn(`${swept.length} WhatsApp message(s) stuck SENDING marked FAILED WA_SEND_INTERRUPTED`);
    }
    for (const r of swept) {
      if (r.wml_src_doc_id) {
        await this.sends.statusStepForRow(r.wml_id, r.wml_acc_year, 'FAILED');
      }
    }
    return swept.length;
  }

  /**
   * F21 / Q19 — past the company's retention the text, number and Meta ids go;
   * kind, status, dates, party id and the cost rate stay for the counts.
   */
  async purge(): Promise<number> {
    const companies = await this.store.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT wml_company_id AS id FROM public.wa_message_log WHERE wml_purged_on IS NULL`;
    let total = 0;
    for (const c of companies) {
      const years = (await this.settings.read(c.id)).logRetentionYears;
      total += await this.store.prisma.$executeRaw`
        UPDATE public.wa_message_log
           SET wml_phone = NULL, wml_params = NULL, wml_meta_message_id = NULL, wml_relay_msg_id = NULL,
               wml_error_text = NULL, wml_party_name = NULL, wml_purged_on = now(), wml_modified_on = now()
         WHERE wml_company_id = ${c.id}::uuid AND wml_purged_on IS NULL
           AND wml_created_on < now() - (${years}::int * interval '1 year')`;
    }
    if (total > 0) this.logger.log(`WhatsApp log retention: ${total} row(s) purged`);
    return total;
  }
}
