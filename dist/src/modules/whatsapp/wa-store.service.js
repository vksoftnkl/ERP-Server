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
var WaStore_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaStore = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_os_1 = require("node:os");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const rights_1 = require("../../common/posting/rights");
const offline_site_1 = require("../../config/offline-site");
const wa_crypto_service_1 = require("./wa-crypto.service");
const wa_errors_1 = require("./wa-errors");
const wa_status_1 = require("./wa-status");
const wa_constants_1 = require("./wa.constants");
const PURPOSES = ['BILL', 'ORDER', 'RECEIPT', 'REMINDER', 'TEST'];
const TPL_STATUSES = ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'NOT_SUBMITTED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let WaStore = WaStore_1 = class WaStore {
    prisma;
    requestContext;
    crypto;
    config;
    logger = new common_1.Logger(WaStore_1.name);
    processName = `${process.pid}@${(0, node_os_1.hostname)()}`.slice(0, 60);
    constructor(prisma, requestContext, crypto, config) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.crypto = crypto;
        this.config = config;
    }
    offlineSite() {
        return (0, offline_site_1.isOfflineSite)(this.config);
    }
    assertMainServer() {
        if (this.offlineSite()) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.SITE_OFFLINE, 'This install is an offline site (CLOUD_SYNC_ENABLED): WhatsApp is set up and sent from the main server.');
        }
    }
    userId() {
        const id = this.requestContext.getUserId();
        return id && UUID.test(id) ? id : null;
    }
    async right(menuId, right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.userId(),
            menuId,
            right,
            codePrefix: 'WA',
            action,
        });
    }
    async actor() {
        const userId = this.userId();
        let userName = 'SYSTEM';
        if (userId) {
            const [u] = await this.prisma.$queryRaw `
        SELECT usr_login_name AS name FROM public.user_master WHERE usr_id = ${userId}::uuid LIMIT 1`;
            userName = (u?.name ?? '').trim() || userId;
        }
        return {
            userId,
            userName: userName.slice(0, 60),
            deviceId: this.requestContext.getDeviceId(),
            branchId: this.requestContext.getBranchId(),
        };
    }
    istToday(now = new Date()) {
        return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
    }
    async accYearOn(companyId, date) {
        const [fy] = await this.prisma.$queryRaw `
      SELECT btrim(fy_year_name) AS name FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND ${date}::date BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_begin_date DESC LIMIT 1`;
        if (fy?.name && /^\d{4}-\d{4}$/.test(fy.name)) {
            return fy.name;
        }
        const d = new Date(`${date}T00:00:00Z`);
        const y = d.getUTCMonth() + 1 >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
        this.logger.warn(`No fiscal year of company ${companyId} covers ${date}: the WhatsApp log uses ${y}-${y + 1}, ` +
            `which needs ensure_acc_year_partitions('${y}-${y + 1}')`);
        return `${y}-${y + 1}`;
    }
    async companyExists(companyId) {
        const [c] = await this.prisma.$queryRaw `
      SELECT true AS ok FROM public.companys WHERE comp_id = ${companyId}::uuid AND comp_is_deleted = false LIMIT 1`;
        return c?.ok === true;
    }
    row(companyId) {
        return this.prisma.waConnection.findFirst({ where: { wacCompanyId: companyId, wacIsDeleted: false } });
    }
    async rowOrRefuse(companyId) {
        const row = await this.row(companyId);
        if (!row) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.NOT_ACTIVATED, 'WhatsApp is not activated for this company: enter the activation code from VK first.', 'companyId');
        }
        return row;
    }
    keyOf(row) {
        return this.crypto.decrypt(row.wacKeyEnc);
    }
    relayUrlOrRefuse() {
        const raw = process.env.WA_RELAY_URL?.trim();
        if (!raw) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.RELAY_NOT_SET, 'WA_RELAY_URL is not set on this server.', 'WA_RELAY_URL');
        }
        return raw.replace(/\/+$/, '');
    }
    async setState(row, state, by) {
        if (row.wacState === state)
            return;
        await this.prisma.waConnection.update({
            where: { wacId: row.wacId },
            data: { wacState: state, wacModifiedOn: new Date(), wacModifiedBy: by.slice(0, 60) },
        });
        row.wacState = state;
    }
    async noteRelayError(row, error, by) {
        if (!(error instanceof wa_errors_1.WaRelayError))
            return;
        try {
            if (error.waCode === wa_constants_1.WA_CODES.KEY_REVOKED || error.waCode === wa_constants_1.WA_CODES.SHOP_SUSPENDED) {
                await this.setState(row, 'SUSPENDED', by);
            }
            else if (error.waCode === wa_constants_1.WA_CODES.NOT_CONNECTED && row.wacState === 'CONNECTED') {
                await this.setState(row, 'DISCONNECTED', by);
            }
        }
        catch (e) {
            this.logger.warn(`could not record the relay's answer on wa_connection: ${String(e)}`);
        }
    }
    async fastPoll(companyId) {
        await this.prisma.$executeRaw `
      UPDATE public.wa_connection
         SET wac_fast_poll_until = GREATEST(COALESCE(wac_fast_poll_until, now()),
                                            now() + (${wa_constants_1.WA_POLL.FAST_WINDOW_MS / 1000}::int * interval '1 second'))
       WHERE wac_company_id = ${companyId}::uuid AND wac_is_deleted = false`;
    }
    async mirror(row, conn, by) {
        const now = new Date();
        const limit = typeof conn.messagingLimit === 'number' ? conn.messagingLimit : null;
        await this.prisma.$transaction(async (tx) => {
            await tx.waConnection.update({
                where: { wacId: row.wacId },
                data: {
                    wacState: (0, wa_status_1.wacStateOf)(conn.state),
                    wacShopCode: (conn.shopCode ?? row.wacShopCode).slice(0, 12),
                    wacDisplayName: conn.displayName?.slice(0, 150) ?? null,
                    wacDisplayPhone: conn.displayPhone?.slice(0, 30) ?? null,
                    wacWabaId: conn.wabaId?.slice(0, 40) ?? null,
                    wacPhoneNumberId: conn.phoneNumberId?.slice(0, 40) ?? null,
                    wacQuality: conn.qualityRating?.slice(0, 10) ?? null,
                    wacMsgLimit: limit,
                    wacConnectedOn: conn.connectedOn ? new Date(conn.connectedOn) : null,
                    wacModifiedOn: now,
                    wacModifiedBy: by.slice(0, 60),
                },
            });
            const keep = [];
            for (const t of conn.templates ?? []) {
                if (!PURPOSES.includes(t.purpose) ||
                    !TPL_STATUSES.includes(t.status) ||
                    !/^[a-z]{2}(_[A-Z]{2})?$/.test(t.lang ?? '') ||
                    !t.name) {
                    this.logger.warn(`template ${t.name}/${t.lang} skipped: ${t.purpose} / ${t.status} is not in the mirror's lists`);
                    continue;
                }
                keep.push(`${t.name}|${t.lang}`);
                const data = {
                    watPurpose: t.purpose,
                    watCategory: t.category?.slice(0, 20) ?? null,
                    watStatus: t.status,
                    watReason: t.reason?.slice(0, 300) ?? null,
                    watBody: t.body ?? null,
                    watParams: (t.params ?? []),
                    watHeaderKind: t.headerKind === 'DOCUMENT' ? 'DOCUMENT' : 'NONE',
                    watButtons: (t.buttons ?? []),
                    watStatusOn: t.statusOn ? new Date(t.statusOn) : null,
                    watPulledOn: now,
                };
                await tx.waTemplate.upsert({
                    where: {
                        watCompanyId_watName_watLang: { watCompanyId: row.wacCompanyId, watName: t.name, watLang: t.lang },
                    },
                    create: { watCompanyId: row.wacCompanyId, watName: t.name, watLang: t.lang, ...data },
                    update: data,
                });
            }
            const existing = await tx.waTemplate.findMany({
                where: { watCompanyId: row.wacCompanyId },
                select: { watId: true, watName: true, watLang: true },
            });
            const gone = existing.filter((e) => !keep.includes(`${e.watName}|${e.watLang}`)).map((e) => e.watId);
            if (gone.length > 0) {
                await tx.waTemplate.deleteMany({ where: { watId: { in: gone } } });
            }
        });
        row.wacState = (0, wa_status_1.wacStateOf)(conn.state);
    }
    async templates(companyId) {
        const rows = await this.prisma.waTemplate.findMany({
            where: { watCompanyId: companyId },
            orderBy: [{ watPurpose: 'asc' }, { watName: 'asc' }, { watLang: 'asc' }],
        });
        return rows.map((r) => ({
            name: r.watName,
            lang: r.watLang,
            status: r.watStatus,
            params: Array.isArray(r.watParams) ? r.watParams.map(String) : [],
            headerKind: r.watHeaderKind,
        }));
    }
    async templateRows(companyId) {
        const rows = await this.prisma.waTemplate.findMany({
            where: { watCompanyId: companyId },
            orderBy: [{ watPurpose: 'asc' }, { watName: 'asc' }, { watLang: 'asc' }],
        });
        return rows.map((r) => ({
            name: r.watName,
            lang: r.watLang,
            purpose: r.watPurpose,
            category: r.watCategory,
            status: r.watStatus,
            reason: r.watReason,
            body: r.watBody,
            params: r.watParams,
            headerKind: r.watHeaderKind,
            buttons: r.watButtons,
            statusOn: r.watStatusOn ? r.watStatusOn.toISOString() : null,
        }));
    }
    async usedToday(companyId) {
        const [r] = await this.prisma.$queryRaw `
      SELECT count(DISTINCT wml_phone)::int AS n FROM public.wa_message_log
       WHERE wml_company_id = ${companyId}::uuid
         AND wml_status IN ('SENDING', 'SENT', 'DELIVERED', 'READ')
         AND wml_kind <> 'TEST'
         AND wml_created_on >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
        return r?.n ?? 0;
    }
};
exports.WaStore = WaStore;
exports.WaStore = WaStore = WaStore_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        wa_crypto_service_1.WaCryptoService,
        config_1.ConfigService])
], WaStore);
//# sourceMappingURL=wa-store.service.js.map