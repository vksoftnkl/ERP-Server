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
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const gst_auth_lease_1 = require("../../gst/client/gst-auth-lease");
const gst_auth_service_1 = require("../../gst/client/gst-auth.service");
const gst_http_client_1 = require("../../gst/client/gst-http.client");
const gst_json_path_1 = require("../../gst/client/gst-json-path");
const gst_route_guard_1 = require("../../gst/client/gst-route-guard");
const gst_crypto_service_1 = require("../../gst/config/gst-crypto.service");
const gst_registration_1 = require("../shared/gst-registration");
const SERVICE = 'GSTIN_VERIFY';
const ACTION = 'VERIFY_GSTIN';
const DATA_KEYS = ['data', 'taxpayer', 'result'];
const TAXPAYER_KEYS = ['lgnm', 'tradeNam', 'tradeName', 'pradr', 'dty'];
const SECRET_PLACEHOLDERS = new Set(['aspId', 'aspPassword', 'clientId', 'clientSecret', 'apiKey']);
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const codeText = (value) => typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value);
let GstinLookupService = GstinLookupService_1 = class GstinLookupService {
    prisma;
    requestContextService;
    crypto;
    http;
    logger = new common_1.Logger(GstinLookupService_1.name);
    constructor(prisma, requestContextService, crypto, http) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
        this.crypto = crypto;
        this.http = http;
    }
    async search(gstin) {
        const route = await this.resolveRoute();
        const { companyId, sourceGstin } = await this.resolveSource();
        const request = this.buildRequest(route, sourceGstin, gstin);
        const host = new URL(request.url).host;
        const startedOn = new Date();
        const log = (outcome) => this.log(route, request, companyId, startedOn, outcome);
        let status;
        let body;
        try {
            const response = await this.http.send({
                method: request.method,
                url: request.url,
                headers: request.headers,
                timeoutMs: request.timeoutMs,
                route: route.guard,
            });
            status = response.status;
            body = this.parseBody(response.text);
        }
        catch (error) {
            const reason = error instanceof gst_http_client_1.GstHttpError || error instanceof Error ? error.message : String(error);
            this.logger.warn(`GSTIN search via ${host} failed: ${reason}`);
            await log({
                status: null,
                body: null,
                ok: false,
                message: `Unable to reach the GST service: ${reason}`,
            });
            this.throwUpstream('Unable to reach the GST service right now');
        }
        const { endpoint } = route;
        const succeeded = status >= 200 &&
            status < 300 &&
            body !== null &&
            (!endpoint.gpeSuccessPath ||
                scalarText(this.at(body, endpoint.gpeSuccessPath)) === endpoint.gpeSuccessValue);
        if (!succeeded) {
            this.logger.warn(`GSTIN search via ${host} answered HTTP ${status}`);
            const message = this.messageOf(body, endpoint, `The GST service answered HTTP ${status}`);
            await log({ status, body, ok: false, message });
            this.throwUpstream(message);
        }
        const root = endpoint.gpeResponseRootPath ? this.at(body, endpoint.gpeResponseRootPath) : body;
        const data = this.extractTaxpayer(root);
        if (!data) {
            const message = this.messageOf(body, endpoint, `The GST service has no details for GSTIN ${gstin}`);
            await log({ status, body, ok: false, message });
            (0, module_service_utils_1.throwSettingsNotFound)('GST details not found', 'gstin', message);
        }
        const payload = this.toPayload(gstin, data);
        await log({
            status,
            body,
            ok: true,
            message: `Found ${payload.legalName ?? payload.tradeName ?? gstin}`,
        });
        return payload;
    }
    async resolveRoute() {
        const services = await this.prisma.gstProviderService.findMany({
            where: { gpsService: SERVICE, gpsIsDeleted: false, provider: { gpvIsDeleted: false } },
            include: {
                provider: true,
                endpoints: {
                    where: { gpeAction: ACTION, gpeIsDeleted: false },
                    orderBy: [{ gpeIsActive: 'desc' }, { gpeCreatedOn: 'asc' }, { gpeId: 'asc' }],
                },
            },
        });
        const rank = (s) => [
            s.gpsEnvironment === 'PRODUCTION' ? 0 : 1,
            s.provider.gpvCode,
            s.gpsCreatedOn.getTime(),
            s.gpsId,
        ];
        services.sort((a, b) => {
            const [x, y] = [rank(a), rank(b)];
            for (let i = 0; i < x.length; i++) {
                if (x[i] !== y[i])
                    return x[i] < y[i] ? -1 : 1;
            }
            return 0;
        });
        let first = null;
        for (const { provider, endpoints, ...service } of services) {
            const endpoint = endpoints[0] ?? null;
            const scope = {
                gccGpvId: service.gpsGpvId,
                gccEnvironment: service.gpsEnvironment,
                gccService: SERVICE,
            };
            const account = (await (0, gst_auth_lease_1.resolveProviderAccount)(this.prisma, scope, SERVICE)) ??
                (await (0, gst_auth_lease_1.resolveProviderAccount)(this.prisma, scope, SERVICE, { activeOnly: false }));
            const guard = { provider, service, action: ACTION, endpoint, account };
            if (endpoint && !(0, gst_route_guard_1.gstRouteRefusal)(guard)) {
                return { provider, service, endpoint, account, guard };
            }
            first ??= guard;
        }
        if (!first) {
            this.throwUnavailable('GSTIN search is switched off', `No ${SERVICE} service is set up. Add one, with a ${ACTION} endpoint and an account, under GST Providers.`);
        }
        (0, gst_route_guard_1.assertGstRouteActive)(first, { field: 'gstin', title: 'GSTIN search is switched off' });
        this.throwUnavailable('GSTIN search is switched off', `No active ${SERVICE} provider`);
    }
    async resolveSource() {
        const companyId = this.requestContextService.getCompanyId();
        const company = companyId
            ? await this.prisma.company.findFirst({
                where: { compId: companyId },
                select: { compGstinNo: true },
            })
            : null;
        const sourceGstin = text(company?.compGstinNo);
        if (!companyId || !sourceGstin) {
            this.throwUnavailable('GSTIN search is not configured', 'The company has no GSTIN to search as: set it in Company Master');
        }
        return { companyId, sourceGstin };
    }
    buildRequest(route, sourceGstin, gstin) {
        const { provider, service, endpoint, account } = route;
        const open = (value) => (value ? this.crypto.decrypt(value) : null);
        const aspId = open(account?.gpaClientIdEnc ?? null);
        const aspPassword = open(account?.gpaClientSecretEnc ?? null);
        const values = {
            gstin: sourceGstin,
            searchGstin: gstin,
            aspId,
            aspPassword,
            clientId: aspId,
            clientSecret: aspPassword,
            apiKey: open(account?.gpaApiKeyEnc ?? null),
        };
        const missing = new Set();
        const fill = (template, encode, forLog) => template.replace(/\{(\w+)\}/g, (_, name) => {
            const value = values[name];
            if (value === null || value === undefined) {
                missing.add(name);
                return '';
            }
            return forLog && SECRET_PLACEHOLDERS.has(name) ? gst_json_path_1.REDACTED : encode(value);
        });
        const asIs = (v) => v;
        const query = endpoint.gpeQueryTemplate
            ? /^[?&]/.test(endpoint.gpeQueryTemplate)
                ? endpoint.gpeQueryTemplate
                : `?${endpoint.gpeQueryTemplate}`
            : '';
        const base = service.gpsBaseUrl.replace(/\/+$/, '');
        const url = base + fill(endpoint.gpePathTemplate + query, encodeURIComponent, false);
        const loggedUrl = base + fill(endpoint.gpePathTemplate + query, encodeURIComponent, true);
        const headers = { Accept: 'application/json, text/plain, */*' };
        const loggedHeaders = { ...headers };
        const templates = endpoint.gpeHeaders;
        if (isRecord(templates)) {
            for (const [name, template] of Object.entries(templates)) {
                headers[name] = fill(scalarText(template), asIs, false);
                loggedHeaders[name] = fill(scalarText(template), asIs, true);
            }
        }
        if (missing.size) {
            const where = `${provider.gpvCode}'s ${service.gpsEnvironment} provider account`;
            const hint = {
                aspId: `{aspId} — set clientId (the aspid) on ${where}`,
                clientId: `{clientId} — set clientId (the aspid) on ${where}`,
                aspPassword: `{aspPassword} — set clientSecret (the ASP password) on ${where}`,
                clientSecret: `{clientSecret} — set clientSecret (the ASP password) on ${where}`,
                apiKey: `{apiKey} — set apiKey on ${where}`,
            };
            this.throwUnavailable('GSTIN search is not configured', [...missing]
                .map((name) => hint[name] ??
                `The ${ACTION} endpoint uses {${name}}, which GSTIN search does not fill`)
                .join('; '));
        }
        try {
            new URL(url);
        }
        catch {
            this.throwUnavailable('GSTIN search is not configured', `${provider.gpvCode} ${service.gpsEnvironment} ${SERVICE}: "${loggedUrl}" is not a valid URL`);
        }
        return {
            method: endpoint.gpeHttpMethod,
            url,
            headers,
            timeoutMs: endpoint.gpeTimeoutMs ?? service.gpsTimeoutMs ?? provider.gpvTimeoutMs,
            logged: { url: loggedUrl, headers: loggedHeaders },
        };
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
    providerErrorOf(body, endpoint) {
        const byRow = {
            code: endpoint.gpeErrorCodePath ? codeText(this.at(body, endpoint.gpeErrorCodePath)) : null,
            message: endpoint.gpeErrorMessagePath
                ? text(this.at(body, endpoint.gpeErrorMessagePath))
                : null,
        };
        if (byRow.code || byRow.message || !isRecord(body)) {
            return byRow;
        }
        if (isRecord(body.error)) {
            return {
                code: codeText(body.error.error_cd) ?? codeText(body.error.errorCode),
                message: text(body.error.message) ?? text(body.error.msg),
            };
        }
        const detail = Array.isArray(body.ErrorDetails) ? body.ErrorDetails[0] : null;
        if (isRecord(detail)) {
            return { code: codeText(detail.ErrorCode), message: text(detail.ErrorMessage) };
        }
        return { code: null, message: null };
    }
    messageOf(body, endpoint, fallback) {
        if (typeof body === 'string') {
            return text(body)?.slice(0, 300) ?? fallback;
        }
        const refusal = this.providerErrorOf(body, endpoint);
        if (refusal.code || refusal.message) {
            const message = refusal.message ?? fallback;
            return (refusal.code ? `[${refusal.code}] ${message}` : message).slice(0, 300);
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
    at(root, path) {
        try {
            return (0, gst_json_path_1.getPath)(root, path);
        }
        catch {
            return undefined;
        }
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
    async log(route, request, companyId, startedOn, outcome) {
        const finishedOn = new Date();
        try {
            const providerCode = outcome.ok
                ? null
                : this.providerErrorOf(outcome.body, route.endpoint).code;
            let ourCode = null;
            if (providerCode) {
                const mapped = await this.prisma.gstProviderErrorMap.findMany({
                    where: {
                        gemGpvId: route.provider.gpvId,
                        gemTheirCode: providerCode,
                        gemIsDeleted: false,
                        OR: [{ gemService: SERVICE }, { gemService: null }],
                    },
                    select: { gemService: true, gemOurCode: true },
                });
                ourCode = (mapped.find((m) => m.gemService !== null) ?? mapped[0])?.gemOurCode ?? null;
            }
            const redact = Array.isArray(route.endpoint.gpeRedactPaths)
                ? route.endpoint.gpeRedactPaths.filter((p) => typeof p === 'string')
                : [];
            const body = outcome.body === null || outcome.body === undefined
                ? client_1.Prisma.DbNull
                : (0, gst_json_path_1.redactPaths)(outcome.body, redact);
            await this.prisma.gstApiLog.create({
                data: {
                    galCompanyId: companyId,
                    galBranchId: this.requestContextService.getBranchId(),
                    galAccYear: (0, gst_auth_service_1.istAccYear)(startedOn),
                    galGpvId: route.provider.gpvId,
                    galService: SERVICE,
                    galAction: ACTION,
                    galEnvironment: route.service.gpsEnvironment,
                    galRequestUrl: request.logged.url,
                    galRequestHeaders: request.logged.headers,
                    galHttpStatus: outcome.status,
                    galResponsePayload: body,
                    galProviderCode: providerCode?.slice(0, 50) ?? null,
                    galOurCode: ourCode?.slice(0, 30) ?? null,
                    galIsSuccess: outcome.ok,
                    galMessage: outcome.message.slice(0, 500),
                    galStartedOn: startedOn,
                    galFinishedOn: finishedOn,
                    galDurationMs: finishedOn.getTime() - startedOn.getTime(),
                    galCreatedBy: (this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR).slice(0, 50),
                },
            });
        }
        catch (error) {
            this.logger.warn('gst_api_log row for a GSTIN search not written: ' +
                (error instanceof Error ? error.message : String(error)));
        }
    }
    throwUpstream(message) {
        throw new common_1.HttpException((0, module_service_utils_1.buildSettingsErrorResponse)('GST service error', [
            { field: 'gstin', message },
        ]), common_1.HttpStatus.BAD_GATEWAY);
    }
    throwUnavailable(title, message) {
        throw new common_1.HttpException((0, module_service_utils_1.buildSettingsErrorResponse)(title, [{ field: 'gstin', message }]), common_1.HttpStatus.SERVICE_UNAVAILABLE);
    }
};
exports.GstinLookupService = GstinLookupService;
exports.GstinLookupService = GstinLookupService = GstinLookupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        gst_crypto_service_1.GstCryptoService,
        gst_http_client_1.GstHttpClient])
], GstinLookupService);
function scalarText(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return value.toString();
    }
    return JSON.stringify(value) ?? '';
}
//# sourceMappingURL=gstin-lookup.service.js.map