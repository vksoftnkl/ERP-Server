import { HttpException } from '@nestjs/common';
import { GstProviderAccount } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { SaveGstProviderAccountDto } from '../dto/save-gst-provider-account.dto';
import { GST_CODES } from './gst-config.constants';
import { GstConfigSupport } from './gst-config.support';
import { GstCryptoService } from './gst-crypto.service';
import { GstProviderAccountService } from './gst-provider-account.service';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e401';
const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e402';
const OTHER_GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e403';
const GPA_ID = '019c6f6c-be87-7a11-8905-36092c46e404';
const CLASH_ID = '019c6f6c-be87-7a11-8905-36092c46e405';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');
const ALL_RIGHTS = ['view', 'create', 'edit', 'delete'];
const ENV_KEYS = ['GST_CRED_KEY', 'GST_CRED_KEY_VERSION', 'GST_CRED_KEY_V1'] as const;
const KEY_V1 = randomBytes(32).toString('hex');

const accountRow = (overrides: Partial<GstProviderAccount> = {}): GstProviderAccount => ({
  gpaId: GPA_ID,
  gpaGpvId: GPV_ID,
  gpaEnvironment: 'SANDBOX',
  gpaService: null,
  gpaAccountRef: 'ACC-7',
  gpaClientIdEnc: null,
  gpaClientSecretEnc: null,
  gpaApiKeyEnc: null,
  gpaKeyVersion: 1,
  gpaValidFrom: null,
  gpaValidUpto: null,
  gpaCreditBalance: null,
  gpaBalanceCheckedOn: null,
  gpaLastVerifiedOn: null,
  gpaRemarks: null,
  gpaIsActive: true,
  gpaIsDeleted: false,
  gpaSyncDate: null,
  gpaCreatedOn: CREATED_ON,
  gpaCreatedBy: USER_ID,
  gpaModifiedOn: null,
  gpaModifiedBy: null,
  ...overrides,
});

/** A user_menus row granting exactly the rights named. */
const grant = (rights: string[]) => [
  Object.fromEntries(
    [
      'view',
      'create',
      'edit',
      'delete',
      'print',
      'export',
      'post',
      'cancel',
      'amend',
      'override',
      'retender',
    ].map((right) => [`um_can_${right}`, rights.includes(right)]),
  ),
];

/** The body as the house ValidationPipe hands it to the controller. */
const pipe = createHouseValidationPipe();
const dtoOf = (plain: object) =>
  pipe.transform(
    { gpaGpvId: GPV_ID, gpaEnvironment: 'SANDBOX', gpaAccountRef: 'ACC-7', ...plain },
    { type: 'body', metatype: SaveGstProviderAccountDto },
  ) as Promise<SaveGstProviderAccountDto>;

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
  menu: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
  gstProvider: { findUnique: jest.Mock };
  gstProviderAccount: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('GstProviderAccountService', () => {
  const saved: Record<string, string | undefined> = {};
  const crypto = new GstCryptoService();
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let service: GstProviderAccountService;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.GST_CRED_KEY = KEY_V1;
    prisma = {
      menu: { findFirst: jest.fn().mockResolvedValue({ menuId: 269 }) },
      $queryRaw: jest.fn().mockResolvedValue(grant(ALL_RIGHTS)),
      gstProvider: {
        findUnique: jest.fn().mockResolvedValue({ gpvCode: 'CHARTERED', gpvIsDeleted: false }),
      },
      gstProviderAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<GstProviderAccount> }) =>
          accountRow(data),
        ),
        update: jest.fn(async ({ data }: { data: Partial<GstProviderAccount> }) =>
          accountRow(data),
        ),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    const support = new GstConfigSupport(
      prisma as unknown as PrismaService,
      { getUserId: () => USER_ID } as never,
      audit as never,
      crypto,
    );
    service = new GstProviderAccountService(prisma as unknown as PrismaService, support);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  /** The stored row an update finds; the update answers with it plus what was written. */
  const stored = (row: GstProviderAccount) => {
    prisma.gstProviderAccount.findUnique.mockResolvedValue(row);
    prisma.gstProviderAccount.update.mockImplementation(
      async ({ data }: { data: Partial<GstProviderAccount> }) => ({ ...row, ...data }),
    );
  };
  const createdData = () =>
    (prisma.gstProviderAccount.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.gstProviderAccount.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('rights (GST Providers menu)', () => {
    it.each([
      ['get', 'view', () => service.getById(GPA_ID)],
      ['create', 'create', async () => service.save(await dtoOf({}))],
      ['update', 'edit', async () => service.save(await dtoOf({ gpaId: GPA_ID }))],
      ['delete', 'delete', () => service.softDelete(GPA_ID)],
    ])('refuses a %s without the %s right before touching a row', async (_label, right, call) => {
      prisma.$queryRaw.mockResolvedValue(grant(ALL_RIGHTS.filter((r) => r !== right)));

      const refusal = await refusalOf(call());

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: `GST_RIGHT_${right.toUpperCase()}` }] },
      });
      expect(prisma.gstProviderAccount.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('refuses an id that names no account', async () => {
      const refusal = await refusalOf(service.getById(GPA_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpaId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('answers a deleted account too, with has* flags and never a secret', async () => {
      const clientId = crypto.encrypt('asp-1704563322');
      prisma.gstProviderAccount.findUnique.mockResolvedValue({
        ...accountRow({ gpaClientIdEnc: clientId, gpaIsDeleted: true }),
        provider: { gpvCode: 'CHARTERED' },
      });

      const payload = await service.getById(GPA_ID);

      expect(prisma.gstProviderAccount.findUnique).toHaveBeenCalledWith({
        where: { gpaId: GPA_ID },
        include: { provider: { select: { gpvCode: true } } },
      });
      expect(payload).toMatchObject({
        gpaId: GPA_ID,
        gpvCode: 'CHARTERED',
        gpaIsDeleted: true,
        hasClientId: true,
        hasClientSecret: false,
        hasApiKey: false,
      });
      expect(JSON.stringify(payload)).not.toContain('gcm:');
      expect(JSON.stringify(payload)).not.toContain('asp-1704563322');
    });
  });

  describe('save — create (no gpaId)', () => {
    it('encrypts each secret sent, keeps them out of the answer and the audit, and names them', async () => {
      const payload = await service.save(
        await dtoOf({
          gpaEnvironment: 'sandbox',
          clientId: 'asp-1704563322',
          clientSecret: ' p@ss word ',
          gpaValidFrom: '2026-04-01',
          gpaValidUpto: '2027-03-31',
        }),
      );

      const data = createdData();
      expect(data).toEqual({
        gpaEnvironment: 'SANDBOX',
        gpaService: null,
        gpaAccountRef: 'ACC-7',
        gpaClientIdEnc: expect.stringMatching(/^gcm:v1:/),
        gpaClientSecretEnc: expect.stringMatching(/^gcm:v1:/),
        gpaKeyVersion: 1,
        gpaValidFrom: new Date('2026-04-01T00:00:00.000Z'),
        gpaValidUpto: new Date('2027-03-31T00:00:00.000Z'),
        gpaRemarks: null,
        gpaIsActive: true,
        gpaGpvId: GPV_ID,
        gpaCreatedBy: USER_ID,
      });
      expect(crypto.decrypt(data.gpaClientIdEnc as string)).toBe('asp-1704563322');
      // A secret is never trimmed: a password may end in a space.
      expect(crypto.decrypt(data.gpaClientSecretEnc as string)).toBe(' p@ss word ');

      expect(payload).toMatchObject({
        gpvCode: 'CHARTERED',
        hasClientId: true,
        hasClientSecret: true,
        hasApiKey: false,
        keyVersion: 1,
        gpaValidFrom: '2026-04-01',
        gpaValidUpto: '2027-03-31',
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'gst provider account',
        screenName: 'GST Provider Account',
        displayName: 'CHARTERED SANDBOX ALL',
        originalRecord: null,
        modifiedRecord: payload,
        notes: 'GST provider account created; secrets written: clientId, clientSecret',
      });
      for (const text of [JSON.stringify(payload), JSON.stringify(auditEntry())]) {
        expect(text).not.toContain('asp-1704563322');
        expect(text).not.toContain('p@ss');
        expect(text).not.toContain('gcm:');
      }
    });

    it('checks for a live account of the same provider, environment and service', async () => {
      await service.save(await dtoOf({ gpaService: 'einvoice' }));

      expect(prisma.gstProviderAccount.findFirst).toHaveBeenCalledWith({
        where: {
          gpaGpvId: GPV_ID,
          gpaEnvironment: 'SANDBOX',
          gpaService: 'EINVOICE',
          gpaIsDeleted: false,
        },
        select: { gpaId: true },
      });
      expect(auditEntry()).toMatchObject({
        displayName: 'CHARTERED SANDBOX EINVOICE',
        notes: 'GST provider account created',
      });
    });

    it.each([
      [null, 'every service'],
      ['GSTIN_VERIFY', 'GSTIN_VERIFY'],
    ])('refuses a second live account for service %s', async (gpaService, words) => {
      prisma.gstProviderAccount.findFirst.mockResolvedValue({ gpaId: CLASH_ID });

      const refusal = await refusalOf(service.save(await dtoOf({ gpaService })));

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Duplicate',
          errors: [
            {
              field: 'gpaEnvironment',
              message: `The provider already has a live SANDBOX account for ${words} (${CLASH_ID}).`,
              code: GST_CODES.ACCOUNT_DUPLICATE,
            },
          ],
        },
      });
      expect(prisma.gstProviderAccount.create).not.toHaveBeenCalled();
    });

    it('answers a unique-index race with the same 409', async () => {
      prisma.gstProviderAccount.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['gpa_gpv_id', 'gpa_environment', 'gpa_service'] },
      });

      const refusal = await refusalOf(service.save(await dtoOf({})));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gpaEnvironment',
              message: 'The provider already has a live account for that environment and service.',
              code: GST_CODES.ACCOUNT_DUPLICATE,
            },
          ],
        },
      });
    });

    it('refuses a provider id that names no provider', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(await dtoOf({})));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpaGpvId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses an account under a deleted provider', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue({ gpvCode: 'NIC', gpvIsDeleted: true });

      const refusal = await refusalOf(service.save(await dtoOf({})));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpaGpvId', code: GST_CODES.ALREADY_DELETED }] },
      });
      expect(prisma.gstProviderAccount.create).not.toHaveBeenCalled();
    });

    it('refuses a valid-upto before the valid-from', async () => {
      const refusal = await refusalOf(
        service.save(await dtoOf({ gpaValidFrom: '2026-04-01', gpaValidUpto: '2026-03-31' })),
      );

      expect(refusal).toEqual({
        status: 400,
        body: {
          success: false,
          message: 'Validation failed',
          errors: [
            {
              field: 'gpaValidUpto',
              message: 'must not be before gpaValidFrom',
              code: GST_CODES.VALID_UPTO_BEFORE_FROM,
            },
          ],
        },
      });
    });

    it('is a 503 when a secret arrives and the server has no GST_CRED_KEY', async () => {
      delete process.env.GST_CRED_KEY;

      const refusal = await refusalOf(service.save(await dtoOf({ apiKey: 'k-1' })));

      expect(refusal).toMatchObject({
        status: 503,
        body: { errors: [{ field: 'GST_CRED_KEY', code: GST_CODES.CRED_KEY_MISSING }] },
      });
      expect(prisma.gstProviderAccount.create).not.toHaveBeenCalled();
    });

    it('saves an account without secrets on a server with no GST_CRED_KEY', async () => {
      delete process.env.GST_CRED_KEY;

      await expect(service.save(await dtoOf({}))).resolves.toMatchObject({
        hasClientId: false,
        keyVersion: 1,
      });
    });

    it('refuses a secret both given and cleared', async () => {
      const refusal = await refusalOf(
        service.save(await dtoOf({ apiKey: 'k-1', clear: ['apiKey'] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'apiKey', code: GST_CODES.SECRET_GIVEN_AND_CLEARED }] },
      });
    });
  });

  describe('save — update (gpaId present)', () => {
    it('refuses an id that names no account', async () => {
      const refusal = await refusalOf(service.save(await dtoOf({ gpaId: GPA_ID })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpaId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses to edit a deleted account', async () => {
      stored(accountRow({ gpaIsDeleted: true }));

      const refusal = await refusalOf(service.save(await dtoOf({ gpaId: GPA_ID })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpaId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it('refuses to move the account to another provider', async () => {
      stored(accountRow());

      const refusal = await refusalOf(
        service.save(await dtoOf({ gpaId: GPA_ID, gpaGpvId: OTHER_GPV_ID })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gpaGpvId',
              message: `This row belongs to provider ${GPV_ID}. Create a new row under the other parent instead.`,
              code: GST_CODES.PARENT_FIXED,
            },
          ],
        },
      });
      expect(prisma.gstProviderAccount.update).not.toHaveBeenCalled();
    });

    it('keeps what the body left out, and checks for clashes with every other account', async () => {
      stored(
        accountRow({
          gpaService: 'EINVOICE',
          gpaValidFrom: new Date('2026-04-01T00:00:00.000Z'),
          gpaValidUpto: new Date('2027-03-31T00:00:00.000Z'),
          gpaRemarks: 'stored remark',
          gpaIsActive: false,
        }),
      );

      await service.save(await dtoOf({ gpaId: GPA_ID }));

      expect(prisma.gstProviderAccount.findFirst).toHaveBeenCalledWith({
        where: {
          gpaGpvId: GPV_ID,
          gpaEnvironment: 'SANDBOX',
          gpaService: 'EINVOICE',
          gpaIsDeleted: false,
          gpaId: { not: GPA_ID },
        },
        select: { gpaId: true },
      });
      expect(updatedData()).toEqual({
        gpaEnvironment: 'SANDBOX',
        gpaService: 'EINVOICE',
        gpaAccountRef: 'ACC-7',
        gpaKeyVersion: 1,
        gpaValidFrom: new Date('2026-04-01T00:00:00.000Z'),
        gpaValidUpto: new Date('2027-03-31T00:00:00.000Z'),
        gpaRemarks: 'stored remark',
        gpaIsActive: false,
        gpaModifiedOn: expect.any(Date),
        gpaModifiedBy: USER_ID,
      });
      expect(prisma.gstProviderAccount.create).not.toHaveBeenCalled();
    });

    it('widens the account to every service when gpaService is sent as null', async () => {
      stored(accountRow({ gpaService: 'EINVOICE' }));

      await service.save(await dtoOf({ gpaId: GPA_ID, gpaService: null }));

      expect(updatedData()).toMatchObject({ gpaService: null });
    });

    it('refuses a new valid-upto before the stored valid-from', async () => {
      stored(accountRow({ gpaValidFrom: new Date('2026-04-01T00:00:00.000Z') }));

      const refusal = await refusalOf(
        service.save(await dtoOf({ gpaId: GPA_ID, gpaValidUpto: '2026-03-31' })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: GST_CODES.VALID_UPTO_BEFORE_FROM }] },
      });
    });

    it('keeps a secret left out or sent as "", and nulls one named in clear', async () => {
      const clientId = crypto.encrypt('asp-1');
      const clientSecret = crypto.encrypt('asp-pass');
      stored(
        accountRow({
          gpaClientIdEnc: clientId,
          gpaClientSecretEnc: clientSecret,
          gpaApiKeyEnc: crypto.encrypt('api-key'),
          gpaKeyVersion: 1,
        }),
      );

      const payload = await service.save(
        await dtoOf({ gpaId: GPA_ID, clientSecret: '', clear: ['apiKey'] }),
      );

      const data = updatedData();
      expect(data).not.toHaveProperty('gpaClientIdEnc');
      expect(data).not.toHaveProperty('gpaClientSecretEnc');
      expect(data.gpaApiKeyEnc).toBeNull();
      expect(data.gpaKeyVersion).toBe(1);
      expect(payload).toMatchObject({ hasClientId: true, hasClientSecret: true, hasApiKey: false });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        displayName: 'CHARTERED SANDBOX ALL',
        originalRecord: expect.objectContaining({ hasApiKey: true }),
        modifiedRecord: expect.objectContaining({ hasApiKey: false }),
        notes: 'GST provider account updated; secrets cleared: apiKey',
      });
    });

    it('re-wraps the stored secrets under the current key when one is written', async () => {
      const underV1 = crypto.encrypt('asp-pass');
      stored(accountRow({ gpaClientSecretEnc: underV1, gpaKeyVersion: 1 }));
      process.env.GST_CRED_KEY_V1 = KEY_V1;
      process.env.GST_CRED_KEY = randomBytes(32).toString('hex');
      process.env.GST_CRED_KEY_VERSION = '2';

      const payload = await service.save(await dtoOf({ gpaId: GPA_ID, clientId: 'asp-2' }));

      const data = updatedData();
      expect(crypto.versionOf(data.gpaClientIdEnc as string)).toBe(2);
      expect(crypto.versionOf(data.gpaClientSecretEnc as string)).toBe(2);
      expect(crypto.decrypt(data.gpaClientSecretEnc as string)).toBe('asp-pass');
      expect(data.gpaKeyVersion).toBe(2);
      expect(payload.keyVersion).toBe(2);
    });
  });

  describe('softDelete', () => {
    const withProvider = (row: GstProviderAccount) => ({ ...row, provider: { gpvCode: 'NIC' } });

    it('refuses an id that names no account', async () => {
      const refusal = await refusalOf(service.softDelete(GPA_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses an account that is already deleted', async () => {
      prisma.gstProviderAccount.findUnique.mockResolvedValue(
        withProvider(accountRow({ gpaIsDeleted: true })),
      );

      const refusal = await refusalOf(service.softDelete(GPA_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'GST provider account is already deleted',
          errors: [{ message: 'Nothing to delete.', code: GST_CODES.ALREADY_DELETED }],
        },
      });
      expect(prisma.gstProviderAccount.update).not.toHaveBeenCalled();
    });

    it('marks the account deleted and audits it as a cancel, secret-free', async () => {
      const row = accountRow({ gpaService: 'EWAYBILL', gpaClientIdEnc: crypto.encrypt('asp-1') });
      prisma.gstProviderAccount.findUnique.mockResolvedValue(withProvider(row));
      prisma.gstProviderAccount.update.mockResolvedValue({ ...row, gpaIsDeleted: true });

      await expect(service.softDelete(GPA_ID)).resolves.toEqual({ gpaId: GPA_ID, deleted: true });

      expect(prisma.gstProviderAccount.update).toHaveBeenCalledWith({
        where: { gpaId: GPA_ID },
        data: { gpaIsDeleted: true, gpaModifiedOn: expect.any(Date), gpaModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        pk: GPA_ID,
        displayName: 'NIC SANDBOX EWAYBILL',
        originalRecord: expect.objectContaining({ gpaIsDeleted: false, hasClientId: true }),
        modifiedRecord: expect.objectContaining({ gpaIsDeleted: true }),
        notes: 'GST provider account soft deleted',
      });
      expect(JSON.stringify(auditEntry())).not.toContain('gcm:');
    });
  });
});
