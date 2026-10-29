import { HttpException } from '@nestjs/common';
import { CustGroup, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { createHouseValidationPipe } from '../../../common/validation/house-validation';
import { SaveCustomerGroupDto } from './dto/save-customer-group.dto';
import { CustomerGroupService } from './customer-group.service';
import { CustomerGroupErrorCode } from './types/customer-group-error-codes';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46a401';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a402';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a403';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a404';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const groupRow = (overrides: Partial<CustGroup> = {}): CustGroup => ({
  cgrId: GROUP_ID,
  cgrCompanyId: COMPANY_ID,
  cgrBranchId: null,
  cgrName: 'Wholesale',
  cgrAlias: null,
  cgrShort: 'WS',
  cgrNarration: null,
  cgrOrder: new Prisma.Decimal(2),
  cgrDiscPerc: new Prisma.Decimal('2.500'),
  cgrCollectionDays: [1, 15],
  cgrDebitAllowed: true,
  cgrDebitDays: 30,
  cgrDebitLimit: new Prisma.Decimal('50000.0000'),
  cgrBillsLimit: 5,
  cgrOverdueBilling: false,
  cgrIsActive: true,
  cgrIsDeleted: false,
  cgrCreatedOn: STAMP,
  cgrModifiedOn: STAMP,
  cgrSyncDate: null,
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
  custGroup: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  company: { findFirst: jest.Mock };
  customer: { count: jest.Mock };
  $transaction: jest.Mock;
};

describe('CustomerGroupService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: CustomerGroupService;

  beforeEach(() => {
    prisma = {
      custGroup: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<CustGroup> }) => groupRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<CustGroup> }) => groupRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      company: { findFirst: jest.fn().mockResolvedValue({ compId: COMPANY_ID }) },
      customer: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new CustomerGroupService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const createdData = () =>
    (prisma.custGroup.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const uniquenessWhere = () =>
    (prisma.custGroup.findFirst.mock.calls.at(-1)![0] as { where: Record<string, unknown> }).where;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — create (no cgrId)', () => {
    it('refuses a blank name before opening a transaction', async () => {
      const refusal = await refusalOf(service.save({ cgrName: '   ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'cgrName', code: CustomerGroupErrorCode.NAME_REQUIRED }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a company that is not live', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.save({ cgrName: 'Wholesale', cgrCompanyId: COMPANY_ID }),
      );

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID, compIsDeleted: false },
        select: { compId: true },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'cgrCompanyId', code: CustomerGroupErrorCode.COMPANY_NOT_FOUND }],
        },
      });
      expect(prisma.custGroup.create).not.toHaveBeenCalled();
    });

    it('skips the company check for a group with no company and checks the name among those', async () => {
      await service.save({ cgrName: 'Wholesale' });

      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(uniquenessWhere()).toEqual({
        cgrIsDeleted: false,
        cgrCompanyId: null,
        cgrName: { equals: 'Wholesale', mode: 'insensitive' },
      });
    });

    it('refuses a name another live group of the company holds', async () => {
      prisma.custGroup.findFirst.mockResolvedValue({ cgrId: 'other' });

      const refusal = await refusalOf(
        service.save({ cgrName: 'wholesale', cgrCompanyId: COMPANY_ID }),
      );

      expect(uniquenessWhere()).toMatchObject({ cgrCompanyId: COMPANY_ID });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'cgrName', code: CustomerGroupErrorCode.NAME_EXISTS }] },
      });
      expect(prisma.custGroup.create).not.toHaveBeenCalled();
    });

    it('writes the trimmed name, the company and the terms sent', async () => {
      await service.save({
        cgrName: ' Wholesale ',
        cgrCompanyId: COMPANY_ID,
        cgrDiscPerc: 2.5,
        cgrDebitAllowed: true,
        cgrDebitDays: 30,
        cgrDebitLimit: 50000,
        cgrCollectionDays: [1, 15],
      });

      expect(createdData()).toEqual({
        cgrName: 'Wholesale',
        cgrCompanyId: COMPANY_ID,
        cgrCollectionDays: [1, 15],
        cgrCreatedOn: expect.any(Date),
        cgrDiscPerc: 2.5,
        cgrDebitAllowed: true,
        cgrDebitDays: 30,
        cgrDebitLimit: 50000,
      });
    });

    it('stores 0 for a NOT NULL number sent as null (F3)', async () => {
      await service.save({
        cgrName: 'Wholesale',
        cgrOrder: null,
        cgrDiscPerc: null,
        cgrDebitDays: null,
        cgrDebitLimit: null,
        cgrBillsLimit: null,
      });

      expect(createdData()).toMatchObject({
        cgrOrder: 0,
        cgrDiscPerc: 0,
        cgrDebitDays: 0,
        cgrDebitLimit: 0,
        cgrBillsLimit: 0,
      });
    });

    it('stores no collection days as an empty list', async () => {
      await service.save({ cgrName: 'Wholesale' });

      expect(createdData().cgrCollectionDays).toEqual([]);
    });

    it('answers with the money and order columns as plain numbers', async () => {
      prisma.custGroup.create.mockResolvedValue(groupRow());

      await expect(service.save({ cgrName: 'Wholesale' })).resolves.toEqual({
        cgrId: GROUP_ID,
        cgrCompanyId: COMPANY_ID,
        cgrBranchId: null,
        cgrName: 'Wholesale',
        cgrAlias: null,
        cgrShort: 'WS',
        cgrNarration: null,
        cgrOrder: 2,
        cgrDiscPerc: 2.5,
        cgrCollectionDays: [1, 15],
        cgrDebitAllowed: true,
        cgrDebitDays: 30,
        cgrDebitLimit: 50000,
        cgrBillsLimit: 5,
        cgrOverdueBilling: false,
        cgrIsActive: true,
        cgrIsDeleted: false,
        cgrCreatedOn: STAMP.toISOString(),
        cgrModifiedOn: STAMP.toISOString(),
      });
    });

    it('audits the create as the request user, or the default actor with nobody logged in', async () => {
      context.getUserId.mockReturnValue(null);

      const payload = await service.save({ cgrName: 'Wholesale' });

      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'cust groups',
        pk: GROUP_ID,
        originalRecord: null,
        modifiedRecord: payload,
        userId: DEFAULT_ACTOR,
      });
    });

    it('answers a unique-index race (P2002) with a 409', async () => {
      prisma.custGroup.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save({ cgrName: 'Wholesale' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: CustomerGroupErrorCode.NAME_EXISTS }] },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.custGroup.create.mockRejectedValue(failure);

      await expect(service.save({ cgrName: 'Wholesale' })).rejects.toBe(failure);
    });
  });

  describe('save — update (cgrId present)', () => {
    beforeEach(() => {
      prisma.custGroup.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          'cgrName' in where ? null : groupRow(),
      );
    });

    it('refuses an id that names no live group', async () => {
      prisma.custGroup.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save({ cgrId: GROUP_ID, cgrName: 'Wholesale' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'cgrId', code: CustomerGroupErrorCode.NOT_FOUND }] },
      });
      expect(prisma.custGroup.update).not.toHaveBeenCalled();
    });

    it('refuses a move to a company that is not live', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.save({ cgrId: GROUP_ID, cgrName: 'Wholesale', cgrCompanyId: OTHER_COMPANY_ID }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: CustomerGroupErrorCode.COMPANY_NOT_FOUND }] },
      });
      expect(prisma.custGroup.update).not.toHaveBeenCalled();
    });

    it('checks the name within the company sent, excluding itself, and writes the move', async () => {
      await service.save({
        cgrId: GROUP_ID,
        cgrName: 'Wholesale',
        cgrCompanyId: OTHER_COMPANY_ID,
      });

      expect(uniquenessWhere()).toEqual({
        cgrIsDeleted: false,
        cgrCompanyId: OTHER_COMPANY_ID,
        cgrName: { equals: 'Wholesale', mode: 'insensitive' },
        cgrId: { not: GROUP_ID },
      });
      expect(prisma.custGroup.update).toHaveBeenCalledWith({
        where: { cgrId: GROUP_ID },
        data: {
          cgrName: 'Wholesale',
          cgrCompanyId: OTHER_COMPANY_ID,
          cgrModifiedOn: expect.any(Date),
        },
      });
    });

    it('refuses a name another group of the company holds', async () => {
      prisma.custGroup.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          'cgrName' in where ? { cgrId: 'other' } : groupRow(),
      );

      const refusal = await refusalOf(
        service.save({ cgrId: GROUP_ID, cgrName: 'Retail', cgrCompanyId: COMPANY_ID }),
      );

      expect(refusal.status).toBe(409);
      expect(prisma.custGroup.update).not.toHaveBeenCalled();
    });

    it('checks a rename with no cgrCompanyId in the group own company, keeping company and days (R1)', async () => {
      const dto = (await createHouseValidationPipe().transform(
        { cgrId: GROUP_ID, cgrName: 'Wholesale B' },
        { type: 'body', metatype: SaveCustomerGroupDto },
      )) as SaveCustomerGroupDto;

      await service.save(dto);

      expect(prisma.custGroup.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cgrCompanyId: COMPANY_ID,
            cgrId: { not: GROUP_ID },
          }) as object,
        }),
      );
      const data = (prisma.custGroup.update.mock.calls[0][0] as { data: Record<string, unknown> })
        .data;
      expect(data.cgrCompanyId).toBe(COMPANY_ID);
      expect(data).not.toHaveProperty('cgrCollectionDays');
    });

    it('stores 0 for a term cleared to null on an update (F3)', async () => {
      await service.save({ cgrId: GROUP_ID, cgrName: 'Wholesale', cgrDebitLimit: null });

      expect(prisma.custGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cgrDebitLimit: 0 }) as object,
        }),
      );
    });

    it('writes the terms sent and audits the before and after', async () => {
      const payload = await service.save({
        cgrId: GROUP_ID,
        cgrName: 'Wholesale',
        cgrCompanyId: COMPANY_ID,
        cgrDebitLimit: 75000,
        cgrCollectionDays: [7],
      });

      expect(prisma.custGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cgrDebitLimit: 75000,
            cgrCollectionDays: [7],
          }) as object,
        }),
      );
      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: GROUP_ID,
        userId: USER_ID,
        originalRecord: expect.objectContaining({ cgrDebitLimit: 50000 }),
        modifiedRecord: payload,
      });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live group', async () => {
      const refusal = await refusalOf(service.getById(GROUP_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: CustomerGroupErrorCode.NOT_FOUND }] },
      });
      expect(prisma.custGroup.findFirst).toHaveBeenCalledWith({
        where: { cgrId: GROUP_ID, cgrIsDeleted: false },
      });
    });

    it('returns the live group', async () => {
      prisma.custGroup.findFirst.mockResolvedValue(groupRow());

      await expect(service.getById(GROUP_ID)).resolves.toMatchObject({
        cgrId: GROUP_ID,
        cgrDiscPerc: 2.5,
      });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live group', async () => {
      const refusal = await refusalOf(service.softDelete(GROUP_ID));

      expect(refusal.status).toBe(404);
    });

    it('refuses while live customers are still in the group', async () => {
      prisma.custGroup.findFirst.mockResolvedValue(groupRow());
      prisma.customer.count.mockResolvedValue(12);

      const refusal = await refusalOf(service.softDelete(GROUP_ID));

      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: { cusGroupId: GROUP_ID, cusIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'cgrId',
              code: CustomerGroupErrorCode.HAS_CUSTOMERS,
              message: `Customer group ${GROUP_ID} is used by 12 customer(s).`,
            },
          ],
        },
      });
      expect(prisma.custGroup.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row went between the read and the write', async () => {
      prisma.custGroup.findFirst.mockResolvedValue(groupRow());
      prisma.custGroup.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(GROUP_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the group deleted and inactive and audits it as a cancel', async () => {
      prisma.custGroup.findFirst.mockResolvedValue(groupRow());

      await expect(service.softDelete(GROUP_ID)).resolves.toEqual({
        cgrId: GROUP_ID,
        deleted: true,
      });
      expect(prisma.custGroup.updateMany).toHaveBeenCalledWith({
        where: { cgrId: GROUP_ID, cgrIsDeleted: false },
        data: { cgrIsDeleted: true, cgrIsActive: false, cgrModifiedOn: expect.any(Date) },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Wholesale',
        userId: USER_ID,
        modifiedRecord: expect.objectContaining({ cgrIsDeleted: true, cgrIsActive: false }),
      });
    });
  });
});
