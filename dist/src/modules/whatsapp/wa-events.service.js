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
var WaEventsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaEventsService = exports.WA_AUDIT_SCREEN = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const wa_errors_1 = require("./wa-errors");
const wa_phone_1 = require("./wa-phone");
const wa_relay_client_1 = require("./wa-relay.client");
const wa_status_1 = require("./wa-status");
const wa_send_service_1 = require("./wa-send.service");
const wa_store_service_1 = require("./wa-store.service");
const wa_constants_1 = require("./wa.constants");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['SENT', 'DELIVERED', 'READ', 'FAILED'];
exports.WA_AUDIT_SCREEN = 'WhatsApp';
let WaEventsService = WaEventsService_1 = class WaEventsService {
    store;
    relay;
    audit;
    sends;
    logger = new common_1.Logger(WaEventsService_1.name);
    failures = new Map();
    lastConnectionRead = new Map();
    constructor(store, relay, audit, sends) {
        this.store = store;
        this.relay = relay;
        this.audit = audit;
        this.sends = sends;
    }
    async takeLease(wacId) {
        const rows = await this.store.prisma.$queryRaw `
      UPDATE public.wa_connection
         SET wac_poll_lease_until = now() + (${wa_constants_1.WA_POLL.LEASE_SECONDS}::int * interval '1 second'),
             wac_poll_lease_by = ${this.store.processName}
       WHERE wac_id = ${wacId}::uuid
         AND (wac_poll_lease_until IS NULL OR wac_poll_lease_until < now())
      RETURNING wac_id`;
        return rows.length === 1;
    }
    async releaseLease(wacId) {
        await this.store.prisma.$executeRaw `
      UPDATE public.wa_connection SET wac_poll_lease_until = NULL, wac_poll_lease_by = NULL
       WHERE wac_id = ${wacId}::uuid AND wac_poll_lease_by = ${this.store.processName}`;
    }
    async pullOnce(companyId, opts = {}) {
        const row = await this.store.row(companyId);
        if (!row) {
            return { pulled: false, applied: 0, cursor: '0', state: null, error: null };
        }
        if (!(await this.takeLease(row.wacId))) {
            return { pulled: false, applied: 0, cursor: row.wacEventCursor.toString(), state: row.wacState, error: 'lease held elsewhere' };
        }
        let applied = 0;
        let cursor = row.wacEventCursor;
        let error = null;
        const started = Date.now();
        try {
            const key = this.store.keyOf(row);
            let refresh = opts.force === true ||
                row.wacState === 'CONNECTING' ||
                Date.now() - (this.lastConnectionRead.get(companyId) ?? 0) > wa_constants_1.WA_POLL.CONNECTION_EVERY_MS;
            for (let page = 0; page < 50 && Date.now() - started < wa_constants_1.WA_POLL.PULL_BUDGET_MS; page++) {
                const { events, more } = await this.relay.events(row.wacRelayUrl, key, cursor, 200);
                if (events.length === 0)
                    break;
                const maxId = events.reduce((m, e) => Math.max(m, Number(e.id)), Number(cursor));
                const settled = [];
                await this.store.prisma.$transaction(async (tx) => {
                    for (const ev of events.sort((a, b) => Number(a.id) - Number(b.id))) {
                        if (await this.apply(tx, row, ev, settled))
                            applied++;
                        if (ev.kind === 'TEMPLATE' || ev.kind === 'ACCOUNT')
                            refresh = true;
                    }
                    await tx.$executeRaw `
            UPDATE public.wa_connection
               SET wac_event_cursor = GREATEST(wac_event_cursor, ${BigInt(maxId)}::bigint)
             WHERE wac_id = ${row.wacId}::uuid`;
                });
                cursor = BigInt(Math.max(Number(cursor), maxId));
                for (const x of settled) {
                    await this.sends.statusStepForRow(x.wmlId, x.accYear, x.result);
                }
                try {
                    await this.relay.ack(row.wacRelayUrl, key, maxId);
                }
                catch (e) {
                    this.logger.warn(`ack ${maxId} for ${row.wacShopCode} failed: ${String(e)}`);
                }
                if (!more)
                    break;
            }
            if (refresh) {
                const conn = await this.relay.connection(row.wacRelayUrl, key);
                await this.store.mirror(row, conn, 'poller');
                this.lastConnectionRead.set(companyId, Date.now());
            }
            this.failures.delete(companyId);
            await this.store.prisma.$executeRaw `
        UPDATE public.wa_connection
           SET wac_last_poll_on = now(), wac_last_poll_ok_on = now(), wac_last_poll_error = NULL
         WHERE wac_id = ${row.wacId}::uuid`;
        }
        catch (e) {
            error =
                e instanceof wa_errors_1.WaRelayError ? `${e.waCode}: ${e.message}` : e instanceof Error ? e.message : String(e);
            this.failures.set(companyId, (this.failures.get(companyId) ?? 0) + 1);
            await this.store.noteRelayError(row, e, 'poller');
            await this.store.prisma.$executeRaw `
        UPDATE public.wa_connection
           SET wac_last_poll_on = now(), wac_last_poll_error = ${error.slice(0, 200)}
         WHERE wac_id = ${row.wacId}::uuid`;
            if (opts.force) {
                throw e;
            }
        }
        finally {
            await this.releaseLease(row.wacId).catch(() => undefined);
        }
        return { pulled: true, applied, cursor: cursor.toString(), state: row.wacState, error };
    }
    async apply(tx, conn, ev, settled = []) {
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
    async findRow(tx, companyId, ev) {
        const byRef = ev.clientRef && UUID.test(ev.clientRef);
        const rows = await tx.$queryRaw `
      SELECT wml_id, wml_acc_year, wml_status, wml_sent_on, wml_delivered_on, wml_read_on, wml_failed_on,
             wml_error_code, wml_meta_error_code, wml_error_text, wml_party_id, wml_party_name
        FROM public.wa_message_log
       WHERE wml_company_id = ${companyId}::uuid
         AND ${byRef ? client_1.Prisma.sql `wml_id = ${ev.clientRef}::uuid` : client_1.Prisma.sql `wml_meta_message_id = ${ev.wamid ?? ''}`}
       ORDER BY wml_created_on DESC
       LIMIT 1
       FOR UPDATE`;
        const r = rows[0];
        if (!r)
            return null;
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
    async applyStatus(tx, companyId, ev, at, settled) {
        const status = (ev.status ?? '').toUpperCase();
        if (!STATUSES.includes(status))
            return false;
        const row = await this.findRow(tx, companyId, ev);
        if (!row) {
            this.logger.warn(`STATUS ${status} for ${ev.clientRef ?? ev.wamid} matches no message of this company`);
            return false;
        }
        const next = (0, wa_status_1.mergeStatus)(row, {
            status,
            at,
            metaErrorCode: ev.metaErrorCode,
            metaErrorTitle: ev.metaErrorTitle,
        });
        if (!(0, wa_status_1.statusChanged)(row, next))
            return false;
        await tx.$executeRaw `
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
    async applyTap(tx, companyId, ev, at) {
        const reply = ev.reply === 'PAID_ALREADY' || ev.reply === 'STOP_REMINDERS' ? ev.reply : null;
        if (!reply)
            return false;
        const row = await this.findRow(tx, companyId, ev);
        if (!row)
            return false;
        await tx.$executeRaw `
      UPDATE public.wa_message_log
         SET wml_reply = ${reply}, wml_reply_on = COALESCE(wml_reply_on, ${at}), wml_modified_on = now()
       WHERE wml_id = ${row.wml_id}::uuid AND wml_acc_year = ${row.wml_acc_year}::bpchar`;
        if (reply === 'STOP_REMINDERS' && row.wml_party_id) {
            const changed = await tx.$queryRaw `
        UPDATE accounts.acc_ledger_master SET led_wa_reminders_off_on = ${at}
         WHERE led_id = ${row.wml_party_id}::uuid AND led_wa_reminders_off_on IS NULL
        RETURNING led_id, led_name`;
            for (const l of changed) {
                await this.auditLedger(tx, l.led_id, l.led_name, { ledWaRemindersOffOn: null }, { ledWaRemindersOffOn: at.toISOString() }, 'WhatsApp: the customer tapped "Stop reminders"');
            }
        }
        return true;
    }
    async applyStop(tx, companyId, ev, at) {
        const phone = (0, wa_phone_1.normalisedOrNull)(ev.fromPhone);
        if (!phone)
            return false;
        const tail = phone.slice(-10);
        const candidates = await tx.$queryRaw `
      SELECT led_id, led_name, led_whatsapp_no, led_phone1, led_phone2, led_wa_all_off_on
        FROM accounts.acc_ledger_master
       WHERE led_is_deleted = false
         AND (led_company_id = ${companyId}::uuid OR led_company_id IS NULL)
         AND (right(regexp_replace(COALESCE(led_whatsapp_no, ''), '\\D', '', 'g'), 10) = ${tail}
           OR right(regexp_replace(COALESCE(led_phone1, ''), '\\D', '', 'g'), 10) = ${tail}
           OR right(regexp_replace(COALESCE(led_phone2, ''), '\\D', '', 'g'), 10) = ${tail})`;
        const matched = candidates.filter((l) => [l.led_whatsapp_no, l.led_phone1, l.led_phone2].some((n) => (0, wa_phone_1.normalisedOrNull)(n) === phone));
        for (const l of matched) {
            if (!l.led_wa_all_off_on) {
                const stopped = await tx.$executeRaw `
          UPDATE accounts.acc_ledger_master SET led_wa_all_off_on = ${at}
           WHERE led_id = ${l.led_id}::uuid AND led_wa_all_off_on IS NULL`;
                if (stopped > 0) {
                    await this.auditLedger(tx, l.led_id, l.led_name, { ledWaAllOffOn: null }, { ledWaAllOffOn: at.toISOString() }, 'WhatsApp: the customer typed STOP');
                }
            }
            await tx.$executeRaw `
        UPDATE public.wa_message_log SET wml_reply = 'STOP_ALL', wml_reply_on = ${at}, wml_modified_on = now()
         WHERE (wml_id, wml_acc_year) IN (
               SELECT wml_id, wml_acc_year FROM public.wa_message_log
                WHERE wml_company_id = ${companyId}::uuid AND wml_party_id = ${l.led_id}::uuid
                ORDER BY wml_created_on DESC LIMIT 1)`;
        }
        return matched.length > 0;
    }
    async auditLedger(tx, ledId, name, before, after, notes, userId = null) {
        await this.audit.logEntityChange({
            action: 'update',
            tableName: 'acc_ledger_master',
            screenName: exports.WA_AUDIT_SCREEN,
            screenType: 'master',
            pk: ledId,
            displayName: name,
            originalRecord: before,
            modifiedRecord: after,
            userId,
            notes,
        }, tx);
    }
};
exports.WaEventsService = WaEventsService;
exports.WaEventsService = WaEventsService = WaEventsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [wa_store_service_1.WaStore,
        wa_relay_client_1.WaRelayClient,
        audit_log_service_1.AuditLogService,
        wa_send_service_1.WaSendService])
], WaEventsService);
//# sourceMappingURL=wa-events.service.js.map