import { Injectable, Logger } from '@nestjs/common';
import {
  GstCompanyCredential,
  GstProvider,
  GstProviderEndpoint,
  GstProviderFieldMap,
  GstProviderService,
  Prisma,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from 'src/database/prisma/prisma.service';
import {
  throwSettingsConflict,
  throwSettingsNotFound,
  throwUnprocessable,
  toNullableNumber,
} from 'src/common/utils/module-service.utils';
import { GST_CODES, GST_SERVICES } from '../config/gst-config.constants';
import { GstCryptoService } from '../config/gst-crypto.service';
import type { GstErrorDetail } from '../types/gst-config.types';
import {
  claimLease,
  releaseLease,
  resolveProviderAccount,
  storeSession,
  type GstLease,
  type GstNewSession,
} from './gst-auth-lease';
import { GstHttpClient, GstHttpError, type GstHttpResponse } from './gst-http.client';
import { getPath, redactPaths, REDACTED } from './gst-json-path';
import { assertGstRouteActive, type GstRoute } from './gst-route-guard';
import {
  appKeyBytes,
  decryptSek,
  encryptAuthPayload,
  loadPublicKey,
  publicKeyDir,
} from './gst-nic-crypto';

/**
 * Sign-ins one GSTIN may spend from the Verify button in 15 minutes. NIC
 * blocks the GSTIN for 15 minutes at the 5th; one is left for the worker, so
 * an admin retyping a password cannot stop every counter's e-invoices.
 */
export const VERIFY_AUTH_BUDGET = 4;
const AUTH_WINDOW_MINUTES = 15;

/** Placeholders whose value never reaches a log: their headers / query values log as '***'. */
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

type AuthEndpoint = GstProviderEndpoint & { fieldMaps: GstProviderFieldMap[] };

interface AuthContext {
  credential: GstCompanyCredential & { provider: GstProvider };
  gstin: string;
  service: GstProviderService;
  endpoint: AuthEndpoint;
  account: Awaited<ReturnType<typeof resolveProviderAccount>>;
  /** The rows the sign-in runs on, every one switched on (notes 88). */
  route: GstRoute;
  timeoutMs: number;
}

interface AuthRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  /** The same request as the log may hold it: secret placeholders as '***'. */
  logged: { url: string; headers: Record<string, string>; body: unknown };
  appKey: Buffer;
}

interface Verdict {
  ok: boolean;
  message: string;
  errorCode?: string;
  theirCode?: string;
  ourCode?: string;
  session: GstNewSession | null;
  response: unknown;
}

export interface GstSignInOutcome {
  ok: boolean;
  message: string;
  errorCode?: string;
  tokenValidUntil?: string;
  creditBalance: number | null;
}

/**
 * ONE sign-in of a company credential at its provider (notes 79 R8; gsp_flow
 * §3), described entirely by rows: the AUTH endpoint of the credential's
 * service (path, query, headers, wrapper, envelope paths, redact paths), its
 * RESPONSE field map (auth_token, session_key, expires_on, refresh_token) and
 * the provider's error map. NIC's own scheme (RSA-wrapped body, AES Sek) is
 * the one piece in code (gst-nic-crypto.ts).
 *
 * Order matters: everything that can be refused without the portal is refused
 * first — missing secrets, a missing public key, the sign-in budget, a held
 * lease — so a refusal never costs one of NIC's five sign-ins.
 *
 * The credential's active flag, its service's and its endpoint's are NOT
 * required: this is a test, and testing a provider before activating it is
 * the point (Chartered is seeded inactive until its aspid is entered).
 * Active rows are preferred when there is a choice.
 */
@Injectable()
export class GstAuthService {
  private readonly logger = new Logger(GstAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: GstCryptoService,
    private readonly http: GstHttpClient,
  ) {}

  async signIn(gccId: string, actor: string): Promise<GstSignInOutcome> {
    const context = await this.resolveContext(gccId);
    const request = await this.buildRequest(context);
    await this.assertBudget(context.credential);
    const lease = await claimLease(this.prisma, {
      gccId,
      holder: randomUUID(),
      leaseSeconds: Math.max(90, Math.ceil(context.timeoutMs / 1000) + 30),
      keyVersion: this.crypto.currentVersion(),
      actor,
    });
    if (!lease) {
      throwSettingsConflict<GstErrorDetail>('A sign-in is already running', [
        {
          field: 'gccId',
          message:
            'Another sign-in for this credential holds the lease. Wait for it to finish and check ' +
            'the status: a second call now would count against the GSTIN’s 5 sign-ins per 15 minutes.',
          code: GST_CODES.AUTH_BUSY,
        },
      ]);
    }
    const startedOn = new Date();
    let response: GstHttpResponse | null = null;
    let verdict: Verdict;
    try {
      response = await this.http.send({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        timeoutMs: context.timeoutMs,
        route: context.route,
      });
      verdict = await this.interpret(context, request, response, actor);
    } catch (error) {
      if (!(error instanceof GstHttpError)) {
        await releaseLease(this.prisma, lease).catch(() => undefined);
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
      message:
        verdict.ok && verdict.session && !stored
          ? `${verdict.message}. The session was not kept: another sign-in took over the lease`
          : verdict.message,
      ...(verdict.errorCode ? { errorCode: verdict.errorCode } : {}),
      ...(stored && verdict.session
        ? { tokenValidUntil: verdict.session.expiresOn.toISOString() }
        : {}),
      creditBalance: toNullableNumber(context.account?.gpaCreditBalance ?? null),
    };
  }

  /** The credential, its GSTIN, and the service + AUTH endpoint it signs in through. */
  private async resolveContext(gccId: string): Promise<AuthContext> {
    const credential = await this.prisma.gstCompanyCredential.findUnique({
      where: { gccId },
      include: {
        provider: true,
        company: { select: { compGstinNo: true, compName: true } },
        branch: { select: { brGstinNo: true } },
      },
    });
    if (!credential) {
      throwSettingsNotFound<GstErrorDetail>(
        'GST credential not found',
        'gccId',
        `No GST credential found with id ${gccId}`,
      );
    }
    if (credential.gccIsDeleted || credential.provider.gpvIsDeleted) {
      throwSettingsConflict<GstErrorDetail>('Nothing to verify', [
        {
          field: 'gccId',
          message: credential.gccIsDeleted
            ? 'The credential is deleted. Restore it first.'
            : `Provider ${credential.provider.gpvCode} is deleted. Restore it first.`,
          code: GST_CODES.ALREADY_DELETED,
        },
      ]);
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
    const rank = (s: GstProviderService) =>
      (s.gpsIsActive ? 0 : 100) +
      GST_SERVICES.indexOf(s.gpsService as (typeof GST_SERVICES)[number]);
    const service = services.filter((s) => s.endpoints.length).sort((a, b) => rank(a) - rank(b))[0];
    if (!service) {
      // A provider that is switched off says so before "nothing is set up" (notes 88).
      assertGstRouteActive({ provider: credential.provider }, { field: 'gccId' });
      this.incomplete(
        'gccGpvId',
        `${credential.provider.gpvCode} has no ${credential.gccService ?? ''} ${credential.gccEnvironment} ` +
          'service with an AUTH endpoint. Add one under GST Providers.',
        GST_CODES.NO_AUTH_ENDPOINT,
      );
    }
    const endpoint = service.endpoints.find((e) => e.gpeIsActive) ?? service.endpoints[0];
    // An active account first; an inactive one only so the refusal below can name it.
    const account =
      (await resolveProviderAccount(this.prisma, credential, service.gpsService)) ??
      (await resolveProviderAccount(this.prisma, credential, service.gpsService, {
        activeOnly: false,
      }));
    // Notes 88: no inactive row is tried any more — Verify refuses like every other call,
    // so testing a provider means switching it on. Before the GSTIN, budget and lease.
    const route: GstRoute = {
      provider: credential.provider,
      service,
      action: 'AUTH',
      endpoint,
      account,
      credential,
    };
    assertGstRouteActive(route, { field: 'gccId' });
    const gstin = credential.branch?.brGstinNo?.trim() || credential.company.compGstinNo?.trim();
    if (!gstin) {
      this.incomplete(
        'gccCompanyId',
        `${credential.company.compName} has no GSTIN to sign in as`,
        GST_CODES.NO_GSTIN,
      );
    }
    return {
      credential,
      gstin,
      route,
      service,
      endpoint,
      account,
      timeoutMs: endpoint.gpeTimeoutMs ?? service.gpsTimeoutMs ?? credential.provider.gpvTimeoutMs,
    };
  }

  /** URL, headers and body from the AUTH row; 422 naming every value it needs and lacks. */
  private async buildRequest(context: AuthContext): Promise<AuthRequest> {
    const { credential, service, endpoint, account } = context;
    const open = (value: string | null | undefined) => (value ? this.crypto.decrypt(value) : null);
    const gccClientId = open(credential.gccClientIdEnc);
    const gccClientSecret = open(credential.gccClientSecretEnc);
    const gpaClientId = open(account?.gpaClientIdEnc);
    const gpaClientSecret = open(account?.gpaClientSecretEnc);
    const storedAppKey = open(credential.gccAppKeyEnc);
    const appKey = storedAppKey ? appKeyBytes(storedAppKey) : randomBytes(32);
    if (!appKey) {
      this.incomplete(
        'appKey',
        'The stored appKey is not 32 bytes (base64 of 32 bytes, or 32 characters)',
      );
    }
    const values: Record<string, string | null> = {
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
    const url =
      service.gpsBaseUrl + fill(endpoint.gpePathTemplate + query, encodeURIComponent, false);
    const loggedUrl =
      service.gpsBaseUrl + fill(endpoint.gpePathTemplate + query, encodeURIComponent, true);
    const headers: Record<string, string> = { Accept: 'application/json' };
    const loggedHeaders: Record<string, string> = { Accept: 'application/json' };
    const templates = endpoint.gpeHeaders;
    if (templates && typeof templates === 'object' && !Array.isArray(templates)) {
      for (const [name, template] of Object.entries(templates)) {
        headers[name] = fill(scalarText(template), asIs, false);
        loggedHeaders[name] = fill(scalarText(template), asIs, true);
      }
    }
    let body: string | undefined;
    let loggedBody: unknown = null;
    if (!['GET', 'DELETE'].includes(endpoint.gpeHttpMethod)) {
      const plain = {
        UserName: credential.gccLoginId,
        Password: values.password,
        AppKey: values.appKey,
        ForceRefreshAccessToken: true,
      };
      let payload: object = plain;
      let loggedPayload: object = { ...plain, Password: REDACTED, AppKey: REDACTED };
      if (service.gpsAuthScheme === 'NIC_SEK' && service.gpsPayloadEncryption !== 'NONE') {
        payload = { Data: encryptAuthPayload(await this.publicKeyOf(credential), plain) };
        loggedPayload = { Data: REDACTED };
      }
      const wrapper = endpoint.gpeRequestWrapper;
      const wrapped = wrapper ? { [wrapper]: payload } : payload;
      body = JSON.stringify(wrapped);
      loggedBody = redactPaths(
        wrapper ? { [wrapper]: loggedPayload } : loggedPayload,
        this.redactList(endpoint),
      );
      if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = endpoint.gpeContentType;
        loggedHeaders['Content-Type'] = endpoint.gpeContentType;
      }
    }
    if (missing.size) {
      throwUnprocessable<GstErrorDetail>(
        'The credential cannot sign in yet',
        [...missing].map((name) => ({
          field: name,
          message: this.missingHint(name, context),
          code: GST_CODES.CREDENTIAL_INCOMPLETE,
        })),
      );
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

  private async publicKeyOf(credential: GstCompanyCredential) {
    const ref = credential.gccPublicKeyRef;
    if (!ref) {
      this.incomplete(
        'gccPublicKeyRef',
        'This service encrypts the sign-in with the IRP public key: set gccPublicKeyRef',
        GST_CODES.PUBLIC_KEY_MISSING,
      );
    }
    const key = await loadPublicKey(ref);
    if (!key) {
      this.incomplete(
        'gccPublicKeyRef',
        `No public key "${ref}" on this server: put it at ${publicKeyDir()}/${ref}.pem`,
        GST_CODES.PUBLIC_KEY_MISSING,
      );
    }
    return key;
  }

  /** 409 once this GSTIN has spent VERIFY_AUTH_BUDGET sign-ins in the window. */
  private async assertBudget(credential: GstCompanyCredential): Promise<void> {
    const [spent] = await this.prisma.$queryRaw<Array<{ n: number; oldest: Date | null }>>`
      SELECT count(*)::int AS n, min(gal_started_on) AS oldest
        FROM public.gst_api_log
       WHERE gal_action = 'AUTH'
         AND gal_is_deleted = false
         AND gal_company_id = ${credential.gccCompanyId}::uuid
         AND gal_branch_id IS NOT DISTINCT FROM ${credential.gccBranchId}::uuid
         AND gal_started_on > now() - make_interval(mins => ${AUTH_WINDOW_MINUTES}::int)`;
    if (spent && spent.n >= VERIFY_AUTH_BUDGET) {
      const freeAt = spent.oldest
        ? new Date(spent.oldest.getTime() + AUTH_WINDOW_MINUTES * 60_000).toISOString()
        : 'in a few minutes';
      throwSettingsConflict<GstErrorDetail>('Too many sign-ins for this GSTIN', [
        {
          field: 'gccId',
          message:
            `${spent.n} sign-ins in the last ${AUTH_WINDOW_MINUTES} minutes; NIC blocks the GSTIN at 5. ` +
            `Try again after ${freeAt}.`,
          code: GST_CODES.AUTH_RATE_LIMIT,
        },
      ]);
    }
  }

  /** The reply, read through the endpoint's envelope paths, field map and the provider's error map. */
  private async interpret(
    context: AuthContext,
    request: AuthRequest,
    response: GstHttpResponse,
    actor: string,
  ): Promise<Verdict> {
    const { endpoint, service, credential } = context;
    let json: unknown = null;
    try {
      json = JSON.parse(response.text);
    } catch {
      json = null;
    }
    const logged = json ?? { raw: response.text.slice(0, 2000) };
    const http2xx = response.status >= 200 && response.status < 300;
    const successByPath = endpoint.gpeSuccessPath
      ? scalarText(this.at(json, endpoint.gpeSuccessPath)) === endpoint.gpeSuccessValue
      : true;
    if (!http2xx || json === null || !successByPath) {
      const theirCode = this.text(
        endpoint.gpeErrorCodePath ? this.at(json, endpoint.gpeErrorCodePath) : null,
      );
      const theirMessage = this.text(
        endpoint.gpeErrorMessagePath ? this.at(json, endpoint.gpeErrorMessagePath) : null,
      );
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
        message:
          mapped?.gemMessage ??
          theirMessage ??
          (json === null && http2xx
            ? 'The portal answered with something that is not JSON'
            : `The portal refused the sign-in (HTTP ${response.status})`),
        errorCode:
          mapped?.gemOurCode ??
          theirCode ??
          (response.status >= 500 ? 'UPSTREAM_DOWN' : 'AUTH_FAILED'),
        theirCode: theirCode ?? undefined,
        ourCode: mapped?.gemOurCode,
        session: null,
        response: this.redactResponse(logged, endpoint),
      };
    }
    const who =
      `Signed in to ${credential.provider.gpvCode} ${service.gpsService} ${service.gpsEnvironment} ` +
      `as ${credential.gccLoginId} for GSTIN ${context.gstin}`;
    const kept = this.sessionFrom(context, request, json, actor);
    return {
      ok: true,
      message: kept.problem ? `${who}, but ${kept.problem}` : who,
      session: kept.session,
      response: this.redactResponse(logged, endpoint),
    };
  }

  /** The new session out of the reply, or why none can be kept. */
  private sessionFrom(
    context: AuthContext,
    request: AuthRequest,
    json: unknown,
    actor: string,
  ): { session: GstNewSession | null; problem?: string } {
    const { endpoint, service } = context;
    const root = endpoint.gpeResponseRootPath ? this.at(json, endpoint.gpeResponseRootPath) : json;
    const rowOf = (field: string) => endpoint.fieldMaps.find((m) => m.gfmOurField === field);
    const valueOf = (field: string) => {
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
      const opened = decryptSek(sessionKey, request.appKey);
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
    const expiresOn =
      parsed && parsed > issuedOn
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

  /** Store the session (or give the lease back) and stamp the credential. True when a session was kept. */
  private async finish(
    gccId: string,
    lease: GstLease,
    verdict: Verdict,
    finishedOn: Date,
  ): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const stored = verdict.session
          ? await storeSession(tx, lease, gccId, verdict.session)
          : false;
        if (!stored) {
          await releaseLease(tx, lease);
        }
        // Operational stamps, not an edit: gcc_modified_on and the audit trail stay as they are.
        await tx.gstCompanyCredential.update({
          where: { gccId },
          data: verdict.ok
            ? { gccLastVerifiedOn: finishedOn, gccLastErrorMessage: null }
            : { gccLastErrorMessage: verdict.message.slice(0, 500) },
        });
        return stored;
      });
    } catch (error) {
      await releaseLease(this.prisma, lease).catch(() => undefined);
      throw error;
    }
  }

  /**
   * One gst_api_log row per attempt (gsp_flow §5.2), redacted: secret
   * placeholders as '***', the endpoint's redact paths, and the reply's token,
   * Sek and refresh token wherever the field map says they are. A log that
   * cannot be written (no partition for the year) is a warning, never a
   * failed verification.
   */
  private async log(
    context: AuthContext,
    request: AuthRequest,
    response: GstHttpResponse | null,
    verdict: Verdict,
    startedOn: Date,
    finishedOn: Date,
    actor: string,
  ): Promise<void> {
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
          galRequestPayload: request.logged.body ?? Prisma.DbNull,
          galHttpStatus: response?.status ?? null,
          galResponsePayload: verdict.response ?? Prisma.DbNull,
          galProviderCode: verdict.theirCode?.slice(0, 50) ?? null,
          galOurCode:
            (verdict.ourCode ?? (verdict.ok ? null : verdict.errorCode))?.slice(0, 30) ?? null,
          galIsSuccess: verdict.ok,
          galMessage: verdict.message.slice(0, 500),
          galStartedOn: startedOn,
          galFinishedOn: finishedOn,
          galDurationMs: finishedOn.getTime() - startedOn.getTime(),
          galCreatedBy: actor.slice(0, 50),
        },
      });
    } catch (error) {
      this.logger.warn(
        `gst_api_log row for AUTH of credential ${credential.gccId} not written: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  private redactResponse(body: unknown, endpoint: AuthEndpoint): unknown {
    const root = endpoint.gpeResponseRootPath ?? '$';
    const secretPaths = endpoint.fieldMaps
      .filter((m) => ['auth_token', 'session_key', 'refresh_token'].includes(m.gfmOurField))
      .map((m) => root + m.gfmTheirPath.slice(1));
    return redactPaths(body, [...this.redactList(endpoint), ...secretPaths]);
  }

  private redactList(endpoint: GstProviderEndpoint): string[] {
    return Array.isArray(endpoint.gpeRedactPaths)
      ? endpoint.gpeRedactPaths.filter((p): p is string => typeof p === 'string')
      : [];
  }

  /** getPath, but a row's malformed path reads as "absent" instead of a 500. */
  private at(root: unknown, path: string): unknown {
    try {
      return getPath(root, path);
    } catch {
      return undefined;
    }
  }

  private text(value: unknown): string | null {
    const s = scalarText(value).trim();
    return s ? s : null;
  }

  private missingHint(name: string, context: AuthContext): string {
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

  private incomplete(
    field: string,
    message: string,
    code: string = GST_CODES.CREDENTIAL_INCOMPLETE,
  ): never {
    throwUnprocessable<GstErrorDetail>('The credential cannot sign in yet', [
      { field, message, code },
    ]);
  }
}

/** A reply value as text: a string as is, a number / boolean spelled out, an object as JSON, nothing as ''. */
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

/**
 * A provider's timestamp. DATETIME_NIC: 'yyyy-MM-dd HH:mm:ss' or
 * 'dd/MM/yyyy hh:mm:ss [AM|PM]', IST with no zone (NIC's TokenExpiry);
 * EPOCH_MS: milliseconds; anything else: ISO-8601. Null when unreadable — the
 * caller falls back to the service's token TTL.
 */
export function parseProviderDateTime(raw: string, transform: string): Date | null {
  const text = raw.trim();
  if (transform === 'EPOCH_MS' || /^\d{12,14}$/.test(text)) {
    const ms = Number(text);
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?([AP]M))?$/i.exec(
    text,
  );
  if (transform === 'DATETIME_NIC' || ymd || dmy) {
    let parts: number[] | null = null;
    if (ymd) {
      parts = [+ymd[1], +ymd[2], +ymd[3], +ymd[4], +ymd[5], +(ymd[6] ?? 0)];
    } else if (dmy) {
      let hour = +dmy[4] % (dmy[7] ? 12 : 24);
      if (dmy[7]?.toUpperCase() === 'PM') {
        hour += 12;
      }
      parts = [+dmy[3], +dmy[2], +dmy[1], hour, +dmy[5], +(dmy[6] ?? 0)];
    }
    if (parts) {
      const [y, mo, d, h, mi, s] = parts;
      // IST is UTC+05:30 all year.
      return new Date(Date.UTC(y, mo - 1, d, h, mi, s) - 330 * 60_000);
    }
  }
  const iso = Date.parse(text);
  return Number.isNaN(iso) ? null : new Date(iso);
}

/** The Indian April–March year of an instant, read in IST — gst_api_log's partition key. */
export function istAccYear(at: Date): string {
  const ist = new Date(at.getTime() + 330 * 60_000);
  const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${start}-${start + 1}`;
}
