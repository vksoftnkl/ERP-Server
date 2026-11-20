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
var WaSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaSettingsService = exports.WA_SETTING_DEFAULTS = void 0;
exports.parseOnPostTypes = parseOnPostTypes;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const app_setting_value_service_1 = require("../settings/appSettings/app-setting-value.service");
const app_settings_api_types_1 = require("../settings/appSettings/types/app-settings-api.types");
const wa_errors_1 = require("./wa-errors");
const wa_constants_1 = require("./wa.constants");
exports.WA_SETTING_DEFAULTS = {
    defaultLanguage: 'en',
    ratePerMessage: new client_1.Prisma.Decimal('0.115'),
    rateGstPercent: new client_1.Prisma.Decimal('18'),
    fallbackClickToChat: true,
    logRetentionYears: 2,
};
function intIn(v, min, max) {
    const raw = String(v ?? '').trim();
    const t = typeof v === 'number' ? v : Number(raw);
    return raw !== '' && Number.isInteger(t) && t >= min && t <= max ? t : null;
}
function decIn(v, min, max, places) {
    const t = String(v ?? '').trim();
    if (!/^\d+(\.\d+)?$/.test(t))
        return null;
    const d = new client_1.Prisma.Decimal(t);
    if (d.lessThan(min) || (max !== null && d.greaterThan(max)) || d.decimalPlaces() > places)
        return null;
    return d;
}
function boolOf(v) {
    if (typeof v === 'boolean')
        return v;
    const t = String(v ?? '').trim().toLowerCase();
    return t === 'true' || t === '1' ? true : t === 'false' || t === '0' ? false : null;
}
function parseOnPostTypes(raw) {
    const t = (raw ?? '').trim();
    if (!t)
        return [];
    let v;
    try {
        v = JSON.parse(t);
    }
    catch {
        return [];
    }
    if (!Array.isArray(v))
        return [];
    const ids = v.filter((x) => typeof x === 'number' && Number.isInteger(x) && x > 0);
    return [...new Set(ids)].sort((a, b) => a - b);
}
let WaSettingsService = WaSettingsService_1 = class WaSettingsService {
    prisma;
    appSettings;
    logger = new common_1.Logger(WaSettingsService_1.name);
    constructor(prisma, appSettings) {
        this.prisma = prisma;
        this.appSettings = appSettings;
    }
    async read(companyId) {
        return this.valuesOf(await this.appSettings.resolveEffective({ companyId }));
    }
    valuesOf(effective) {
        const v = (key) => effective.find((i) => i.asdKey === key)?.value ?? null;
        const d = exports.WA_SETTING_DEFAULTS;
        const lang = (v(wa_constants_1.WA_SETTING.DEFAULT_LANGUAGE) ?? '').trim().toLowerCase();
        return {
            defaultLanguage: lang === 'ta' ? 'ta' : 'en',
            ratePerMessage: decIn(v(wa_constants_1.WA_SETTING.RATE), 0, null, 4) ?? d.ratePerMessage,
            rateGstPercent: decIn(v(wa_constants_1.WA_SETTING.GST), 0, 100, 2) ?? d.rateGstPercent,
            fallbackClickToChat: boolOf(v(wa_constants_1.WA_SETTING.FALLBACK)) ?? d.fallbackClickToChat,
            logRetentionYears: intIn(v(wa_constants_1.WA_SETTING.RETENTION_YEARS), 1, 10) ?? d.logRetentionYears,
        };
    }
    async onPostSetting(companyId) {
        return this.onPostOf(await this.appSettings.resolveEffective({ companyId }));
    }
    onPostOf(effective) {
        const item = effective.find((i) => i.asdKey === wa_constants_1.WA_SETTING.ON_POST_TYPES);
        if (!item)
            return { ids: [], defined: false };
        const ids = parseOnPostTypes(item.value);
        if (ids.length === 0 && (item.value ?? '').trim() !== '' && (item.value ?? '').replace(/\s/g, '') !== '[]') {
            this.logger.warn(`${wa_constants_1.WA_SETTING.ON_POST_TYPES} = ${item.value} is not a list of voucher type ids: read as []`);
        }
        return { ids, defined: true };
    }
    async onPostTypes(companyId, setting) {
        const { ids } = setting ?? (await this.onPostSetting(companyId));
        const rows = await this.prisma.$queryRaw `
      SELECT vchr_type_id, vchr_type_name, vchr_parent_id
        FROM accounts.acc_voucher_types
       WHERE vchr_type_id = ANY(${[...wa_constants_1.WA_ON_POST_SERVED]}::int[])
       ORDER BY vchr_type_id`;
        return rows.map((r) => ({
            vchrTypeId: r.vchr_type_id,
            vchrTypeName: r.vchr_type_name,
            vchrParentId: r.vchr_parent_id,
            kind: 'ORDER',
            templateName: wa_constants_1.WA_TEMPLATE_OF_KIND.ORDER,
            on: ids.includes(r.vchr_type_id),
        }));
    }
    async get(companyId) {
        const effective = await this.appSettings.resolveEffective({ companyId });
        const onPostTypes = await this.onPostTypes(companyId, this.onPostOf(effective));
        return { companyId, ...this.view(this.valuesOf(effective)), onPostTypes };
    }
    view(s) {
        return {
            defaultLanguage: s.defaultLanguage,
            ratePerMessage: s.ratePerMessage.toFixed(4),
            rateGstPercent: s.rateGstPercent.toFixed(2),
            fallbackClickToChat: s.fallbackClickToChat,
            logRetentionYears: s.logRetentionYears,
        };
    }
    async save(companyId, dto) {
        const bad = [];
        const say = (field, message) => bad.push({ field, code: wa_constants_1.WA_CODES.SETTING_INVALID, message });
        const writes = [];
        const has = (k) => dto[k] !== undefined;
        if (has('defaultLanguage')) {
            const l = String(dto.defaultLanguage ?? '').trim().toLowerCase();
            if (l !== 'en' && l !== 'ta')
                say('defaultLanguage', 'Message language must be en or ta');
            else
                writes.push({ key: wa_constants_1.WA_SETTING.DEFAULT_LANGUAGE, value: l });
        }
        if (has('ratePerMessage')) {
            const r = decIn(dto.ratePerMessage, 0, 9999, 4);
            if (r === null)
                say('ratePerMessage', 'Rate per message must be 0 or more, at most 4 decimals');
            else
                writes.push({ key: wa_constants_1.WA_SETTING.RATE, value: r.toString() });
        }
        if (has('rateGstPercent')) {
            const g = decIn(dto.rateGstPercent, 0, 100, 2);
            if (g === null)
                say('rateGstPercent', 'GST % must be from 0 to 100, at most 2 decimals');
            else
                writes.push({ key: wa_constants_1.WA_SETTING.GST, value: g.toString() });
        }
        if (has('fallbackClickToChat')) {
            const b = boolOf(dto.fallbackClickToChat);
            if (b === null)
                say('fallbackClickToChat', 'fallbackClickToChat must be true or false');
            else
                writes.push({ key: wa_constants_1.WA_SETTING.FALLBACK, value: String(b) });
        }
        if (has('logRetentionYears')) {
            const n = intIn(dto.logRetentionYears, 1, 10);
            if (n === null)
                say('logRetentionYears', 'Keep message details for 1 to 10 years');
            else
                writes.push({ key: wa_constants_1.WA_SETTING.RETENTION_YEARS, value: String(n) });
        }
        if (dto.onPostTypes !== undefined) {
            const current = await this.onPostSetting(companyId);
            const allowed = await this.onPostTypes(companyId, current);
            const next = new Set(current.ids);
            for (const [i, t] of (dto.onPostTypes ?? []).entries()) {
                const hit = allowed.find((a) => a.vchrTypeId === t?.vchrTypeId);
                if (!hit) {
                    say('onPostTypes', `onPostTypes[${i}]: voucher type ${String(t?.vchrTypeId)} cannot send WhatsApp on post in this version (allowed: ${allowed
                        .map((a) => a.vchrTypeId)
                        .join(', ')})`);
                }
                else if (t.on) {
                    next.add(hit.vchrTypeId);
                }
                else {
                    next.delete(hit.vchrTypeId);
                }
            }
            if (!current.defined) {
                say('onPostTypes', `WhatsApp on Post cannot be saved yet: the setting ${wa_constants_1.WA_SETTING.ON_POST_TYPES} is not on this database ` +
                    '(migration 20261119190000_whatsapp_on_post_company)');
            }
            else {
                const ids = [...next].sort((a, b) => a - b);
                if (ids.join(',') !== current.ids.join(',')) {
                    writes.push({ key: wa_constants_1.WA_SETTING.ON_POST_TYPES, value: JSON.stringify(ids) });
                }
            }
        }
        if (bad.length > 0) {
            (0, wa_errors_1.waRefuseMany)('WhatsApp settings not saved', bad);
        }
        if (writes.length > 0) {
            await this.appSettings.save(writes.map((w) => ({
                asvSettingKey: w.key,
                asvScope: app_settings_api_types_1.AppSettingScope.COMPANY,
                asvCompanyId: companyId,
                asvValue: w.value,
                asvRemarks: 'WhatsApp settings (307)',
            })));
        }
        return this.get(companyId);
    }
};
exports.WaSettingsService = WaSettingsService;
exports.WaSettingsService = WaSettingsService = WaSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_setting_value_service_1.AppSettingValueService])
], WaSettingsService);
//# sourceMappingURL=wa-settings.service.js.map