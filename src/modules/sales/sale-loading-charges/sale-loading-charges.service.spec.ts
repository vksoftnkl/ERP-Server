import { HttpException } from '@nestjs/common';
import { Prisma, SaleLoadingCharge } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { SaveSaleLoadingChargeDto } from './dto/save-sale-loading-charges.dto';
import { SaleLoadingChargeService } from './sale-loading-charges.service';
import { SaleLoadingChargeErrorCode } from './types/sale-loading-charges-error-codes';

const ILC_ID = '019c6f6c-be87-7a11-8905-36092c46a201';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a202';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a203';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a204';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const loadingRow = (overrides: Partial<SaleLoadingCharge> = {}): SaleLoadingCharge => ({
  ilcId: ILC_ID,
  ilcCompId: COMPANY_ID,
  ilcBranchId: BRANCH_ID,
  ilcFromWeight: new Prisma.Decimal('100'),
  ilcToWeight: new Prisma.Decimal('200'),
  ilcLoadChrg: new Prisma.Decimal('35.5'),
  ilcUnloadChrg: new Prisma.Decimal('20'),
  ilcIsActive: true,
  ilcIsDeleted: false,
  ilcSyncDate: null,
  ilcCreatedOn: STAMP,
  ilcCreatedBy: USER_ID,
  ilcModifiedOn: STAMP,
  ilcModifiedBy: USER_ID,
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

const prismaError = (code: string) => Object.assign(new Error(`Prisma failure ${code}`), { code });

/**
 * What Prisma raises for the GiST exclusion constraint: an unknown-request
 * error with no code, the SQLSTATE only inside the driver message.
 */
const overlapError = () =>
  new Error(
    'Invalid `prisma.saleLoadingCharge.create()` invocation: Error occurred during query execution: ' +
      'ConnectorError(... code: "23P01", message: "conflicting key value violates exclusion constraint \\"excl_ilc_slab_overlap\\"")',
  );

type PrismaMock = {
  saleLoadingCharge: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

const asDecimals = (data: Record<string, unknown>): Partial<SaleLoadingCharge> => {
  const out: Record<string, unknown> = { ...data };
  for (const key of ['ilcFromWeight', 'ilcToWeight', 'ilcLoadChrg', 'ilcUnloadChrg']) {
    if (typeof out[key] === 'number') out[key] = new Prisma.Decimal(out[key]);
  }
  return out;
};

describe('SaleLoadingChargeService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: SaleLoadingChargeService;

  beforeEach(() => {
    prisma = {
      saleLoadingCharge: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          loadingRow(asDecimals(data)),
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          loadingRow(asDecimals(data)),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new SaleLoadingChargeService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const createdData = () =>
    (prisma.saleLoadingCharge.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('createSaleLoadingCharge', () => {
    it('seeds every figure to 0 and the scope to null when the body leaves them out', async () => {
      await service.createSaleLoadingCharge({}, USER_ID);

      expect(createdData()).toEqual({
        ilcCompId: null,
        ilcBranchId: null,
        ilcFromWeight: 0,
        ilcToWeight: 0,
        ilcLoadChrg: 0,
        ilcUnloadChrg: 0,
        ilcIsActive: true,
        ilcIsDeleted: false,
        ilcCreatedOn: expect.any(Date),
        ilcCreatedBy: USER_ID,
        ilcModifiedOn: expect.any(Date),
        ilcModifiedBy: USER_ID,
      });
    });

    it('writes the slab it is sent and answers with plain numbers', async () => {
      const payload = await service.createSaleLoadingCharge(
        {
          ilcCompId: COMPANY_ID,
          ilcBranchId: BRANCH_ID,
          ilcFromWeight: 0,
          ilcToWeight: 100,
          ilcLoadChrg: 12.75,
          ilcUnloadChrg: 8,
        },
        USER_ID,
      );

      expect(createdData()).toMatchObject({
        ilcCompId: COMPANY_ID,
        ilcBranchId: BRANCH_ID,
        ilcToWeight: 100,
        ilcLoadChrg: 12.75,
        ilcUnloadChrg: 8,
      });
      expect(payload).toMatchObject({
        ilcId: ILC_ID,
        ilcToWeight: 100,
        ilcLoadChrg: 12.75,
        ilcUnloadChrg: 8,
        ilcCompanyName: null,
        ilcBranchName: null,
      });
    });

    it('stores a slab created inactive as deleted too, as the README documents', async () => {
      await service.createSaleLoadingCharge({ ilcIsActive: false }, USER_ID);

      expect(createdData()).toMatchObject({ ilcIsActive: false, ilcIsDeleted: true });
    });

    it('takes the creator named in the body over the caller', async () => {
      await service.createSaleLoadingCharge({ ilcCreatedBy: 'import-job' }, USER_ID);

      expect(createdData()).toMatchObject({
        ilcCreatedBy: 'import-job',
        ilcModifiedBy: 'import-job',
      });
    });

    it('audits the new slab under its weight range', async () => {
      const payload = await service.createSaleLoadingCharge(
        { ilcFromWeight: 100, ilcToWeight: 200 },
        USER_ID,
      );

      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'New',
          tableName: 'sale loading charges',
          screenName: 'Sale Loading Charges',
          pk: ILC_ID,
          displayName: 'ILC-100-200',
          originalRecord: null,
          modifiedRecord: payload,
          userId: USER_ID,
        }),
        prisma,
      );
    });

    it('answers a unique-index clash (P2002) with a 409 on ilcFromWeight', async () => {
      prisma.saleLoadingCharge.create.mockRejectedValue(prismaError('P2002'));

      const refusal = await refusalOf(service.createSaleLoadingCharge({}, USER_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Sale loading charge already exists',
          errors: [{ field: 'ilcFromWeight', code: SaleLoadingChargeErrorCode.RANGE_EXISTS }],
        },
      });
    });

    it('answers an overlapping slab (23P01, no Prisma code) with a 409, not a 500', async () => {
      prisma.saleLoadingCharge.create.mockRejectedValue(overlapError());

      const refusal = await refusalOf(
        service.createSaleLoadingCharge({ ilcFromWeight: 150, ilcToWeight: 250 }, USER_ID),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Overlapping sale loading charge slab',
          errors: [{ field: 'ilcFromWeight', code: SaleLoadingChargeErrorCode.RANGE_OVERLAPS }],
        },
      });
    });

    it('answers a missing company or branch (P2003) with a 400', async () => {
      prisma.saleLoadingCharge.create.mockRejectedValue(prismaError('P2003'));

      const refusal = await refusalOf(service.createSaleLoadingCharge({}, USER_ID));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'request', code: SaleLoadingChargeErrorCode.REFERENCE_NOT_FOUND }],
        },
      });
    });

    it('rethrows any other failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.saleLoadingCharge.create.mockRejectedValue(failure);

      await expect(service.createSaleLoadingCharge({}, USER_ID)).rejects.toBe(failure);
    });
  });

  describe('save', () => {
    it('creates under the request user when the body has no ilcId', async () => {
      await service.save({ ilcToWeight: 50 });

      expect(createdData()).toMatchObject({ ilcCreatedBy: USER_ID, ilcToWeight: 50 });
    });

    it('creates under the default actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.save({});

      expect(createdData().ilcCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('refuses to update an id with no live slab', async () => {
      const refusal = await refusalOf(service.save({ ilcId: ILC_ID, ilcLoadChrg: 40 }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'ilcId', code: SaleLoadingChargeErrorCode.NOT_FOUND }] },
      });
      expect(prisma.saleLoadingCharge.update).not.toHaveBeenCalled();
    });

    it('patches only the fields sent, stamping the modifier', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());

      await service.save({ ilcId: ILC_ID, ilcLoadChrg: 40, ilcUnloadChrg: null });

      expect(prisma.saleLoadingCharge.update).toHaveBeenCalledWith({
        where: { ilcId: ILC_ID },
        data: {
          ilcModifiedOn: expect.any(Date),
          ilcModifiedBy: USER_ID,
          ilcLoadChrg: 40,
          ilcUnloadChrg: null,
        },
      });
    });

    it('audits the update against the stored slab, under the modifier named in the body', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());

      const payload = await service.save({
        ilcId: ILC_ID,
        ilcToWeight: 300,
        ilcModifiedBy: 'rate-sync',
      });

      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: ILC_ID,
        displayName: 'ILC-100-300',
        originalRecord: expect.objectContaining({ ilcToWeight: 200 }),
        modifiedRecord: payload,
        userId: 'rate-sync',
      });
    });

    it('leaves every column a validated body omits undefined, so the update keeps it', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());
      // What the ValidationPipe hands over: every declared field is an own key.
      const dto = plainToInstance(SaveSaleLoadingChargeDto, {
        ilcId: ILC_ID,
        ilcLoadChrg: 40,
        ilcBranchId: null,
      });

      await service.save(dto);

      const { data } = prisma.saleLoadingCharge.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toMatchObject({ ilcLoadChrg: 40, ilcBranchId: null });
      for (const omitted of [
        'ilcCompId',
        'ilcFromWeight',
        'ilcToWeight',
        'ilcUnloadChrg',
        'ilcIsActive',
      ]) {
        expect(data[omitted]).toBeUndefined();
      }
    });

    it('stamps the default actor on an update when nobody is named or logged in', async () => {
      context.getUserId.mockReturnValue(null);
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());

      await service.save({ ilcId: ILC_ID, ilcLoadChrg: 40 });

      expect(prisma.saleLoadingCharge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ilcModifiedBy: DEFAULT_ACTOR }) as object,
        }),
      );
      expect(auditEntry().userId).toBe(DEFAULT_ACTOR);
    });

    it('answers a unique-index clash on update with the same 409', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());
      prisma.saleLoadingCharge.update.mockRejectedValue(prismaError('P2002'));

      const refusal = await refusalOf(service.save({ ilcId: ILC_ID, ilcFromWeight: 0 }));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'ilcFromWeight', code: SaleLoadingChargeErrorCode.RANGE_EXISTS }],
        },
      });
    });

    it('answers a missing company or branch on update with a 400', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());
      prisma.saleLoadingCharge.update.mockRejectedValue(prismaError('P2003'));

      const refusal = await refusalOf(service.save({ ilcId: ILC_ID, ilcCompId: COMPANY_ID }));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'request', code: SaleLoadingChargeErrorCode.REFERENCE_NOT_FOUND }],
        },
      });
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('answers an overlap on update with the same 409', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());
      prisma.saleLoadingCharge.update.mockRejectedValue(overlapError());

      const refusal = await refusalOf(service.save({ ilcId: ILC_ID, ilcToWeight: 900 }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SaleLoadingChargeErrorCode.RANGE_OVERLAPS }] },
      });
    });
  });

  describe('getById', () => {
    it('reads the live slab with its company and branch names', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue({
        ...loadingRow(),
        company: { compName: 'Zeta Traders' },
        branch: { brName: 'Main' },
      });

      await expect(service.getById(ILC_ID)).resolves.toEqual({
        ilcId: ILC_ID,
        ilcCompId: COMPANY_ID,
        ilcCompanyName: 'Zeta Traders',
        ilcBranchId: BRANCH_ID,
        ilcBranchName: 'Main',
        ilcFromWeight: 100,
        ilcToWeight: 200,
        ilcLoadChrg: 35.5,
        ilcUnloadChrg: 20,
        ilcIsActive: true,
        ilcIsDeleted: false,
        ilcSyncDate: null,
        ilcCreatedOn: STAMP.toISOString(),
        ilcCreatedBy: USER_ID,
        ilcModifiedOn: STAMP.toISOString(),
        ilcModifiedBy: USER_ID,
      });
      expect(prisma.saleLoadingCharge.findFirst).toHaveBeenCalledWith({
        where: { ilcId: ILC_ID, ilcIsDeleted: false },
        include: {
          company: { select: { compName: true } },
          branch: { select: { brName: true } },
        },
      });
    });

    it('answers null for figures the row leaves blank', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue({
        ...loadingRow({ ilcLoadChrg: null, ilcUnloadChrg: null }),
        company: null,
        branch: null,
      });

      await expect(service.getById(ILC_ID)).resolves.toMatchObject({
        ilcCompanyName: null,
        ilcBranchName: null,
        ilcLoadChrg: null,
        ilcUnloadChrg: null,
      });
    });

    it('refuses an id with no live slab', async () => {
      const refusal = await refusalOf(service.getById(ILC_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'ilcId', code: SaleLoadingChargeErrorCode.NOT_FOUND }] },
      });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live slab', async () => {
      const refusal = await refusalOf(service.softDelete(ILC_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.saleLoadingCharge.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());
      prisma.saleLoadingCharge.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(ILC_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the slab deleted and inactive, and audits it as a cancel', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(loadingRow());

      await expect(service.softDelete(ILC_ID)).resolves.toEqual({ ilcId: ILC_ID, deleted: true });
      expect(prisma.saleLoadingCharge.updateMany).toHaveBeenCalledWith({
        where: { ilcId: ILC_ID, ilcIsDeleted: false },
        data: {
          ilcIsDeleted: true,
          ilcIsActive: false,
          ilcModifiedOn: expect.any(Date),
          ilcModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'ILC-100-200',
        modifiedRecord: expect.objectContaining({ ilcIsDeleted: true, ilcIsActive: false }),
      });
    });

    it('names a slab with blank weights by empty bounds', async () => {
      prisma.saleLoadingCharge.findFirst.mockResolvedValue(
        loadingRow({ ilcFromWeight: null, ilcToWeight: null }),
      );

      await service.softDelete(ILC_ID);

      expect(auditEntry().displayName).toBe('ILC--');
    });
  });
});
