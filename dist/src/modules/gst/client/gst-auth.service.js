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
var GstAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GstAuthService = exports.VERIFY_AUTH_BUDGET = void 0;
exports.parseProviderDateTime = parseProviderDateTime;
exports.istAccYear = istAccYear;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const gst_config_constants_1 = require("../config/gst-config.constants");
const gst_crypto_service_1 = require("../config/gst-crypto.service");
const gst_auth_lease_1 = require("./gst-auth-lease");
const gst_http_client_1 = require("./gst-http.client");
const gst_json_path_1 = require("./gst-json-path");
const gst_nic_crypto_1 = require("./gst-nic-crypto");
exports.VERIFY_AUTH_BUDGET = 4;
const AUTH_WINDOW_MINUTES = 15;
const SECRET_PLACEHOLDERS = new Set([
    'password',
    'clientId',
    'clientSecret',
    'aspId',
    'aspPassword',
    'apiKey',
    'appKey',
    'authToken',
]);
let GstAuthService = GstAuthService_1 = class GstAuthService {
    prisma;
    crypto;
    http;
    logger = new common_1.Logger(GstAuthService_1.name);
    constructor(prisma, crypto, http) {
        this.prisma = prisma;
        this.crypto = crypto;
        this.http = http;
    }
    async signIn(gccId, actor) {
        const context = await this.resolveContext(gccId);
        const request = await this.buildRequest(context);
        await this.assertBudget(context.credential);
        const lease = await (0, gst_auth_lease_1.claimLease)(this.prisma, {
            gccId,
            holder: (0, node_crypto_1.randomUUID)(),
            leaseSeconds: Math.max(90, Math.ceil(context.timeoutMs / 1000) + 30),
            keyVersion: this.crypto.currentVersion(),
            actor,
        });
        if (!lease) {
            (0, module_service_utils_1.throwSettingsConflict)('A sign-in is already running', [
                {
                    field: 'gccId',
                    message: 'Another sign-in for this credential holds the lease. Wait for it to finish and check ' +
                        'the status: a second call now would count against the GSTIN’s 5 sign-ins per 15 minutes.',
                    code: gst_config_constants_1.GST_CODES.AUTH_BUSY,
                },
            ]);
        }
        const startedOn = new Date();
        let response = null;
        let verdict;
        try {
            response = await this.http.send({
                method: request.method,
                url: request.url,
                headers: request.headers,
                body: request.body,
                timeoutMs: context.timeoutMs,
            });
            verdict = await this.interpret(context, request, response, actor);
        }
        catch (error) {
            if (!(error instanceof gst_http_client_1.GstHttpError)) {
                await (0, gst_auth_lease_1.releaseLease)(this.prisma, lease).catch(() => undefined);
                throw error;
            }
            verdict = {
                ok: false,
                message: error.message,
                errorCode: error.kind === 'TIMEOUT' ? 'TIMEOUT' : 'UPSTREAM_DOWN',
                session: null,
                response: null,
            };
        }
        const finishedOn = new Date();
        const stored = await this.finish(context.credential.gccId, lease, verdict, finishedOn);
        await this.log(context, request, response, verdict, startedOn, finishedOn, actor);
        return {
            ok: verdict.ok,
            message: verdict.ok && verdict.session && !stored
                ? `${verdict.message}. The session was not kept: another sign-in took over the lease`
                : verdict.message,
            ...(verdict.errorCode ? { errorCode: verdict.errorCode } : {}),
            ...(stored && verdict.session
                ? { tokenValidUntil: verdict.session.expiresOn.toISOString() }
                : {}),
            creditBalance: (0, module_service_utils_1.toNullableNumber)(context.account?.gpaCreditBalance ?? null),
        };
    }
    async resolveContext(gccId) {
        const credential = await this.prisma.gstCompanyCredential.findUnique({
            where: { gccId },
            include: {
                provider: true,
                company: { select: { compGstinNo: true, compName: true } },
                branch: { select: { brGstinNo: true } },
            },
        });
        if (!credential) {
            (0, module_service_utils_1.throwSettingsNotFound)('GST credential not found', 'gccId', `No GST credential found with id ${gccId}`);
        }
        if (credential.gccIsDeleted || credential.provider.gpvIsDeleted) {
            (0, module_service_utils_1.throwSettingsConflict)('Nothing to verify', [
                {
                    field: 'gccId',
                    message: credential.gccIsDeleted
                        ? 'The credential is deleted. Restore it first.'
                        : `Provider ${credential.provider.gpvCode} is deleted. Restore it first.`,
                    code: gst_config_constants_1.GST_CODES.ALREADY_DELETED,
                },
            ]);
        }
        const gstin = credential.branch?.brGstinNo?.trim() || credential.company.compGstinNo?.trim();
        if (!gstin) {
            this.incomplete('gccCompanyId', `${credential.company.compName} has no GSTIN to sign in as`, gst_config_constants_1.GST_CODES.NO_GSTIN);
        }
        const services = await this.prisma.gstProviderService.findMany({
            where: {
                gpsGpvId: credential.gccGpvId,
                gpsEnvironment: credential.gccEnvironment,
                gpsIsDeleted: false,
                ...(credential.gccService ? { gpsService: credential.gccService } : {}),
            },
            include: {
                endpoints: {
                    where: { gpeAction: 'AUTH', gpeIsDeleted: false },
                    include: {
                        fieldMaps: {
                            where: { gfmDirection: 'RESPONSE', gfmIsDeleted: false },
                            orderBy: { gfmSortOrder: 'asc' },
                        },
                    },
                },
            },
        });
        const rank = (s) => (s.gpsIsActive ? 0 : 100) +
            gst_config_constants_1.GST_SERVICES.indexOf(s.gpsService);
        const service = services.filter((s) => s.endpoints.length).sort((a, b) => rank(a) - rank(b))[0];
        if (!service) {
            this.incomplete('gccGpvId', `${credential.provider.gpvCode} has no ${credential.gccService ?? ''} ${credential.gccEnvironment} ` +
                'service with an AUTH endpoint. Add one under GST Providers.', gst_config_constants_1.GST_CODES.NO_AUTH_ENDPOINT);
        }
        const endpoint = service.endpoints.find((e) => e.gpeIsActive) ?? service.endpoints[0];
        const account = await (0, gst_auth_lease_1.resolveProviderAccount)(this.prisma, credential, service.gpsService, {
            activeOnly: false,
        });
        return {
            credential,
            gstin,
            service,
            endpoint,
            account,
            timeoutMs: endpoint.gpeTimeoutMs ?? service.gpsTimeoutMs ?? credential.provider.gpvTimeoutMs,
        };
    }
    async buildRequest(context) {
        const { credential, service, endpoint, account } = context;
        const open = (value) => (value ? this.crypto.decrypt(value) : null);
        const gccClientId = open(credential.gccClientIdEnc);
        const gccClientSecret = open(credential.gccClientSecretEnc);
        const gpaClientId = open(account?.gpaClientIdEnc);
        const gpaClientSecret = open(account?.gpaClientSecretEnc);
        const storedAppKey = open(credential.gccAppKeyEnc);
        const appKey = storedAppKey ? (0, gst_nic_crypto_1.appKeyBytes)(storedAppKey) : (0, node_crypto_1.randomBytes)(32);
        if (!appKey) {
            this.incomplete('appKey', 'The stored appKey is not 32 bytes (base64 of 32 bytes, or 32 characters)');
        }
        const values = {
            gstin: context.gstin,
            loginId: credential.gccLoginId,
            password: open(credential.gccPasswordEnc),
            clientId: gccClientId ?? gpaClientId,
            clientSecret: gccClientSecret ?? gpaClientSecret,
            aspId: gpaClientId,
            aspPassword: gpaClientSecret,
            apiKey: open(account?.gpaApiKeyEnc),
            appKey: appKey.toString('base64'),
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
        const url = service.gpsBaseUrl + fill(endpoint.gpePathTemplate + query, encodeURIComponent, false);
        const loggedUrl = service.gpsBaseUrl + fill(endpoint.gpePathTemplate + query, encodeURIComponent, true);
        const headers = { Accept: 'application/json' };
        const loggedHeaders = { Accept: 'application/json' };
        const templates = endpoint.gpeHeaders;
        if (templates && typeof templates === 'object' && !Array.isArray(templates)) {
            for (const [name, template] of Object.entries(templates)) {
                headers[name] = fill(scalarText(template), asIs, false);
                loggedHeaders[name] = fill(scalarText(template), asIs, true);
            }
        }
        let body;
        let loggedBody = null;
        if (!['GET', 'DELETE'].includes(endpoint.gpeHttpMethod)) {
            const plain = {
                UserName: credential.gccLoginId,
                Password: values.password,
                AppKey: values.appKey,
                ForceRefreshAccessToken: true,
            };
            let payload = plain;
            let loggedPayload = { ...plain, Password: gst_json_path_1.REDACTED, AppKey: gst_json_path_1.REDACTED };
            if (service.gpsAuthScheme === 'NIC_SEK' && service.gpsPayloadEncryption !== 'NONE') {
                payload = { Data: (0, gst_nic_crypto_1.encryptAuthPayload)(await this.publicKeyOf(credential), plain) };
                loggedPayload = { Data: gst_json_path_1.REDACTED };
            }
            const wrapper = endpoint.gpeRequestWrapper;
            const wrapped = wrapper ? { [wrapper]: payload } : payload;
            body = JSON.stringify(wrapped);
            loggedBody = (0, gst_json_path_1.redactPaths)(wrapper ? { [wrapper]: loggedPayload } : loggedPayload, this.redactList(endpoint));
            if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
                headers['Content-Type'] = endpoint.gpeContentType;
                loggedHeaders['Content-Type'] = endpoint.gpeContentType;
            }
        }
        if (missing.size) {
            (0, module_service_utils_1.throwUnprocessable)('The credential cannot sign in yet', [...missing].map((name) => ({
                field: name,
                message: this.missingHint(name, context),
                code: gst_config_constants_1.GST_CODES.CREDENTIAL_INCOMPLETE,
            })));
        }
        return {
            method: endpoint.gpeHttpMethod,
            url,
            headers,
            body,
            logged: { url: loggedUrl, headers: loggedHeaders, body: loggedBody },
            appKey,
        };
    }
    async publicKeyOf(credential) {
        const ref = credential.gccPublicKeyRef;
        if (!ref) {
            this.incomplete('gccPublicKeyRef', 'This service encrypts the sign-in with the IRP public key: set gccPublicKeyRef', gst_config_constants_1.GST_CODES.PUBLIC_KEY_MISSING);
        }
        const key = await (0, gst_nic_crypto_1.loadPublicKey)(ref);
        if (!key) {
            this.incomplete('gccPublicKeyRef', `No public key "${ref}" on this server: put it at ${(0, gst_nic_crypto_1.publicKeyDir)()}/${ref}.pem`, gst_config_constants_1.GST_CODES.PUBLIC_KEY_MISSING);
        }
        return key;
    }
    async assertBudget(credential) {
        const [spent] = await this.prisma.$queryRaw `
      SELECT count(*)::int AS n, min(gal_started_on) AS oldest
        FROM public.gst_api_log
       WHERE gal_action = 'AUTH'
         AND gal_is_deleted = false
         AND gal_company_id = ${credential.gccCompanyId}::uuid
         AND gal_branch_id IS NOT DISTINCT FROM ${credential.gccBranchId}::uuid
         AND gal_started_on > now() - make_interval(mins => ${AUTH_WINDOW_MINUTES}::int)`;
        if (spent && spent.n >= exports.VERIFY_AUTH_BUDGET) {
            const freeAt = spent.oldest
                ? new Date(spent.oldest.getTime() + AUTH_WINDOW_MINUTES * 60_000).toISOString()
                : 'in a few minutes';
            (0, module_service_utils_1.throwSettingsConflict)('Too many sign-ins for this GSTIN', [
                {
                    field: 'gccId',
                    message: `${spent.n} sign-ins in the last ${AUTH_WINDOW_MINUTES} minutes; NIC blocks the GSTIN at 5. ` +
                        `Try again after ${freeAt}.`,
                    code: gst_config_constants_1.GST_CODES.AUTH_RATE_LIMIT,
                },
            ]);
        }
    }
    async interpret(context, request, response, actor) {
        const { endpoint, service, credential } = context;
        let json = null;
        try {
            json = JSON.parse(response.text);
        }
        catch {
            json = null;
        }
        const logged = json ?? { raw: response.text.slice(0, 2000) };
        const http2xx = response.status >= 200 && response.status < 300;
        const successByPath = endpoint.gpeSuccessPath
            ? scalarText(this.at(json, endpoint.gpeSuccessPath)) === endpoint.gpeSuccessValue
            : true;
        if (!http2xx || json === null || !successByPath) {
            const theirCode = this.text(endpoint.gpeErrorCodePath ? this.at(json, endpoint.gpeErrorCodePath) : null);
            const theirMessage = this.text(endpoint.gpeErrorMessagePath ? this.at(json, endpoint.gpeErrorMessagePath) : null);
            const mapped = theirCode
                ? await this.prisma.gstProviderErrorMap.findFirst({
                    where: {
                        gemGpvId: credential.gccGpvId,
                        gemTheirCode: theirCode,
                        gemIsDeleted: false,
                        OR: [{ gemService: service.gpsService }, { gemService: null }],
                    },
                    orderBy: { gemService: { sort: 'asc', nulls: 'last' } },
                })
                : null;
            return {
                ok: false,
                message: mapped?.gemMessage ??
                    theirMessage ??
                    (json === null && http2xx
                        ? 'The portal answered with something that is not JSON'
                        : `The portal refused the sign-in (HTTP ${response.status})`),
                errorCode: mapped?.gemOurCode ??
                    theirCode ??
                    (response.status >= 500 ? 'UPSTREAM_DOWN' : 'AUTH_FAILED'),
                theirCode: theirCode ?? undefined,
                ourCode: mapped?.gemOurCode,
                session: null,
                response: this.redactResponse(logged, endpoint),
            };
        }
        const who = `Signed in to ${credential.provider.gpvCode} ${service.gpsService} ${service.gpsEnvironment} ` +
            `as ${credential.gccLoginId} for GSTIN ${context.gstin}`;
        const kept = this.sessionFrom(context, request, json, actor);
        return {
            ok: true,
            message: kept.problem ? `${who}, but ${kept.problem}` : who,
            session: kept.session,
            response: this.redactResponse(logged, endpoint),
        };
    }
    sessionFrom(context, request, json, actor) {
        const { endpoint, service } = context;
        const root = endpoint.gpeResponseRootPath ? this.at(json, endpoint.gpeResponseRootPath) : json;
        const rowOf = (field) => endpoint.fieldMaps.find((m) => m.gfmOurField === field);
        const valueOf = (field) => {
            const row = rowOf(field);
            const value = row ? this.at(root, row.gfmTheirPath) : undefined;
            return value === undefined || value === null || value === ''
                ? (row?.gfmDefaultValue ?? null)
                : value;
        };
        const lacking = endpoint.fieldMaps
            .filter((m) => m.gfmIsRequired && valueOf(m.gfmOurField) === null)
            .map((m) => `${m.gfmOurField} (${m.gfmTheirPath})`);
        if (!rowOf('auth_token')) {
            return {
                session: null,
                problem: 'the AUTH endpoint maps no auth_token, so no session was kept',
            };
        }
        if (lacking.length) {
            return {
                session: null,
                problem: `the reply lacks ${lacking.join(', ')}; no session was kept`,
            };
        }
        const token = this.text(valueOf('auth_token'));
        if (!token) {
            return { session: null, problem: 'the reply carries no auth_token; no session was kept' };
        }
        let sessionKey = this.text(valueOf('session_key'));
        if (sessionKey && service.gpsPayloadEncryption === 'AES_SEK') {
            const opened = (0, gst_nic_crypto_1.decryptSek)(sessionKey, request.appKey);
            if (!opened) {
                return {
                    session: null,
                    problem: 'its Sek does not open with the AppKey sent; no session was kept',
                };
            }
            sessionKey = opened.toString('base64');
        }
        const issuedOn = new Date();
        const expiryRow = rowOf('expires_on');
        const expiryRaw = this.text(valueOf('expires_on'));
        const parsed = expiryRaw
            ? parseProviderDateTime(expiryRaw, expiryRow?.gfmTransform ?? 'NONE')
            : null;
        const expiresOn = parsed && parsed > issuedOn
            ? parsed
            : new Date(issuedOn.getTime() + service.gpsTokenTtlMinutes * 60_000);
        const refreshToken = this.text(valueOf('refresh_token'));
        return {
            session: {
                authTokenEnc: this.crypto.encrypt(token),
                sessionKeyEnc: sessionKey ? this.crypto.encrypt(sessionKey) : null,
                refreshTokenEnc: refreshToken ? this.crypto.encrypt(refreshToken) : null,
                keyVersion: this.crypto.currentVersion(),
                issuedOn,
                expiresOn,
                expiryRaw,
                actor,
            },
        };
    }
    async finish(gccId, lease, verdict, finishedOn) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const stored = verdict.session
                    ? await (0, gst_auth_lease_1.storeSession)(tx, lease, gccId, verdict.session)
                    : false;
                if (!stored) {
                    await (0, gst_auth_lease_1.releaseLease)(tx, lease);
                }
                await tx.gstCompanyCredential.update({
                    where: { gccId },
                    data: verdict.ok
                        ? { gccLastVerifiedOn: finishedOn, gccLastErrorMessage: null }
                        : { gccLastErrorMessage: verdict.message.slice(0, 500) },
                });
                return stored;
            });
        }
        catch (error) {
            await (0, gst_auth_lease_1.releaseLease)(this.prisma, lease).catch(() => undefined);
            throw error;
        }
    }
    async log(context, request, response, verdict, startedOn, finishedOn, actor) {
        const { credential, service } = context;
        try {
            await this.prisma.gstApiLog.create({
                data: {
                    galCompanyId: credential.gccCompanyId,
                    galBranchId: credential.gccBranchId,
                    galAccYear: istAccYear(startedOn),
                    galGccId: credential.gccId,
                    galGpvId: credential.gccGpvId,
                    galService: service.gpsService,
                    galAction: 'AUTH',
                    galEnvironment: service.gpsEnvironment,
                    galRequestUrl: request.logged.url,
                    galRequestHeaders: request.logged.headers,
                    galRequestPayload: request.logged.body ?? client_1.Prisma.DbNull,
                    galHttpStatus: response?.status ?? null,
                    galResponsePayload: verdict.response ?? client_1.Prisma.DbNull,
                    galProviderCode: verdict.theirCode?.slice(0, 50) ?? null,
                    galOurCode: (verdict.ourCode ?? (verdict.ok ? null : verdict.errorCode))?.slice(0, 30) ?? null,
                    galIsSuccess: verdict.ok,
                    galMessage: verdict.message.slice(0, 500),
                    galStartedOn: startedOn,
                    galFinishedOn: finishedOn,
                    galDurationMs: finishedOn.getTime() - startedOn.getTime(),
                    galCreatedBy: actor.slice(0, 50),
                },
            });
        }
        catch (error) {
            this.logger.warn(`gst_api_log row for AUTH of credential ${credential.gccId} not written: ` +
                (error instanceof Error ? error.message : String(error)));
        }
    }
    redactResponse(body, endpoint) {
        const root = endpoint.gpeResponseRootPath ?? '$';
        const secretPaths = endpoint.fieldMaps
            .filter((m) => ['auth_token', 'session_key', 'refresh_token'].includes(m.gfmOurField))
            .map((m) => root + m.gfmTheirPath.slice(1));
        return (0, gst_json_path_1.redactPaths)(body, [...this.redactList(endpoint), ...secretPaths]);
    }
    redactList(endpoint) {
        return Array.isArray(endpoint.gpeRedactPaths)
            ? endpoint.gpeRedactPaths.filter((p) => typeof p === 'string')
            : [];
    }
    at(root, path) {
        try {
            return (0, gst_json_path_1.getPath)(root, path);
        }
        catch {
            return undefined;
        }
    }
    text(value) {
        const s = scalarText(value).trim();
        return s ? s : null;
    }
    missingHint(name, context) {
        const env = context.credential.gccEnvironment;
        const code = context.credential.provider.gpvCode;
        switch (name) {
            case 'password':
                return 'The credential has no password';
            case 'clientId':
            case 'clientSecret':
                return `{${name}} — set ${name} on the credential, or on ${code}'s ${env} provider account`;
            case 'aspId':
                return `{aspId} — set clientId (the aspid) on ${code}'s ${env} provider account`;
            case 'aspPassword':
                return `{aspPassword} — set clientSecret (the ASP password) on ${code}'s ${env} provider account`;
            case 'apiKey':
                return `{apiKey} — set apiKey on ${code}'s ${env} provider account`;
            case 'authToken':
                return 'An AUTH call cannot send {authToken}: remove it from the AUTH endpoint’s headers';
            default:
                return `The AUTH endpoint uses {${name}}, which this server does not know`;
        }
    }
    incomplete(field, message, code = gst_config_constants_1.GST_CODES.CREDENTIAL_INCOMPLETE) {
        (0, module_service_utils_1.throwUnprocessable)('The credential cannot sign in yet', [
            { field, message, code },
        ]);
    }
};
exports.GstAuthService = GstAuthService;
exports.GstAuthService = GstAuthService = GstAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gst_crypto_service_1.GstCryptoService,
        gst_http_client_1.GstHttpClient])
], GstAuthService);
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
function parseProviderDateTime(raw, transform) {
    const text = raw.trim();
    if (transform === 'EPOCH_MS' || /^\d{12,14}$/.test(text)) {
        const ms = Number(text);
        return Number.isFinite(ms) ? new Date(ms) : null;
    }
    const ymd = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?([AP]M))?$/i.exec(text);
    if (transform === 'DATETIME_NIC' || ymd || dmy) {
        let parts = null;
        if (ymd) {
            parts = [+ymd[1], +ymd[2], +ymd[3], +ymd[4], +ymd[5], +(ymd[6] ?? 0)];
        }
        else if (dmy) {
            let hour = +dmy[4] % (dmy[7] ? 12 : 24);
            if (dmy[7]?.toUpperCase() === 'PM') {
                hour += 12;
            }
            parts = [+dmy[3], +dmy[2], +dmy[1], hour, +dmy[5], +(dmy[6] ?? 0)];
        }
        if (parts) {
            const [y, mo, d, h, mi, s] = parts;
            return new Date(Date.UTC(y, mo - 1, d, h, mi, s) - 330 * 60_000);
        }
    }
    const iso = Date.parse(text);
    return Number.isNaN(iso) ? null : new Date(iso);
}
function istAccYear(at) {
    const ist = new Date(at.getTime() + 330 * 60_000);
    const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
    return `${start}-${start + 1}`;
}
//# sourceMappingURL=gst-auth.service.js.map