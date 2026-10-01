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
var GstinLookupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GstinLookupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const gst_registration_1 = require("../shared/gst-registration");
const SEARCH_PATH = '/commonapi/v1.1/search';
const LOOKUP_TIMEOUT_MS = 10_000;
const DATA_KEYS = ['data', 'taxpayer', 'result'];
const TAXPAYER_KEYS = ['lgnm', 'tradeNam', 'tradeName', 'pradr', 'dty'];
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
let GstinLookupService = GstinLookupService_1 = class GstinLookupService {
    prisma;
    requestContextService;
    logger = new common_1.Logger(GstinLookupService_1.name);
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async search(gstin) {
        const provider = await this.resolveProvider();
        const sourceGstin = await this.resolveSourceGstin();
        const url = this.buildUrl(provider, sourceGstin, gstin);
        let ok;
        let status;
        let body;
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
                headers: { Accept: 'application/json, text/plain, */*' },
            });
            ok = response.ok;
            status = response.status;
            body = this.parseBody(await response.text());
        }
        catch (error) {
            this.logger.warn(`GSTIN search via ${provider.gspProviderCode} failed: ${error instanceof Error ? error.message : String(error)}`);
            this.throwUpstream('Unable to reach the GST service right now');
        }
        if (!ok) {
            this.logger.warn(`GSTIN search via ${provider.gspProviderCode} answered HTTP ${status}`);
            this.throwUpstream(this.messageOf(body, `The GST service answered HTTP ${status}`));
        }
        const data = this.extractTaxpayer(body);
        if (!data) {
            (0, module_service_utils_1.throwSettingsNotFound)('GST details not found', 'gstin', this.messageOf(body, `The GST service has no details for GSTIN ${gstin}`));
        }
        return this.toPayload(gstin, data);
    }
    async resolveProvider() {
        const live = { gspIsActive: true, gspIsDeleted: false };
        const code = process.env.GST_LOOKUP_PROVIDER_CODE?.trim();
        if (code) {
            const byCode = await this.prisma.gspProviderMaster.findFirst({
                where: { ...live, gspProviderCode: code },
            });
            if (!byCode) {
                this.throwUnavailable(`GST_LOOKUP_PROVIDER_CODE names "${code}", which is not an active provider`);
            }
            return byCode;
        }
        const companyId = this.requestContextService.getCompanyId();
        if (companyId) {
            const mapped = await this.prisma.gspCompanyService.findFirst({
                where: { csgCompanyId: companyId, csgIsActive: true, csgIsDeleted: false },
                orderBy: { csgCreatedOn: 'asc' },
                select: { csgGspProviderId: true },
            });
            if (mapped) {
                const provider = await this.prisma.gspProviderMaster.findFirst({
                    where: { ...live, gspProviderId: mapped.csgGspProviderId },
                });
                if (provider) {
                    return provider;
                }
            }
        }
        const providers = await this.prisma.gspProviderMaster.findMany({ where: live, take: 2 });
        if (providers.length !== 1) {
            this.throwUnavailable(providers.length
                ? 'Several GST providers are active: set GST_LOOKUP_PROVIDER_CODE, or map this company to one (GSP Company Service)'
                : 'No active GST provider is configured (GSP Provider Master)');
        }
        return providers[0];
    }
    async resolveSourceGstin() {
        const companyId = this.requestContextService.getCompanyId();
        const company = companyId
            ? await this.prisma.company.findFirst({
                where: { compId: companyId },
                select: { compGstinNo: true },
            })
            : null;
        const gstin = text(company?.compGstinNo) ?? text(process.env.GST_LOOKUP_SOURCE_GSTIN);
        if (!gstin) {
            this.throwUnavailable('The company has no GSTIN to search as: set it in Company Master, or set GST_LOOKUP_SOURCE_GSTIN');
        }
        return gstin;
    }
    buildUrl(provider, sourceGstin, gstin) {
        const endpoint = text(process.env.GST_LOOKUP_ENDPOINT) ??
            `${provider.gspBaseUrl.replace(/\/+$/, '')}${SEARCH_PATH}`;
        const url = new URL(endpoint);
        url.searchParams.set('aspid', provider.gspUserName);
        url.searchParams.set('password', provider.gspUserPassword);
        url.searchParams.set('Action', 'TP');
        url.searchParams.set('Gstin', sourceGstin);
        url.searchParams.set('SearchGstin', gstin);
        return url.toString();
    }
    parseBody(body) {
        const trimmed = body.trim();
        if (!trimmed) {
            return null;
        }
        try {
            return JSON.parse(trimmed);
        }
        catch {
            return trimmed;
        }
    }
    extractTaxpayer(body) {
        if (!isRecord(body)) {
            return null;
        }
        const looksLikeTaxpayer = (record) => TAXPAYER_KEYS.some((key) => key in record);
        for (const key of DATA_KEYS) {
            const nested = body[key];
            if (isRecord(nested) && looksLikeTaxpayer(nested)) {
                return nested;
            }
        }
        return looksLikeTaxpayer(body) ? body : null;
    }
    messageOf(body, fallback) {
        if (typeof body === 'string') {
            return text(body)?.slice(0, 300) ?? fallback;
        }
        if (isRecord(body)) {
            for (const key of ['message', 'error', 'detail', 'status_desc', 'statusDesc']) {
                const value = text(body[key]);
                if (value) {
                    return value.slice(0, 300);
                }
            }
        }
        return fallback;
    }
    toPayload(gstin, data) {
        const registrationType = text(data.dty);
        return {
            gstin,
            legalName: text(data.lgnm),
            tradeName: text(data.tradeNam) ?? text(data.tradeName),
            status: text(data.sts),
            registrationType,
            gstRegType: this.toGstRegType(registrationType),
            stateCode: gstin.slice(0, 2),
            panNo: gstin.slice(2, 12),
            registeredOn: text(data.rgdt),
            address: this.toAddress(data.pradr),
            raw: data,
        };
    }
    toAddress(pradr) {
        const addr = isRecord(pradr) && isRecord(pradr.addr) ? pradr.addr : null;
        if (!addr) {
            return null;
        }
        const building = [text(addr.flno), text(addr.bno), text(addr.bnm)].filter(Boolean).join(', ');
        return {
            building: building || null,
            street: text(addr.st),
            locality: text(addr.locality) ?? text(addr.loc),
            city: text(addr.loc) ?? text(addr.dst),
            district: text(addr.dst),
            state: text(addr.stcd),
            pin: text(addr.pncd),
        };
    }
    toGstRegType(registrationType) {
        const upper = registrationType?.toUpperCase() ?? '';
        if (upper.includes('COMPOSITION'))
            return 'COMPOSITION';
        if (upper.includes('SEZ'))
            return 'SEZ';
        if (upper.includes('UNREG'))
            return 'UNREGISTERED';
        if (upper.includes('REGULAR'))
            return 'REGULAR';
        return gst_registration_1.GST_REG_TYPES.includes(upper) ? upper : null;
    }
    throwUpstream(message) {
        throw new common_1.HttpException((0, module_service_utils_1.buildSettingsErrorResponse)('GST service error', [
            { field: 'gstin', message },
        ]), common_1.HttpStatus.BAD_GATEWAY);
    }
    throwUnavailable(message) {
        throw new common_1.HttpException((0, module_service_utils_1.buildSettingsErrorResponse)('GSTIN search is not configured', [
            { field: 'gstin', message },
        ]), common_1.HttpStatus.SERVICE_UNAVAILABLE);
    }
};
exports.GstinLookupService = GstinLookupService;
exports.GstinLookupService = GstinLookupService = GstinLookupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], GstinLookupService);
//# sourceMappingURL=gstin-lookup.service.js.map