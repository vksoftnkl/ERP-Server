import { HttpException } from '@nestjs/common';
import {
  GstProvider,
  GstProviderAccount,
  GstProviderService as GstServiceRow,
} from '@prisma/client';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { SaveGstProviderDto } from '../dto/save-gst-provider.dto';
import { GST_CODES } from './gst-config.constants';
import { GstConfigSupport } from './gst-config.support';
import { GstCryptoService } from './gst-crypto.service';
import { GstProviderService } from './gst-provider.service';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e302';
const OTHER_GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e303';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');
const CIPHER = 'gcm:v1:aXY=:dGFn:Ym9keQ==';
const ALL_RIGHTS = ['view', 'create', 'edit', 'delete', 'post'];

const providerRow = (overrides: Partial<GstProvider> = {}): GstProvider => ({
  gpvId: GPV_ID,
  gpvCode: 'NIC',
  gpvName: 'NIC IRP',
  gpvPortalUrl: 'https://einvoice1.gst.gov.in',
  gpvSupportEmail: 'support@nic.in',
  gpvSupportPhone: null,
  gpvTimeoutMs: 45000,
  gpvMaxRetries: 3,
  gpvRateLimitPerMin: 60,
  gpvRemarks: 'stored remark',
  gpvIsActive: false,
  gpvIsDeleted: false,
  gpvSyncDate: null,
  gpvCreatedOn: CREATED_ON,
  gpvCreatedBy: USER_ID,
  gpvModifiedOn: null,
  gpvModifiedBy: null,
  ...overrides,
});

const serviceRow = (gpsId: string, gpsService: string): GstServiceRow => ({
  gpsId,
  gpsGpvId: GPV_ID,
  gpsService,
  gpsEnvironment: 'SANDBOX',
  gpsBaseUrl: 'https://einv-apisandbox.nic.in',
  gpsFallbackUrls: [],
  gpsAuthScheme: 'NIC_SEK',
  gpsTokenTtlMinutes: 360,
  gpsRefreshMarginMinutes: 15,
  gpsPayloadEncryption: 'AES_SEK',
  gpsTimeoutMs: null,
  gpsMaxRetries: null,
  gpsRemarks: null,
  gpsIsActive: true,
  gpsIsDeleted: false,
  gpsSyncDate: null,
  gpsCreatedOn: CREATED_ON,
  gpsCreatedBy: USER_ID,
  gpsModifiedOn: null,
  gpsModifiedBy: null,
});

const accountRow = (): GstProviderAccount => ({
  gpaId: 'gpa-1',
  gpaGpvId: GPV_ID,
  gpaEnvironment: 'SANDBOX',
  gpaService: null,
  gpaAccountRef: 'ACC-7',
  gpaClientIdEnc: CIPHER,
  gpaClientSecretEnc: CIPHER,
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
  pipe.transform(plain, {
    type: 'body',
    metatype: SaveGstProviderDto,
  }) as Promise<SaveGstProviderDto>;

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
  gstProvider: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  gstProviderService: { findMany: jest.Mock };
  gstProviderAccount: { findMany: jest.Mock };
  gstProviderErrorMap: { count: jest.Mock };
  gstProviderEndpoint: { groupBy: jest.Mock };
  gstCompanyCredential: { count: jest.Mock };
  $transaction: jest.Mock;
};

describe('GstProviderService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let service: GstProviderService;

  beforeEach(() => {
    prisma = {
      menu: { findFirst: jest.fn().mockResolvedValue({ menuId: 269 }) },
      $queryRaw: jest.fn().mockResolvedValue(grant(ALL_RIGHTS)),
      gstProvider: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<GstProvider> }) =>
          providerRow({ ...data, gpvId: GPV_ID }),
        ),
        update: jest.fn(async ({ data }: { data: Partial<GstProvider> }) => providerRow(data)),
      },
      gstProviderService: { findMany: jest.fn().mockResolvedValue([]) },
      gstProviderAccount: { findMany: jest.fn().mockResolvedValue([]) },
      gstProviderErrorMap: { count: jest.fn().mockResolvedValue(0) },
      gstProviderEndpoint: { groupBy: jest.fn().mockResolvedValue([]) },
      gstCompanyCredential: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    const support = new GstConfigSupport(
      prisma as unknown as PrismaService,
      { getUserId: () => USER_ID } as never,
      audit as never,
      new GstCryptoService(),
    );
    service = new GstProviderService(prisma as unknown as PrismaService, support);
  });

  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('rights (GST Providers menu)', () => {
    it.each([
      ['get', 'view', () => service.getById(GPV_ID)],
      [
        'create',
        'create',
        async () => service.save(await dtoOf({ gpvCode: 'NIC', gpvName: 'NIC' })),
      ],
      [
        'update',
        'edit',
        async () => service.save(await dtoOf({ gpvId: GPV_ID, gpvCode: 'NIC', gpvName: 'NIC' })),
      ],
      ['delete', 'delete', () => service.softDelete(GPV_ID)],
      ['restore', 'edit', () => service.restore(GPV_ID)],
    ])('refuses a %s without the %s right before touching a row', async (_label, right, call) => {
      prisma.$queryRaw.mockResolvedValue(grant(ALL_RIGHTS.filter((r) => r !== right)));

      const refusal = await refusalOf(call());

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: `GST_RIGHT_${right.toUpperCase()}` }] },
      });
      expect(prisma.gstProvider.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('refuses an id that names no provider', async () => {
      const refusal = await refusalOf(service.getById(GPV_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpvId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('answers a deleted provider too, so the screen can offer Restore', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow({ gpvIsDeleted: true }));

      await expect(service.getById(GPV_ID)).resolves.toMatchObject({
        gpvId: GPV_ID,
        gpvIsDeleted: true,
      });
    });

    it('adds the live services with their endpoint counts, the accounts and the counts below', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow());
      prisma.gstProviderService.findMany.mockResolvedValue([
        serviceRow('gps-1', 'EINVOICE'),
        serviceRow('gps-2', 'EWAYBILL'),
      ]);
      prisma.gstProviderEndpoint.groupBy.mockResolvedValue([
        { gpeGpsId: 'gps-1', _count: { _all: 3 } },
      ]);
      prisma.gstProviderAccount.findMany.mockResolvedValue([accountRow()]);
      prisma.gstProviderErrorMap.count.mockResolvedValue(12);
      prisma.gstCompanyCredential.count.mockResolvedValue(2);

      const payload = await service.getById(GPV_ID);

      expect(payload.services.map((s) => [s.gpsId, s.endpointCount])).toEqual([
        ['gps-1', 3],
        ['gps-2', 0],
      ]);
      expect(payload).toMatchObject({ endpointCount: 3, errorMapCount: 12, credentialCount: 2 });
      expect(payload.accounts).toEqual([
        expect.objectContaining({
          gpaId: 'gpa-1',
          gpvCode: 'NIC',
          hasClientId: true,
          hasApiKey: false,
        }),
      ]);
      expect(JSON.stringify(payload)).not.toContain('gcm:');
      expect(prisma.gstProviderService.findMany).toHaveBeenCalledWith({
        where: { gpsGpvId: GPV_ID, gpsIsDeleted: false },
        orderBy: [{ gpsService: 'asc' }, { gpsEnvironment: 'asc' }],
      });
      expect(prisma.gstProviderAccount.findMany).toHaveBeenCalledWith({
        where: { gpaGpvId: GPV_ID, gpaIsDeleted: false },
        orderBy: [{ gpaEnvironment: 'asc' }, { gpaService: { sort: 'asc', nulls: 'first' } }],
      });
      expect(prisma.gstProviderEndpoint.groupBy).toHaveBeenCalledWith({
        by: ['gpeGpsId'],
        where: { gpeGpsId: { in: ['gps-1', 'gps-2'] }, gpeIsDeleted: false },
        _count: { _all: true },
      });
      expect(prisma.gstProviderErrorMap.count).toHaveBeenCalledWith({
        where: { gemGpvId: GPV_ID, gemIsDeleted: false },
      });
      expect(prisma.gstCompanyCredential.count).toHaveBeenCalledWith({
        where: { gccGpvId: GPV_ID, gccIsDeleted: false },
      });
    });

    it('counts no endpoints, and asks for none, when the provider has no services', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow());

      await expect(service.getById(GPV_ID)).resolves.toMatchObject({
        services: [],
        endpointCount: 0,
      });
      expect(prisma.gstProviderEndpoint.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('save — create (no gpvId)', () => {
    it('upper-cases the code, fills the defaults and audits the new provider', async () => {
      const payload = await service.save(
        await dtoOf({ gpvCode: ' chartered ', gpvName: 'Chartered' }),
      );

      expect(prisma.gstProvider.findUnique).toHaveBeenCalledWith({
        where: { gpvCode: 'CHARTERED' },
        select: { gpvId: true, gpvIsDeleted: true },
      });
      expect(prisma.gstProvider.create).toHaveBeenCalledWith({
        data: {
          gpvName: 'Chartered',
          gpvPortalUrl: null,
          gpvSupportEmail: null,
          gpvSupportPhone: null,
          gpvTimeoutMs: 30000,
          gpvMaxRetries: 2,
          gpvRateLimitPerMin: null,
          gpvRemarks: null,
          gpvIsActive: true,
          gpvCode: 'CHARTERED',
          gpvCreatedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'gst provider',
        screenName: 'GST Provider',
        pk: GPV_ID,
        displayName: 'CHARTERED',
        originalRecord: null,
        modifiedRecord: expect.objectContaining({ gpvCode: 'CHARTERED', gpvTimeoutMs: 30000 }),
        notes: 'GST provider created',
      });
      expect(payload).toMatchObject({ gpvCode: 'CHARTERED', services: [], accounts: [] });
    });

    it('refuses a code a live provider holds', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue({ gpvId: OTHER_GPV_ID, gpvIsDeleted: false });

      const refusal = await refusalOf(
        service.save(await dtoOf({ gpvCode: 'NIC', gpvName: 'NIC' })),
      );

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'GST provider code already exists',
          errors: [
            {
              field: 'gpvCode',
              message: `NIC is provider ${OTHER_GPV_ID}.`,
              code: GST_CODES.PROVIDER_CODE_DUPLICATE,
            },
          ],
        },
      });
      expect(prisma.gstProvider.create).not.toHaveBeenCalled();
    });

    it('refuses a code a deleted provider holds, and says to restore it', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue({ gpvId: OTHER_GPV_ID, gpvIsDeleted: true });

      const refusal = await refusalOf(
        service.save(await dtoOf({ gpvCode: 'NIC', gpvName: 'NIC' })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              message: `NIC belongs to deleted provider ${OTHER_GPV_ID}. Restore it instead.`,
              code: GST_CODES.PROVIDER_CODE_DUPLICATE,
            },
          ],
        },
      });
    });

    it('answers a unique-index race on gpv_code with the same 409', async () => {
      prisma.gstProvider.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: ['gpv_code'] },
        }),
      );

      const refusal = await refusalOf(
        service.save(await dtoOf({ gpvCode: 'NIC', gpvName: 'NIC' })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gpvCode',
              message: 'Provider code NIC is taken (by a deleted provider, perhaps).',
              code: GST_CODES.PROVIDER_CODE_DUPLICATE,
            },
          ],
        },
      });
    });

    it('answers a CHECK the database refused as a 400 on its field', async () => {
      prisma.gstProvider.create.mockRejectedValue({
        code: 'P2010',
        meta: {
          code: '23514',
          message: 'new row for relation "gst_provider" violates check constraint "ck_gpv_retries"',
        },
      });

      const refusal = await refusalOf(
        service.save(await dtoOf({ gpvCode: 'NIC', gpvName: 'NIC' })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'gpvMaxRetries', code: GST_CODES.CHECK }] },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.gstProvider.create.mockRejectedValue(failure);

      await expect(service.save(await dtoOf({ gpvCode: 'NIC', gpvName: 'NIC' }))).rejects.toBe(
        failure,
      );
    });
  });

  describe('save — update (gpvId present)', () => {
    it('refuses an id that names no provider', async () => {
      const refusal = await refusalOf(
        service.save(await dtoOf({ gpvId: GPV_ID, gpvCode: 'NIC', gpvName: 'NIC' })),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpvId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses to edit a deleted provider', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow({ gpvIsDeleted: true }));

      const refusal = await refusalOf(
        service.save(await dtoOf({ gpvId: GPV_ID, gpvCode: 'NIC', gpvName: 'NIC' })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpvId', code: GST_CODES.ALREADY_DELETED }] },
      });
      expect(prisma.gstProvider.update).not.toHaveBeenCalled();
    });

    it('never renames a provider', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow());

      const refusal = await refusalOf(
        service.save(await dtoOf({ gpvId: GPV_ID, gpvCode: 'NIC2', gpvName: 'NIC' })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'A provider code is never renamed',
          errors: [
            {
              field: 'gpvCode',
              message: 'This provider is NIC. Retire it and create NIC2 instead.',
              code: GST_CODES.PROVIDER_CODE_FIXED,
            },
          ],
        },
      });
      expect(prisma.gstProvider.update).not.toHaveBeenCalled();
    });

    it('keeps every stored field the body left out, and clears the ones sent as null', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow());

      await service.save(
        await dtoOf({
          gpvId: GPV_ID,
          gpvCode: 'nic',
          gpvName: 'NIC e-Invoice',
          gpvRateLimitPerMin: null,
          gpvRemarks: null,
        }),
      );

      expect(prisma.gstProvider.update).toHaveBeenCalledWith({
        where: { gpvId: GPV_ID },
        data: {
          gpvName: 'NIC e-Invoice',
          gpvPortalUrl: 'https://einvoice1.gst.gov.in',
          gpvSupportEmail: 'support@nic.in',
          gpvSupportPhone: null,
          gpvTimeoutMs: 45000,
          gpvMaxRetries: 3,
          gpvRateLimitPerMin: null,
          gpvRemarks: null,
          gpvIsActive: false,
          gpvModifiedOn: expect.any(Date),
          gpvModifiedBy: USER_ID,
        },
      });
      // The code is checked against the row, not against the other providers.
      expect(prisma.gstProvider.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.gstProvider.create).not.toHaveBeenCalled();
    });

    it('audits the before and after of the update', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow());

      await service.save(
        await dtoOf({ gpvId: GPV_ID, gpvCode: 'NIC', gpvName: 'NIC', gpvIsActive: true }),
      );

      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: GPV_ID,
        displayName: 'NIC',
        originalRecord: expect.objectContaining({ gpvIsActive: false }),
        modifiedRecord: expect.objectContaining({ gpvIsActive: true }),
        notes: 'GST provider updated',
      });
      expect(auditEntry().modifiedRecord).not.toHaveProperty('services');
    });
  });

  describe('softDelete', () => {
    it('refuses an id that names no provider', async () => {
      const refusal = await refusalOf(service.softDelete(GPV_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses a provider that is already deleted', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow({ gpvIsDeleted: true }));

      const refusal = await refusalOf(service.softDelete(GPV_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              message: 'Nothing to delete. POST /gst/providers/restore brings it back.',
              code: GST_CODES.ALREADY_DELETED,
            },
          ],
        },
      });
    });

    it.each([
      [1, '1 live company credential signs in through NIC. Delete or repoint it first.'],
      [3, '3 live company credentials sign in through NIC. Delete or repoint them first.'],
    ])('refuses while %i live credential(s) sign in through it', async (count, message) => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow());
      prisma.gstCompanyCredential.count.mockResolvedValue(count);

      const refusal = await refusalOf(service.softDelete(GPV_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpvId', message, code: GST_CODES.PROVIDER_IN_USE }] },
      });
      expect(prisma.gstProvider.update).not.toHaveBeenCalled();
    });

    it('marks the provider deleted and audits it as a cancel', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow());

      await expect(service.softDelete(GPV_ID)).resolves.toEqual({ gpvId: GPV_ID, deleted: true });

      expect(prisma.gstProvider.update).toHaveBeenCalledWith({
        where: { gpvId: GPV_ID },
        data: { gpvIsDeleted: true, gpvModifiedOn: expect.any(Date), gpvModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'NIC',
        originalRecord: expect.objectContaining({ gpvIsDeleted: false }),
        modifiedRecord: expect.objectContaining({ gpvIsDeleted: true }),
        notes: 'GST provider soft deleted',
      });
    });
  });

  describe('restore', () => {
    it('refuses an id that names no provider', async () => {
      const refusal = await refusalOf(service.restore(GPV_ID));

      expect(refusal.status).toBe(404);
    });

    it('refuses a provider that is not deleted', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow());

      const refusal = await refusalOf(service.restore(GPV_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { message: 'GST provider is not deleted', errors: [{ code: GST_CODES.NOT_DELETED }] },
      });
    });

    it('brings the provider back and audits it as an update', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(providerRow({ gpvIsDeleted: true }));

      await expect(service.restore(GPV_ID)).resolves.toEqual({ gpvId: GPV_ID, deleted: false });

      expect(prisma.gstProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gpvIsDeleted: false }) as object,
        }),
      );
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ gpvIsDeleted: true }),
        modifiedRecord: expect.objectContaining({ gpvIsDeleted: false }),
        notes: 'GST provider restored',
      });
    });
  });
});
