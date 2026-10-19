import { HttpException } from '@nestjs/common';
import { StateCode } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { StateCodeMasterService } from './state-code-master.service';
import { StateCodeMasterErrorCode } from './types/state-code-master-error-codes';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fa01';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const stateRow = (overrides: Partial<StateCode> = {}): StateCode => ({
  stateCode: 'TN',
  stateName: 'Tamil Nadu',
  stateUt: false,
  tinCode: '33',
  isActive: true,
  isDeleted: false,
  stateSyncDate: null,
  createdOn: CREATED_ON,
  createdBy: USER_ID,
  modifiedOn: CREATED_ON,
  modifiedBy: USER_ID,
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
  stateCode: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('StateCodeMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let grid: {
    loadCandidates: jest.Mock;
    filterPrimaryFromTable: jest.Mock;
    validateBaseSql: jest.Mock;
    runPagedQuery: jest.Mock;
  };
  let service: StateCodeMasterService;

  beforeEach(() => {
    prisma = {
      stateCode: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<StateCode> }) => stateRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<StateCode> }) => stateRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    grid = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn((grids: unknown[]) => grids),
      validateBaseSql: jest.fn(() => ({ isValid: true, normalizedSql: 'SELECT 1' })),
      runPagedQuery: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    service = new StateCodeMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      grid as never,
      { getUserId: jest.fn().mockReturnValue(USER_ID) } as never,
    );
  });

  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('the state code itself', () => {
    it.each([
      ['a one-letter code', 'T'],
      ['a three-letter code', 'TNX'],
      ['a blank code', '   '],
      ['a missing code', undefined as unknown as string],
    ])('refuses %s with a 400, not a crash', async (_label, stateCode) => {
      const refusal = await refusalOf(service.getById(stateCode));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'stateCode', code: StateCodeMasterErrorCode.CODE_INVALID }] },
      });
      expect(prisma.stateCode.findFirst).not.toHaveBeenCalled();
    });

    it('is trimmed and upper-cased before it is looked up', async () => {
      prisma.stateCode.findFirst.mockResolvedValue(stateRow());

      await service.getById(' tn ');

      expect(prisma.stateCode.findFirst).toHaveBeenCalledWith({
        where: { stateCode: 'TN', isDeleted: false },
      });
    });
  });

  describe('save — a code not on file creates it', () => {
    it('writes the normalised code and name, stamps the request user and audits it', async () => {
      const payload = await service.save({
        stateCode: 'ka',
        stateName: ' Karnataka ',
        tinCode: '29',
      });

      expect(prisma.stateCode.findUnique).toHaveBeenCalledWith({
        where: { stateCode: 'KA' },
        select: { stateCode: true },
      });
      expect(prisma.stateCode.create).toHaveBeenCalledWith({
        data: {
          stateCode: 'KA',
          stateName: 'Karnataka',
          createdOn: expect.any(Date),
          createdBy: USER_ID,
          tinCode: '29',
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'state codes',
        pk: 'KA',
        displayName: 'Karnataka',
        modifiedRecord: payload,
      });
    });

    it('refuses a blank name', async () => {
      const refusal = await refusalOf(service.save({ stateCode: 'KA', stateName: '  ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'stateName', code: StateCodeMasterErrorCode.NAME_REQUIRED }] },
      });
    });

    it('refuses a name another live state holds', async () => {
      prisma.stateCode.findFirst.mockResolvedValue({ stateCode: 'TN' });

      const refusal = await refusalOf(service.save({ stateCode: 'KA', stateName: 'tamil nadu' }));

      expect(prisma.stateCode.findFirst).toHaveBeenCalledWith({
        where: {
          isDeleted: false,
          stateName: { equals: 'tamil nadu', mode: 'insensitive' },
          stateCode: { not: 'KA' },
        },
        select: { stateCode: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'stateName', code: StateCodeMasterErrorCode.NAME_DUPLICATE }] },
      });
      expect(prisma.stateCode.create).not.toHaveBeenCalled();
    });

    it('answers a unique-index race on the code (P2002) with a 409 on stateCode', async () => {
      prisma.stateCode.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save({ stateCode: 'KA', stateName: 'Karnataka' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'stateCode', code: StateCodeMasterErrorCode.DUPLICATE }] },
      });
    });
  });

  describe('save — a code on file updates it', () => {
    it('updates a live state and audits it as an update', async () => {
      prisma.stateCode.findUnique.mockResolvedValue(stateRow());

      await service.save({ stateCode: 'TN', stateName: 'Tamil Nadu', isActive: false });

      expect(prisma.stateCode.update).toHaveBeenCalledWith({
        where: { stateCode: 'TN' },
        data: {
          stateName: 'Tamil Nadu',
          isDeleted: false,
          modifiedOn: expect.any(Date),
          modifiedBy: USER_ID,
          isActive: false,
        },
      });
      expect(prisma.stateCode.create).not.toHaveBeenCalled();
      expect(auditEntry()).toMatchObject({ action: 'update', notes: 'State code updated' });
    });

    it('brings a soft-deleted state back and says so in the audit', async () => {
      prisma.stateCode.findUnique.mockResolvedValue(stateRow({ isDeleted: true, isActive: false }));

      const payload = await service.save({ stateCode: 'TN', stateName: 'Tamil Nadu' });

      expect(payload.isDeleted).toBe(false);
      expect(auditEntry()).toMatchObject({
        notes: 'State code restored and updated',
        originalRecord: expect.objectContaining({ isDeleted: true }),
      });
    });

    it('takes modifiedBy from the body over the request user', async () => {
      prisma.stateCode.findUnique.mockResolvedValue(stateRow());

      await service.save({ stateCode: 'TN', stateName: 'Tamil Nadu', modifiedBy: 'gst-sync' });

      expect(prisma.stateCode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ modifiedBy: 'gst-sync' }) as object,
        }),
      );
    });
  });

  describe('list', () => {
    it('refuses when no grid is configured for state codes', async () => {
      const refusal = await refusalOf(service.list({}));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: StateCodeMasterErrorCode.GRID_NOT_CONFIGURED }] },
      });
    });

    it('returns the configured grid page', async () => {
      grid.loadCandidates.mockResolvedValue([{ gridId: 9n, gridSql: 'SELECT * FROM st' }]);
      grid.runPagedQuery.mockResolvedValue({ items: [{ stateCode: 'TN' }], total: 38 });

      await expect(service.list({ limit: 20 })).resolves.toEqual({
        items: [{ stateCode: 'TN' }],
        meta: { page: 1, limit: 20, total: 38, total_pages: 2 },
      });
    });
  });

  describe('getById', () => {
    it('refuses a code with no live state', async () => {
      const refusal = await refusalOf(service.getById('ZZ'));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            {
              code: StateCodeMasterErrorCode.NOT_FOUND,
              message: 'No active state code found with code ZZ',
            },
          ],
        },
      });
    });
  });

  describe('softDelete', () => {
    it('refuses a code with no live state', async () => {
      const refusal = await refusalOf(service.softDelete('TN'));

      expect(refusal.status).toBe(404);
      expect(prisma.stateCode.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.stateCode.findFirst.mockResolvedValue(stateRow());
      prisma.stateCode.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete('TN'));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the state deleted and inactive under the normalised code', async () => {
      prisma.stateCode.findFirst.mockResolvedValue(stateRow());

      await expect(service.softDelete('tn')).resolves.toEqual({ stateCode: 'TN', deleted: true });
      expect(prisma.stateCode.updateMany).toHaveBeenCalledWith({
        where: { stateCode: 'TN', isDeleted: false },
        data: {
          isDeleted: true,
          isActive: false,
          modifiedOn: expect.any(Date),
          modifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        pk: 'TN',
        displayName: 'Tamil Nadu',
        modifiedRecord: expect.objectContaining({ isDeleted: true, isActive: false }),
      });
    });
  });
});
