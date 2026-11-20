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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaMessagesService = void 0;
exports.typedInPopup = typedInPopup;
const common_1 = require("@nestjs/common");
const wa_errors_1 = require("./wa-errors");
const wa_send_service_1 = require("./wa-send.service");
const wa_store_service_1 = require("./wa-store.service");
const wa_constants_1 = require("./wa.constants");
const RESENT_KINDS = ['TEST', 'ORDER'];
const RETRY_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };
let WaMessagesService = class WaMessagesService {
    store;
    sends;
    constructor(store, sends) {
        this.store = store;
        this.sends = sends;
    }
    async send(dto) {
        await this.store.right(wa_constants_1.WA_MENU_OF_DOC[dto.docType], 'print', 'send this document (Print right)');
        this.store.assertMainServer();
        const actor = await this.store.actor();
        const prepared = await this.sends.prepareDocument({
            companyId: dto.companyId,
            docType: dto.docType,
            docId: dto.docId,
            docAccYear: dto.docAccYear,
            trigger: 'MANUAL',
            bodyPhone: dto.phone?.trim() || null,
            lang: dto.lang ?? null,
            actor,
        });
        if ('notConnected' in prepared) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.NOT_CONNECTED, 'WhatsApp is not connected', 'companyId');
        }
        return this.sends.deliverForAnswer(prepared);
    }
    async retry(dto) {
        await this.store.right(wa_constants_1.WA_MENU.LOG, 'post', 'resend WhatsApp messages');
        this.store.assertMainServer();
        const actor = await this.store.actor();
        const prepared = await this.store.prisma.$transaction(async (tx) => {
            const row = await this.loadRow(dto.companyId, dto.wmlId, dto.accYear, tx);
            if (!RESENT_KINDS.includes(row.wml_kind)) {
                (0, wa_errors_1.waRefuse)(wa_errors_1.WA_HOUSE_CODES.KIND_NOT_SENT, `A ${row.wml_kind} message cannot be resent by this server version (only ${RESENT_KINDS.join(', ')})`, 'wmlId', { kind: row.wml_kind });
            }
            await this.lockRoot(tx, row);
            const chain = await this.chain(tx, row);
            const latest = chain.reduce((a, r) => (r.wml_try_no > a.wml_try_no || (r.wml_try_no === a.wml_try_no && r.wml_created_on > a.wml_created_on) ? r : a), row);
            const which = latest.wml_id === row.wml_id ? 'This message' : `Its latest try (${latest.wml_try_no})`;
            if (latest.wml_status === 'SENDING') {
                (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.RETRY_NOT_ALLOWED, `${which} is still being sent`, 'wmlId', {
                    status: latest.wml_status,
                    latestWmlId: latest.wml_id,
                    latestAccYear: latest.wml_acc_year,
                });
            }
            if ((latest.wml_status === 'DELIVERED' || latest.wml_status === 'READ') && dto.confirmResend !== true) {
                (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.ALREADY_DELIVERED, `${which} is already ${latest.wml_status}: send confirmResend: true to send it again`, 'confirmResend', { status: latest.wml_status, latestWmlId: latest.wml_id, latestAccYear: latest.wml_acc_year });
            }
            const tryNo = latest.wml_try_no + 1;
            if (row.wml_kind === 'TEST') {
                return this.sends.prepareTest({ companyId: dto.companyId, phone: row.wml_phone ?? '', tryNo, retryOf: row.wml_id, actor }, tx);
            }
            const next = await this.sends.prepareDocument({
                companyId: dto.companyId,
                docType: row.wml_src_doc_type,
                docId: row.wml_src_doc_id,
                docAccYear: row.wml_src_acc_year.trim(),
                trigger: 'RETRY',
                tryNo,
                retryOf: row.wml_id,
                bodyPhone: typedInPopup(row) ? row.wml_phone : null,
                lang: row.wml_lang_wanted,
                actor,
            }, tx);
            if ('notConnected' in next) {
                (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.NOT_CONNECTED, 'WhatsApp is not connected', 'companyId');
            }
            return next;
        }, RETRY_TX_OPTIONS);
        return this.sends.deliverForAnswer(prepared);
    }
    async loadRow(companyId, wmlId, accYear, client = this.store.prisma) {
        const [row] = await client.$queryRaw `
      SELECT l.*, COALESCE(sb.sb_status, so.so_status, vh.avh_voucher_status) AS doc_status
        FROM public.wa_message_log l
        LEFT JOIN sales.sale_bill sb ON l.wml_src_doc_type = 'SALE_BILL' AND sb.sb_id = l.wml_src_doc_id
                                    AND sb.sb_acc_year = l.wml_src_acc_year
        LEFT JOIN sales.sale_order so ON l.wml_src_doc_type = 'SALES_ORDER' AND so.so_id = l.wml_src_doc_id
                                     AND so.so_acc_year = l.wml_src_acc_year
        LEFT JOIN accounts.acc_voucher_header vh ON l.wml_src_doc_type = 'RECEIPT' AND vh.avh_voucher_id = l.wml_src_doc_id
                                                AND vh.avh_acc_year = l.wml_src_acc_year
       WHERE l.wml_id = ${wmlId}::uuid AND l.wml_acc_year = ${accYear}::bpchar
         AND l.wml_company_id = ${companyId}::uuid AND l.wml_is_deleted = false`;
        if (!row) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.DOC_NOT_FOUND, `No WhatsApp message ${wmlId} in ${accYear} for this company`, 'wmlId');
        }
        return row;
    }
    async lockRoot(tx, row) {
        await tx.$queryRaw `
      WITH RECURSIVE up AS (
             SELECT wml_id, wml_retry_of, 0 AS depth FROM public.wa_message_log
              WHERE wml_id = ${row.wml_id}::uuid AND wml_company_id = ${row.wml_company_id}::uuid
             UNION
             SELECT l.wml_id, l.wml_retry_of, up.depth + 1 FROM public.wa_message_log l
               JOIN up ON l.wml_id = up.wml_retry_of
              WHERE l.wml_company_id = ${row.wml_company_id}::uuid AND up.depth < 50)
      SELECT l.wml_id FROM public.wa_message_log l
       WHERE l.wml_id = (SELECT wml_id FROM up ORDER BY depth DESC LIMIT 1)
         AND l.wml_company_id = ${row.wml_company_id}::uuid
         FOR UPDATE OF l`;
    }
    async chain(client, row) {
        return client.$queryRaw `
      WITH RECURSIVE up AS (
             SELECT wml_id, wml_retry_of, 0 AS depth FROM public.wa_message_log
              WHERE wml_id = ${row.wml_id}::uuid AND wml_company_id = ${row.wml_company_id}::uuid
             UNION
             SELECT l.wml_id, l.wml_retry_of, up.depth + 1 FROM public.wa_message_log l
               JOIN up ON l.wml_id = up.wml_retry_of
              WHERE l.wml_company_id = ${row.wml_company_id}::uuid AND up.depth < 50),
           root AS (SELECT wml_id FROM up WHERE wml_retry_of IS NULL),
           down AS (
             SELECT wml_id, 0 AS depth FROM root
             UNION
             SELECT l.wml_id, down.depth + 1 FROM public.wa_message_log l
               JOIN down ON l.wml_retry_of = down.wml_id
              WHERE l.wml_company_id = ${row.wml_company_id}::uuid
                AND l.wml_kind = ${row.wml_kind} AND down.depth < 50)
      SELECT l.*, NULL::text AS doc_status FROM public.wa_message_log l
       WHERE l.wml_id IN (SELECT wml_id FROM down) AND l.wml_company_id = ${row.wml_company_id}::uuid
       ORDER BY l.wml_try_no, l.wml_created_on`;
    }
};
exports.WaMessagesService = WaMessagesService;
exports.WaMessagesService = WaMessagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [wa_store_service_1.WaStore,
        wa_send_service_1.WaSendService])
], WaMessagesService);
function typedInPopup(row) {
    const params = row.wml_params;
    return (row.wml_phone_source === 'TYPED' &&
        !!row.wml_phone &&
        typeof params === 'object' &&
        params !== null &&
        !Array.isArray(params) &&
        params[wa_constants_1.WA_POPUP_PHONE_MARK] === true);
}
//# sourceMappingURL=wa-messages.service.js.map