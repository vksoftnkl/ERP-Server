import { HttpException } from '@nestjs/common';
import { AppSettingDef, AppSettingValue, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppSettingValueService } from './app-setting-value.service';
import { SaveAppSettingValueDto } from './dto/save-app-setting-value.dto';
import {
  AppSettingDataType,
  AppSettingScope,
  AppSettingSource,
} from './types/app-settings-api.types';
import { AppSettingsErrorCode } from './types/app-settings-error-codes';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f201';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f202';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46f203';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46f204';
const ASV_ID = '019c6f6c-be87-7a11-8905-36092c46f205';
const KEY = 'sales.max_discount_percent';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const defRow = (overrides: Partial<AppSettingDef> = {}): AppSettingDef => ({
  asdId: '019c6f6c-be87-7a11-8905-36092c46f2d0',
  asdKey: KEY,
  asdModule: 'sales',
  asdGroup: 'discount',
  asdDataType: AppSettingDataType.DECIMAL,
  asdDefaultValue: '10',
  asdAllowedValues: null,
  asdMinValue: new Prisma.Decimal(0),
  asdMaxValue: new Prisma.Decimal(100),
  asdMaxScope: AppSettingScope.BRANCH,
  asdLabel: 'Max discount %',
  asdDescription: null,
  asdSortOrder: 1,
  asdIsActive: true,
  asdNeedsRelogin: false,
  asdIsDeleted: false,
  asdSyncDate: null,
  asdCreatedOn: STAMP,
  asdCreatedBy: USER_ID,
  asdModifiedOn: null,
  asdModifiedBy: null,
  ...overrides,
});

const valueRow = (overrides: Partial<AppSettingValue> = {}): AppSettingValue => ({
  asvId: ASV_ID,
  asvSettingKey: KEY,
  asvScope: AppSettingScope.BRANCH,
  asvCompanyId: null,
  asvBranchId: BRANCH_ID,
  asvDeviceId: null,
  asvUserId: null,
  asvValue: '25',
  asvRemarks: null,
  asvIsDeleted: false,
  asvSyncDate: null,
  asvCreatedOn: STAMP,
  asvCreatedBy: USER_ID,
  asvModifiedOn: null,
  asvModifiedBy: null,
  ...overrides,
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

type PrismaMock = {
  appSettingValue: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  appSettingDef: { findFirst: jest.Mock };
  company: { findFirst: jest.Mock };
  branchMaster: { findFirst: jest.Mock };
  deviceMaster: { findFirst: jest.Mock };
  userMaster: { findFirst: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
};

describe('AppSettingValueService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let service: AppSettingValueService;

  beforeEach(() => {
    prisma = {
      appSettingValue: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<AppSettingValue> }) => valueRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<AppSettingValue> }) =>
          valueRow(data as Partial<AppSettingValue>),
        ),
      },
      appSettingDef: { findFirst: jest.fn().mockResolvedValue(defRow()) },
      company: { findFirst: jest.fn().mockResolvedValue({ compId: COMPANY_ID }) },
      branchMaster: { findFirst: jest.fn().mockResolvedValue({ brId: BRANCH_ID }) },
      deviceMaster: { findFirst: jest.fn().mockResolvedValue({ devId: DEVICE_ID }) },
      userMaster: { findFirst: jest.fn().mockResolvedValue({ usrId: USER_ID }) },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new AppSettingValueService(
      prisma as unknown as PrismaService,
      audit as never,
      { getUserId: jest.fn().mockReturnValue(USER_ID) } as never,
    );
  });

  const branchOverride = (overrides: Partial<SaveAppSettingValueDto> = {}) => ({
    asvSettingKey: KEY,
    asvScope: AppSettingScope.BRANCH,
    asvBranchId: BRANCH_ID,
    asvValue: '25',
    ...overrides,
  });
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — the batch', () => {
    it('runs the whole page in one transaction with room for a long batch', async () => {
      await service.save([branchOverride(), branchOverride({ asvValue: '30' })]);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 10_000,
        timeout: 30_000,
      });
    });

    it('names the entry a refusal came from, so the screen can mark that box', async () => {
      const refusal = await refusalOf(
        service.save([branchOverride(), branchOverride({ asvValue: '250' })]),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          message: 'Invalid setting value',
          errors: [{ field: 'data[1].asvValue', code: AppSettingsErrorCode.VALUE_ABOVE_MAX }],
        },
      });
    });
  });

  describe('save — a new override (no asvId)', () => {
    it.each([
      ['asvSettingKey', { asvSettingKey: '  ' }],
      ['asvScope', { asvScope: undefined }],
    ])('requires %s', async (field, overrides) => {
      const refusal = await refusalOf(service.save([branchOverride(overrides)]));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: `data[0].${field}`, code: AppSettingsErrorCode.FIELD_REQUIRED }] },
      });
    });

    it('requires the id its scope names', async () => {
      const refusal = await refusalOf(service.save([branchOverride({ asvBranchId: undefined })]));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'data[0].asvBranchId', code: AppSettingsErrorCode.TARGET_ID_REQUIRED },
          ],
        },
      });
    });

    it('refuses every id its scope does not name, all at once', async () => {
      const refusal = await refusalOf(
        service.save([
          {
            asvSettingKey: KEY,
            asvScope: AppSettingScope.GLOBAL,
            asvCompanyId: COMPANY_ID,
            asvUserId: USER_ID,
          },
        ]),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          message: 'Invalid scope target',
          errors: [
            { field: 'data[0].asvCompanyId', code: AppSettingsErrorCode.TARGET_ID_NOT_ALLOWED },
            { field: 'data[0].asvUserId', code: AppSettingsErrorCode.TARGET_ID_NOT_ALLOWED },
          ],
        },
      });
      expect(prisma.appSettingDef.findFirst).not.toHaveBeenCalled();
    });

    it('refuses a key the catalog does not hold', async () => {
      prisma.appSettingDef.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save([branchOverride()]));

      expect(prisma.appSettingDef.findFirst).toHaveBeenCalledWith({
        where: { asdKey: KEY, asdIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'data[0].asvSettingKey', code: AppSettingsErrorCode.UNKNOWN_KEY }],
        },
      });
    });

    it('refuses a new override on a retired setting with a 409', async () => {
      prisma.appSettingDef.findFirst.mockResolvedValue(defRow({ asdIsActive: false }));

      const refusal = await refusalOf(service.save([branchOverride()]));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: AppSettingsErrorCode.RETIRED }] },
      });
    });

    it('refuses a scope deeper than the setting allows', async () => {
      prisma.appSettingDef.findFirst.mockResolvedValue(
        defRow({ asdMaxScope: AppSettingScope.COMPANY }),
      );

      const refusal = await refusalOf(service.save([branchOverride()]));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'data[0].asvScope',
              code: AppSettingsErrorCode.SCOPE_TOO_DEEP,
              message: `"${KEY}" may not be overridden below COMPANY scope (asked for BRANCH)`,
            },
          ],
        },
      });
    });

    it.each([
      ['company', 'COMPANY', 'asvCompanyId', COMPANY_ID],
      ['branch', 'BRANCH', 'asvBranchId', BRANCH_ID],
      ['device', 'DEVICE', 'asvDeviceId', DEVICE_ID],
      ['user', 'USER', 'asvUserId', USER_ID],
    ] as const)(
      'refuses a %s that does not exist',
      async (label, scope, field, id) => {
        prisma.appSettingDef.findFirst.mockResolvedValue(
          defRow({ asdMaxScope: AppSettingScope.USER }),
        );
        prisma.company.findFirst.mockResolvedValue(null);
        prisma.branchMaster.findFirst.mockResolvedValue(null);
        prisma.deviceMaster.findFirst.mockResolvedValue(null);
        prisma.userMaster.findFirst.mockResolvedValue(null);

        const refusal = await refusalOf(
          service.save([{ asvSettingKey: KEY, asvScope: AppSettingScope[scope], [field]: id }]),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [
              {
                field: `data[0].${field}`,
                code: AppSettingsErrorCode.TARGET_NOT_FOUND,
                message: `No active ${label} found with id ${id}`,
              },
            ],
          },
        });
      },
    );

    it('refuses a value the setting cannot hold', async () => {
      const refusal = await refusalOf(service.save([branchOverride({ asvValue: 'ten' })]));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: AppSettingsErrorCode.VALUE_WRONG_TYPE }] },
      });
      expect(prisma.appSettingValue.create).not.toHaveBeenCalled();
    });

    it('refuses a value outside the allowed list', async () => {
      prisma.appSettingDef.findFirst.mockResolvedValue(
        defRow({
          asdDataType: AppSettingDataType.TEXT,
          asdAllowedValues: ['FIFO', 'LIFO', 7] as Prisma.JsonArray,
        }),
      );

      const refusal = await refusalOf(service.save([branchOverride({ asvValue: 'AVG' })]));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              code: AppSettingsErrorCode.VALUE_NOT_ALLOWED,
              // A non-string member can never match, so it is not offered either.
              message: `"AVG" is not one of the allowed values for setting "${KEY}" (FIFO, LIFO)`,
            },
          ],
        },
      });
    });

    it('creates the override with the other id columns null, and audits it', async () => {
      const [payload] = await service.save([branchOverride({ asvRemarks: '  festival  ' })]);

      expect(prisma.appSettingValue.findFirst).toHaveBeenCalledWith({
        where: {
          asvSettingKey: KEY,
          asvIsDeleted: false,
          asvCompanyId: null,
          asvBranchId: BRANCH_ID,
          asvDeviceId: null,
          asvUserId: null,
        },
      });
      expect(prisma.appSettingValue.create).toHaveBeenCalledWith({
        data: {
          asvSettingKey: KEY,
          asvScope: AppSettingScope.BRANCH,
          asvCompanyId: null,
          asvBranchId: BRANCH_ID,
          asvDeviceId: null,
          asvUserId: null,
          asvValue: '25',
          asvRemarks: 'festival',
          asvCreatedOn: expect.any(Date),
          asvCreatedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'app setting value',
        screenType: 'settings',
        branchId: BRANCH_ID,
        displayName: `${KEY} @ BRANCH ${BRANCH_ID}`,
        notes: 'BRANCH override set',
        modifiedRecord: payload,
      });
    });

    it('takes asvCreatedBy from the body over the request user', async () => {
      await service.save([branchOverride({ asvCreatedBy: 'migration' })]);

      expect(prisma.appSettingValue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ asvCreatedBy: 'migration' }) as object,
        }),
      );
    });

    it('stores null as the deliberate blank, and a blank string the same way', async () => {
      await service.save([branchOverride({ asvValue: null }), branchOverride({ asvValue: '  ' })]);

      const values = prisma.appSettingValue.create.mock.calls.map(
        ([args]) => (args as { data: { asvValue: unknown } }).data.asvValue,
      );
      expect(values).toEqual([null, null]);
    });

    it('moves the override already on the target instead of colliding with it', async () => {
      prisma.appSettingValue.findFirst.mockResolvedValue(valueRow({ asvValue: '20' }));

      await service.save([branchOverride({ asvValue: '30' })]);

      expect(prisma.appSettingValue.create).not.toHaveBeenCalled();
      expect(prisma.appSettingValue.update).toHaveBeenCalledWith({
        where: { asvId: ASV_ID },
        data: { asvValue: '30', asvModifiedOn: expect.any(Date), asvModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ asvValue: '20' }),
      });
    });

    it('answers a race on the target index (P2002) with a 409 on that entry', async () => {
      prisma.appSettingValue.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save([branchOverride()]));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'data[0].asvScope', code: AppSettingsErrorCode.OVERRIDE_EXISTS }],
        },
      });
    });
  });

  describe('save — an edit (asvId present)', () => {
    it('refuses an id with no live override, naming the entry', async () => {
      const refusal = await refusalOf(service.save([{ asvId: ASV_ID, asvValue: '5' }]));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [{ field: 'data[0].asvId', code: AppSettingsErrorCode.OVERRIDE_NOT_FOUND }],
        },
      });
    });

    it('refuses to repoint the override, naming each field that would move', async () => {
      prisma.appSettingValue.findFirst.mockResolvedValue(valueRow());

      const refusal = await refusalOf(
        service.save([
          {
            asvId: ASV_ID,
            asvSettingKey: 'sales.other',
            asvScope: AppSettingScope.COMPANY,
            asvCompanyId: COMPANY_ID,
            asvBranchId: null,
          },
        ]),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          message: 'Override target is immutable',
          errors: [
            { field: 'data[0].asvSettingKey', code: AppSettingsErrorCode.TARGET_IMMUTABLE },
            { field: 'data[0].asvScope', code: AppSettingsErrorCode.TARGET_IMMUTABLE },
            { field: 'data[0].asvCompanyId', code: AppSettingsErrorCode.TARGET_IMMUTABLE },
            { field: 'data[0].asvBranchId', code: AppSettingsErrorCode.TARGET_IMMUTABLE },
          ],
        },
      });
    });

    it('accepts the stored target sent back unchanged', async () => {
      prisma.appSettingValue.findFirst.mockResolvedValue(valueRow());

      await service.save([
        { asvId: ASV_ID, asvSettingKey: KEY, asvScope: AppSettingScope.BRANCH, asvBranchId: BRANCH_ID, asvValue: '40' },
      ]);

      expect(prisma.appSettingValue.update).toHaveBeenCalledTimes(1);
    });

    it('keeps the stored value when none is sent, and still checks it', async () => {
      prisma.appSettingValue.findFirst.mockResolvedValue(valueRow({ asvValue: '150' }));

      const refusal = await refusalOf(service.save([{ asvId: ASV_ID, asvRemarks: 'note' }]));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: AppSettingsErrorCode.VALUE_ABOVE_MAX }] },
      });
    });

    it('re-checks the scope, which the catalog may have narrowed since', async () => {
      prisma.appSettingValue.findFirst.mockResolvedValue(valueRow());
      prisma.appSettingDef.findFirst.mockResolvedValue(
        defRow({ asdMaxScope: AppSettingScope.GLOBAL }),
      );

      const refusal = await refusalOf(service.save([{ asvId: ASV_ID, asvValue: '5' }]));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: AppSettingsErrorCode.SCOPE_TOO_DEEP }] },
      });
    });

    it('writes the remarks only when they are sent, and stamps asvModifiedBy', async () => {
      prisma.appSettingValue.findFirst.mockResolvedValue(valueRow());

      await service.save([{ asvId: ASV_ID, asvValue: '5', asvModifiedBy: 'hq' }]);
      await service.save([{ asvId: ASV_ID, asvRemarks: '' }]);

      const [first, second] = prisma.appSettingValue.update.mock.calls.map(
        ([args]) => (args as { data: Record<string, unknown> }).data,
      );
      expect(first).toEqual({ asvValue: '5', asvModifiedOn: expect.any(Date), asvModifiedBy: 'hq' });
      expect(second).toEqual({
        asvValue: '25',
        asvModifiedOn: expect.any(Date),
        asvModifiedBy: USER_ID,
        asvRemarks: null,
      });
    });
  });

  describe('softDelete — the reset', () => {
    it('refuses an id with no live override', async () => {
      const refusal = await refusalOf(service.softDelete(ASV_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'asvId', code: AppSettingsErrorCode.OVERRIDE_NOT_FOUND }] },
      });
    });

    it('marks the override deleted so the layer above takes over again', async () => {
      prisma.appSettingValue.findFirst.mockResolvedValue(valueRow());

      await expect(service.softDelete(ASV_ID)).resolves.toEqual({
        asvId: ASV_ID,
        asvSettingKey: KEY,
        deleted: true,
      });
      expect(prisma.appSettingValue.update).toHaveBeenCalledWith({
        where: { asvId: ASV_ID },
        data: { asvIsDeleted: true, asvModifiedOn: expect.any(Date), asvModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        branchId: BRANCH_ID,
        notes: 'Override reset to the BRANCH layer above',
      });
    });
  });

  describe('resolveEffective', () => {
    const effectiveRow = (overrides: Record<string, unknown> = {}) => ({
      out_asd_id: 'asd-1',
      out_asd_key: KEY,
      out_asd_module: 'sales',
      out_asd_group: 'discount',
      out_asd_data_type: 'DECIMAL',
      out_asd_default_value: '10',
      out_asd_allowed_values: null,
      out_asd_min_value: new Prisma.Decimal('0'),
      out_asd_max_value: new Prisma.Decimal('99.5'),
      out_asd_max_scope: 'BRANCH',
      out_asd_label: 'Max discount %',
      out_asd_description: null,
      out_asd_sort_order: 1,
      out_asd_needs_relogin: false,
      out_asv_id: null,
      out_asv_scope: null,
      out_asv_company_id: null,
      out_asv_branch_id: null,
      out_asv_device_id: null,
      out_asv_user_id: null,
      out_asv_value: null,
      out_asv_remarks: null,
      out_asv_sync_date: null,
      out_asv_created_on: null,
      out_asv_created_by: null,
      out_asv_modified_on: null,
      out_asv_modified_by: null,
      out_effective_value: '10',
      out_source: 'DEFAULT',
      ...overrides,
    });

    it('asks the SQL resolver with the ids sent and null for the rest', async () => {
      await service.resolveEffective({ companyId: COMPANY_ID, userId: USER_ID });

      const [, ...values] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(values).toEqual([COMPANY_ID, null, null, USER_ID]);
    });

    it('answers a default with no override, and bounds as numbers', async () => {
      prisma.$queryRaw.mockResolvedValue([effectiveRow()]);

      await expect(service.resolveEffective({})).resolves.toEqual([
        expect.objectContaining({
          asdKey: KEY,
          asdMinValue: 0,
          asdMaxValue: 99.5,
          asdAllowedValues: null,
          source: AppSettingSource.DEFAULT,
          value: '10',
          override: null,
        }),
      ]);
    });

    it('keeps an override that blanks the setting, so it can still be reset', async () => {
      prisma.$queryRaw.mockResolvedValue([
        effectiveRow({
          out_asv_id: ASV_ID,
          out_asv_scope: 'BRANCH',
          out_asv_branch_id: BRANCH_ID,
          out_asv_value: null,
          out_asv_created_on: STAMP,
          out_asv_created_by: USER_ID,
          out_effective_value: null,
          out_source: 'OVERRIDE',
        }),
      ]);

      const [item] = await service.resolveEffective({ branchId: BRANCH_ID });

      expect(item).toMatchObject({
        source: AppSettingSource.OVERRIDE,
        value: null,
        override: {
          asvId: ASV_ID,
          asvScope: AppSettingScope.BRANCH,
          asvBranchId: BRANCH_ID,
          asvValue: null,
          asvCreatedOn: STAMP.toISOString(),
          asvModifiedOn: null,
        },
      });
    });
  });
});
