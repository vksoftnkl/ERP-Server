import { HttpException } from '@nestjs/common';
import {
  GstProviderEndpoint,
  GstProviderErrorMap,
  GstProviderFieldMap,
  GstProviderService,
  Prisma,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/database/prisma/prisma.service';
import {
  SaveGstProviderEndpointDto,
  SaveGstProviderErrorMapDto,
  SaveGstProviderFieldMapDto,
  SaveGstProviderServiceDto,
} from '../dto/save-gst-provider.dto';
import { GST_CODES } from './gst-config.constants';
import { GstConfigSupport } from './gst-config.support';
import { GstProviderPartsService } from './gst-provider-parts.service';

const PROVIDER_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const OTHER_PROVIDER_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const SERVICE_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const OTHER_SERVICE_ID = '019c6f6c-be87-7a11-8905-36092c46e202';
const ENDPOINT_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const OTHER_ENDPOINT_ID = '019c6f6c-be87-7a11-8905-36092c46e302';
const FIELD_MAP_ID = '019c6f6c-be87-7a11-8905-36092c46e401';
const OTHER_FIELD_MAP_ID = '019c6f6c-be87-7a11-8905-36092c46e402';
const ERROR_MAP_ID = '019c6f6c-be87-7a11-8905-36092c46e501';
const OTHER_ERROR_MAP_ID = '019c6f6c-be87-7a11-8905-36092c46e502';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e601';
/** What the "GST Providers" menu row resolves to; the code finds it by (parent 60, name). */
const MENU_ID = 269;
const STAMP = new Date('2026-10-02T04:30:00.000Z');
const BASE_URL = 'https://einv-apisandbox.nic.in';

// ── rows ────────────────────────────────────────────────────────────────────

const serviceRow = (overrides: Partial<GstProviderService> = {}): GstProviderService => ({
  gpsId: SERVICE_ID,
  gpsGpvId: PROVIDER_ID,
  gpsService: 'EINVOICE',
  gpsEnvironment: 'SANDBOX',
  gpsBaseUrl: BASE_URL,
  gpsFallbackUrls: [],
  gpsAuthScheme: 'NIC_SEK',
  gpsTokenTtlMinutes: 360,
  gpsRefreshMarginMinutes: 15,
  gpsPayloadEncryption: 'NONE',
  gpsTimeoutMs: null,
  gpsMaxRetries: null,
  gpsRemarks: null,
  gpsIsActive: true,
  gpsIsDeleted: false,
  gpsSyncDate: null,
  gpsCreatedOn: STAMP,
  gpsCreatedBy: USER_ID,
  gpsModifiedOn: null,
  gpsModifiedBy: null,
  ...overrides,
});

const endpointRow = (overrides: Partial<GstProviderEndpoint> = {}): GstProviderEndpoint => ({
  gpeId: ENDPOINT_ID,
  gpeGpsId: SERVICE_ID,
  gpeAction: 'AUTH',
  gpeHttpMethod: 'POST',
  gpePathTemplate: '/eivital/v1.04/auth',
  gpeQueryTemplate: null,
  gpeContentType: 'application/json',
  gpeHeaders: null,
  gpeRequestWrapper: null,
  gpeRedactPaths: null,
  gpeResponseRootPath: null,
  gpeSuccessPath: null,
  gpeSuccessValue: null,
  gpeErrorCodePath: null,
  gpeErrorMessagePath: null,
  gpeTimeoutMs: null,
  gpeMaxRetries: null,
  gpeIsIdempotent: false,
  gpeRemarks: null,
  gpeIsActive: true,
  gpeIsDeleted: false,
  gpeSyncDate: null,
  gpeCreatedOn: STAMP,
  gpeCreatedBy: USER_ID,
  gpeModifiedOn: null,
  gpeModifiedBy: null,
  ...overrides,
});

const fieldMapRow = (overrides: Partial<GstProviderFieldMap> = {}): GstProviderFieldMap => ({
  gfmId: FIELD_MAP_ID,
  gfmGpeId: ENDPOINT_ID,
  gfmDirection: 'RESPONSE',
  gfmOurField: 'auth_token',
  gfmTheirPath: '$.Data.AuthToken',
  gfmDataType: 'TEXT',
  gfmTransform: 'NONE',
  gfmFormatMask: null,
  gfmIsRequired: false,
  gfmDefaultValue: null,
  gfmTargetColumn: null,
  gfmSortOrder: 0,
  gfmIsDeleted: false,
  gfmSyncDate: null,
  gfmCreatedOn: STAMP,
  gfmCreatedBy: USER_ID,
  gfmModifiedOn: null,
  gfmModifiedBy: null,
  ...overrides,
});

const errorMapRow = (overrides: Partial<GstProviderErrorMap> = {}): GstProviderErrorMap => ({
  gemId: ERROR_MAP_ID,
  gemGpvId: PROVIDER_ID,
  gemService: null,
  gemTheirCode: '2150',
  gemOurCode: 'DUPLICATE_IRN',
  gemMessage: null,
  gemTreatAs: 'ERROR',
  gemExtractPath: null,
  gemCanonicalField: null,
  gemIsRetryable: false,
  gemRetryAfterSeconds: null,
  gemShouldReauth: false,
  gemRecoveryAction: 'NONE',
  gemSeverity: 'ERROR',
  gemIsDeleted: false,
  gemSyncDate: null,
  gemCreatedOn: STAMP,
  gemCreatedBy: USER_ID,
  gemModifiedOn: null,
  gemModifiedBy: null,
  ...overrides,
});

/** What a write reads back as: Prisma.DbNull is NULL in the row. */
const asStored = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value === Prisma.DbNull ? null : value]),
  );

// ── DTOs, built the way the ValidationPipe builds them ──────────────────────
// A plain literal hides that every declared field is an own property; these
// go through plainToInstance so "absent" really is an undefined own key.

const serviceDto = (plain: Record<string, unknown> = {}) =>
  plainToInstance(SaveGstProviderServiceDto, {
    gpsGpvId: PROVIDER_ID,
    gpsService: 'einvoice',
    gpsEnvironment: 'sandbox',
    gpsBaseUrl: `${BASE_URL}/`,
    gpsAuthScheme: 'nic_sek',
    ...plain,
  });

const endpointDto = (plain: Record<string, unknown> = {}) =>
  plainToInstance(SaveGstProviderEndpointDto, {
    gpeGpsId: SERVICE_ID,
    gpeAction: 'auth',
    gpePathTemplate: ' /eivital/v1.04/auth ',
    ...plain,
  });

const fieldMapDto = (plain: Record<string, unknown> = {}) =>
  plainToInstance(SaveGstProviderFieldMapDto, {
    gfmGpeId: ENDPOINT_ID,
    gfmDirection: 'response',
    gfmOurField: ' auth_token ',
    gfmTheirPath: '$.Data.AuthToken',
    ...plain,
  });

const errorMapDto = (plain: Record<string, unknown> = {}) =>
  plainToInstance(SaveGstProviderErrorMapDto, {
    gemGpvId: PROVIDER_ID,
    gemTheirCode: ' 2150 ',
    gemOurCode: 'duplicate_irn',
    ...plain,
  });

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

const uniqueRace = (target: unknown) =>
  Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target } });

type RightName = 'view' | 'create' | 'edit' | 'delete';

/** The user_menus row the rights read returns, with every right but `denied` granted. */
const rightsRow = (...denied: RightName[]) => ({
  um_can_view: !denied.includes('view'),
  um_can_create: !denied.includes('create'),
  um_can_edit: !denied.includes('edit'),
  um_can_delete: !denied.includes('delete'),
});

type PrismaMock = {
  menu: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  gstProvider: { findUnique: jest.Mock };
  gstProviderService: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  gstProviderEndpoint: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
  gstProviderFieldMap: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  gstProviderErrorMap: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe('GstProviderPartsService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: GstProviderPartsService;

  beforeEach(() => {
    prisma = {
      menu: { findFirst: jest.fn().mockResolvedValue({ menuId: MENU_ID }) },
      $queryRaw: jest.fn().mockResolvedValue([rightsRow()]),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
      gstProvider: { findUnique: jest.fn().mockResolvedValue({ gpvIsDeleted: false }) },
      gstProviderService: {
        findUnique: jest.fn().mockResolvedValue(serviceRow()),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          serviceRow(asStored(data) as Partial<GstProviderService>),
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          serviceRow(asStored(data) as Partial<GstProviderService>),
        ),
      },
      gstProviderEndpoint: {
        findUnique: jest.fn().mockResolvedValue(endpointRow()),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          endpointRow(asStored(data) as Partial<GstProviderEndpoint>),
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          endpointRow(asStored(data) as Partial<GstProviderEndpoint>),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      gstProviderFieldMap: {
        findUnique: jest.fn().mockResolvedValue(fieldMapRow()),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          fieldMapRow(data as Partial<GstProviderFieldMap>),
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          fieldMapRow(data as Partial<GstProviderFieldMap>),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      gstProviderErrorMap: {
        findUnique: jest.fn().mockResolvedValue(errorMapRow()),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          errorMapRow(data as Partial<GstProviderErrorMap>),
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          errorMapRow(data as Partial<GstProviderErrorMap>),
        ),
      },
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    // The real support, so every route's rights gate runs as it does in the app.
    const support = new GstConfigSupport(
      prisma as unknown as PrismaService,
      context as never,
      audit as never,
      {} as never,
    );
    service = new GstProviderPartsService(prisma as unknown as PrismaService, support);
  });

  const dataOf = (mock: jest.Mock) =>
    (mock.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  // ── rights ──────────────────────────────────────────────────────────────────

  describe('rights on the GST Providers menu', () => {
    const CALLS: Array<[string, (s: GstProviderPartsService) => Promise<unknown>, RightName]> = [
      ['a new service', (s) => s.saveService(serviceDto()), 'create'],
      ['a service edit', (s) => s.saveService(serviceDto({ gpsId: SERVICE_ID })), 'edit'],
      ['a service delete', (s) => s.deleteService(SERVICE_ID), 'delete'],
      ['an endpoint read', (s) => s.getEndpoint(ENDPOINT_ID), 'view'],
      ['a new endpoint', (s) => s.saveEndpoint(endpointDto()), 'create'],
      ['an endpoint edit', (s) => s.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID })), 'edit'],
      ['an endpoint delete', (s) => s.deleteEndpoint(ENDPOINT_ID), 'delete'],
      ['a new field map', (s) => s.saveFieldMap(fieldMapDto()), 'create'],
      ['a field map edit', (s) => s.saveFieldMap(fieldMapDto({ gfmId: FIELD_MAP_ID })), 'edit'],
      ['a field map delete', (s) => s.deleteFieldMap(FIELD_MAP_ID), 'delete'],
      ['a new error map', (s) => s.saveErrorMap(errorMapDto()), 'create'],
      ['an error map edit', (s) => s.saveErrorMap(errorMapDto({ gemId: ERROR_MAP_ID })), 'edit'],
      ['an error map delete', (s) => s.deleteErrorMap(ERROR_MAP_ID), 'delete'],
    ];

    it.each(CALLS)('refuses %s without the %s right, before any read', async (_l, call, right) => {
      prisma.$queryRaw.mockResolvedValue([rightsRow(right)]);

      const refusal = await refusalOf(call(service));

      expect(refusal).toMatchObject({
        status: 403,
        body: {
          errors: [
            {
              field: 'userId',
              code: `GST_RIGHT_${right.toUpperCase()}`,
              message: expect.stringContaining(`menu ${MENU_ID}: um_can_${right} is not granted`),
            },
          ],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.gstProviderEndpoint.findUnique).not.toHaveBeenCalled();
    });

    it.each(CALLS)('lets %s through on the %s right alone', async (_l, call, right) => {
      const others = (['view', 'create', 'edit', 'delete'] as const).filter((r) => r !== right);
      prisma.$queryRaw.mockResolvedValue([rightsRow(...others)]);
      // The endpoint reads of /get and /delete include the service.
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue({
        ...endpointRow(),
        service: serviceRow(),
      });

      await expect(call(service)).resolves.toBeDefined();
    });

    it('finds the menu by parent and name, and reads the caller’s rights on it', async () => {
      await service.getEndpoint(ENDPOINT_ID).catch(() => undefined);

      expect(prisma.menu.findFirst).toHaveBeenCalledWith({
        where: { menuParentId: 60, menuName: 'GST Providers' },
        select: { menuId: true },
      });
      expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([USER_ID, MENU_ID]);
    });

    it('grants nobody anything while the menu row is missing', async () => {
      prisma.menu.findFirst.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([]);

      const refusal = await refusalOf(service.getEndpoint(ENDPOINT_ID));

      expect(refusal.status).toBe(403);
      expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([USER_ID, 0]);
    });

    it('grants a call with no logged-in user nothing, without reading rights', async () => {
      context.getUserId.mockReturnValue(null);

      const refusal = await refusalOf(service.deleteErrorMap(ERROR_MAP_ID));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: 'GST_RIGHT_DELETE' }] },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ── R2 services ─────────────────────────────────────────────────────────────

  describe('saveService — create (no gpsId)', () => {
    it('creates under a live provider with the column defaults, and audits it as New', async () => {
      const payload = await service.saveService(serviceDto());

      expect(prisma.gstProvider.findUnique).toHaveBeenCalledWith({
        where: { gpvId: PROVIDER_ID },
        select: { gpvIsDeleted: true },
      });
      expect(prisma.gstProviderService.findUnique).not.toHaveBeenCalled();
      expect(dataOf(prisma.gstProviderService.create)).toEqual({
        gpsService: 'EINVOICE',
        gpsEnvironment: 'SANDBOX',
        gpsBaseUrl: BASE_URL,
        gpsFallbackUrls: [],
        gpsAuthScheme: 'NIC_SEK',
        gpsTokenTtlMinutes: 360,
        gpsRefreshMarginMinutes: 15,
        gpsPayloadEncryption: 'NONE',
        gpsTimeoutMs: null,
        gpsMaxRetries: null,
        gpsRemarks: null,
        gpsIsActive: true,
        gpsGpvId: PROVIDER_ID,
        gpsCreatedBy: USER_ID,
      });
      expect(prisma.gstProviderEndpoint.count).toHaveBeenCalledWith({
        where: { gpeGpsId: SERVICE_ID, gpeIsDeleted: false },
      });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'New',
          tableName: 'gst provider service',
          screenName: 'GST Provider Service',
          pk: SERVICE_ID,
          displayName: 'EINVOICE SANDBOX',
          originalRecord: null,
          modifiedRecord: payload,
          userId: USER_ID,
          notes: 'GST provider service created',
        }),
        prisma,
      );
      expect(payload).toMatchObject({
        gpsId: SERVICE_ID,
        gpsGpvId: PROVIDER_ID,
        endpointCount: 0,
        createdOn: STAMP.toISOString(),
        modifiedOn: null,
      });
    });

    it('checks the service and environment only against the provider’s other live rows', async () => {
      await service.saveService(serviceDto());

      expect(prisma.gstProviderService.findFirst).toHaveBeenCalledWith({
        where: {
          gpsGpvId: PROVIDER_ID,
          gpsService: 'EINVOICE',
          gpsEnvironment: 'SANDBOX',
          gpsIsDeleted: false,
        },
        select: { gpsId: true },
      });
    });

    it('refuses a provider that does not exist', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.saveService(serviceDto()));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'GST provider not found',
          errors: [{ field: 'gpsGpvId', code: GST_CODES.NOT_FOUND }],
        },
      });
      expect(prisma.gstProviderService.create).not.toHaveBeenCalled();
    });

    it('refuses a deleted provider as a parent', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue({ gpvIsDeleted: true });

      const refusal = await refusalOf(service.saveService(serviceDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpsGpvId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it('refuses a refresh margin that is not below the token lifetime', async () => {
      const refusal = await refusalOf(
        service.saveService(serviceDto({ gpsTokenTtlMinutes: 30, gpsRefreshMarginMinutes: 30 })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'gpsRefreshMarginMinutes',
              message: 'must be below gpsTokenTtlMinutes (30): renewing that early renews forever',
              code: GST_CODES.REFRESH_MARGIN_TOO_LONG,
            },
          ],
        },
      });
      expect(prisma.gstProviderService.create).not.toHaveBeenCalled();
    });

    it('refuses a second live row for the same service and environment', async () => {
      prisma.gstProviderService.findFirst.mockResolvedValue({ gpsId: OTHER_SERVICE_ID });

      const refusal = await refusalOf(service.saveService(serviceDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gpsEnvironment',
              message: `The provider already has a live EINVOICE SANDBOX service (${OTHER_SERVICE_ID}).`,
              code: GST_CODES.SERVICE_DUPLICATE,
            },
          ],
        },
      });
      expect(prisma.gstProviderService.create).not.toHaveBeenCalled();
    });

    it('answers a unique-index race (P2002) with the same 409', async () => {
      prisma.gstProviderService.create.mockRejectedValue(
        uniqueRace(['gps_gpv_id', 'gps_service', 'gps_environment']),
      );

      const refusal = await refusalOf(service.saveService(serviceDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gpsEnvironment',
              message: 'The provider already has a live EINVOICE SANDBOX service.',
              code: GST_CODES.SERVICE_DUPLICATE,
            },
          ],
        },
      });
    });

    it('turns a CHECK refusal into a 400 on the field it guards', async () => {
      prisma.gstProviderService.create.mockRejectedValue(
        Object.assign(new Error('raw'), {
          meta: {
            code: '23514',
            message: 'new row violates check constraint "ck_gps_base_url"',
          },
        }),
      );

      const refusal = await refusalOf(service.saveService(serviceDto()));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'gpsBaseUrl', message: 'refused by ck_gps_base_url', code: GST_CODES.CHECK },
          ],
        },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.gstProviderService.create.mockRejectedValue(failure);

      await expect(service.saveService(serviceDto())).rejects.toBe(failure);
    });
  });

  describe('saveService — update (gpsId present)', () => {
    it('refuses an id that names no service', async () => {
      prisma.gstProviderService.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.saveService(serviceDto({ gpsId: SERVICE_ID })));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'GST provider service not found',
          errors: [
            {
              field: 'gpsId',
              message: `No gst provider service found with id ${SERVICE_ID}`,
              code: GST_CODES.NOT_FOUND,
            },
          ],
        },
      });
    });

    it('refuses to edit a deleted service', async () => {
      prisma.gstProviderService.findUnique.mockResolvedValue(serviceRow({ gpsIsDeleted: true }));

      const refusal = await refusalOf(service.saveService(serviceDto({ gpsId: SERVICE_ID })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpsId', code: GST_CODES.ALREADY_DELETED }] },
      });
      expect(prisma.gstProviderService.update).not.toHaveBeenCalled();
    });

    it('refuses to move a service to another provider', async () => {
      const refusal = await refusalOf(
        service.saveService(serviceDto({ gpsId: SERVICE_ID, gpsGpvId: OTHER_PROVIDER_ID })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gpsGpvId',
              message: `This row belongs to provider ${PROVIDER_ID}. Create a new row under the other parent instead.`,
              code: GST_CODES.PARENT_FIXED,
            },
          ],
        },
      });
    });

    it('keeps what the update leaves out and clears what it sends as null', async () => {
      prisma.gstProviderService.findUnique.mockResolvedValue(
        serviceRow({
          gpsFallbackUrls: ['https://backup.example'],
          gpsTokenTtlMinutes: 120,
          gpsRefreshMarginMinutes: 10,
          gpsPayloadEncryption: 'AES_SEK',
          gpsTimeoutMs: 5000,
          gpsMaxRetries: 2,
          gpsRemarks: 'night host',
          gpsIsActive: false,
        }),
      );

      await service.saveService(
        serviceDto({ gpsId: SERVICE_ID, gpsTimeoutMs: null, gpsRemarks: null }),
      );

      expect(prisma.gstProviderService.update).toHaveBeenCalledWith({
        where: { gpsId: SERVICE_ID },
        data: {
          gpsService: 'EINVOICE',
          gpsEnvironment: 'SANDBOX',
          gpsBaseUrl: BASE_URL,
          gpsFallbackUrls: ['https://backup.example'],
          gpsAuthScheme: 'NIC_SEK',
          gpsTokenTtlMinutes: 120,
          gpsRefreshMarginMinutes: 10,
          gpsPayloadEncryption: 'AES_SEK',
          gpsTimeoutMs: null,
          gpsMaxRetries: 2,
          gpsRemarks: null,
          gpsIsActive: false,
          gpsModifiedOn: expect.any(Date),
          gpsModifiedBy: USER_ID,
        },
      });
      expect(prisma.gstProviderService.create).not.toHaveBeenCalled();
    });

    it('clears the fallback hosts when they are sent as null', async () => {
      prisma.gstProviderService.findUnique.mockResolvedValue(
        serviceRow({ gpsFallbackUrls: ['https://backup.example'] }),
      );

      await service.saveService(serviceDto({ gpsId: SERVICE_ID, gpsFallbackUrls: null }));

      expect(dataOf(prisma.gstProviderService.update).gpsFallbackUrls).toEqual([]);
    });

    it('measures a new margin against the stored token lifetime', async () => {
      prisma.gstProviderService.findUnique.mockResolvedValue(
        serviceRow({ gpsTokenTtlMinutes: 60, gpsRefreshMarginMinutes: 10 }),
      );

      const refusal = await refusalOf(
        service.saveService(serviceDto({ gpsId: SERVICE_ID, gpsRefreshMarginMinutes: 90 })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              message: 'must be below gpsTokenTtlMinutes (60): renewing that early renews forever',
              code: GST_CODES.REFRESH_MARGIN_TOO_LONG,
            },
          ],
        },
      });
    });

    it('checks for a duplicate among every live row but itself', async () => {
      await service.saveService(serviceDto({ gpsId: SERVICE_ID }));

      expect(prisma.gstProviderService.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gpsId: { not: SERVICE_ID } }) as object,
        }),
      );
    });

    it('audits the before and after with the live endpoint count', async () => {
      prisma.gstProviderService.findUnique.mockResolvedValue(serviceRow({ gpsRemarks: 'old' }));
      prisma.gstProviderEndpoint.count.mockResolvedValue(4);

      const payload = await service.saveService(
        serviceDto({ gpsId: SERVICE_ID, gpsRemarks: 'new' }),
      );

      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: SERVICE_ID,
        originalRecord: expect.objectContaining({ gpsRemarks: 'old', endpointCount: 4 }),
        modifiedRecord: payload,
        notes: 'GST provider service updated',
      });
      expect(payload).toMatchObject({ gpsRemarks: 'new', endpointCount: 4 });
    });
  });

  describe('deleteService', () => {
    it('refuses an id that names no service', async () => {
      prisma.gstProviderService.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.deleteService(SERVICE_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpsId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses a service that is already deleted', async () => {
      prisma.gstProviderService.findUnique.mockResolvedValue(serviceRow({ gpsIsDeleted: true }));

      const refusal = await refusalOf(service.deleteService(SERVICE_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'GST provider service is already deleted',
          errors: [
            { field: 'gpsId', message: 'Nothing to delete.', code: GST_CODES.ALREADY_DELETED },
          ],
        },
      });
      expect(prisma.gstProviderService.update).not.toHaveBeenCalled();
    });

    it('takes its live endpoints and their field maps with it, at one moment', async () => {
      prisma.gstProviderEndpoint.findMany.mockResolvedValue([
        { gpeId: ENDPOINT_ID },
        { gpeId: OTHER_ENDPOINT_ID },
      ]);

      await expect(service.deleteService(SERVICE_ID)).resolves.toEqual({
        gpsId: SERVICE_ID,
        deleted: true,
        endpointsDeleted: 2,
      });

      expect(prisma.gstProviderEndpoint.findMany).toHaveBeenCalledWith({
        where: { gpeGpsId: SERVICE_ID, gpeIsDeleted: false },
        select: { gpeId: true },
      });
      const fieldMaps = prisma.gstProviderFieldMap.updateMany.mock.calls[0][0] as {
        where: unknown;
        data: Record<string, unknown>;
      };
      const endpoints = prisma.gstProviderEndpoint.updateMany.mock.calls[0][0] as {
        where: unknown;
        data: Record<string, unknown>;
      };
      expect(fieldMaps.where).toEqual({
        gfmGpeId: { in: [ENDPOINT_ID, OTHER_ENDPOINT_ID] },
        gfmIsDeleted: false,
      });
      expect(endpoints.where).toEqual({ gpeId: { in: [ENDPOINT_ID, OTHER_ENDPOINT_ID] } });
      expect(prisma.gstProviderService.update).toHaveBeenCalledWith({
        where: { gpsId: SERVICE_ID },
        data: { gpsIsDeleted: true, gpsModifiedOn: expect.any(Date), gpsModifiedBy: USER_ID },
      });
      const serviceData = dataOf(prisma.gstProviderService.update);
      expect(fieldMaps.data.gfmModifiedOn).toBe(serviceData.gpsModifiedOn);
      expect(endpoints.data.gpeModifiedOn).toBe(serviceData.gpsModifiedOn);
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'EINVOICE SANDBOX',
        originalRecord: expect.objectContaining({ gpsIsDeleted: false, endpointCount: 2 }),
        modifiedRecord: expect.objectContaining({ gpsIsDeleted: true, endpointCount: 0 }),
        notes: 'GST provider service soft deleted, with 2 endpoint(s)',
      });
    });

    it('touches no endpoint or field map when the service has none', async () => {
      await expect(service.deleteService(SERVICE_ID)).resolves.toMatchObject({
        endpointsDeleted: 0,
      });

      expect(prisma.gstProviderFieldMap.updateMany).not.toHaveBeenCalled();
      expect(prisma.gstProviderEndpoint.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── R3 endpoints ────────────────────────────────────────────────────────────

  describe('getEndpoint', () => {
    it('refuses an id that names no endpoint', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.getEndpoint(ENDPOINT_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpeId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('answers a deleted endpoint too, with its service and its live field map in order', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue({
        ...endpointRow({ gpeIsDeleted: true, gpeHeaders: { Gstin: '{gstin}' } }),
        service: serviceRow(),
      });
      prisma.gstProviderFieldMap.findMany.mockResolvedValue([fieldMapRow()]);

      const payload = await service.getEndpoint(ENDPOINT_ID);

      expect(prisma.gstProviderEndpoint.findUnique).toHaveBeenCalledWith({
        where: { gpeId: ENDPOINT_ID },
        include: { service: true },
      });
      expect(prisma.gstProviderFieldMap.findMany).toHaveBeenCalledWith({
        where: { gfmGpeId: ENDPOINT_ID, gfmIsDeleted: false },
        orderBy: [{ gfmDirection: 'asc' }, { gfmSortOrder: 'asc' }, { gfmOurField: 'asc' }],
      });
      expect(payload).toMatchObject({
        gpeId: ENDPOINT_ID,
        gpvId: PROVIDER_ID,
        gpsService: 'EINVOICE',
        gpsEnvironment: 'SANDBOX',
        gpeIsDeleted: true,
        gpeHeaders: { Gstin: '{gstin}' },
        fieldMaps: [{ gfmId: FIELD_MAP_ID, gfmOurField: 'auth_token' }],
      });
    });
  });

  describe('saveEndpoint — create (no gpeId)', () => {
    it('creates under a live service with the column defaults', async () => {
      const payload = await service.saveEndpoint(endpointDto());

      expect(prisma.gstProviderService.findUnique).toHaveBeenCalledWith({
        where: { gpsId: SERVICE_ID },
      });
      expect(prisma.gstProvider.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { gpvId: PROVIDER_ID } }),
      );
      expect(dataOf(prisma.gstProviderEndpoint.create)).toEqual({
        gpeAction: 'AUTH',
        gpeHttpMethod: 'POST',
        gpePathTemplate: '/eivital/v1.04/auth',
        gpeQueryTemplate: null,
        gpeContentType: 'application/json',
        gpeHeaders: Prisma.DbNull,
        gpeRequestWrapper: null,
        gpeRedactPaths: Prisma.DbNull,
        gpeResponseRootPath: null,
        gpeSuccessPath: null,
        gpeSuccessValue: null,
        gpeErrorCodePath: null,
        gpeErrorMessagePath: null,
        gpeTimeoutMs: null,
        gpeMaxRetries: null,
        gpeIsIdempotent: false,
        gpeRemarks: null,
        gpeIsActive: true,
        gpeGpsId: SERVICE_ID,
        gpeCreatedBy: USER_ID,
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'gst provider endpoint',
        screenName: 'GST Provider Endpoint',
        pk: ENDPOINT_ID,
        displayName: 'EINVOICE SANDBOX AUTH',
        originalRecord: null,
        notes: 'GST provider endpoint created',
      });
      expect(payload).toMatchObject({ gpeId: ENDPOINT_ID, gpeHeaders: null, fieldMaps: [] });
    });

    it('answers with the endpoint’s live field map, as /get does', async () => {
      prisma.gstProviderFieldMap.findMany.mockResolvedValue([fieldMapRow()]);

      const payload = await service.saveEndpoint(endpointDto());

      expect(prisma.gstProviderFieldMap.findMany).toHaveBeenCalledWith({
        where: { gfmGpeId: ENDPOINT_ID, gfmIsDeleted: false },
        orderBy: [{ gfmDirection: 'asc' }, { gfmSortOrder: 'asc' }, { gfmOurField: 'asc' }],
      });
      expect(payload.fieldMaps).toEqual([expect.objectContaining({ gfmId: FIELD_MAP_ID })]);
    });

    it.each([
      [
        'whose service does not exist',
        () => prisma.gstProviderService.findUnique.mockResolvedValue(null),
        404,
        GST_CODES.NOT_FOUND,
        'GST provider service not found',
      ],
      [
        'whose service is deleted',
        () =>
          prisma.gstProviderService.findUnique.mockResolvedValue(
            serviceRow({ gpsIsDeleted: true }),
          ),
        409,
        GST_CODES.ALREADY_DELETED,
        'GST provider service is deleted',
      ],
      [
        'whose service’s provider is deleted',
        () => prisma.gstProvider.findUnique.mockResolvedValue({ gpvIsDeleted: true }),
        409,
        GST_CODES.ALREADY_DELETED,
        'GST provider is deleted',
      ],
    ])('refuses an endpoint %s', async (_label, arrange, status, code, message) => {
      arrange();

      const refusal = await refusalOf(service.saveEndpoint(endpointDto()));

      expect(refusal).toMatchObject({
        status,
        body: { message, errors: [{ field: 'gpeGpsId', code }] },
      });
      expect(prisma.gstProviderEndpoint.create).not.toHaveBeenCalled();
    });

    it('stores headers as an object of string templates', async () => {
      await service.saveEndpoint(
        endpointDto({ gpeHeaders: { Gstin: '{gstin}', user_name: '{loginId}' } }),
      );

      expect(dataOf(prisma.gstProviderEndpoint.create).gpeHeaders).toEqual({
        Gstin: '{gstin}',
        user_name: '{loginId}',
      });
    });

    it('refuses each header with a blank name or a value that is not a string', async () => {
      const refusal = await refusalOf(
        service.saveEndpoint(endpointDto({ gpeHeaders: { ' ': '{gstin}', Gstin: 5, ok: 'x' } })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'gpeHeaders. ', code: GST_CODES.HEADER_INVALID },
            { field: 'gpeHeaders.Gstin', code: GST_CODES.HEADER_INVALID },
          ],
        },
      });
      expect((refusal.body as { errors: unknown[] }).errors).toHaveLength(2);
    });

    it.each([
      [{ gpeSuccessPath: '$.Status' }, 'gpeSuccessValue'],
      [{ gpeSuccessValue: '1' }, 'gpeSuccessPath'],
    ])('refuses half of the success pair (%o), naming the missing half', async (half, field) => {
      const refusal = await refusalOf(service.saveEndpoint(endpointDto(half)));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field,
              message: 'gpeSuccessPath and gpeSuccessValue are set together, or neither',
              code: GST_CODES.PAIR_INCOMPLETE,
            },
          ],
        },
      });
    });

    it('stores the success pair when both halves are sent', async () => {
      await service.saveEndpoint(endpointDto({ gpeSuccessPath: '$.Status', gpeSuccessValue: '1' }));

      expect(dataOf(prisma.gstProviderEndpoint.create)).toMatchObject({
        gpeSuccessPath: '$.Status',
        gpeSuccessValue: '1',
      });
    });

    it('refuses a second live endpoint for the same action', async () => {
      prisma.gstProviderEndpoint.findFirst.mockResolvedValue({ gpeId: OTHER_ENDPOINT_ID });

      const refusal = await refusalOf(service.saveEndpoint(endpointDto()));

      expect(prisma.gstProviderEndpoint.findFirst).toHaveBeenCalledWith({
        where: { gpeGpsId: SERVICE_ID, gpeAction: 'AUTH', gpeIsDeleted: false },
        select: { gpeId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gpeAction',
              message: `The service already has a live AUTH endpoint (${OTHER_ENDPOINT_ID}).`,
              code: GST_CODES.ENDPOINT_DUPLICATE,
            },
          ],
        },
      });
    });

    it('answers a unique-index race (P2002) with the same 409', async () => {
      prisma.gstProviderEndpoint.create.mockRejectedValue(uniqueRace('ux_gpe_service_action'));

      const refusal = await refusalOf(service.saveEndpoint(endpointDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpeAction', code: GST_CODES.ENDPOINT_DUPLICATE }] },
      });
    });
  });

  describe('saveEndpoint — update (gpeId present)', () => {
    const storedEndpoint = () =>
      endpointRow({
        gpeHttpMethod: 'GET',
        gpeHeaders: { Gstin: '{gstin}' },
        gpeRedactPaths: ['$.Password'],
        gpeSuccessPath: '$.Status',
        gpeSuccessValue: '1',
        gpeIsIdempotent: true,
        gpeRemarks: 'sandbox',
      });

    it('refuses an id that names no endpoint', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpeId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses to edit a deleted endpoint', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(endpointRow({ gpeIsDeleted: true }));

      const refusal = await refusalOf(service.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpeId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it('refuses to move an endpoint to another service', async () => {
      const refusal = await refusalOf(
        service.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID, gpeGpsId: OTHER_SERVICE_ID })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gpeGpsId', code: GST_CODES.PARENT_FIXED }] },
      });
    });

    it('keeps the stored headers, redact paths and success pair when the update leaves them out', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(storedEndpoint());

      await service.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID }));

      expect(prisma.gstProviderEndpoint.update).toHaveBeenCalledWith({
        where: { gpeId: ENDPOINT_ID },
        data: expect.objectContaining({
          gpeHttpMethod: 'GET',
          gpeHeaders: { Gstin: '{gstin}' },
          gpeRedactPaths: ['$.Password'],
          gpeSuccessPath: '$.Status',
          gpeSuccessValue: '1',
          gpeIsIdempotent: true,
          gpeRemarks: 'sandbox',
          gpeModifiedOn: expect.any(Date),
          gpeModifiedBy: USER_ID,
        }) as object,
      });
      expect(prisma.gstProviderEndpoint.create).not.toHaveBeenCalled();
    });

    it('clears what the update sends as null', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(storedEndpoint());

      await service.saveEndpoint(
        endpointDto({
          gpeId: ENDPOINT_ID,
          gpeHeaders: null,
          gpeRedactPaths: null,
          gpeSuccessPath: null,
          gpeSuccessValue: null,
          gpeRemarks: null,
        }),
      );

      expect(dataOf(prisma.gstProviderEndpoint.update)).toMatchObject({
        gpeHeaders: Prisma.DbNull,
        gpeRedactPaths: Prisma.DbNull,
        gpeSuccessPath: null,
        gpeSuccessValue: null,
        gpeRemarks: null,
      });
    });

    it('refuses clearing one half of the stored success pair', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(storedEndpoint());

      const refusal = await refusalOf(
        service.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID, gpeSuccessPath: null })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'gpeSuccessPath', code: GST_CODES.PAIR_INCOMPLETE }] },
      });
      expect(prisma.gstProviderEndpoint.update).not.toHaveBeenCalled();
    });

    it('checks the stored headers again, so a bad stored one cannot ride along', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(
        endpointRow({ gpeHeaders: { Gstin: 7 } }),
      );

      const refusal = await refusalOf(service.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'gpeHeaders.Gstin', code: GST_CODES.HEADER_INVALID }] },
      });
    });

    it('checks for a duplicate action among every live endpoint but itself', async () => {
      await service.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID }));

      expect(prisma.gstProviderEndpoint.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gpeId: { not: ENDPOINT_ID } }) as object,
        }),
      );
    });

    it('audits the before and after', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(storedEndpoint());

      await service.saveEndpoint(endpointDto({ gpeId: ENDPOINT_ID, gpeRemarks: 'production' }));

      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: ENDPOINT_ID,
        displayName: 'EINVOICE SANDBOX AUTH',
        originalRecord: expect.objectContaining({ gpeRemarks: 'sandbox' }),
        modifiedRecord: expect.objectContaining({ gpeRemarks: 'production' }),
        notes: 'GST provider endpoint updated',
      });
    });
  });

  describe('deleteEndpoint', () => {
    beforeEach(() => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue({
        ...endpointRow(),
        service: serviceRow(),
      });
    });

    it('refuses an id that names no endpoint', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.deleteEndpoint(ENDPOINT_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gpeId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses an endpoint that is already deleted', async () => {
      prisma.gstProviderEndpoint.findUnique.mockResolvedValue({
        ...endpointRow({ gpeIsDeleted: true }),
        service: serviceRow(),
      });

      const refusal = await refusalOf(service.deleteEndpoint(ENDPOINT_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'GST provider endpoint is already deleted',
          errors: [{ field: 'gpeId', code: GST_CODES.ALREADY_DELETED }],
        },
      });
      expect(prisma.gstProviderFieldMap.updateMany).not.toHaveBeenCalled();
    });

    it('takes its live field map with it and says how many rows went', async () => {
      prisma.gstProviderFieldMap.updateMany.mockResolvedValue({ count: 3 });
      prisma.gstProviderEndpoint.update.mockResolvedValue(endpointRow({ gpeIsDeleted: true }));

      await expect(service.deleteEndpoint(ENDPOINT_ID)).resolves.toEqual({
        gpeId: ENDPOINT_ID,
        deleted: true,
        fieldMapsDeleted: 3,
      });

      expect(prisma.gstProviderFieldMap.updateMany).toHaveBeenCalledWith({
        where: { gfmGpeId: ENDPOINT_ID, gfmIsDeleted: false },
        data: { gfmIsDeleted: true, gfmModifiedOn: expect.any(Date), gfmModifiedBy: USER_ID },
      });
      expect(prisma.gstProviderEndpoint.update).toHaveBeenCalledWith({
        where: { gpeId: ENDPOINT_ID },
        data: { gpeIsDeleted: true, gpeModifiedOn: expect.any(Date), gpeModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'EINVOICE SANDBOX AUTH',
        originalRecord: expect.objectContaining({ gpeIsDeleted: false }),
        modifiedRecord: expect.objectContaining({ gpeIsDeleted: true }),
        notes: 'GST provider endpoint soft deleted, with 3 field map row(s)',
      });
    });
  });

  // ── R4 field maps ───────────────────────────────────────────────────────────

  describe('saveFieldMap — create (no gfmId)', () => {
    it('creates under a live endpoint with the column defaults', async () => {
      const payload = await service.saveFieldMap(fieldMapDto());

      expect(prisma.gstProviderEndpoint.findUnique).toHaveBeenCalledWith({
        where: { gpeId: ENDPOINT_ID },
      });
      expect(dataOf(prisma.gstProviderFieldMap.create)).toEqual({
        gfmDirection: 'RESPONSE',
        gfmOurField: 'auth_token',
        gfmTheirPath: '$.Data.AuthToken',
        gfmDataType: 'TEXT',
        gfmTransform: 'NONE',
        gfmFormatMask: null,
        gfmIsRequired: false,
        gfmDefaultValue: null,
        gfmTargetColumn: null,
        gfmSortOrder: 0,
        gfmGpeId: ENDPOINT_ID,
        gfmCreatedBy: USER_ID,
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'gst provider field map',
        screenName: 'GST Provider Field Map',
        pk: FIELD_MAP_ID,
        displayName: 'RESPONSE auth_token',
        originalRecord: null,
        modifiedRecord: payload,
      });
    });

    it.each([
      [
        'whose endpoint does not exist',
        () => prisma.gstProviderEndpoint.findUnique.mockResolvedValue(null),
        404,
        'GST provider endpoint not found',
      ],
      [
        'whose endpoint is deleted',
        () =>
          prisma.gstProviderEndpoint.findUnique.mockResolvedValue(
            endpointRow({ gpeIsDeleted: true }),
          ),
        409,
        'GST provider endpoint is deleted',
      ],
      [
        'whose endpoint’s service is deleted',
        () =>
          prisma.gstProviderService.findUnique.mockResolvedValue(
            serviceRow({ gpsIsDeleted: true }),
          ),
        409,
        'GST provider service is deleted',
      ],
    ])('refuses a field map %s', async (_label, arrange, status, message) => {
      arrange();

      const refusal = await refusalOf(service.saveFieldMap(fieldMapDto()));

      expect(refusal).toMatchObject({
        status,
        body: { message, errors: [{ field: 'gfmGpeId' }] },
      });
      expect(prisma.gstProviderFieldMap.create).not.toHaveBeenCalled();
    });

    it('refuses a required field that carries a default, and a mask transform with no mask, together', async () => {
      const refusal = await refusalOf(
        service.saveFieldMap(
          fieldMapDto({
            gfmIsRequired: true,
            gfmDefaultValue: 'NA',
            gfmTransform: 'datetime_mask',
          }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'gfmDefaultValue', code: GST_CODES.REQUIRED_FIELD_DEFAULT },
            { field: 'gfmFormatMask', code: GST_CODES.FORMAT_MASK_REQUIRED },
          ],
        },
      });
    });

    it('stores a mask transform with its mask', async () => {
      await service.saveFieldMap(
        fieldMapDto({ gfmTransform: 'datetime_mask', gfmFormatMask: 'dd/MM/yyyy hh:mm:ss tt' }),
      );

      expect(dataOf(prisma.gstProviderFieldMap.create)).toMatchObject({
        gfmTransform: 'DATETIME_MASK',
        gfmFormatMask: 'dd/MM/yyyy hh:mm:ss tt',
      });
    });

    it('refuses a second live row for the same direction and field', async () => {
      prisma.gstProviderFieldMap.findFirst.mockResolvedValue({ gfmId: OTHER_FIELD_MAP_ID });

      const refusal = await refusalOf(service.saveFieldMap(fieldMapDto()));

      expect(prisma.gstProviderFieldMap.findFirst).toHaveBeenCalledWith({
        where: {
          gfmGpeId: ENDPOINT_ID,
          gfmDirection: 'RESPONSE',
          gfmOurField: 'auth_token',
          gfmIsDeleted: false,
        },
        select: { gfmId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gfmOurField',
              message: `The endpoint already maps RESPONSE auth_token (${OTHER_FIELD_MAP_ID}).`,
              code: GST_CODES.FIELD_MAP_DUPLICATE,
            },
          ],
        },
      });
    });

    it('answers a unique-index race (P2002) with the same 409', async () => {
      prisma.gstProviderFieldMap.create.mockRejectedValue(uniqueRace('ux_gfm_endpoint_field'));

      const refusal = await refusalOf(service.saveFieldMap(fieldMapDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gfmOurField', code: GST_CODES.FIELD_MAP_DUPLICATE }] },
      });
    });
  });

  describe('saveFieldMap — update (gfmId present)', () => {
    it('refuses an id that names no field map', async () => {
      prisma.gstProviderFieldMap.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.saveFieldMap(fieldMapDto({ gfmId: FIELD_MAP_ID })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gfmId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses to edit a deleted field map', async () => {
      prisma.gstProviderFieldMap.findUnique.mockResolvedValue(fieldMapRow({ gfmIsDeleted: true }));

      const refusal = await refusalOf(service.saveFieldMap(fieldMapDto({ gfmId: FIELD_MAP_ID })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gfmId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it('refuses to move a field map to another endpoint', async () => {
      const refusal = await refusalOf(
        service.saveFieldMap(fieldMapDto({ gfmId: FIELD_MAP_ID, gfmGpeId: OTHER_ENDPOINT_ID })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gfmGpeId', code: GST_CODES.PARENT_FIXED }] },
      });
    });

    it('judges a newly required field against the default it keeps', async () => {
      prisma.gstProviderFieldMap.findUnique.mockResolvedValue(
        fieldMapRow({ gfmDefaultValue: 'NA' }),
      );

      const refusal = await refusalOf(
        service.saveFieldMap(fieldMapDto({ gfmId: FIELD_MAP_ID, gfmIsRequired: true })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'gfmDefaultValue', code: GST_CODES.REQUIRED_FIELD_DEFAULT }] },
      });
    });

    it('lets a field turn required when the same save clears its default', async () => {
      prisma.gstProviderFieldMap.findUnique.mockResolvedValue(
        fieldMapRow({ gfmDefaultValue: 'NA', gfmSortOrder: 4, gfmDataType: 'DATE' }),
      );

      await service.saveFieldMap(
        fieldMapDto({ gfmId: FIELD_MAP_ID, gfmIsRequired: true, gfmDefaultValue: null }),
      );

      expect(prisma.gstProviderFieldMap.update).toHaveBeenCalledWith({
        where: { gfmId: FIELD_MAP_ID },
        data: expect.objectContaining({
          gfmIsRequired: true,
          gfmDefaultValue: null,
          gfmSortOrder: 4,
          gfmDataType: 'DATE',
          gfmModifiedOn: expect.any(Date),
          gfmModifiedBy: USER_ID,
        }) as object,
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ gfmDefaultValue: 'NA' }),
        notes: 'GST provider field map updated',
      });
    });

    it('refuses clearing the mask a stored mask transform needs', async () => {
      prisma.gstProviderFieldMap.findUnique.mockResolvedValue(
        fieldMapRow({ gfmTransform: 'DATETIME_MASK', gfmFormatMask: 'dd/MM/yyyy' }),
      );

      const refusal = await refusalOf(
        service.saveFieldMap(fieldMapDto({ gfmId: FIELD_MAP_ID, gfmFormatMask: null })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'gfmFormatMask', code: GST_CODES.FORMAT_MASK_REQUIRED }] },
      });
    });

    it('checks for a duplicate among every live row but itself', async () => {
      await service.saveFieldMap(fieldMapDto({ gfmId: FIELD_MAP_ID }));

      expect(prisma.gstProviderFieldMap.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gfmId: { not: FIELD_MAP_ID } }) as object,
        }),
      );
    });
  });

  describe('deleteFieldMap', () => {
    it('refuses an id that names no field map', async () => {
      prisma.gstProviderFieldMap.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.deleteFieldMap(FIELD_MAP_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gfmId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses a field map that is already deleted', async () => {
      prisma.gstProviderFieldMap.findUnique.mockResolvedValue(fieldMapRow({ gfmIsDeleted: true }));

      const refusal = await refusalOf(service.deleteFieldMap(FIELD_MAP_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gfmId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it('marks the row deleted and audits it as a cancel', async () => {
      await expect(service.deleteFieldMap(FIELD_MAP_ID)).resolves.toEqual({
        gfmId: FIELD_MAP_ID,
        deleted: true,
      });

      expect(prisma.gstProviderFieldMap.update).toHaveBeenCalledWith({
        where: { gfmId: FIELD_MAP_ID },
        data: { gfmIsDeleted: true, gfmModifiedOn: expect.any(Date), gfmModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'RESPONSE auth_token',
        originalRecord: expect.objectContaining({ gfmIsDeleted: false }),
        modifiedRecord: expect.objectContaining({ gfmIsDeleted: true }),
        notes: 'GST provider field map soft deleted',
      });
    });
  });

  // ── R5 error maps ───────────────────────────────────────────────────────────

  describe('saveErrorMap — create (no gemId)', () => {
    it('creates for every service of a live provider, with the column defaults', async () => {
      const payload = await service.saveErrorMap(errorMapDto());

      expect(dataOf(prisma.gstProviderErrorMap.create)).toEqual({
        gemService: null,
        gemTheirCode: '2150',
        gemOurCode: 'DUPLICATE_IRN',
        gemMessage: null,
        gemTreatAs: 'ERROR',
        gemExtractPath: null,
        gemCanonicalField: null,
        gemIsRetryable: false,
        gemRetryAfterSeconds: null,
        gemShouldReauth: false,
        gemRecoveryAction: 'NONE',
        gemSeverity: 'ERROR',
        gemGpvId: PROVIDER_ID,
        gemCreatedBy: USER_ID,
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'gst provider error map',
        screenName: 'GST Provider Error Map',
        pk: ERROR_MAP_ID,
        displayName: '2150 → DUPLICATE_IRN',
        originalRecord: null,
        modifiedRecord: payload,
      });
    });

    it('refuses a provider that does not exist', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.saveErrorMap(errorMapDto()));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gemGpvId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses a deleted provider as a parent', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue({ gpvIsDeleted: true });

      const refusal = await refusalOf(service.saveErrorMap(errorMapDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gemGpvId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it.each([
      [{}, ['gemExtractPath', 'gemCanonicalField']],
      [{ gemExtractPath: '$.ErrorDetails[0].InfoDtls.Irn' }, ['gemCanonicalField']],
      [{ gemCanonicalField: 'irn' }, ['gemExtractPath']],
    ])(
      'refuses a treat-as SUCCESS row that does not say what to take (%o)',
      async (plain, fields) => {
        const refusal = await refusalOf(
          service.saveErrorMap(errorMapDto({ gemTreatAs: 'success', ...plain })),
        );

        expect(refusal.status).toBe(400);
        expect((refusal.body as { errors: { field: string; code: string }[] }).errors).toEqual(
          fields.map((field) =>
            expect.objectContaining({ field, code: GST_CODES.SUCCESS_MAPPING_INCOMPLETE }),
          ),
        );
      },
    );

    it('stores a treat-as SUCCESS row that says where the value is and what it becomes', async () => {
      await service.saveErrorMap(
        errorMapDto({
          gemTreatAs: 'success',
          gemExtractPath: '$.ErrorDetails[0].InfoDtls.Irn',
          gemCanonicalField: 'irn',
        }),
      );

      expect(dataOf(prisma.gstProviderErrorMap.create)).toMatchObject({
        gemTreatAs: 'SUCCESS',
        gemExtractPath: '$.ErrorDetails[0].InfoDtls.Irn',
        gemCanonicalField: 'irn',
      });
    });

    it.each([
      [{}, null, 'every service'],
      [{ gemService: 'einvoice' }, 'EINVOICE', 'EINVOICE'],
    ])(
      'refuses a code already mapped for the same service (%o)',
      async (plain, gemService, words) => {
        prisma.gstProviderErrorMap.findFirst.mockResolvedValue({ gemId: OTHER_ERROR_MAP_ID });

        const refusal = await refusalOf(service.saveErrorMap(errorMapDto(plain)));

        expect(prisma.gstProviderErrorMap.findFirst).toHaveBeenCalledWith({
          where: {
            gemGpvId: PROVIDER_ID,
            gemService,
            gemTheirCode: '2150',
            gemIsDeleted: false,
          },
          select: { gemId: true },
        });
        expect(refusal).toMatchObject({
          status: 409,
          body: {
            errors: [
              {
                field: 'gemTheirCode',
                message: `Code 2150 is already mapped for ${words} (${OTHER_ERROR_MAP_ID}).`,
                code: GST_CODES.ERROR_MAP_DUPLICATE,
              },
            ],
          },
        });
      },
    );

    it('answers a unique-index race (P2002) with the same 409', async () => {
      prisma.gstProviderErrorMap.create.mockRejectedValue(uniqueRace('ux_gem_provider_code'));

      const refusal = await refusalOf(service.saveErrorMap(errorMapDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gemTheirCode', code: GST_CODES.ERROR_MAP_DUPLICATE }] },
      });
    });
  });

  describe('saveErrorMap — update (gemId present)', () => {
    it('refuses an id that names no error map', async () => {
      prisma.gstProviderErrorMap.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.saveErrorMap(errorMapDto({ gemId: ERROR_MAP_ID })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gemId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses to edit a deleted error map', async () => {
      prisma.gstProviderErrorMap.findUnique.mockResolvedValue(errorMapRow({ gemIsDeleted: true }));

      const refusal = await refusalOf(service.saveErrorMap(errorMapDto({ gemId: ERROR_MAP_ID })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gemId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it('refuses to move an error map to another provider', async () => {
      const refusal = await refusalOf(
        service.saveErrorMap(errorMapDto({ gemId: ERROR_MAP_ID, gemGpvId: OTHER_PROVIDER_ID })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gemGpvId', code: GST_CODES.PARENT_FIXED }] },
      });
    });

    it('keeps the stored service when the update leaves it out, in the check and the write', async () => {
      prisma.gstProviderErrorMap.findUnique.mockResolvedValue(
        errorMapRow({ gemService: 'EINVOICE', gemSeverity: 'WARN', gemIsRetryable: true }),
      );

      await service.saveErrorMap(errorMapDto({ gemId: ERROR_MAP_ID }));

      expect(prisma.gstProviderErrorMap.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gemService: 'EINVOICE',
            gemId: { not: ERROR_MAP_ID },
          }) as object,
        }),
      );
      expect(prisma.gstProviderErrorMap.update).toHaveBeenCalledWith({
        where: { gemId: ERROR_MAP_ID },
        data: expect.objectContaining({
          gemService: 'EINVOICE',
          gemSeverity: 'WARN',
          gemIsRetryable: true,
          gemModifiedOn: expect.any(Date),
          gemModifiedBy: USER_ID,
        }) as object,
      });
    });

    it('widens the row to every service when the update sends gemService null', async () => {
      prisma.gstProviderErrorMap.findUnique.mockResolvedValue(
        errorMapRow({ gemService: 'EINVOICE' }),
      );

      await service.saveErrorMap(errorMapDto({ gemId: ERROR_MAP_ID, gemService: null }));

      expect(dataOf(prisma.gstProviderErrorMap.update).gemService).toBeNull();
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ gemService: 'EINVOICE' }),
        modifiedRecord: expect.objectContaining({ gemService: null }),
        notes: 'GST provider error map updated',
      });
    });

    it('refuses clearing the extract path a stored SUCCESS row needs', async () => {
      prisma.gstProviderErrorMap.findUnique.mockResolvedValue(
        errorMapRow({
          gemTreatAs: 'SUCCESS',
          gemExtractPath: '$.ErrorDetails[0].InfoDtls.Irn',
          gemCanonicalField: 'irn',
        }),
      );

      const refusal = await refusalOf(
        service.saveErrorMap(errorMapDto({ gemId: ERROR_MAP_ID, gemExtractPath: null })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'gemExtractPath', code: GST_CODES.SUCCESS_MAPPING_INCOMPLETE }],
        },
      });
    });
  });

  describe('deleteErrorMap', () => {
    it('refuses an id that names no error map', async () => {
      prisma.gstProviderErrorMap.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.deleteErrorMap(ERROR_MAP_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gemId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses an error map that is already deleted', async () => {
      prisma.gstProviderErrorMap.findUnique.mockResolvedValue(errorMapRow({ gemIsDeleted: true }));

      const refusal = await refusalOf(service.deleteErrorMap(ERROR_MAP_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gemId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it('marks the row deleted and audits it as a cancel', async () => {
      await expect(service.deleteErrorMap(ERROR_MAP_ID)).resolves.toEqual({
        gemId: ERROR_MAP_ID,
        deleted: true,
      });

      expect(prisma.gstProviderErrorMap.update).toHaveBeenCalledWith({
        where: { gemId: ERROR_MAP_ID },
        data: { gemIsDeleted: true, gemModifiedOn: expect.any(Date), gemModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: '2150 → DUPLICATE_IRN',
        modifiedRecord: expect.objectContaining({ gemIsDeleted: true }),
        notes: 'GST provider error map soft deleted',
      });
    });
  });
});
