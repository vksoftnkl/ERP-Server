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
exports.WaConnectionService = void 0;
const common_1 = require("@nestjs/common");
const wa_crypto_service_1 = require("./wa-crypto.service");
const wa_errors_1 = require("./wa-errors");
const wa_events_service_1 = require("./wa-events.service");
const wa_relay_client_1 = require("./wa-relay.client");
const wa_send_service_1 = require("./wa-send.service");
const wa_settings_service_1 = require("./wa-settings.service");
const wa_store_service_1 = require("./wa-store.service");
const wa_constants_1 = require("./wa.constants");
function cleanName(v, max) {
    const t = (v ?? '').replace(/[{}\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, max) : null;
}
const cut = (v, max) => {
    const t = (v ?? '').trim();
    return t ? t.slice(0, max) : null;
};
let WaConnectionService = class WaConnectionService {
    store;
    relay;
    crypto;
    events;
    sends;
    settings;
    constructor(store, relay, crypto, events, sends, settings) {
        this.store = store;
        this.relay = relay;
        this.crypto = crypto;
        this.events = events;
        this.sends = sends;
        this.settings = settings;
    }
    async get(companyId) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'view', 'open WhatsApp settings');
        return this.view(companyId);
    }
    async view(companyId) {
        const [row, settings] = await Promise.all([this.store.row(companyId), this.settings.read(companyId)]);
        const relayUrl = row?.wacRelayUrl ?? this.relay.configuredUrl();
        const [templates, usedToday, relayReachable] = await Promise.all([
            row ? this.store.templateRows(companyId) : Promise.resolve([]),
            row ? this.store.usedToday(companyId) : Promise.resolve(0),
            relayUrl ? this.relay.healthy(relayUrl) : Promise.resolve(false),
        ]);
        const state = row ? row.wacState : 'NOT_ACTIVATED';
        return {
            companyId,
            state,
            shopCode: row?.wacShopCode ?? null,
            keyPrefix: row?.wacKeyPrefix ?? null,
            displayName: row?.wacDisplayName ?? null,
            displayPhone: row?.wacDisplayPhone ?? null,
            wabaId: row?.wacWabaId ?? null,
            phoneNumberId: row?.wacPhoneNumberId ?? null,
            qualityRating: row?.wacQuality ?? null,
            messagingLimit: row?.wacMsgLimit ?? null,
            usedToday,
            connectedOn: row?.wacConnectedOn?.toISOString() ?? null,
            lastPollOn: row?.wacLastPollOn?.toISOString() ?? null,
            lastPollError: row?.wacLastPollError ?? null,
            relayReachable,
            fallbackClickToChat: settings.fallbackClickToChat,
            templates,
        };
    }
    async activate(dto) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'edit', 'activate WhatsApp');
        this.store.assertMainServer();
        if (!(await this.store.companyExists(dto.companyId))) {
            (0, wa_errors_1.waRefuse)(wa_errors_1.WA_HOUSE_CODES.COMPANY_NOT_FOUND, `No company ${dto.companyId}`, 'companyId');
        }
        const relayUrl = this.store.relayUrlOrRefuse();
        if (!this.crypto.isConfigured()) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.KEY_MISSING, 'WA_CRED_KEY is not set on this server', 'WA_CRED_KEY');
        }
        this.crypto.encrypt('probe');
        const existing = await this.store.row(dto.companyId);
        if (existing && existing.wacState !== 'SUSPENDED' && dto.replace !== true) {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.ALREADY_ACTIVATED, `WhatsApp is already activated here (shop ${existing.wacShopCode}, key ${existing.wacKeyPrefix}…). ` +
                'Send replace: true to use this code in its place (VK re-key / recovery).', 'activationCode', { state: existing.wacState, shopCode: existing.wacShopCode });
        }
        const actor = await this.store.actor();
        const company = await this.companyInfo(dto.companyId);
        const issued = await this.callRelay(null, () => this.relay.activate(relayUrl, {
            activationCode: dto.activationCode,
            installLabel: cut(`${company.displayName ?? 'ERP'} · ERP server`, 100),
            erpVersion: cut(process.env.APP_VERSION, 40),
        }));
        const keyEnc = this.crypto.encrypt(issued.apiKey);
        const now = new Date();
        const data = {
            wacState: 'ACTIVATED',
            wacRelayUrl: relayUrl.slice(0, 200),
            wacShopCode: issued.shopCode.slice(0, 12),
            wacInstallId: issued.installId,
            wacKeyEnc: keyEnc,
            wacKeyVersion: this.crypto.currentVersion(),
            wacKeyPrefix: issued.keyPrefix.slice(0, 12),
            wacKeyIssuedOn: now,
            wacLastPollError: null,
        };
        const row = existing
            ? await this.store.prisma.waConnection.update({
                where: { wacId: existing.wacId },
                data: {
                    ...data,
                    ...(existing.wacInstallId !== issued.installId ? { wacEventCursor: BigInt(0) } : {}),
                    wacModifiedOn: now,
                    wacModifiedBy: actor.userName,
                },
            })
            : await this.store.prisma.waConnection.create({
                data: { ...data, wacCompanyId: dto.companyId, wacCreatedOn: now, wacCreatedBy: actor.userName },
            });
        try {
            const conn = await this.relay.connection(row.wacRelayUrl, issued.apiKey);
            await this.store.mirror(row, conn, actor.userName);
        }
        catch {
        }
        const fresh = await this.store.row(dto.companyId);
        return { state: fresh?.wacState ?? 'ACTIVATED', shopCode: issued.shopCode, keyPrefix: issued.keyPrefix };
    }
    async connectStart(dto) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'edit', 'connect WhatsApp');
        this.store.assertMainServer();
        const row = await this.store.rowOrRefuse(dto.companyId);
        if (row.wacState === 'CONNECTED') {
            (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.ALREADY_CONNECTED, `This company's number ${row.wacDisplayPhone ?? ''} is already connected`, 'companyId');
        }
        const actor = await this.store.actor();
        const info = await this.companyInfo(dto.companyId);
        const key = this.store.keyOf(row);
        const res = await this.callRelay(row, () => this.relay.connectCode(row.wacRelayUrl, key, {
            requestedBy: actor.userName.slice(0, 60),
            shopInfo: {
                legalName: info.legalName ?? info.displayName ?? 'Shop',
                displayName: info.displayName ?? info.legalName ?? 'Shop',
                addrLine: info.addrLine,
                city: info.city,
                state: info.state,
                pincode: info.pincode,
                phone: info.phone,
                email: info.email,
                website: info.website,
            },
        }));
        await this.store.setState(row, 'CONNECTING', actor.userName);
        await this.store.fastPoll(dto.companyId);
        return { connectUrl: res.url, expiresAt: res.expiresAt };
    }
    async refresh(dto) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'view', 'refresh WhatsApp');
        const row = await this.store.row(dto.companyId);
        if (row && !this.store.offlineSite()) {
            await this.callRelay(row, () => this.events.pullOnce(dto.companyId, { force: true }));
        }
        return this.view(dto.companyId);
    }
    async disconnect(dto) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'edit', 'disconnect WhatsApp');
        this.store.assertMainServer();
        const row = await this.store.rowOrRefuse(dto.companyId);
        const actor = await this.store.actor();
        const key = this.store.keyOf(row);
        await this.callRelay(row, () => this.relay.disconnect(row.wacRelayUrl, key, {
            requestedBy: actor.userName.slice(0, 60),
            reason: cut(dto.reason, 200),
        }));
        await this.store.prisma.waConnection.update({
            where: { wacId: row.wacId },
            data: { wacState: 'DISCONNECTED', wacConnectedOn: null, wacModifiedOn: new Date(), wacModifiedBy: actor.userName },
        });
        return { state: 'DISCONNECTED' };
    }
    async rotateKey(dto) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'edit', 'rotate the WhatsApp key');
        this.store.assertMainServer();
        const row = await this.store.rowOrRefuse(dto.companyId);
        const actor = await this.store.actor();
        const key = this.store.keyOf(row);
        const res = await this.callRelay(row, () => this.relay.rotate(row.wacRelayUrl, key));
        const now = new Date();
        await this.store.prisma.waConnection.update({
            where: { wacId: row.wacId },
            data: {
                wacKeyEnc: this.crypto.encrypt(res.apiKey),
                wacKeyVersion: this.crypto.currentVersion(),
                wacKeyPrefix: res.keyPrefix.slice(0, 12),
                wacKeyIssuedOn: now,
                wacModifiedOn: now,
                wacModifiedBy: actor.userName,
            },
        });
        return { keyPrefix: res.keyPrefix, rotatedOn: now.toISOString(), oldKeyValidUntil: res.oldKeyValidUntil };
    }
    async test(dto) {
        await this.store.right(wa_constants_1.WA_MENU.WHATSAPP, 'view', 'send a WhatsApp test');
        this.store.assertMainServer();
        const actor = await this.store.actor();
        const prepared = await this.sends.prepareTest({ companyId: dto.companyId, phone: dto.phone, actor });
        return this.sends.deliverForAnswer(prepared);
    }
    async callRelay(row, work) {
        try {
            return await work();
        }
        catch (error) {
            if (error instanceof wa_errors_1.WaRelayError) {
                if (row)
                    await this.store.noteRelayError(row, error, 'route');
                (0, wa_errors_1.waRefuse)(error.waCode, error.message, error.relay.field ?? 'request', {
                    relayCode: error.relay.relayCode,
                });
            }
            throw error;
        }
    }
    async companyInfo(companyId) {
        const [c] = await this.store.prisma.$queryRaw `
      SELECT comp_name, comp_legal_name,
             concat_ws(', ', NULLIF(btrim(comp_addr1), ''), NULLIF(btrim(comp_addr2), ''), NULLIF(btrim(comp_addr3), '')) AS addr,
             comp_city, comp_state, comp_pin,
             COALESCE(NULLIF(btrim(comp_phone), ''), NULLIF(btrim(comp_tel), '')) AS phone,
             COALESCE(NULLIF(btrim(comp_mail), ''), NULLIF(btrim(comp_support_email), '')) AS email,
             comp_website_name
        FROM public.companys WHERE comp_id = ${companyId}::uuid`;
        return {
            legalName: cleanName(c?.comp_legal_name ?? c?.comp_name, 150),
            displayName: cleanName(c?.comp_name ?? c?.comp_legal_name, 100),
            addrLine: cut(c?.addr, 300),
            city: cut(c?.comp_city, 60),
            state: cut(c?.comp_state, 60),
            pincode: c?.comp_pin ? String(c.comp_pin).slice(0, 10) : null,
            phone: cut(c?.phone, 20),
            email: cut(c?.email, 120),
            website: cut(c?.comp_website_name, 200),
        };
    }
};
exports.WaConnectionService = WaConnectionService;
exports.WaConnectionService = WaConnectionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [wa_store_service_1.WaStore,
        wa_relay_client_1.WaRelayClient,
        wa_crypto_service_1.WaCryptoService,
        wa_events_service_1.WaEventsService,
        wa_send_service_1.WaSendService,
        wa_settings_service_1.WaSettingsService])
], WaConnectionService);
//# sourceMappingURL=wa-connection.service.js.map