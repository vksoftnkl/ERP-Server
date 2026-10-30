import { HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  constants,
  createCipheriv,
  generateKeyPairSync,
  privateDecrypt,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GST_CODES } from '../config/gst-config.constants';
import { GstCryptoService } from '../config/gst-crypto.service';
import { GstAuthService, VERIFY_AUTH_BUDGET } from './gst-auth.service';
import { GstHttpClient, GstHttpError, type GstHttpRequest } from './gst-http.client';

const ENV_KEYS = [
  'GST_CRED_KEY',
  'GST_CRED_KEY_VERSION',
  'GST_CRED_KEY_V1',
  'GST_PUBLIC_KEY_DIR',
] as const;
const KEY_HEX = randomBytes(32).toString('hex');

const GCC_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e104';
const GPS_ID = '019c6f6c-be87-7a11-8905-36092c46e105';
const GPE_ID = '019c6f6c-be87-7a11-8905-36092c46e106';
const GPA_ID = '019c6f6c-be87-7a11-8905-36092c46e107';
const GAS_ID = '019c6f6c-be87-7a11-8905-36092c46e108';
const ACTOR = '019c6f6c-be87-7a11-8905-36092c46e109';
const COMPANY_GSTIN = '33AAACZ1234A1Z5';
const BRANCH_GSTIN = '33AAACZ1234A2Z4';
const BASE_URL = 'https://gsp.example.test';
const AUTH_PATH = '/eivital/v1.04/auth';
const PUBLIC_KEY_REF = 'nic-sandbox';
/** 11:30 IST on 21 Oct 2026 — inside the 2026-2027 year. */
const NOW = new Date('2026-10-21T06:00:00.000Z');
/** NIC's TokenExpiry is IST with no zone. */
const TOKEN_EXPIRY = '2099-01-01 10:00:00';
const TOKEN_EXPIRY_UTC = '2099-01-01T04:30:00.000Z';
const TOKEN_TTL_MINUTES = 360;
const WHO = `Signed in to CHARTERED EINVOICE SANDBOX as zeta_api for GSTIN ${COMPANY_GSTIN}`;

const crypto = new GstCryptoService();
/** Encrypted the way the screens store a secret (needs GST_CRED_KEY, set in beforeEach). */
const enc = (plain: string) => crypto.encrypt(plain);

// ── rows ────────────────────────────────────────────────────────────────────
// Only the columns GstAuthService and the route guard read.

const providerRow = (overrides: Record<string, unknown> = {}) => ({
  gpvId: GPV_ID,
  gpvCode: 'CHARTERED',
  gpvTimeoutMs: 30_000,
  gpvIsActive: true,
  gpvIsDeleted: false,
  ...overrides,
});

const credentialRow = (overrides: Record<string, unknown> = {}) => ({
  gccId: GCC_ID,
  gccCompanyId: COMPANY_ID,
  gccBranchId: null,
  gccGpvId: GPV_ID,
  gccService: 'EINVOICE',
  gccEnvironment: 'SANDBOX',
  gccLoginId: 'zeta_api',
  gccPasswordEnc: enc('s3cret'),
  gccClientIdEnc: null,
  gccClientSecretEnc: null,
  gccAppKeyEnc: null,
  gccPublicKeyRef: null,
  gccIsActive: true,
  gccIsDeleted: false,
  provider: providerRow(),
  company: { compGstinNo: COMPANY_GSTIN, compName: 'Zeta Traders' },
  branch: null,
  ...overrides,
});

const fieldMap = (
  ourField: string,
  theirPath: string,
  overrides: Record<string, unknown> = {},
) => ({
  gfmId: `gfm-${ourField}`,
  gfmGpeId: GPE_ID,
  gfmDirection: 'RESPONSE',
  gfmOurField: ourField,
  gfmTheirPath: theirPath,
  gfmDataType: 'STRING',
  gfmTransform: 'NONE',
  gfmIsRequired: false,
  gfmDefaultValue: null,
  gfmSortOrder: 0,
  gfmIsDeleted: false,
  ...overrides,
});

const DEFAULT_FIELD_MAPS = [
  fieldMap('auth_token', '$.Data.AuthToken', { gfmIsRequired: true }),
  fieldMap('session_key', '$.Data.Sek'),
  fieldMap('expires_on', '$.Data.TokenExpiry', { gfmTransform: 'DATETIME_NIC' }),
];

const endpointRow = (overrides: Record<string, unknown> = {}) => ({
  gpeId: GPE_ID,
  gpeGpsId: GPS_ID,
  gpeAction: 'AUTH',
  gpeHttpMethod: 'POST',
  gpePathTemplate: AUTH_PATH,
  gpeQueryTemplate: null,
  gpeContentType: 'application/json',
  gpeHeaders: {
    gstin: '{gstin}',
    user_name: '{loginId}',
    client_id: '{clientId}',
    client_secret: '{clientSecret}',
  },
  gpeRequestWrapper: null,
  gpeRedactPaths: null,
  gpeResponseRootPath: null,
  gpeSuccessPath: '$.Status',
  gpeSuccessValue: '1',
  gpeErrorCodePath: '$.ErrorDetails[0].ErrorCode',
  gpeErrorMessagePath: '$.ErrorDetails[0].ErrorMessage',
  gpeTimeoutMs: null,
  gpeIsActive: true,
  gpeIsDeleted: false,
  fieldMaps: DEFAULT_FIELD_MAPS,
  ...overrides,
});

const serviceRow = (overrides: Record<string, unknown> = {}) => ({
  gpsId: GPS_ID,
  gpsGpvId: GPV_ID,
  gpsService: 'EINVOICE',
  gpsEnvironment: 'SANDBOX',
  gpsBaseUrl: BASE_URL,
  gpsAuthScheme: 'API_KEY',
  gpsTokenTtlMinutes: TOKEN_TTL_MINUTES,
  gpsPayloadEncryption: 'NONE',
  gpsTimeoutMs: null,
  gpsIsActive: true,
  gpsIsDeleted: false,
  endpoints: [endpointRow()],
  ...overrides,
});

const accountRow = (overrides: Record<string, unknown> = {}) => ({
  gpaId: GPA_ID,
  gpaGpvId: GPV_ID,
  gpaEnvironment: 'SANDBOX',
  gpaService: null,
  gpaClientIdEnc: enc('asp-id'),
  gpaClientSecretEnc: enc('asp-secret'),
  gpaApiKeyEnc: null,
  gpaCreditBalance: new Prisma.Decimal('125.50'),
  gpaIsActive: true,
  gpaIsDeleted: false,
  ...overrides,
});

// ── replies ─────────────────────────────────────────────────────────────────

const reply = (status: number, body: unknown) => ({
  status,
  text: typeof body === 'string' ? body : JSON.stringify(body),
});
const nicSuccess = (data: Record<string, unknown> = {}) =>
  reply(200, { Status: 1, Data: { AuthToken: 'tok-123', TokenExpiry: TOKEN_EXPIRY, ...data } });
const nicFailure = (code: string, message: string, status = 200) =>
  reply(status, { Status: 0, ErrorDetails: [{ ErrorCode: code, ErrorMessage: message }] });

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

type PrismaMock = {
  gstCompanyCredential: { findUnique: jest.Mock; update: jest.Mock };
  gstProviderService: { findMany: jest.Mock };
  gstProviderAccount: { findFirst: jest.Mock };
  gstProviderErrorMap: { findFirst: jest.Mock };
  gstAuthSession: { updateMany: jest.Mock; create: jest.Mock };
  gstApiLog: { create: jest.Mock };
  $executeRaw: jest.Mock;
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

describe('GstAuthService', () => {
  const saved: Record<string, string | undefined> = {};
  let keyDir: string;
  let privateKey: KeyObject;
  let prisma: PrismaMock;
  let http: { send: jest.Mock };
  let budget: { n: number; oldest: Date | null };
  let leased: Array<{ gas_id: string; gas_token_version: number }>;
  let service: GstAuthService;

  beforeAll(() => {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = pair.privateKey;
    keyDir = mkdtempSync(path.join(tmpdir(), 'gst-auth-spec-'));
    writeFileSync(
      path.join(keyDir, `${PUBLIC_KEY_REF}.pem`),
      pair.publicKey.export({ type: 'spki', format: 'pem' }),
    );
  });
  afterAll(() => rmSync(keyDir, { recursive: true, force: true }));

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.GST_CRED_KEY = KEY_HEX;
    process.env.GST_PUBLIC_KEY_DIR = keyDir;
    // Only the clock is frozen; promises, I/O and crypto run for real.
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });

    budget = { n: 0, oldest: null };
    leased = [{ gas_id: GAS_ID, gas_token_version: 4 }];
    prisma = {
      gstCompanyCredential: {
        findUnique: jest.fn().mockResolvedValue(credentialRow()),
        update: jest.fn().mockResolvedValue({}),
      },
      gstProviderService: { findMany: jest.fn().mockResolvedValue([serviceRow()]) },
      gstProviderAccount: { findFirst: jest.fn().mockResolvedValue(accountRow()) },
      gstProviderErrorMap: { findFirst: jest.fn().mockResolvedValue(null) },
      gstAuthSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      gstApiLog: { create: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      // The budget count reads gst_api_log; the lease is an UPDATE … RETURNING.
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) =>
        strings.join('?').includes('gst_api_log') ? [budget] : leased,
      ),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    http = { send: jest.fn().mockResolvedValue(nicSuccess()) };
    service = new GstAuthService(
      prisma as unknown as PrismaService,
      crypto,
      http as unknown as GstHttpClient,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const signIn = () => service.signIn(GCC_ID, ACTOR);
  const sent = () => http.send.mock.calls[0][0] as GstHttpRequest;
  const sentBody = () => JSON.parse(sent().body ?? 'null') as Record<string, unknown>;
  const logRow = () =>
    (prisma.gstApiLog.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const storedSession = () =>
    (prisma.gstAuthSession.create.mock.calls[0][0] as { data: Record<string, string> }).data;
  const credentialStamp = () =>
    prisma.gstCompanyCredential.update.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
  /** The holder uuid the lease UPDATE was run with. */
  const leaseHolder = () =>
    prisma.$queryRaw.mock.calls.find(([strings]: [TemplateStringsArray]) =>
      strings.join('?').includes('gas_lock_by'),
    )![1] as string;
  const releaseCall = () => ({
    where: { gasId: GAS_ID, gasLockBy: leaseHolder() },
    data: { gasLockBy: null, gasLockOn: null, gasLockUpto: null },
  });
  /** Whether the lease was handed back (an updateMany without the gasIsActive guard). */
  const leaseReleased = () =>
    prisma.gstAuthSession.updateMany.mock.calls.some(
      ([args]: [{ where: Record<string, unknown> }]) => !('gasIsActive' in args.where),
    );
  const nothingSpent = () => {
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(http.send).not.toHaveBeenCalled();
    expect(prisma.gstApiLog.create).not.toHaveBeenCalled();
  };

  // ── resolving the rows ──────────────────────────────────────────────────
  describe('resolving the rows', () => {
    it('reads the credential with its provider, company and branch GSTINs', async () => {
      await signIn();

      expect(prisma.gstCompanyCredential.findUnique).toHaveBeenCalledWith({
        where: { gccId: GCC_ID },
        include: {
          provider: true,
          company: { select: { compGstinNo: true, compName: true } },
          branch: { select: { brGstinNo: true } },
        },
      });
    });

    it('answers 404 for a credential that does not exist', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(signIn());

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gccId', code: GST_CODES.NOT_FOUND }] },
      });
      nothingSpent();
    });

    it.each([
      ['the credential', { gccIsDeleted: true }, 'The credential is deleted. Restore it first.'],
      [
        'its provider',
        { provider: providerRow({ gpvIsDeleted: true }) },
        'Provider CHARTERED is deleted. Restore it first.',
      ],
    ])('refuses to verify when %s is deleted', async (_label, overrides, message) => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(credentialRow(overrides));

      const refusal = await refusalOf(signIn());

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gccId', message, code: GST_CODES.ALREADY_DELETED }] },
      });
      expect(prisma.gstProviderService.findMany).not.toHaveBeenCalled();
      nothingSpent();
    });

    it("looks for the AUTH endpoint under the credential's provider, environment and service", async () => {
      await signIn();

      expect(prisma.gstProviderService.findMany).toHaveBeenCalledWith({
        where: {
          gpsGpvId: GPV_ID,
          gpsEnvironment: 'SANDBOX',
          gpsIsDeleted: false,
          gpsService: 'EINVOICE',
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
    });

    it('looks under every service when the credential is for all of them', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(credentialRow({ gccService: null }));

      await signIn();

      const [{ where }] = prisma.gstProviderService.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(where).not.toHaveProperty('gpsService');
    });

    it.each([
      [
        'the first service in GST_SERVICES order when both are on',
        [
          serviceRow({ gpsService: 'EWAYBILL', gpsBaseUrl: 'https://ewb.example.test' }),
          serviceRow({ gpsService: 'EINVOICE', gpsBaseUrl: 'https://einv.example.test' }),
        ],
        'https://einv.example.test',
      ],
      [
        'an active service over an earlier inactive one',
        [
          serviceRow({ gpsService: 'EWAYBILL', gpsBaseUrl: 'https://ewb.example.test' }),
          serviceRow({
            gpsService: 'EINVOICE',
            gpsBaseUrl: 'https://einv.example.test',
            gpsIsActive: false,
          }),
        ],
        'https://ewb.example.test',
      ],
      [
        'a service that has an AUTH endpoint',
        [
          serviceRow({ gpsService: 'EINVOICE', endpoints: [] }),
          serviceRow({ gpsService: 'EWAYBILL', gpsBaseUrl: 'https://ewb.example.test' }),
        ],
        'https://ewb.example.test',
      ],
    ])('signs in through %s', async (_label, services, baseUrl) => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(credentialRow({ gccService: null }));
      prisma.gstProviderService.findMany.mockResolvedValue(services);

      await signIn();

      expect(sent().url).toBe(`${baseUrl}${AUTH_PATH}`);
    });

    it('signs in through the active AUTH endpoint when the service has an inactive one too', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [
            endpointRow({ gpeId: 'gpe-old', gpePathTemplate: '/old/auth', gpeIsActive: false }),
            endpointRow(),
          ],
        }),
      ]);

      await signIn();

      expect(sent().url).toBe(`${BASE_URL}${AUTH_PATH}`);
    });

    it('refuses with 422 when no service of the credential has an AUTH endpoint', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([serviceRow({ endpoints: [] })]);

      const refusal = await refusalOf(signIn());

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'The credential cannot sign in yet',
          errors: [
            {
              field: 'gccGpvId',
              message:
                'CHARTERED has no EINVOICE SANDBOX service with an AUTH endpoint. Add one under GST Providers.',
              code: GST_CODES.NO_AUTH_ENDPOINT,
            },
          ],
        },
      });
      nothingSpent();
    });

    it('says the provider is switched off before saying nothing is set up', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ provider: providerRow({ gpvIsActive: false }) }),
      );
      prisma.gstProviderService.findMany.mockResolvedValue([]);

      const refusal = await refusalOf(signIn());

      expect(refusal).toMatchObject({
        status: 503,
        body: {
          errors: [
            {
              field: 'gccId',
              message: 'GST provider CHARTERED is inactive',
              code: GST_CODES.SWITCHED_OFF,
            },
          ],
        },
      });
    });

    it('prefers an active provider account and resolves it for the chosen service', async () => {
      await signIn();

      expect(prisma.gstProviderAccount.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.gstProviderAccount.findFirst).toHaveBeenCalledWith({
        where: {
          gpaGpvId: GPV_ID,
          gpaEnvironment: 'SANDBOX',
          gpaIsDeleted: false,
          gpaIsActive: true,
          OR: [{ gpaService: 'EINVOICE' }, { gpaService: null }],
        },
        orderBy: [{ gpaService: { sort: 'asc', nulls: 'last' } }, { gpaIsActive: 'desc' }],
      });
    });

    // Notes 88: nothing is tried while a row on the route is off — refused
    // before the GSTIN check, the budget, the lease and the log.
    it.each([
      [
        'the provider is inactive',
        () =>
          prisma.gstCompanyCredential.findUnique.mockResolvedValue(
            credentialRow({ provider: providerRow({ gpvIsActive: false }) }),
          ),
        'GST provider CHARTERED is inactive',
      ],
      [
        'the service is inactive',
        () =>
          prisma.gstProviderService.findMany.mockResolvedValue([
            serviceRow({ gpsIsActive: false }),
          ]),
        'EINVOICE · SANDBOX service is inactive',
      ],
      [
        'its only AUTH endpoint is inactive',
        () =>
          prisma.gstProviderService.findMany.mockResolvedValue([
            serviceRow({ endpoints: [endpointRow({ gpeIsActive: false })] }),
          ]),
        'AUTH endpoint of EINVOICE · SANDBOX is inactive',
      ],
      [
        'the only provider account is inactive',
        () =>
          prisma.gstProviderAccount.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(accountRow({ gpaIsActive: false })),
        'CHARTERED SANDBOX provider account is inactive',
      ],
      [
        'there is no provider account and the credential has no client pair',
        () => prisma.gstProviderAccount.findFirst.mockResolvedValue(null),
        'CHARTERED has no SANDBOX provider account',
      ],
      [
        'the credential is inactive',
        () =>
          prisma.gstCompanyCredential.findUnique.mockResolvedValue(
            credentialRow({ gccIsActive: false }),
          ),
        'The GST credential is inactive',
      ],
    ])('refuses with 503 and spends nothing when %s', async (_label, arrange, message) => {
      arrange();

      const refusal = await refusalOf(signIn());

      expect(refusal).toEqual({
        status: 503,
        body: {
          success: false,
          message: 'GST service is switched off',
          errors: [{ field: 'gccId', message, code: GST_CODES.SWITCHED_OFF }],
        },
      });
      nothingSpent();
    });

    it('looks for an inactive account only to name it in the refusal', async () => {
      prisma.gstProviderAccount.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(accountRow({ gpaIsActive: false }));

      await refusalOf(signIn());

      const [{ where }] = prisma.gstProviderAccount.findFirst.mock.calls[1] as [
        { where: Record<string, unknown> },
      ];
      expect(where).not.toHaveProperty('gpaIsActive');
    });

    it('signs in as the branch GSTIN, trimmed, when the credential names a branch', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ gccBranchId: BRANCH_ID, branch: { brGstinNo: `  ${BRANCH_GSTIN} ` } }),
      );

      await signIn();

      expect(sent().headers.gstin).toBe(BRANCH_GSTIN);
    });

    it("falls back to the company's GSTIN when the branch has none", async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ gccBranchId: BRANCH_ID, branch: { brGstinNo: '  ' } }),
      );

      await signIn();

      expect(sent().headers.gstin).toBe(COMPANY_GSTIN);
    });

    it('refuses with 422 when neither the branch nor the company has a GSTIN', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({
          company: { compGstinNo: null, compName: 'Zeta Traders' },
          branch: { brGstinNo: null },
        }),
      );

      const refusal = await refusalOf(signIn());

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'gccCompanyId',
              message: 'Zeta Traders has no GSTIN to sign in as',
              code: GST_CODES.NO_GSTIN,
            },
          ],
        },
      });
      nothingSpent();
    });
  });

  // ── building the request ────────────────────────────────────────────────
  describe('building the request', () => {
    it('fills the AUTH row with the credential and the account, and sends it on its route', async () => {
      await signIn();

      expect(sent()).toEqual({
        method: 'POST',
        url: `${BASE_URL}${AUTH_PATH}`,
        headers: {
          Accept: 'application/json',
          gstin: COMPANY_GSTIN,
          user_name: 'zeta_api',
          client_id: 'asp-id',
          client_secret: 'asp-secret',
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
        timeoutMs: 30_000,
        route: expect.objectContaining({
          provider: expect.objectContaining({ gpvCode: 'CHARTERED' }),
          service: expect.objectContaining({ gpsId: GPS_ID }),
          action: 'AUTH',
          endpoint: expect.objectContaining({ gpeId: GPE_ID }),
          account: expect.objectContaining({ gpaId: GPA_ID }),
          credential: expect.objectContaining({ gccId: GCC_ID }),
        }),
      });
      expect(sentBody()).toEqual({
        UserName: 'zeta_api',
        Password: 's3cret',
        AppKey: expect.any(String),
        ForceRefreshAccessToken: true,
      });
    });

    it('mints a fresh 32-byte AppKey for each sign-in when the credential stores none', async () => {
      await signIn();
      await signIn();

      const [first, second] = http.send.mock.calls.map(
        ([request]: [GstHttpRequest]) => (JSON.parse(request.body!) as { AppKey: string }).AppKey,
      );
      expect(Buffer.from(first, 'base64')).toHaveLength(32);
      expect(first).not.toBe(second);
    });

    it('sends the AppKey the credential stores', async () => {
      const appKey = randomBytes(32).toString('base64');
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ gccAppKeyEnc: enc(appKey) }),
      );

      await signIn();

      expect(sentBody().AppKey).toBe(appKey);
    });

    it('refuses with 422 a stored AppKey that is not 32 bytes', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ gccAppKeyEnc: enc('too-short') }),
      );

      const refusal = await refusalOf(signIn());

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'appKey', code: GST_CODES.CREDENTIAL_INCOMPLETE }] },
      });
      nothingSpent();
    });

    it("uses the credential's own client pair over the provider account's", async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ gccClientIdEnc: enc('own-id'), gccClientSecretEnc: enc('own-secret') }),
      );

      await signIn();

      expect(sent().headers).toMatchObject({ client_id: 'own-id', client_secret: 'own-secret' });
    });

    it('URL-encodes path and query values, and logs every secret placeholder as ***', async () => {
      prisma.gstProviderAccount.findFirst.mockResolvedValue(
        accountRow({ gpaClientSecretEnc: enc('p@ss word') }),
      );
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [
            endpointRow({
              gpePathTemplate: '/auth/{gstin}',
              gpeQueryTemplate: 'aspid={aspId}&password={aspPassword}&user={loginId}',
            }),
          ],
        }),
      ]);

      await signIn();

      expect(sent().url).toBe(
        `${BASE_URL}/auth/${COMPANY_GSTIN}?aspid=asp-id&password=p%40ss%20word&user=zeta_api`,
      );
      expect(logRow().galRequestUrl).toBe(
        `${BASE_URL}/auth/${COMPANY_GSTIN}?aspid=***&password=***&user=zeta_api`,
      );
      expect(logRow().galRequestHeaders).toEqual({
        Accept: 'application/json',
        gstin: COMPANY_GSTIN,
        user_name: 'zeta_api',
        client_id: '***',
        client_secret: '***',
        'Content-Type': 'application/json',
      });
    });

    it.each(['?a=1', '&a=1'])(
      'keeps a query template that already opens with %s',
      async (query) => {
        prisma.gstProviderService.findMany.mockResolvedValue([
          serviceRow({ endpoints: [endpointRow({ gpeQueryTemplate: query })] }),
        ]);

        await signIn();

        expect(sent().url).toBe(`${BASE_URL}${AUTH_PATH}${query}`);
      },
    );

    it('wraps the body, and logs it with the password, the AppKey and the redact paths as ***', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [
            endpointRow({ gpeRequestWrapper: 'data', gpeRedactPaths: ['$.data.UserName', 7] }),
          ],
        }),
      ]);

      await signIn();

      expect(sentBody()).toEqual({
        data: {
          UserName: 'zeta_api',
          Password: 's3cret',
          AppKey: expect.any(String),
          ForceRefreshAccessToken: true,
        },
      });
      expect(logRow().galRequestPayload).toEqual({
        data: { UserName: '***', Password: '***', AppKey: '***', ForceRefreshAccessToken: true },
      });
    });

    it('keeps a Content-Type the header template already sets, in any case', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [endpointRow({ gpeHeaders: { 'content-type': 'text/plain' } })],
        }),
      ]);

      await signIn();

      expect(sent().headers).toEqual({ Accept: 'application/json', 'content-type': 'text/plain' });
    });

    it('sends a GET with no body and no Content-Type, and spells out a non-text header', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [endpointRow({ gpeHttpMethod: 'GET', gpeHeaders: { 'x-api-version': 104 } })],
        }),
      ]);

      await signIn();

      expect(sent()).toMatchObject({
        method: 'GET',
        body: undefined,
        headers: { Accept: 'application/json', 'x-api-version': '104' },
      });
      expect(logRow().galRequestPayload).toBe(Prisma.DbNull);
    });

    it('refuses with 422 naming every value the AUTH row needs and nothing holds', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ gccPasswordEnc: '' }),
      );
      prisma.gstProviderAccount.findFirst.mockResolvedValue(
        accountRow({ gpaClientIdEnc: null, gpaClientSecretEnc: null, gpaApiKeyEnc: null }),
      );
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [
            endpointRow({
              gpeHeaders: {
                a: '{password}',
                b: '{clientId}',
                c: '{clientSecret}',
                d: '{aspId}',
                e: '{aspPassword}',
                f: '{apiKey}',
                g: '{authToken}',
                h: '{shoeSize}',
              },
            }),
          ],
        }),
      ]);

      const refusal = await refusalOf(signIn());

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'The credential cannot sign in yet',
          errors: [
            ['password', 'The credential has no password'],
            [
              'clientId',
              "{clientId} — set clientId on the credential, or on CHARTERED's SANDBOX provider account",
            ],
            [
              'clientSecret',
              "{clientSecret} — set clientSecret on the credential, or on CHARTERED's SANDBOX provider account",
            ],
            ['aspId', "{aspId} — set clientId (the aspid) on CHARTERED's SANDBOX provider account"],
            [
              'aspPassword',
              "{aspPassword} — set clientSecret (the ASP password) on CHARTERED's SANDBOX provider account",
            ],
            ['apiKey', "{apiKey} — set apiKey on CHARTERED's SANDBOX provider account"],
            [
              'authToken',
              'An AUTH call cannot send {authToken}: remove it from the AUTH endpoint’s headers',
            ],
            ['shoeSize', 'The AUTH endpoint uses {shoeSize}, which this server does not know'],
          ].map(([field, message]) => ({
            field,
            message,
            code: GST_CODES.CREDENTIAL_INCOMPLETE,
          })),
        },
      });
      nothingSpent();
    });

    // ── NIC's own scheme ────────────────────────────────────────────────
    describe("NIC's own scheme (NIC_SEK)", () => {
      const nicService = (overrides: Record<string, unknown> = {}) =>
        serviceRow({ gpsAuthScheme: 'NIC_SEK', gpsPayloadEncryption: 'AES_SEK', ...overrides });

      it('RSA-wraps the base64 JSON body with the public key gccPublicKeyRef names', async () => {
        const appKey = randomBytes(32).toString('base64');
        prisma.gstCompanyCredential.findUnique.mockResolvedValue(
          credentialRow({ gccPublicKeyRef: PUBLIC_KEY_REF, gccAppKeyEnc: enc(appKey) }),
        );
        prisma.gstProviderService.findMany.mockResolvedValue([nicService()]);

        await signIn();

        const { Data } = sentBody() as { Data: string };
        const opened = privateDecrypt(
          { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
          Buffer.from(Data, 'base64'),
        ).toString('utf8');
        expect(JSON.parse(Buffer.from(opened, 'base64').toString('utf8'))).toEqual({
          UserName: 'zeta_api',
          Password: 's3cret',
          AppKey: appKey,
          ForceRefreshAccessToken: true,
        });
        expect(logRow().galRequestPayload).toEqual({ Data: '***' });
      });

      it('sends the plain body when the service leaves encryption to the GSP', async () => {
        prisma.gstProviderService.findMany.mockResolvedValue([
          nicService({ gpsPayloadEncryption: 'NONE' }),
        ]);

        await signIn();

        expect(sentBody()).toMatchObject({ UserName: 'zeta_api', Password: 's3cret' });
      });

      it('refuses with 422 when the credential names no public key', async () => {
        prisma.gstProviderService.findMany.mockResolvedValue([nicService()]);

        const refusal = await refusalOf(signIn());

        expect(refusal).toMatchObject({
          status: 422,
          body: {
            errors: [
              {
                field: 'gccPublicKeyRef',
                message:
                  'This service encrypts the sign-in with the IRP public key: set gccPublicKeyRef',
                code: GST_CODES.PUBLIC_KEY_MISSING,
              },
            ],
          },
        });
        nothingSpent();
      });

      it('refuses with 422, naming where the file belongs, when the key is not on this server', async () => {
        prisma.gstCompanyCredential.findUnique.mockResolvedValue(
          credentialRow({ gccPublicKeyRef: 'nic-production' }),
        );
        prisma.gstProviderService.findMany.mockResolvedValue([nicService()]);

        const refusal = await refusalOf(signIn());

        expect(refusal).toMatchObject({
          status: 422,
          body: {
            errors: [
              {
                field: 'gccPublicKeyRef',
                message: `No public key "nic-production" on this server: put it at ${keyDir}/nic-production.pem`,
                code: GST_CODES.PUBLIC_KEY_MISSING,
              },
            ],
          },
        });
        nothingSpent();
      });
    });
  });

  // ── budget and lease ────────────────────────────────────────────────────
  describe('the sign-in budget and the lease', () => {
    it(`refuses with 409 once the GSTIN has spent ${VERIFY_AUTH_BUDGET} sign-ins in 15 minutes`, async () => {
      budget = { n: VERIFY_AUTH_BUDGET, oldest: new Date('2026-10-21T05:50:00.000Z') };

      const refusal = await refusalOf(signIn());

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Too many sign-ins for this GSTIN',
          errors: [
            {
              field: 'gccId',
              message:
                '4 sign-ins in the last 15 minutes; NIC blocks the GSTIN at 5. ' +
                'Try again after 2026-10-21T06:05:00.000Z.',
              code: GST_CODES.AUTH_RATE_LIMIT,
            },
          ],
        },
      });
      // Counted per company + branch, over the window.
      expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([COMPANY_ID, null, 15]);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(http.send).not.toHaveBeenCalled();
    });

    it('still refuses at the budget when the oldest sign-in time is unknown', async () => {
      budget = { n: 5, oldest: null };

      const refusal = await refusalOf(signIn());

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ message: expect.stringContaining('Try again after in a few minutes.') }],
        },
      });
    });

    it('signs in while the GSTIN is under its budget', async () => {
      budget = { n: VERIFY_AUTH_BUDGET - 1, oldest: new Date('2026-10-21T05:50:00.000Z') };

      await expect(signIn()).resolves.toMatchObject({ ok: true });
    });

    it('refuses with 409 while another sign-in holds the lease, before calling the portal', async () => {
      leased = [];

      const refusal = await refusalOf(signIn());

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'A sign-in is already running',
          errors: [{ field: 'gccId', code: GST_CODES.AUTH_BUSY }],
        },
      });
      expect(http.send).not.toHaveBeenCalled();
      expect(prisma.gstApiLog.create).not.toHaveBeenCalled();
    });

    it('seeds the session row it leases under the current key version and the actor', async () => {
      process.env.GST_CRED_KEY_VERSION = '3';
      process.env.GST_CRED_KEY_V1 = KEY_HEX;

      await signIn();

      expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual([GCC_ID, 3, ACTOR]);
    });

    it.each([
      ['the provider timeout', { gpv: 30_000, gps: null, gpe: null }, 30_000, 90],
      [
        'the service timeout over the provider',
        { gpv: 30_000, gps: 120_000, gpe: null },
        120_000,
        150,
      ],
      ['the endpoint timeout over both', { gpv: 30_000, gps: 120_000, gpe: 100_000 }, 100_000, 130],
    ])(
      'waits %s, and leases for that plus 30 s (at least 90 s)',
      async (_label, timeouts, timeoutMs, leaseSeconds) => {
        prisma.gstCompanyCredential.findUnique.mockResolvedValue(
          credentialRow({ provider: providerRow({ gpvTimeoutMs: timeouts.gpv }) }),
        );
        prisma.gstProviderService.findMany.mockResolvedValue([
          serviceRow({
            gpsTimeoutMs: timeouts.gps,
            endpoints: [endpointRow({ gpeTimeoutMs: timeouts.gpe })],
          }),
        ]);

        await signIn();

        expect(sent().timeoutMs).toBe(timeoutMs);
        const leaseCall = prisma.$queryRaw.mock.calls[1] as unknown[];
        expect(leaseCall.slice(1)).toEqual([expect.any(String), leaseSeconds, GCC_ID]);
      },
    );
  });

  // ── a sign-in that worked ───────────────────────────────────────────────
  describe('a sign-in the portal accepts', () => {
    it('keeps the session encrypted, retires the leased row and stamps the credential', async () => {
      const outcome = await signIn();

      expect(outcome).toEqual({
        ok: true,
        message: WHO,
        tokenValidUntil: TOKEN_EXPIRY_UTC,
        creditBalance: 125.5,
      });
      expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledWith({
        where: { gasId: GAS_ID, gasLockBy: leaseHolder(), gasIsActive: true },
        data: { gasIsActive: false, gasLockBy: null, gasLockOn: null, gasLockUpto: null },
      });
      expect(storedSession()).toEqual({
        gasGccId: GCC_ID,
        gasAuthTokenEnc: expect.stringMatching(/^gcm:v1:/),
        gasSessionKeyEnc: null,
        gasRefreshTokenEnc: null,
        gasKeyVersion: 1,
        gasTokenType: 'AuthToken',
        gasIssuedOn: NOW,
        gasExpiresOn: new Date(TOKEN_EXPIRY_UTC),
        gasExpiryRaw: TOKEN_EXPIRY,
        gasTokenVersion: 5,
        gasCreatedBy: ACTOR,
      });
      expect(crypto.decrypt(storedSession().gasAuthTokenEnc)).toBe('tok-123');
      expect(credentialStamp()).toEqual({
        where: { gccId: GCC_ID },
        data: { gccLastVerifiedOn: NOW, gccLastErrorMessage: null },
      });
    });

    it('writes one redacted log row for the attempt', async () => {
      http.send.mockImplementation(async () => {
        jest.setSystemTime(NOW.getTime() + 1234);
        return nicSuccess({ Sek: 'plain-session-key' });
      });

      await signIn();

      expect(prisma.gstApiLog.create).toHaveBeenCalledTimes(1);
      expect(logRow()).toEqual({
        galCompanyId: COMPANY_ID,
        galBranchId: null,
        galAccYear: '2026-2027',
        galGccId: GCC_ID,
        galGpvId: GPV_ID,
        galService: 'EINVOICE',
        galAction: 'AUTH',
        galEnvironment: 'SANDBOX',
        galRequestUrl: `${BASE_URL}${AUTH_PATH}`,
        galRequestHeaders: expect.objectContaining({ client_id: '***', client_secret: '***' }),
        galRequestPayload: {
          UserName: 'zeta_api',
          Password: '***',
          AppKey: '***',
          ForceRefreshAccessToken: true,
        },
        galHttpStatus: 200,
        galResponsePayload: {
          Status: 1,
          Data: { AuthToken: '***', Sek: '***', TokenExpiry: TOKEN_EXPIRY },
        },
        galProviderCode: null,
        galOurCode: null,
        galIsSuccess: true,
        galMessage: WHO,
        galStartedOn: NOW,
        galFinishedOn: new Date(NOW.getTime() + 1234),
        galDurationMs: 1234,
        galCreatedBy: ACTOR,
      });
    });

    it('keeps the session key as sent when the service does not use a Sek', async () => {
      http.send.mockResolvedValue(nicSuccess({ Sek: 'plain-session-key' }));

      await signIn();

      expect(crypto.decrypt(storedSession().gasSessionKeyEnc)).toBe('plain-session-key');
    });

    it('opens an AES Sek with the AppKey it sent and keeps the session key it holds', async () => {
      const appKey = randomBytes(32);
      const sessionKey = randomBytes(32);
      const cipher = createCipheriv('aes-256-ecb', appKey, null);
      const sek = Buffer.concat([cipher.update(sessionKey), cipher.final()]).toString('base64');
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({
          gccPublicKeyRef: PUBLIC_KEY_REF,
          gccAppKeyEnc: enc(appKey.toString('base64')),
        }),
      );
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({ gpsAuthScheme: 'NIC_SEK', gpsPayloadEncryption: 'AES_SEK' }),
      ]);
      http.send.mockResolvedValue(nicSuccess({ Sek: sek }));

      await signIn();

      expect(crypto.decrypt(storedSession().gasSessionKeyEnc)).toBe(sessionKey.toString('base64'));
    });

    it('keeps the refresh token the field map points at, and logs it as ***', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [
            endpointRow({
              fieldMaps: [...DEFAULT_FIELD_MAPS, fieldMap('refresh_token', '$.Data.Refresh')],
            }),
          ],
        }),
      ]);
      http.send.mockResolvedValue(nicSuccess({ Refresh: 'refresh-456' }));

      await signIn();

      expect(crypto.decrypt(storedSession().gasRefreshTokenEnc)).toBe('refresh-456');
      expect(logRow().galResponsePayload).toMatchObject({ Data: { Refresh: '***' } });
    });

    it('reads the reply under the response root path and redacts the token there', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [
            endpointRow({
              gpeResponseRootPath: '$.Data',
              fieldMaps: [
                fieldMap('auth_token', '$.AuthToken', { gfmIsRequired: true }),
                fieldMap('expires_on', '$.TokenExpiry', { gfmTransform: 'DATETIME_NIC' }),
              ],
            }),
          ],
        }),
      ]);

      const outcome = await signIn();

      expect(outcome.tokenValidUntil).toBe(TOKEN_EXPIRY_UTC);
      expect(crypto.decrypt(storedSession().gasAuthTokenEnc)).toBe('tok-123');
      expect(logRow().galResponsePayload).toMatchObject({ Data: { AuthToken: '***' } });
    });

    it.each([
      ['an expiry already past', { TokenExpiry: '2020-01-01 10:00:00' }],
      ['an expiry it cannot read', { TokenExpiry: 'soon' }],
      ['no expiry', { TokenExpiry: null }],
    ])("falls back to the service's token lifetime on %s", async (_label, data) => {
      http.send.mockResolvedValue(nicSuccess(data));

      const outcome = await signIn();

      const ttlEnd = new Date(NOW.getTime() + TOKEN_TTL_MINUTES * 60_000);
      expect(storedSession().gasExpiresOn).toEqual(ttlEnd);
      expect(outcome.tokenValidUntil).toBe(ttlEnd.toISOString());
    });

    it('takes a field’s default value when the reply leaves it empty', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [
            endpointRow({
              fieldMaps: [
                fieldMap('auth_token', '$.Data.AuthToken', { gfmIsRequired: true }),
                fieldMap('expires_on', '$.Data.TokenExpiry', {
                  gfmTransform: 'DATETIME_NIC',
                  gfmDefaultValue: TOKEN_EXPIRY,
                }),
              ],
            }),
          ],
        }),
      ]);
      http.send.mockResolvedValue(nicSuccess({ TokenExpiry: '' }));

      await expect(signIn()).resolves.toMatchObject({ tokenValidUntil: TOKEN_EXPIRY_UTC });
    });

    it('accepts any 2xx JSON reply when the endpoint names no success path', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({ endpoints: [endpointRow({ gpeSuccessPath: null, gpeSuccessValue: null })] }),
      ]);
      http.send.mockResolvedValue(reply(201, { Data: { AuthToken: 'tok-123' } }));

      await expect(signIn()).resolves.toMatchObject({ ok: true, message: WHO });
    });

    it('reports no credit balance when the sign-in needs no provider account', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ gccClientIdEnc: enc('own-id'), gccClientSecretEnc: enc('own-secret') }),
      );
      prisma.gstProviderAccount.findFirst.mockResolvedValue(null);

      await expect(signIn()).resolves.toMatchObject({ ok: true, creditBalance: null });
    });

    // ── signed in, but no session kept ──────────────────────────────────
    it.each([
      [
        'the AUTH endpoint maps no auth_token',
        [fieldMap('expires_on', '$.Data.TokenExpiry')],
        nicSuccess(),
        'the AUTH endpoint maps no auth_token, so no session was kept',
      ],
      [
        'the reply lacks a required field',
        [
          fieldMap('auth_token', '$.Data.AuthToken', { gfmIsRequired: true }),
          fieldMap('session_key', '$.Data.Sek', { gfmIsRequired: true }),
        ],
        nicSuccess(),
        'the reply lacks session_key ($.Data.Sek); no session was kept',
      ],
      [
        'the reply carries no auth_token',
        [fieldMap('auth_token', '$.Data.AuthToken')],
        nicSuccess({ AuthToken: '  ' }),
        'the reply carries no auth_token; no session was kept',
      ],
    ])(
      'says it signed in but kept no session when %s, and gives the lease back',
      async (_label, fieldMaps, answer, problem) => {
        prisma.gstProviderService.findMany.mockResolvedValue([
          serviceRow({ endpoints: [endpointRow({ fieldMaps })] }),
        ]);
        http.send.mockResolvedValue(answer);

        const outcome = await signIn();

        expect(outcome).toEqual({
          ok: true,
          message: `${WHO}, but ${problem}`,
          creditBalance: 125.5,
        });
        expect(prisma.gstAuthSession.create).not.toHaveBeenCalled();
        expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledWith(releaseCall());
        expect(credentialStamp().data).toEqual({
          gccLastVerifiedOn: NOW,
          gccLastErrorMessage: null,
        });
      },
    );

    it('keeps no session when the Sek does not open with the AppKey sent', async () => {
      prisma.gstCompanyCredential.findUnique.mockResolvedValue(
        credentialRow({ gccPublicKeyRef: PUBLIC_KEY_REF }),
      );
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({ gpsAuthScheme: 'NIC_SEK', gpsPayloadEncryption: 'AES_SEK' }),
      ]);
      // Three bytes: no AES block, so no key opens it.
      http.send.mockResolvedValue(nicSuccess({ Sek: 'AAAA' }));

      const outcome = await signIn();

      expect(outcome).toEqual({
        ok: true,
        message: `${WHO}, but its Sek does not open with the AppKey sent; no session was kept`,
        creditBalance: 125.5,
      });
      expect(prisma.gstAuthSession.create).not.toHaveBeenCalled();
      expect(leaseReleased()).toBe(true);
    });

    it('says so, and claims no token, when another sign-in took the lease meanwhile', async () => {
      prisma.gstAuthSession.updateMany.mockResolvedValueOnce({ count: 0 });

      const outcome = await signIn();

      expect(outcome).toEqual({
        ok: true,
        message: `${WHO}. The session was not kept: another sign-in took over the lease`,
        creditBalance: 125.5,
      });
      expect(prisma.gstAuthSession.create).not.toHaveBeenCalled();
      expect(prisma.gstAuthSession.updateMany).toHaveBeenLastCalledWith(releaseCall());
    });
  });

  // ── a sign-in that failed ───────────────────────────────────────────────
  describe('a sign-in the portal refuses', () => {
    it("words the refusal by the provider's error map and logs both codes", async () => {
      prisma.gstProviderErrorMap.findFirst.mockResolvedValue({
        gemOurCode: 'AUTH_INVALID_CREDENTIALS',
        gemMessage: 'The user name or password is wrong',
      });
      http.send.mockResolvedValue(nicFailure('1005', 'Invalid Token'));

      const outcome = await signIn();

      expect(outcome).toEqual({
        ok: false,
        message: 'The user name or password is wrong',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        creditBalance: 125.5,
      });
      expect(prisma.gstProviderErrorMap.findFirst).toHaveBeenCalledWith({
        where: {
          gemGpvId: GPV_ID,
          gemTheirCode: '1005',
          gemIsDeleted: false,
          OR: [{ gemService: 'EINVOICE' }, { gemService: null }],
        },
        orderBy: { gemService: { sort: 'asc', nulls: 'last' } },
      });
      expect(logRow()).toMatchObject({
        galHttpStatus: 200,
        galProviderCode: '1005',
        galOurCode: 'AUTH_INVALID_CREDENTIALS',
        galIsSuccess: false,
        galMessage: 'The user name or password is wrong',
      });
      expect(credentialStamp()).toEqual({
        where: { gccId: GCC_ID },
        data: { gccLastErrorMessage: 'The user name or password is wrong' },
      });
      expect(prisma.gstAuthSession.create).not.toHaveBeenCalled();
      expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledWith(releaseCall());
    });

    it('passes the portal’s own code and words on when no error map row matches', async () => {
      http.send.mockResolvedValue(nicFailure('1005', 'Invalid Token'));

      await expect(signIn()).resolves.toEqual({
        ok: false,
        message: 'Invalid Token',
        errorCode: '1005',
        creditBalance: 125.5,
      });
      expect(logRow()).toMatchObject({ galProviderCode: '1005', galOurCode: '1005' });
    });

    it.each([
      [401, reply(401, {}), 'The portal refused the sign-in (HTTP 401)', 'AUTH_FAILED'],
      [503, reply(503, {}), 'The portal refused the sign-in (HTTP 503)', 'UPSTREAM_DOWN'],
      [
        200,
        reply(200, '<html>Gateway</html>'),
        'The portal answered with something that is not JSON',
        'AUTH_FAILED',
      ],
      [
        502,
        reply(502, '<html>Bad Gateway</html>'),
        'The portal refused the sign-in (HTTP 502)',
        'UPSTREAM_DOWN',
      ],
    ])(
      'answers an HTTP %i reply that names no error code in plain words',
      async (_status, answer, message, errorCode) => {
        http.send.mockResolvedValue(answer);

        await expect(signIn()).resolves.toEqual({
          ok: false,
          message,
          errorCode,
          creditBalance: 125.5,
        });
        expect(prisma.gstProviderErrorMap.findFirst).not.toHaveBeenCalled();
        expect(logRow()).toMatchObject({ galProviderCode: null, galOurCode: errorCode });
      },
    );

    it('logs a reply that is not JSON as its first 2000 characters', async () => {
      http.send.mockResolvedValue(reply(502, 'x'.repeat(3000)));

      await signIn();

      expect(logRow().galResponsePayload).toEqual({ raw: 'x'.repeat(2000) });
    });

    it('reads a malformed row path as absent instead of failing', async () => {
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow({
          endpoints: [
            endpointRow({ gpeErrorCodePath: 'ErrorCode', gpeErrorMessagePath: '$.Errors[*]' }),
          ],
        }),
      ]);
      http.send.mockResolvedValue(nicFailure('1005', 'Invalid Token'));

      await expect(signIn()).resolves.toMatchObject({ ok: false, errorCode: 'AUTH_FAILED' });
    });

    it('cuts the stored and logged message to 500 characters and the codes to their columns', async () => {
      http.send.mockResolvedValue(nicFailure('E'.repeat(60), 'w'.repeat(600)));

      await signIn();

      expect(credentialStamp().data.gccLastErrorMessage).toHaveLength(500);
      expect(logRow().galMessage).toHaveLength(500);
      expect(logRow().galProviderCode).toHaveLength(50);
      expect(logRow().galOurCode).toHaveLength(30);
    });
  });

  // ── no reply at all ─────────────────────────────────────────────────────
  describe('a portal that does not answer', () => {
    it.each([
      ['a timeout', new GstHttpError('TIMEOUT', 'No reply within 30000 ms'), 'TIMEOUT'],
      [
        'an unreachable host',
        new GstHttpError('NETWORK', 'Could not reach gsp.example.test: ECONNREFUSED'),
        'UPSTREAM_DOWN',
      ],
    ])(
      'reports %s as a failed sign-in, logs it and gives the lease back',
      async (_label, error, errorCode) => {
        http.send.mockRejectedValue(error);

        await expect(signIn()).resolves.toEqual({
          ok: false,
          message: error.message,
          errorCode,
          creditBalance: 125.5,
        });
        expect(logRow()).toMatchObject({
          galHttpStatus: null,
          galResponsePayload: Prisma.DbNull,
          galOurCode: errorCode,
          galIsSuccess: false,
        });
        expect(credentialStamp().data).toEqual({ gccLastErrorMessage: error.message });
        expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledWith(releaseCall());
      },
    );

    it('gives the lease back and rethrows anything else the call throws', async () => {
      const failure = new Error('socket hang up');
      http.send.mockRejectedValue(failure);

      await expect(signIn()).rejects.toBe(failure);

      expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledWith(releaseCall());
      expect(prisma.gstCompanyCredential.update).not.toHaveBeenCalled();
      expect(prisma.gstApiLog.create).not.toHaveBeenCalled();
    });

    it('still rethrows the original failure when giving the lease back fails too', async () => {
      const failure = new Error('socket hang up');
      http.send.mockRejectedValue(failure);
      prisma.gstAuthSession.updateMany.mockRejectedValue(new Error('db down'));

      await expect(signIn()).rejects.toBe(failure);
    });
  });

  // ── writing the result ──────────────────────────────────────────────────
  describe('writing the result', () => {
    it('gives the lease back and rethrows when the result cannot be written', async () => {
      const failure = new Error('deadlock detected');
      prisma.gstCompanyCredential.update.mockRejectedValue(failure);

      await expect(signIn()).rejects.toBe(failure);

      expect(prisma.gstAuthSession.updateMany).toHaveBeenLastCalledWith(releaseCall());
      expect(prisma.gstApiLog.create).not.toHaveBeenCalled();
    });

    it('treats a log row it cannot write as a warning, never a failed verification', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      prisma.gstApiLog.create.mockRejectedValue(
        new Error('no partition of gst_api_log for 2026-2027'),
      );

      await expect(signIn()).resolves.toMatchObject({
        ok: true,
        tokenValidUntil: TOKEN_EXPIRY_UTC,
      });
      expect(warn).toHaveBeenCalledWith(
        `gst_api_log row for AUTH of credential ${GCC_ID} not written: ` +
          'no partition of gst_api_log for 2026-2027',
      );
    });

    it('cuts the actor to the 50 characters its columns hold', async () => {
      const longActor = 'a'.repeat(60);

      await service.signIn(GCC_ID, longActor);

      expect(prisma.$executeRaw.mock.calls[0][3]).toBe('a'.repeat(50));
      expect(storedSession().gasCreatedBy).toBe('a'.repeat(50));
      expect(logRow().galCreatedBy).toBe('a'.repeat(50));
    });
  });
});
