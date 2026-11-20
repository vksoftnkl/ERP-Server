"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WaPollerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaPollerService = void 0;
exports.pollDue = pollDue;
const common_1 = require("@nestjs/common");
const wa_crypto_service_1 = require("./wa-crypto.service");
const wa_events_service_1 = require("./wa-events.service");
const wa_send_service_1 = require("./wa-send.service");
const wa_settings_service_1 = require("./wa-settings.service");
const wa_store_service_1 = require("./wa-store.service");
const wa_constants_1 = require("./wa.constants");
function pollDue(row, failures, now) {
    if (row.wac_state !== 'CONNECTED' && row.wac_state !== 'CONNECTING')
        return false;
    const last = row.wac_last_poll_on ? row.wac_last_poll_on.getTime() : 0;
    const since = now - last;
    if (failures >= wa_constants_1.WA_POLL.BACKOFF_AFTER_FAILS)
        return since >= wa_constants_1.WA_POLL.BACKOFF_MS;
    const fast = row.wac_fast_poll_until !== null && row.wac_fast_poll_until.getTime() > now;
    return since >= (fast ? wa_constants_1.WA_POLL.FAST_MS : wa_constants_1.WA_POLL.SLOW_MS) - 500;
}
let WaPollerService = WaPollerService_1 = class WaPollerService {
    store;
    events;
    sends;
    settings;
    crypto;
    logger = new common_1.Logger(WaPollerService_1.name);
    timer = null;
    running = false;
    lastSweep = 0;
    lastRetention = 0;
    constructor(store, events, sends, settings, crypto) {
        this.store = store;
        this.events = events;
        this.sends = sends;
        this.settings = settings;
        this.crypto = crypto;
    }
    onApplicationBootstrap() {
        if (process.env.NODE_ENV === 'test' && process.env.WA_POLL_IN_TEST !== '1') {
            this.logger.log('NODE_ENV=test: WhatsApp poller off');
            return;
        }
        if (this.store.offlineSite()) {
            this.logger.log('Offline site: WhatsApp poller off (WhatsApp runs on the main server)');
            return;
        }
        this.lastRetention = Date.now() - wa_constants_1.WA_POLL.RETENTION_EVERY_MS + 60_000;
        this.timer = setInterval(() => void this.tick(), wa_constants_1.WA_POLL.TICK_MS);
        this.timer.unref();
        this.logger.log(`WhatsApp poller on (${this.store.processName})`);
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
    }
    async tick(now = Date.now()) {
        if (this.running)
            return;
        if (!this.crypto.isConfigured() || !process.env.WA_RELAY_URL?.trim())
            return;
        this.running = true;
        try {
            const rows = await this.store.prisma.$queryRaw `
        SELECT wac_company_id, wac_state, wac_last_poll_on, wac_fast_poll_until
          FROM public.wa_connection
         WHERE wac_is_deleted = false AND wac_state IN ('CONNECTED', 'CONNECTING')`;
            for (const row of rows) {
                if (!pollDue(row, this.events.failures.get(row.wac_company_id) ?? 0, now))
                    continue;
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
            if (now - this.lastRetention >= wa_constants_1.WA_POLL.RETENTION_EVERY_MS) {
                this.lastRetention = now;
                await this.purge();
            }
        }
        catch (e) {
            this.logger.warn(`WhatsApp poller tick failed: ${String(e)}`);
        }
        finally {
            this.running = false;
        }
    }
    async sweepSending() {
        const busy = [...this.sends.inFlight];
        const swept = await this.store.prisma.$queryRaw `
      UPDATE public.wa_message_log
         SET wml_status = 'FAILED', wml_error_code = ${wa_constants_1.WA_CODES.SEND_INTERRUPTED},
             wml_error_text = 'The server stopped while this message was being sent',
             wml_failed_on = COALESCE(wml_failed_on, now()), wml_modified_on = now()
       WHERE wml_status = 'SENDING'
         AND wml_created_on < now() - (${wa_constants_1.WA_POLL.SENDING_SWEEP_MINUTES}::int * interval '1 minute')
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
    async purge() {
        const companies = await this.store.prisma.$queryRaw `
      SELECT DISTINCT wml_company_id AS id FROM public.wa_message_log WHERE wml_purged_on IS NULL`;
        let total = 0;
        for (const c of companies) {
            const years = (await this.settings.read(c.id)).logRetentionYears;
            total += await this.store.prisma.$executeRaw `
        UPDATE public.wa_message_log
           SET wml_phone = NULL, wml_params = NULL, wml_meta_message_id = NULL, wml_relay_msg_id = NULL,
               wml_error_text = NULL, wml_party_name = NULL, wml_purged_on = now(), wml_modified_on = now()
         WHERE wml_company_id = ${c.id}::uuid AND wml_purged_on IS NULL
           AND wml_created_on < now() - (${years}::int * interval '1 year')`;
        }
        if (total > 0)
            this.logger.log(`WhatsApp log retention: ${total} row(s) purged`);
        return total;
    }
};
exports.WaPollerService = WaPollerService;
exports.WaPollerService = WaPollerService = WaPollerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [wa_store_service_1.WaStore,
        wa_events_service_1.WaEventsService,
        wa_send_service_1.WaSendService,
        wa_settings_service_1.WaSettingsService,
        wa_crypto_service_1.WaCryptoService])
], WaPollerService);
//# sourceMappingURL=wa-poller.service.js.map