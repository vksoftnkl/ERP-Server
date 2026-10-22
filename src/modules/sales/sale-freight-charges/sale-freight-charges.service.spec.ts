import { HttpException } from '@nestjs/common';
import { Prisma, SaleFreightCharge } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { SaveSaleFreightChargeDto } from './dto/save-sale-freight-charges.dto';
import { SaleFreightChargeService } from './sale-freight-charges.service';
import { SaleFreightChargeErrorCode } from './types/sale-freight-charges-error-codes';

const FR_ID = '019c6f6c-be87-7a11-8905-36092c46a101';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a102';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a103';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a104';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const freightRow = (overrides: Partial<SaleFreightCharge> = {}): SaleFreightCharge => ({
  frId: FR_ID,
  frCompanyId: COMPANY_ID,
  frBranchId: BRANCH_ID,
  frFromKm: 0,
  frToKm: 50,
  frFromWeight: new Prisma.Decimal('0'),
  frToWeight: new Prisma.Decimal('1000.5'),
  frFreightChrg: new Prisma.Decimal('750.25'),
  frIsActive: true,
  frIsDeleted: false,
  frSyncDate: null,
  frCreatedOn: STAMP,
  frCreatedBy: USER_ID,
  frModifiedOn: STAMP,
  frModifiedBy: USER_ID,
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

type PrismaMock = {
  saleFreightCharge: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('SaleFreightChargeService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: SaleFreightChargeService;

  beforeEach(() => {
    prisma = {
      saleFreightCharge: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          freightRow({
            ...data,
            frFromWeight: new Prisma.Decimal(data.frFromWeight as number),
            frToWeight: new Prisma.Decimal(data.frToWeight as number),
            frFreightChrg: new Prisma.Decimal(data.frFreightChrg as number),
          }),
        ),
        update: jest.fn(async ({ data }: { data: Partial<SaleFreightCharge> }) => freightRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new SaleFreightChargeService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const createdData = () =>
    (prisma.saleFreightCharge.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('createSaleFreightCharge', () => {
    it('seeds every figure to 0 and the scope to null when the body leaves them out', async () => {
      await service.createSaleFreightCharge({}, USER_ID);

      expect(createdData()).toEqual({
        frCompanyId: null,
        frBranchId: null,
        frFromKm: 0,
        frToKm: 0,
        frFreightChrg: 0,
        frFromWeight: 0,
        frToWeight: 0,
        frIsActive: true,
        frIsDeleted: false,
        frCreatedOn: expect.any(Date),
        frCreatedBy: USER_ID,
        frModifiedOn: expect.any(Date),
        frModifiedBy: USER_ID,
      });
      const data = createdData();
      expect(data.frCreatedOn).toBe(data.frModifiedOn);
    });

    it('writes the slab it is sent and answers with plain numbers', async () => {
      const payload = await service.createSaleFreightCharge(
        {
          frCompanyId: COMPANY_ID,
          frBranchId: BRANCH_ID,
          frFromKm: 10,
          frToKm: 25,
          frFromWeight: 0,
          frToWeight: 500,
          frFreightChrg: 120.5,
        },
        USER_ID,
      );

      expect(createdData()).toMatchObject({
        frCompanyId: COMPANY_ID,
        frBranchId: BRANCH_ID,
        frFromKm: 10,
        frToKm: 25,
        frToWeight: 500,
        frFreightChrg: 120.5,
      });
      expect(payload).toMatchObject({
        frId: FR_ID,
        frFromKm: 10,
        frToKm: 25,
        frToWeight: 500,
        frFreightChrg: 120.5,
        // A create answers without resolving the relation names.
        frCompanyName: null,
        frBranchName: null,
      });
    });

    it('stores a slab created inactive as deleted too, as the README documents', async () => {
      await service.createSaleFreightCharge({ frIsActive: false }, USER_ID);

      expect(createdData()).toMatchObject({ frIsActive: false, frIsDeleted: true });
    });

    it('takes the creator named in the body over the caller', async () => {
      await service.createSaleFreightCharge({ frCreatedBy: '  import-job ' }, USER_ID);

      expect(createdData()).toMatchObject({
        frCreatedBy: 'import-job',
        frModifiedBy: 'import-job',
      });
    });

    it('audits the new slab under its km range', async () => {
      const payload = await service.createSaleFreightCharge({ frFromKm: 10, frToKm: 25 }, USER_ID);

      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'New',
          tableName: 'sale freight charges',
          screenName: 'Sale Freight Charges',
          pk: FR_ID,
          displayName: 'FR-10-25',
          originalRecord: null,
          modifiedRecord: payload,
          userId: USER_ID,
        }),
        prisma,
      );
    });

    it('answers a unique-index clash (P2002) with a 409 on frFromKm', async () => {
      prisma.saleFreightCharge.create.mockRejectedValue(prismaError('P2002'));

      const refusal = await refusalOf(service.createSaleFreightCharge({}, USER_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Sale freight charge already exists',
          errors: [{ field: 'frFromKm', code: SaleFreightChargeErrorCode.RANGE_EXISTS }],
        },
      });
    });

    it('answers a missing company or branch (P2003) with a 400', async () => {
      prisma.saleFreightCharge.create.mockRejectedValue(prismaError('P2003'));

      const refusal = await refusalOf(
        service.createSaleFreightCharge({ frCompanyId: COMPANY_ID }, USER_ID),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'request', code: SaleFreightChargeErrorCode.REFERENCE_NOT_FOUND }],
        },
      });
    });

    it('rethrows any other failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.saleFreightCharge.create.mockRejectedValue(failure);

      await expect(service.createSaleFreightCharge({}, USER_ID)).rejects.toBe(failure);
    });
  });

  describe('save', () => {
    it('creates under the request user when the body has no frId', async () => {
      await service.save({ frFromKm: 1 });

      expect(createdData()).toMatchObject({ frCreatedBy: USER_ID, frFromKm: 1 });
    });

    it('creates under the default actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.save({});

      expect(createdData().frCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('refuses to update an id with no live slab', async () => {
      const refusal = await refusalOf(service.save({ frId: FR_ID, frToKm: 60 }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'frId', code: SaleFreightChargeErrorCode.NOT_FOUND }] },
      });
      expect(prisma.saleFreightCharge.findFirst).toHaveBeenCalledWith({
        where: { frId: FR_ID, frIsDeleted: false },
      });
      expect(prisma.saleFreightCharge.update).not.toHaveBeenCalled();
    });

    it('patches only the fields sent, stamping the modifier', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());

      await service.save({ frId: FR_ID, frToKm: 60, frFreightChrg: 800 });

      expect(prisma.saleFreightCharge.update).toHaveBeenCalledWith({
        where: { frId: FR_ID },
        data: {
          frModifiedOn: expect.any(Date),
          frModifiedBy: USER_ID,
          frToKm: 60,
          frFreightChrg: 800,
        },
      });
    });

    it('can deactivate a slab on update without deleting it', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());

      await service.save({ frId: FR_ID, frIsActive: false });

      const { data } = prisma.saleFreightCharge.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data.frIsActive).toBe(false);
      expect(data).not.toHaveProperty('frIsDeleted');
    });

    it('audits the update against the stored slab, under the modifier named in the body', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());

      const payload = await service.save({ frId: FR_ID, frToKm: 60, frModifiedBy: 'rate-sync' });

      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: FR_ID,
        displayName: 'FR-0-60',
        originalRecord: expect.objectContaining({ frToKm: 50 }),
        modifiedRecord: payload,
        userId: 'rate-sync',
      });
    });

    it('leaves every column a validated body omits undefined, so the update keeps it', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());
      // What the ValidationPipe hands over: every declared field is an own key.
      const dto = plainToInstance(SaveSaleFreightChargeDto, {
        frId: FR_ID,
        frToKm: 60,
        frFromWeight: null,
      });

      await service.save(dto);

      const { data } = prisma.saleFreightCharge.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toMatchObject({ frToKm: 60, frFromWeight: null });
      for (const omitted of [
        'frCompanyId',
        'frBranchId',
        'frFromKm',
        'frToWeight',
        'frFreightChrg',
        'frIsActive',
      ]) {
        expect(data[omitted]).toBeUndefined();
      }
    });

    it('stamps the default actor on an update when nobody is named or logged in', async () => {
      context.getUserId.mockReturnValue(null);
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());

      await service.save({ frId: FR_ID, frToKm: 60 });

      expect(prisma.saleFreightCharge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ frModifiedBy: DEFAULT_ACTOR }) as object,
        }),
      );
      expect(auditEntry().userId).toBe(DEFAULT_ACTOR);
    });

    it('answers a missing company or branch on update with a 400', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());
      prisma.saleFreightCharge.update.mockRejectedValue(prismaError('P2003'));

      const refusal = await refusalOf(service.save({ frId: FR_ID, frBranchId: BRANCH_ID }));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'request', code: SaleFreightChargeErrorCode.REFERENCE_NOT_FOUND }],
        },
      });
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('answers a unique-index clash on update with the same 409', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());
      prisma.saleFreightCharge.update.mockRejectedValue(prismaError('P2002'));

      const refusal = await refusalOf(service.save({ frId: FR_ID, frFromKm: 5 }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SaleFreightChargeErrorCode.RANGE_EXISTS }] },
      });
    });
  });

  describe('getById', () => {
    it('reads the live slab with its company and branch names', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue({
        ...freightRow(),
        company: { compName: 'Zeta Traders' },
        branch: { brName: 'Main' },
      });

      await expect(service.getById(FR_ID)).resolves.toEqual({
        frId: FR_ID,
        frCompanyId: COMPANY_ID,
        frCompanyName: 'Zeta Traders',
        frBranchId: BRANCH_ID,
        frBranchName: 'Main',
        frFromKm: 0,
        frToKm: 50,
        frFromWeight: 0,
        frToWeight: 1000.5,
        frFreightChrg: 750.25,
        frIsActive: true,
        frIsDeleted: false,
        frSyncDate: null,
        frCreatedOn: STAMP.toISOString(),
        frCreatedBy: USER_ID,
        frModifiedOn: STAMP.toISOString(),
        frModifiedBy: USER_ID,
      });
      expect(prisma.saleFreightCharge.findFirst).toHaveBeenCalledWith({
        where: { frId: FR_ID, frIsDeleted: false },
        include: {
          company: { select: { compName: true } },
          branch: { select: { brName: true } },
        },
      });
    });

    it('answers null names and null figures for a global slab with blank weights', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue({
        ...freightRow({
          frCompanyId: null,
          frBranchId: null,
          frFromWeight: null,
          frToWeight: null,
        }),
        company: null,
        branch: null,
      });

      await expect(service.getById(FR_ID)).resolves.toMatchObject({
        frCompanyName: null,
        frBranchName: null,
        frFromWeight: null,
        frToWeight: null,
      });
    });

    it('refuses an id with no live slab', async () => {
      const refusal = await refusalOf(service.getById(FR_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            {
              field: 'frId',
              code: SaleFreightChargeErrorCode.NOT_FOUND,
              message: `No active sale freight charge found with id ${FR_ID}`,
            },
          ],
        },
      });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live slab', async () => {
      const refusal = await refusalOf(service.softDelete(FR_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.saleFreightCharge.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());
      prisma.saleFreightCharge.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(FR_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: SaleFreightChargeErrorCode.NOT_FOUND }] },
      });
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the slab deleted and inactive, and audits it as a cancel', async () => {
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());

      await expect(service.softDelete(FR_ID)).resolves.toEqual({ frId: FR_ID, deleted: true });
      expect(prisma.saleFreightCharge.updateMany).toHaveBeenCalledWith({
        where: { frId: FR_ID, frIsDeleted: false },
        data: {
          frIsDeleted: true,
          frIsActive: false,
          frModifiedOn: expect.any(Date),
          frModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'FR-0-50',
        originalRecord: expect.objectContaining({ frIsDeleted: false }),
        modifiedRecord: expect.objectContaining({ frIsDeleted: true, frIsActive: false }),
        userId: USER_ID,
      });
    });

    it('stamps the default actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);
      prisma.saleFreightCharge.findFirst.mockResolvedValue(freightRow());

      await service.softDelete(FR_ID);

      expect(prisma.saleFreightCharge.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ frModifiedBy: DEFAULT_ACTOR }) as object,
        }),
      );
    });
  });
});
