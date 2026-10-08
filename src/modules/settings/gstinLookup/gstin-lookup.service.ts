import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  GstProvider,
  GstProviderAccount,
  GstProviderEndpoint,
  GstProviderService,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  buildSettingsErrorResponse,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { resolveProviderAccount } from '../../gst/client/gst-auth-lease';
import { istAccYear } from '../../gst/client/gst-auth.service';
import { GstHttpClient, GstHttpError } from '../../gst/client/gst-http.client';
import { getPath, redactPaths, REDACTED } from '../../gst/client/gst-json-path';
import {
  assertGstRouteActive,
  gstRouteRefusal,
  type GstRoute,
} from '../../gst/client/gst-route-guard';
import { GstCryptoService } from '../../gst/config/gst-crypto.service';
import { GST_REG_TYPES, type GstRegType } from '../shared/gst-registration';
import {
  GstinLookupAddress,
  GstinLookupErrorDetail,
  GstinLookupPayload,
} from './types/gstin-lookup.types';

const SERVICE = 'GSTIN_VERIFY';
const ACTION = 'VERIFY_GSTIN';
/** Where the provider may nest the taxpayer record. */
const DATA_KEYS = ['data', 'taxpayer', 'result'] as const;
/** Keys only a taxpayer record carries. */
const TAXPAYER_KEYS = ['lgnm', 'tradeNam', 'tradeName', 'pradr', 'dty'] as const;
/** Placeholders whose value never reaches the log: they read '***' there. */
const SECRET_PLACEHOLDERS = new Set(['aspId', 'aspPassword', 'clientId', 'clientSecret', 'apiKey']);

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
/** A provider code may come back as a number (NIC's ErrorCode does). */
const codeText = (value: unknown): string | null =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value);

/** The rows one search runs on: whatever the GST Provider screen has switched on. */
interface SearchRoute {
  provider: GstProvider;
  service: GstProviderService;
  endpoint: GstProviderEndpoint;
  account: GstProviderAccount | null;
  /** The same rows as the shared guard sees them (notes 88). */
  guard: GstRoute;
}

interface SearchRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
  /** The same request as gst_api_log holds it: secret placeholders as '***'. */
  logged: { url: string; headers: Record<string, string> };
}

/**
 * Notes 72 C6 — GSTIN search on the server, for the Qt and React fetch buttons
 * on company, branch, customer, supplier and ledger.
 *
 * Notes 87 — WHERE and AS WHOM come from the GST Provider screen, the way
 * Verify's do, and nothing else: there is one switch.
 *   service   gst_provider_service GSTIN_VERIFY. PRODUCTION before SANDBOX,
 *             then provider code, then the older row; the first whose whole
 *             chain is switched on is used:
 *   endpoint  its VERIFY_GSTIN row (method, path + query template, header
 *             templates, envelope paths, timeout, redact paths);
 *   account   the provider account for that provider + environment
 *             (GSTIN_VERIFY, else the all-services one), resolveProviderAccount
 *             as Verify uses it: clientId is {aspId}, clientSecret {aspPassword}.
 * Notes 88 — "switched on" is the shared guard (gst-route-guard.ts): when no
 * chain passes it, the 503 names the first row that is off on the best one —
 * "GST provider CHARTERED is inactive" — and no call goes out. The
 * GST_LOOKUP_* environment settings of notes 79/84 are gone.
 *
 * Placeholders: {gstin} the request company's own GSTIN, {searchGstin} the one
 * asked for, {aspId} / {aspPassword} (alias {clientId} / {clientSecret}) and
 * {apiKey} from the account.
 *
 * Notes 85 — every call that goes out leaves one gst_api_log row, secrets as
 * '***', and a refusal reaches the client in the provider's own words: the
 * endpoint's error paths, else TaxPro's {status_cd:"0", error:{error_cd,
 * message}}, else NIC's ErrorDetails[0].
 */
@Injectable()
export class GstinLookupService {
  private readonly logger = new Logger(GstinLookupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
    private readonly crypto: GstCryptoService,
    private readonly http: GstHttpClient,
  ) {}

  async search(gstin: string): Promise<GstinLookupPayload> {
    const route = await this.resolveRoute();
    const { companyId, sourceGstin } = await this.resolveSource();
    const request = this.buildRequest(route, sourceGstin, gstin);
    const host = new URL(request.url).host;
    const startedOn = new Date();
    const log = (outcome: LogOutcome) => this.log(route, request, companyId, startedOn, outcome);

    let status: number;
    let body: unknown;
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
    } catch (error) {
      const reason =
        error instanceof GstHttpError || error instanceof Error ? error.message : String(error);
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
    const succeeded =
      status >= 200 &&
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
      const message = this.messageOf(
        body,
        endpoint,
        `The GST service has no details for GSTIN ${gstin}`,
      );
      await log({ status, body, ok: false, message });
      throwSettingsNotFound<GstinLookupErrorDetail>('GST details not found', 'gstin', message);
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

  /**
   * The first GSTIN_VERIFY chain the shared guard lets through, else 503 naming
   * the first row that is off on the best-ranked one. Inactive rows are read too,
   * only so the refusal can name them.
   */
  private async resolveRoute(): Promise<SearchRoute> {
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
    const rank = (s: (typeof services)[number]) =>
      [
        s.gpsEnvironment === 'PRODUCTION' ? 0 : 1,
        s.provider.gpvCode,
        s.gpsCreatedOn.getTime(),
        s.gpsId,
      ] as const;
    services.sort((a, b) => {
      const [x, y] = [rank(a), rank(b)];
      for (let i = 0; i < x.length; i++) {
        if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
      }
      return 0;
    });
    let first: GstRoute | null = null;
    for (const { provider, endpoints, ...service } of services) {
      const endpoint = endpoints[0] ?? null;
      const scope = {
        gccGpvId: service.gpsGpvId,
        gccEnvironment: service.gpsEnvironment,
        gccService: SERVICE,
      };
      const account =
        (await resolveProviderAccount(this.prisma, scope, SERVICE)) ??
        (await resolveProviderAccount(this.prisma, scope, SERVICE, { activeOnly: false }));
      const guard: GstRoute = { provider, service, action: ACTION, endpoint, account };
      if (endpoint && !gstRouteRefusal(guard)) {
        return { provider, service, endpoint, account, guard };
      }
      first ??= guard;
    }
    if (!first) {
      this.throwUnavailable(
        'GSTIN search is switched off',
        `No ${SERVICE} service is set up. Add one, with a ${ACTION} endpoint and an account, under GST Providers.`,
      );
    }
    assertGstRouteActive(first, { field: 'gstin', title: 'GSTIN search is switched off' });
    // Unreachable: a route the guard refuses has thrown above.
    this.throwUnavailable('GSTIN search is switched off', `No active ${SERVICE} provider`);
  }

  /** The request company and the GSTIN it searches as: {gstin}. */
  private async resolveSource(): Promise<{ companyId: string; sourceGstin: string }> {
    const companyId = this.requestContextService.getCompanyId();
    const company = companyId
      ? await this.prisma.company.findFirst({
          where: { compId: companyId },
          select: { compGstinNo: true },
        })
      : null;
    const sourceGstin = text(company?.compGstinNo);
    if (!companyId || !sourceGstin) {
      this.throwUnavailable(
        'GSTIN search is not configured',
        'The company has no GSTIN to search as: set it in Company Master',
      );
    }
    return { companyId, sourceGstin };
  }

  /** URL and headers from the endpoint's templates; 503 naming every value it needs and lacks. */
  private buildRequest(route: SearchRoute, sourceGstin: string, gstin: string): SearchRequest {
    const { provider, service, endpoint, account } = route;
    const open = (value: string | null) => (value ? this.crypto.decrypt(value) : null);
    const aspId = open(account?.gpaClientIdEnc ?? null);
    const aspPassword = open(account?.gpaClientSecretEnc ?? null);
    const values: Record<string, string | null> = {
      gstin: sourceGstin,
      searchGstin: gstin,
      aspId,
      aspPassword,
      clientId: aspId,
      clientSecret: aspPassword,
      apiKey: open(account?.gpaApiKeyEnc ?? null),
    };
    const missing = new Set<string>();
    const fill = (template: string, encode: (v: string) => string, forLog: boolean) =>
      template.replace(/\{(\w+)\}/g, (_, name: string) => {
        const value = values[name];
        if (value === null || value === undefined) {
          missing.add(name);
          return '';
        }
        return forLog && SECRET_PLACEHOLDERS.has(name) ? REDACTED : encode(value);
      });
    const asIs = (v: string) => v;
    const query = endpoint.gpeQueryTemplate
      ? /^[?&]/.test(endpoint.gpeQueryTemplate)
        ? endpoint.gpeQueryTemplate
        : `?${endpoint.gpeQueryTemplate}`
      : '';
    const base = service.gpsBaseUrl.replace(/\/+$/, '');
    const url = base + fill(endpoint.gpePathTemplate + query, encodeURIComponent, false);
    const loggedUrl = base + fill(endpoint.gpePathTemplate + query, encodeURIComponent, true);
    const headers: Record<string, string> = { Accept: 'application/json, text/plain, */*' };
    const loggedHeaders: Record<string, string> = { ...headers };
    const templates = endpoint.gpeHeaders;
    if (isRecord(templates)) {
      for (const [name, template] of Object.entries(templates)) {
        headers[name] = fill(scalarText(template), asIs, false);
        loggedHeaders[name] = fill(scalarText(template), asIs, true);
      }
    }
    if (missing.size) {
      const where = `${provider.gpvCode}'s ${service.gpsEnvironment} provider account`;
      const hint: Record<string, string> = {
        aspId: `{aspId} — set clientId (the aspid) on ${where}`,
        clientId: `{clientId} — set clientId (the aspid) on ${where}`,
        aspPassword: `{aspPassword} — set clientSecret (the ASP password) on ${where}`,
        clientSecret: `{clientSecret} — set clientSecret (the ASP password) on ${where}`,
        apiKey: `{apiKey} — set apiKey on ${where}`,
      };
      this.throwUnavailable(
        'GSTIN search is not configured',
        [...missing]
          .map(
            (name) =>
              hint[name] ??
              `The ${ACTION} endpoint uses {${name}}, which GSTIN search does not fill`,
          )
          .join('; '),
      );
    }
    try {
      new URL(url);
    } catch {
      this.throwUnavailable(
        'GSTIN search is not configured',
        `${provider.gpvCode} ${service.gpsEnvironment} ${SERVICE}: "${loggedUrl}" is not a valid URL`,
      );
    }
    return {
      method: endpoint.gpeHttpMethod,
      url,
      headers,
      timeoutMs: endpoint.gpeTimeoutMs ?? service.gpsTimeoutMs ?? provider.gpvTimeoutMs,
      logged: { url: loggedUrl, headers: loggedHeaders },
    };
  }

  private parseBody(body: string): unknown {
    const trimmed = body.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }

  private extractTaxpayer(body: unknown): JsonRecord | null {
    if (!isRecord(body)) {
      return null;
    }
    const looksLikeTaxpayer = (record: JsonRecord) => TAXPAYER_KEYS.some((key) => key in record);
    for (const key of DATA_KEYS) {
      const nested = body[key];
      if (isRecord(nested) && looksLikeTaxpayer(nested)) {
        return nested;
      }
    }
    return looksLikeTaxpayer(body) ? body : null;
  }

  /**
   * The provider's own refusal: the endpoint's error paths when the row has
   * them, else wherever the envelope keeps it — TaxPro nests it under `error`
   * ({"status_cd":"0","error":{"error_cd":"GSP020","message":…}}), NIC lists it
   * in ErrorDetails[0] (ErrorCode / ErrorMessage).
   */
  private providerErrorOf(
    body: unknown,
    endpoint: GstProviderEndpoint,
  ): { code: string | null; message: string | null } {
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
    const detail = Array.isArray(body.ErrorDetails) ? (body.ErrorDetails as unknown[])[0] : null;
    if (isRecord(detail)) {
      return { code: codeText(detail.ErrorCode), message: text(detail.ErrorMessage) };
    }
    return { code: null, message: null };
  }

  /** What the client is told: the provider's `[code] message` first, then a flat message. */
  private messageOf(body: unknown, endpoint: GstProviderEndpoint, fallback: string): string {
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

  /** getPath, but a row's malformed path reads as "absent" instead of a 500. */
  private at(root: unknown, path: string): unknown {
    try {
      return getPath(root, path);
    } catch {
      return undefined;
    }
  }

  private toPayload(gstin: string, data: JsonRecord): GstinLookupPayload {
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

  private toAddress(pradr: unknown): GstinLookupAddress | null {
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

  /** "Regular", "Composition", "SEZ Unit" … onto GST_REG_TYPES; anything else is null. */
  private toGstRegType(registrationType: string | null): GstRegType | null {
    const upper = registrationType?.toUpperCase() ?? '';
    if (upper.includes('COMPOSITION')) return 'COMPOSITION';
    if (upper.includes('SEZ')) return 'SEZ';
    if (upper.includes('UNREG')) return 'UNREGISTERED';
    if (upper.includes('REGULAR')) return 'REGULAR';
    return (GST_REG_TYPES as readonly string[]).includes(upper) ? (upper as GstRegType) : null;
  }

  /**
   * One gst_api_log row per call that went out: the route's provider and
   * environment, the request with its secrets as '***', the reply through the
   * endpoint's redact paths, and our code from the provider's error map. A row
   * that cannot be written — no partition for the year, say — is a warning,
   * never a failed search.
   */
  private async log(
    route: SearchRoute,
    request: SearchRequest,
    companyId: string,
    startedOn: Date,
    outcome: LogOutcome,
  ): Promise<void> {
    const finishedOn = new Date();
    try {
      const providerCode = outcome.ok
        ? null
        : this.providerErrorOf(outcome.body, route.endpoint).code;
      let ourCode: string | null = null;
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
        ? route.endpoint.gpeRedactPaths.filter((p): p is string => typeof p === 'string')
        : [];
      const body =
        outcome.body === null || outcome.body === undefined
          ? Prisma.DbNull
          : (redactPaths(outcome.body, redact) as Prisma.InputJsonValue);
      await this.prisma.gstApiLog.create({
        data: {
          galCompanyId: companyId,
          galBranchId: this.requestContextService.getBranchId(),
          galAccYear: istAccYear(startedOn),
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
          galCreatedBy: (this.requestContextService.getUserId() ?? DEFAULT_ACTOR).slice(0, 50),
        },
      });
    } catch (error) {
      this.logger.warn(
        'gst_api_log row for a GSTIN search not written: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  private throwUpstream(message: string): never {
    throw new HttpException(
      buildSettingsErrorResponse<GstinLookupErrorDetail>('GST service error', [
        { field: 'gstin', message },
      ]),
      HttpStatus.BAD_GATEWAY,
    );
  }

  private throwUnavailable(title: string, message: string): never {
    throw new HttpException(
      buildSettingsErrorResponse<GstinLookupErrorDetail>(title, [{ field: 'gstin', message }]),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

interface LogOutcome {
  status: number | null;
  body: unknown;
  ok: boolean;
  message: string;
}

/** A reply value as text: a string as is, a number / boolean spelled out, an object as JSON. */
function scalarText(value: unknown): string {
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
