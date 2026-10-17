import { Prisma, PrismaClient } from '@prisma/client';
import {
  constants,
  generateKeyPairSync,
  privateDecrypt,
  randomBytes,
  createCipheriv,
} from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { GstCryptoService } from '../src/modules/gst/config/gst-crypto.service';
import { GstConfigSupport } from '../src/modules/gst/config/gst-config.support';
import { GstProviderService } from '../src/modules/gst/config/gst-provider.service';
import { GstProviderPartsService } from '../src/modules/gst/config/gst-provider-parts.service';
import { GstProviderAccountService } from '../src/modules/gst/config/gst-provider-account.service';
import { GstCompanyCredentialService } from '../src/modules/gst/config/gst-company-credential.service';
import { GstAuthService } from '../src/modules/gst/client/gst-auth.service';
import type { GstHttpRequest, GstHttpResponse } from '../src/modules/gst/client/gst-http.client';

/**
 * Notes 79 R1–R9 against the real database, in one rolled-back transaction,
 * on the REAL audit service, with a scripted NIC portal behind the HTTP
 * client: the provider tree, the write-only secret contract (no plain text in
 * a response, a column, an audit row or the call log), the credential slots,
 * and Verify end to end — RSA-wrapped sign-in, Sek unwrapped with the AppKey,
 * the session kept encrypted, the error map, the lease and the sign-in budget.
 *
 *     npm run test:e2e -- gst-config
 */

const prisma = new PrismaClient();
class Rollback extends Error {}

function transactional(tx: Prisma.TransactionClient): PrismaService {
  const proxy: object = new Proxy(tx, {
    get(target, prop) {
      if (prop === '$transaction') {
        return (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (client: unknown) => unknown)(proxy)
            : Promise.all(arg as Array<Promise<unknown>>);
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return proxy as PrismaService;
}

describe('GST providers & credentials (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let spSeq = 0;
  let userId: string;
  let menus: { providers: number; credentials: number };
  let companyId: string;
  let companyGstin: string;
  let providers: GstProviderService;
  let parts: GstProviderPartsService;
  let accounts: GstProviderAccountService;
  let credentials: GstCompanyCredentialService;
  let portal: (request: GstHttpRequest) => GstHttpResponse;
  const calls: GstHttpRequest[] = [];
  const stamp = Date.now().toString(36).toUpperCase();
  const savedEnv: Record<string, string | undefined> = {};
  const keyDir = mkdtempSync(path.join(tmpdir(), 'gst-keys-'));
  const irp = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const PASSWORD = `Pw-${stamp}-secret`;
  const CLIENT_SECRET = `cs-${stamp}-secret`;
  const TOKEN = `tok-${stamp}-live`;

  beforeAll(async () => {
    for (const key of ['GST_CRED_KEY', 'GST_CRED_KEY_VERSION', 'GST_PUBLIC_KEY_DIR']) {
      savedEnv[key] = process.env[key];
    }
    process.env.GST_CRED_KEY = randomBytes(32).toString('hex');
    delete process.env.GST_CRED_KEY_VERSION;
    process.env.GST_PUBLIC_KEY_DIR = keyDir;
    writeFileSync(
      path.join(keyDir, 'test-irp.pem'),
      irp.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    );

    await new Promise<void>((ready, fail) => {
      txDone = prisma
        .$transaction(
          async (client) => {
            tx = client;
            ready();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            throw new Rollback();
          },
          { maxWait: 30_000, timeout: 10 * 60_000 },
        )
        .then(
          () => undefined,
          (error: unknown) => {
            if (error instanceof Rollback) return;
            fail(error instanceof Error ? error : new Error(String(error)));
            throw error;
          },
        );
    });
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    userId = user.usr_id;
    const menuRows = await tx.$queryRaw<Array<{ menu_id: number; menu_name: string }>>`
      SELECT menu_id, menu_name FROM fixed.menu_master
       WHERE menu_parent = 60 AND menu_name IN ('GST Providers', 'GST Credentials')`;
    menus = {
      providers: menuRows.find((m) => m.menu_name === 'GST Providers')!.menu_id,
      credentials: menuRows.find((m) => m.menu_name === 'GST Credentials')!.menu_id,
    };
    const [company] = await tx.$queryRaw<Array<{ comp_id: string; comp_gstin_no: string }>>`
      SELECT comp_id, comp_gstin_no FROM public.companys
       WHERE comp_is_deleted = false AND comp_gstin_no IS NOT NULL AND comp_gstin_no <> ''
       ORDER BY comp_created_on LIMIT 1`;
    companyId = company.comp_id;
    companyGstin = company.comp_gstin_no;

    const ctx = {
      getUserId: () => userId,
      getIpAddress: () => null,
    } as unknown as RequestContextService;
    const db = transactional(tx);
    const audit = new AuditLogService(db, ctx);
    const crypto = new GstCryptoService();
    const support = new GstConfigSupport(db, ctx, audit, crypto);
    const http = {
      send: (request: GstHttpRequest) => {
        calls.push(request);
        return Promise.resolve(portal(request));
      },
    };
    providers = new GstProviderService(db, support);
    parts = new GstProviderPartsService(db, support);
    accounts = new GstProviderAccountService(db, support);
    credentials = new GstCompanyCredentialService(
      db,
      support,
      new GstAuthService(db, crypto, http),
    );
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
    rmSync(keyDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  async function attempt<T>(fn: () => Promise<T>): Promise<T> {
    const sp = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
    try {
      const out = await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      return out;
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw error;
    }
  }
  const refusal = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return {
        status: (error as { status?: number }).status,
        body: JSON.stringify((error as { response?: unknown }).response ?? String(error)),
      };
    }
    throw new Error('expected a refusal, got a result');
  };
  const grant = async (
    menuId: number,
    rights: Partial<Record<'view' | 'create' | 'edit' | 'delete' | 'post', boolean>>,
  ) => {
    await tx.$executeRaw`
      INSERT INTO public.user_menus (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit,
                                     um_can_delete, um_can_post, um_created_by)
      VALUES (${userId}::uuid, ${menuId}, ${rights.view ?? false}, ${rights.create ?? false},
              ${rights.edit ?? false}, ${rights.delete ?? false}, ${rights.post ?? false}, ${userId}::uuid)
      ON CONFLICT (um_user_id, um_menu_id) DO UPDATE
        SET um_can_view = EXCLUDED.um_can_view, um_can_create = EXCLUDED.um_can_create,
            um_can_edit = EXCLUDED.um_can_edit, um_can_delete = EXCLUDED.um_can_delete,
            um_can_post = EXCLUDED.um_can_post, um_is_deleted = false`;
  };
  const all = { view: true, create: true, edit: true, delete: true, post: true };

  /** NIC's sign-in, scripted: unwrap the RSA body, check the login, answer with a Sek under the AppKey. */
  const nicPortal =
    (sessionKey: Buffer, expiryIst: string) =>
    (request: GstHttpRequest): GstHttpResponse => {
      const { Data } = JSON.parse(request.body!) as { Data: string };
      const base64Json = privateDecrypt(
        { key: irp.privateKey, padding: constants.RSA_PKCS1_PADDING },
        Buffer.from(Data, 'base64'),
      ).toString('utf8');
      const login = JSON.parse(Buffer.from(base64Json, 'base64').toString('utf8')) as {
        UserName: string;
        Password: string;
        AppKey: string;
      };
      if (login.Password !== PASSWORD) {
        return {
          status: 200,
          text: JSON.stringify({
            Status: 0,
            ErrorDetails: [{ ErrorCode: '1005', ErrorMessage: 'Invalid login' }],
          }),
        };
      }
      const cipher = createCipheriv('aes-256-ecb', Buffer.from(login.AppKey, 'base64'), null);
      const sek = Buffer.concat([cipher.update(sessionKey), cipher.final()]).toString('base64');
      return {
        status: 200,
        text: JSON.stringify({
          Status: 1,
          Data: {
            ClientId: 'x',
            UserName: login.UserName,
            AuthToken: TOKEN,
            Sek: sek,
            TokenExpiry: expiryIst,
          },
        }),
      };
    };

  let gpvId: string;
  let gpsId: string;
  let gpeId: string;
  let gccId: string;

  it('refuses a save without the menu right, naming the user_menus column', async () => {
    await grant(menus.providers, {});
    const r = await refusal(
      attempt(() => providers.save({ gpvCode: `ZT${stamp}`, gpvName: 'Test GSP' })),
    );
    expect(r.status).toBe(403);
    expect(r.body).toContain('GST_RIGHT_CREATE');
    expect(r.body).toContain('um_can_create');
  });

  it('R1: creates a provider, keeps omitted fields on update, never renames, refuses a taken code', async () => {
    await grant(menus.providers, all);
    const created = await attempt(() =>
      providers.save({
        gpvCode: `ZT${stamp}`,
        gpvName: 'Test GSP',
        gpvRemarks: 'first',
        gpvTimeoutMs: 20000,
      }),
    );
    gpvId = created.gpvId;
    expect(created).toMatchObject({
      gpvCode: `ZT${stamp}`,
      gpvTimeoutMs: 20000,
      services: [],
      accounts: [],
    });
    const updated = await attempt(() =>
      providers.save({ gpvId, gpvCode: `ZT${stamp}`, gpvName: 'Renamed GSP' }),
    );
    expect(updated).toMatchObject({
      gpvName: 'Renamed GSP',
      gpvRemarks: 'first',
      gpvTimeoutMs: 20000,
    });
    expect(
      (await refusal(attempt(() => providers.save({ gpvId, gpvCode: `ZX${stamp}`, gpvName: 'x' }))))
        .body,
    ).toContain('GST_PROVIDER_CODE_FIXED');
    expect(
      (await refusal(attempt(() => providers.save({ gpvCode: 'NIC', gpvName: 'again' })))).body,
    ).toContain('GST_PROVIDER_CODE_DUPLICATE');
  });

  it('R2: a service per (service, environment), margin below the TTL', async () => {
    const service = await attempt(() =>
      parts.saveService({
        gpsGpvId: gpvId,
        gpsService: 'EINVOICE',
        gpsEnvironment: 'SANDBOX',
        gpsBaseUrl: 'https://einv.example.test',
        gpsAuthScheme: 'NIC_SEK',
        gpsPayloadEncryption: 'AES_SEK',
      }),
    );
    gpsId = service.gpsId;
    expect(service).toMatchObject({
      gpsTokenTtlMinutes: 360,
      gpsRefreshMarginMinutes: 15,
      gpsFallbackUrls: [],
    });
    const dup = await refusal(
      attempt(() =>
        parts.saveService({
          gpsGpvId: gpvId,
          gpsService: 'EINVOICE',
          gpsEnvironment: 'SANDBOX',
          gpsBaseUrl: 'https://other.example.test',
          gpsAuthScheme: 'NIC_SEK',
        }),
      ),
    );
    expect(dup.status).toBe(409);
    expect(dup.body).toContain('GST_SERVICE_DUPLICATE');
    const margin = await refusal(
      attempt(() =>
        parts.saveService({
          ...service,
          gpsId,
          gpsTokenTtlMinutes: 10,
          gpsRefreshMarginMinutes: 10,
        }),
      ),
    );
    expect(margin.status).toBe(400);
    expect(margin.body).toContain('gpsRefreshMarginMinutes');
  });

  it('R3 + R4: the AUTH endpoint and its field map, read back in one call', async () => {
    const endpoint = await attempt(() =>
      parts.saveEndpoint({
        gpeGpsId: gpsId,
        gpeAction: 'AUTH',
        gpePathTemplate: '/eivital/v1.04/auth',
        gpeHeaders: { Gstin: '{gstin}', client_id: '{clientId}', client_secret: '{clientSecret}' },
        gpeRedactPaths: ['$.Data', '$.client_secret'],
        gpeResponseRootPath: '$.Data',
        gpeSuccessPath: '$.Status',
        gpeSuccessValue: '1',
        gpeErrorCodePath: '$.ErrorDetails[0].ErrorCode',
        gpeErrorMessagePath: '$.ErrorDetails[0].ErrorMessage',
        gpeIsIdempotent: true,
      }),
    );
    gpeId = endpoint.gpeId;
    expect(endpoint).toMatchObject({
      gpvId,
      gpsService: 'EINVOICE',
      gpeHttpMethod: 'POST',
      fieldMaps: [],
    });
    expect(
      (
        await refusal(
          attempt(() =>
            parts.saveEndpoint({ gpeGpsId: gpsId, gpeAction: 'AUTH', gpePathTemplate: '/x' }),
          ),
        )
      ).body,
    ).toContain('GST_ENDPOINT_DUPLICATE');
    const pair = await refusal(
      attempt(() =>
        parts.saveEndpoint({
          gpeGpsId: gpsId,
          gpeAction: 'HEALTH',
          gpePathTemplate: '/h',
          gpeSuccessPath: '$.ok',
        }),
      ),
    );
    expect(pair.status).toBe(400);

    for (const [field, their, required, transform, sort] of [
      ['auth_token', '$.AuthToken', true, 'NONE', 10],
      ['session_key', '$.Sek', true, 'NONE', 20],
      ['expires_on', '$.TokenExpiry', false, 'DATETIME_NIC', 30],
    ] as const) {
      await attempt(() =>
        parts.saveFieldMap({
          gfmGpeId: gpeId,
          gfmDirection: 'RESPONSE',
          gfmOurField: field,
          gfmTheirPath: their,
          gfmIsRequired: required,
          gfmTransform: transform,
          gfmSortOrder: sort,
        }),
      );
    }
    expect(
      (
        await refusal(
          attempt(() =>
            parts.saveFieldMap({
              gfmGpeId: gpeId,
              gfmDirection: 'RESPONSE',
              gfmOurField: 'auth_token',
              gfmTheirPath: '$.T',
            }),
          ),
        )
      ).body,
    ).toContain('GST_FIELD_MAP_DUPLICATE');
    expect(
      (
        await refusal(
          attempt(() =>
            parts.saveFieldMap({
              gfmGpeId: gpeId,
              gfmDirection: 'RESPONSE',
              gfmOurField: 'irn',
              gfmTheirPath: '$.Irn',
              gfmIsRequired: true,
              gfmDefaultValue: 'x',
            }),
          ),
        )
      ).status,
    ).toBe(400);
    const read = await parts.getEndpoint(gpeId);
    expect(read.fieldMaps?.map((m) => m.gfmOurField)).toEqual([
      'auth_token',
      'session_key',
      'expires_on',
    ]);
  });

  it('R5: an error-map row; SUCCESS needs an extract path', async () => {
    await attempt(() =>
      parts.saveErrorMap({
        gemGpvId: gpvId,
        gemService: null,
        gemTheirCode: '1005',
        gemOurCode: 'AUTH_FAILED',
        gemMessage: 'The portal user or password is wrong',
        gemShouldReauth: false,
      }),
    );
    expect(
      (
        await refusal(
          attempt(() =>
            parts.saveErrorMap({ gemGpvId: gpvId, gemTheirCode: '1005', gemOurCode: 'UNKNOWN' }),
          ),
        )
      ).body,
    ).toContain('GST_ERROR_MAP_DUPLICATE');
    const success = await refusal(
      attempt(() =>
        parts.saveErrorMap({
          gemGpvId: gpvId,
          gemTheirCode: '2150',
          gemOurCode: 'DUPLICATE_IRN',
          gemTreatAs: 'SUCCESS',
        }),
      ),
    );
    expect(success.status).toBe(400);
    expect(success.body).toContain('gemExtractPath');
  });

  it('R6: account secrets go in once and come back only as flags — response, column, audit', async () => {
    const created = await attempt(() =>
      accounts.save({
        gpaGpvId: gpvId,
        gpaEnvironment: 'SANDBOX',
        gpaAccountRef: 'ACC-1',
        clientId: 'client-id-plain',
        clientSecret: CLIENT_SECRET,
        apiKey: 'api-key-plain',
      }),
    );
    expect(created).toMatchObject({
      hasClientId: true,
      hasClientSecret: true,
      hasApiKey: true,
      keyVersion: 1,
    });
    expect(JSON.stringify(created)).not.toContain(CLIENT_SECRET);
    const kept = await attempt(() =>
      accounts.save({
        gpaId: created.gpaId,
        gpaGpvId: gpvId,
        gpaEnvironment: 'SANDBOX',
        gpaAccountRef: 'ACC-1',
        clientSecret: '',
        clear: ['apiKey'],
      }),
    );
    expect(kept).toMatchObject({ hasClientSecret: true, hasApiKey: false });
    const [row] = await tx.$queryRaw<Array<{ gpa_client_secret_enc: string }>>`
      SELECT gpa_client_secret_enc FROM public.gst_provider_account WHERE gpa_id = ${created.gpaId}::uuid`;
    expect(row.gpa_client_secret_enc).toMatch(/^gcm:v1:/);
    expect(row.gpa_client_secret_enc).not.toContain(CLIENT_SECRET);
    const auditRows = await tx.$queryRaw<Array<{ text: string }>>`
      SELECT concat_ws(' ', log_original_record::text, log_modified_record::text,
                       log_changed_fields::text, log_notes) AS text
        FROM audit.audit_log WHERE log_pk = ${created.gpaId}`;
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
    expect(auditRows.map((r) => r.text).join(' ')).not.toContain(CLIENT_SECRET);
    expect(
      (
        await refusal(
          attempt(() =>
            accounts.save({ gpaGpvId: gpvId, gpaEnvironment: 'SANDBOX', gpaAccountRef: 'ACC-2' }),
          ),
        )
      ).body,
    ).toContain('GST_ACCOUNT_DUPLICATE');
    const provider = await providers.getById(gpvId);
    expect(provider).toMatchObject({ endpointCount: 1, errorMapCount: 1, credentialCount: 0 });
    expect(provider.services[0]).toMatchObject({ gpsId, endpointCount: 1 });
    expect(provider.accounts).toHaveLength(1);
  });

  it('R7: a credential resolves its GSTIN, hides its secrets, and holds one primary slot', async () => {
    await grant(menus.credentials, all);
    const base = {
      gccCompanyId: companyId,
      gccGpvId: gpvId,
      gccService: 'EINVOICE',
      gccEnvironment: 'SANDBOX',
      gccLoginId: `user_${stamp}`,
      gccValidFrom: '2026-04-01',
    };
    expect((await refusal(attempt(() => credentials.save(base)))).body).toContain(
      'password is required',
    );
    const created = await attempt(() =>
      credentials.save({ ...base, password: PASSWORD, gccWhitelistedIps: ['203.0.113.10'] }),
    );
    gccId = created.gccId;
    expect(created).toMatchObject({
      gstin: companyGstin,
      isPrimary: true,
      hasPassword: true,
      hasClientId: false,
      hasAppKey: false,
      gccWhitelistedIps: ['203.0.113.10'],
    });
    expect(created.gccPasswordChangedOn).not.toBeNull();
    expect(JSON.stringify(created)).not.toContain(PASSWORD);
    const primary = await refusal(attempt(() => credentials.save({ ...base, password: 'x' })));
    expect(primary.status).toBe(409);
    expect(primary.body).toContain('GST_CREDENTIAL_PRIMARY_EXISTS');
    const failover = await attempt(() =>
      credentials.save({ ...base, password: 'x', gccPriority: 2 }),
    );
    expect(failover.isPrimary).toBe(false);
    expect(
      (await refusal(attempt(() => credentials.save({ ...base, password: 'x', gccPriority: 2 }))))
        .body,
    ).toContain('GST_CREDENTIAL_PRIORITY_TAKEN');
    const half = await refusal(
      attempt(() => credentials.save({ ...base, gccId, clientId: 'only-half' })),
    );
    expect(half.status).toBe(400);
    expect(half.body).toContain('clientSecret');
    expect((await refusal(attempt(() => providers.softDelete(gpvId)))).body).toContain(
      'GST_PROVIDER_IN_USE',
    );
  });

  it('R8: refuses before calling the portal while the public key is missing', async () => {
    calls.length = 0;
    const r = await refusal(attempt(() => credentials.verify(gccId)));
    expect(r.status).toBe(422);
    expect(r.body).toContain('GST_PUBLIC_KEY_MISSING');
    expect(calls).toHaveLength(0);
  });

  it('R8: one RSA-wrapped sign-in; the session is kept encrypted, nothing secret is logged', async () => {
    const before = await attempt(() => credentials.getById(gccId));
    await attempt(() =>
      credentials.save({
        gccId,
        gccCompanyId: companyId,
        gccGpvId: gpvId,
        gccEnvironment: 'SANDBOX',
        gccLoginId: before.gccLoginId,
        gccValidFrom: '2026-04-01',
        gccPublicKeyRef: 'test-irp',
      }),
    );
    const sessionKey = randomBytes(32);
    const expiry = new Date(Date.now() + 6 * 3600_000);
    const expiryIst = new Date(expiry.getTime() + 330 * 60_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    portal = nicPortal(sessionKey, expiryIst);
    calls.length = 0;
    const result = await attempt(() => credentials.verify(gccId));
    expect(result).toMatchObject({ ok: true });
    expect(result.message).toContain(companyGstin);
    expect(new Date(result.tokenValidUntil!).getTime()).toBe(
      Math.floor(expiry.getTime() / 1000) * 1000,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].headers).toMatchObject({
      Gstin: companyGstin,
      client_id: 'client-id-plain',
      client_secret: CLIENT_SECRET,
    });

    const sessions = await tx.$queryRaw<
      Array<{ gas_auth_token_enc: string; gas_session_key_enc: string; gas_token_version: number }>
    >`
      SELECT gas_auth_token_enc, gas_session_key_enc, gas_token_version FROM public.gst_auth_session
       WHERE gas_gcc_id = ${gccId}::uuid AND gas_is_active = true`;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].gas_auth_token_enc).toMatch(/^gcm:v1:/);
    expect(sessions[0].gas_auth_token_enc).not.toContain(TOKEN);
    expect(sessions[0].gas_token_version).toBe(1);
    const crypto = new GstCryptoService();
    expect(crypto.decrypt(sessions[0].gas_auth_token_enc)).toBe(TOKEN);
    expect(
      Buffer.from(crypto.decrypt(sessions[0].gas_session_key_enc), 'base64').equals(sessionKey),
    ).toBe(true);

    const [log] = await tx.$queryRaw<Array<{ row: string; gal_is_success: boolean }>>`
      SELECT row_to_json(l)::text AS row, gal_is_success FROM public.gst_api_log l
       WHERE gal_gcc_id = ${gccId}::uuid ORDER BY gal_started_on DESC LIMIT 1`;
    expect(log.gal_is_success).toBe(true);
    for (const secret of [TOKEN, PASSWORD, CLIENT_SECRET]) {
      expect(log.row).not.toContain(secret);
    }

    const status = await credentials.status(gccId);
    expect(status).toMatchObject({ hasLiveToken: true, leaseFree: true, lastErrorMessage: null });
    expect(status.lastVerifiedOn).not.toBeNull();
  });

  it('R8: a refusal by the portal is data, mapped through the error map, and stamps the message', async () => {
    portal = (request) => {
      const parsed = JSON.parse(request.body!) as { Data: string };
      void parsed;
      return {
        status: 200,
        text: JSON.stringify({
          Status: 0,
          ErrorDetails: [{ ErrorCode: '1005', ErrorMessage: 'Invalid login' }],
        }),
      };
    };
    const result = await attempt(() => credentials.verify(gccId));
    expect(result).toMatchObject({
      ok: false,
      errorCode: 'AUTH_FAILED',
      message: 'The portal user or password is wrong',
    });
    expect((await credentials.status(gccId)).lastErrorMessage).toBe(
      'The portal user or password is wrong',
    );
  });

  it('R8: 409 GST_AUTH_BUSY while another sign-in holds the lease — and no portal call', async () => {
    await tx.$executeRaw`
      UPDATE public.gst_auth_session
         SET gas_lock_by = gen_random_uuid(), gas_lock_on = now(), gas_lock_upto = now() + interval '5 minutes'
       WHERE gas_gcc_id = ${gccId}::uuid AND gas_is_active = true`;
    calls.length = 0;
    const r = await refusal(attempt(() => credentials.verify(gccId)));
    expect(r.status).toBe(409);
    expect(r.body).toContain('GST_AUTH_BUSY');
    expect(calls).toHaveLength(0);
    expect((await credentials.status(gccId)).leaseFree).toBe(false);
    await tx.$executeRaw`
      UPDATE public.gst_auth_session SET gas_lock_by = NULL, gas_lock_on = NULL, gas_lock_upto = NULL
       WHERE gas_gcc_id = ${gccId}::uuid AND gas_is_active = true`;
  });

  it('R8: the GSTIN’s sign-in budget stops the fifth call in 15 minutes before it leaves the server', async () => {
    portal = nicPortal(randomBytes(32), '2099-01-01 00:00:00');
    // Two sign-ins are logged above; two more spend the budget.
    expect((await attempt(() => credentials.verify(gccId))).ok).toBe(true);
    expect((await attempt(() => credentials.verify(gccId))).ok).toBe(true);
    calls.length = 0;
    const r = await refusal(attempt(() => credentials.verify(gccId)));
    expect(r.status).toBe(409);
    expect(r.body).toContain('GST_AUTH_RATE_LIMIT');
    expect(calls).toHaveLength(0);
  });

  it('notes 88: every switch refuses Verify with a 503 naming it — before the portal and the log', async () => {
    const logged = async () => {
      const [row] = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM public.gst_api_log WHERE gal_gcc_id = ${gccId}::uuid`;
      return row.n;
    };
    const before = await logged();
    const switches: Array<[string, (active: boolean) => Promise<unknown>]> = [
      [
        `GST provider ZT${stamp} is inactive`,
        (active) => tx.gstProvider.update({ where: { gpvId }, data: { gpvIsActive: active } }),
      ],
      [
        'EINVOICE · SANDBOX service is inactive',
        (active) =>
          tx.gstProviderService.update({ where: { gpsId }, data: { gpsIsActive: active } }),
      ],
      [
        'AUTH endpoint of EINVOICE · SANDBOX is inactive',
        (active) =>
          tx.gstProviderEndpoint.update({ where: { gpeId }, data: { gpeIsActive: active } }),
      ],
      [
        'The GST credential is inactive',
        (active) =>
          tx.gstCompanyCredential.update({ where: { gccId }, data: { gccIsActive: active } }),
      ],
    ];
    for (const [message, flip] of switches) {
      await flip(false);
      calls.length = 0;
      const r = await refusal(attempt(() => credentials.verify(gccId)));
      expect(r.status).toBe(503);
      expect(r.body).toContain('GST_SWITCHED_OFF');
      expect(r.body).toContain(message);
      expect(calls).toHaveLength(0);
      await flip(true);
    }
    // The provider is named first even when everything below it is off too.
    await switches[1][1](false);
    await switches[0][1](false);
    expect((await refusal(attempt(() => credentials.verify(gccId)))).body).toContain(
      `GST provider ZT${stamp} is inactive`,
    );
    await switches[0][1](true);
    await switches[1][1](true);
    expect(await logged()).toBe(before);
  });

  it('a new password retires the live session; delete and restore keep the slot rules', async () => {
    const current = await credentials.getById(gccId);
    const saved = await attempt(() =>
      credentials.save({
        gccId,
        gccCompanyId: companyId,
        gccGpvId: gpvId,
        gccEnvironment: 'SANDBOX',
        gccLoginId: current.gccLoginId,
        gccValidFrom: '2026-04-01',
        password: `${PASSWORD}-2`,
      }),
    );
    expect(saved.hasPassword).toBe(true);
    expect((await credentials.status(gccId)).hasLiveToken).toBe(false);
    expect(await attempt(() => credentials.softDelete(gccId))).toEqual({ gccId, deleted: true });
    expect((await credentials.getById(gccId)).gccIsDeleted).toBe(true);
    expect((await refusal(attempt(() => credentials.verify(gccId)))).status).toBe(409);
    expect(await attempt(() => credentials.restore(gccId))).toEqual({ gccId, deleted: false });
    expect((await refusal(attempt(() => credentials.restore(gccId)))).body).toContain(
      'GST_NOT_DELETED',
    );
  });

  it('deleting a service takes its endpoints and their field maps with it', async () => {
    const out = await attempt(() => parts.deleteService(gpsId));
    expect(out).toEqual({ gpsId, deleted: true, endpointsDeleted: 1 });
    const [left] = await tx.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM public.gst_provider_field_map
       WHERE gfm_gpe_id = ${gpeId}::uuid AND gfm_is_deleted = false`;
    expect(left.n).toBe(0);
    expect((await providers.getById(gpvId)).endpointCount).toBe(0);
  });
});
