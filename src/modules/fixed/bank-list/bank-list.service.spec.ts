import { HttpException } from '@nestjs/common';
import { BankMaster } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { BankListService } from './bank-list.service';
import { BankListErrorCode } from './types/bank-list-error-codes';

const BANK_ID = '019c6f6c-be87-7a11-8905-36092c46fb01';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fb02';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const bankRow = (overrides: Partial<BankMaster> = {}): BankMaster => ({
  bnkId: BANK_ID,
  bnkName: 'State Bank of India',
  bnkShortName: 'SBI',
  bnkAlias: null,
  bnkRbiCode: 'SBIN',
  bnkIbanSupported: false,
  bnkIsActive: true,
  bnkIsDeleted: false,
  bnkSyncDate: null,
  bnkCreatedOn: CREATED_ON,
  bnkCreatedBy: USER_ID,
  bnkModifiedOn: CREATED_ON,
  bnkModifiedBy: USER_ID,
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
  bankMaster: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  accLedgerBankAccount: { count: jest.Mock };
  $transaction: jest.Mock;
};

describe('BankListService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let grid: {
    loadCandidates: jest.Mock;
    filterPrimaryFromTable: jest.Mock;
    validateBaseSql: jest.Mock;
    runPagedQuery: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let service: BankListService;

  beforeEach(() => {
    prisma = {
      bankMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<BankMaster> }) => bankRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<BankMaster> }) => bankRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accLedgerBankAccount: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    grid = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn((grids: unknown[]) => grids),
      validateBaseSql: jest.fn(() => ({ isValid: true, normalizedSql: 'SELECT 1' })),
      runPagedQuery: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new BankListService(
      prisma as unknown as PrismaService,
      audit as never,
      grid as never,
      context as never,
    );
  });

  const createdData = () =>
    (prisma.bankMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedCall = () =>
    prisma.bankMaster.update.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — create (no bnkId)', () => {
    it('trims the name, stamps the request user and writes only the optional fields sent', async () => {
      const payload = await service.save({
        bnkName: '  State Bank of India  ',
        bnkShortName: 'SBI',
      });

      expect(createdData()).toEqual({
        bnkName: 'State Bank of India',
        bnkCreatedOn: expect.any(Date),
        bnkCreatedBy: USER_ID,
        bnkShortName: 'SBI',
      });
      expect(payload).toMatchObject({
        bnkId: BANK_ID,
        bnkName: 'State Bank of India',
        bnkSyncDate: null,
        bnkCreatedOn: (createdData().bnkCreatedOn as Date).toISOString(),
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'bank master',
        pk: BANK_ID,
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
      });
    });

    it('takes the creator named in the body over the request user', async () => {
      await service.save({ bnkName: 'Canara Bank', bnkCreatedBy: '  admin  ' });

      expect(createdData().bnkCreatedBy).toBe('admin');
    });

    it('falls back to the default actor when nobody is named and no user is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.save({ bnkName: 'Canara Bank' });

      expect(createdData().bnkCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('refuses a blank name before opening a transaction', async () => {
      const refusal = await refusalOf(service.save({ bnkName: '   ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'bnkName', code: BankListErrorCode.NAME_REQUIRED }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a name another live bank holds, compared case-insensitively', async () => {
      prisma.bankMaster.findFirst.mockResolvedValue({ bnkId: 'other' });

      const refusal = await refusalOf(service.save({ bnkName: 'state bank of india' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'bnkName', code: BankListErrorCode.NAME_DUPLICATE }] },
      });
      expect(prisma.bankMaster.findFirst).toHaveBeenCalledWith({
        where: {
          bnkIsDeleted: false,
          bnkName: { equals: 'state bank of india', mode: 'insensitive' },
        },
        select: { bnkId: true },
      });
      expect(prisma.bankMaster.create).not.toHaveBeenCalled();
    });

    it('answers a unique-index race (P2002) with the same 409', async () => {
      prisma.bankMaster.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save({ bnkName: 'Canara Bank' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: BankListErrorCode.NAME_DUPLICATE }] },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.bankMaster.create.mockRejectedValue(failure);

      await expect(service.save({ bnkName: 'Canara Bank' })).rejects.toBe(failure);
    });
  });

  describe('save — update (bnkId present)', () => {
    it('refuses an id that names no live bank', async () => {
      const refusal = await refusalOf(service.save({ bnkId: BANK_ID, bnkName: 'SBI' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'bnkId', code: BankListErrorCode.NOT_FOUND }] },
      });
      expect(prisma.bankMaster.update).not.toHaveBeenCalled();
    });

    it('checks the name against every bank but itself, then writes and audits the change', async () => {
      prisma.bankMaster.findFirst.mockResolvedValueOnce(bankRow()).mockResolvedValueOnce(null);

      const payload = await service.save({
        bnkId: BANK_ID,
        bnkName: ' State Bank ',
        bnkIsActive: false,
      });

      expect(prisma.bankMaster.findFirst).toHaveBeenLastCalledWith({
        where: {
          bnkIsDeleted: false,
          bnkName: { equals: 'State Bank', mode: 'insensitive' },
          bnkId: { not: BANK_ID },
        },
        select: { bnkId: true },
      });
      expect(updatedCall()).toEqual({
        where: { bnkId: BANK_ID },
        data: {
          bnkName: 'State Bank',
          bnkModifiedOn: expect.any(Date),
          bnkModifiedBy: USER_ID,
          bnkIsActive: false,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: BANK_ID,
        originalRecord: expect.objectContaining({ bnkName: 'State Bank of India' }),
        modifiedRecord: payload,
      });
    });
  });

  describe('list', () => {
    it('refuses when no grid is configured for the bank master', async () => {
      const refusal = await refusalOf(service.list({}));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'list', code: BankListErrorCode.GRID_NOT_CONFIGURED }] },
      });
    });

    it('pages the configured grid and reports the page count', async () => {
      grid.loadCandidates.mockResolvedValue([{ gridId: 7n, gridSql: 'SELECT * FROM bank' }]);
      grid.runPagedQuery.mockResolvedValue({ items: [{ bnkName: 'SBI' }], total: 25 });

      const result = await service.list({ page: 2, limit: 10, search: 'sb' });

      expect(grid.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'bank_list_grid', search: 'sb', limit: 10, skip: 10 }),
      );
      expect(result).toEqual({
        items: [{ bnkName: 'SBI' }],
        meta: { page: 2, limit: 10, total: 25, total_pages: 3 },
      });
    });
  });

  describe('getById', () => {
    it('returns the live bank as a payload with ISO dates', async () => {
      prisma.bankMaster.findFirst.mockResolvedValue(
        bankRow({ bnkSyncDate: new Date('2026-10-02T00:00:00.000Z') }),
      );

      await expect(service.getById(BANK_ID)).resolves.toMatchObject({
        bnkId: BANK_ID,
        bnkSyncDate: '2026-10-02T00:00:00.000Z',
        bnkModifiedOn: CREATED_ON.toISOString(),
      });
      expect(prisma.bankMaster.findFirst).toHaveBeenCalledWith({
        where: { bnkId: BANK_ID, bnkIsDeleted: false },
      });
    });

    it('refuses an id with no live bank', async () => {
      const refusal = await refusalOf(service.getById(BANK_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: BankListErrorCode.NOT_FOUND }] },
      });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live bank', async () => {
      const refusal = await refusalOf(service.softDelete(BANK_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.bankMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses while ledger bank accounts still name the bank', async () => {
      prisma.bankMaster.findFirst.mockResolvedValue(bankRow());
      prisma.accLedgerBankAccount.count.mockResolvedValue(2);

      const refusal = await refusalOf(service.softDelete(BANK_ID));

      expect(prisma.accLedgerBankAccount.count).toHaveBeenCalledWith({
        where: { lbaBankName: 'State Bank of India', lbaIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'bnkId',
              code: BankListErrorCode.IN_USE,
              message: `Bank ${BANK_ID} is used in 2 ledger bank account(s).`,
            },
          ],
        },
      });
      expect(prisma.bankMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.bankMaster.findFirst.mockResolvedValue(bankRow());
      prisma.bankMaster.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(BANK_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the bank deleted and inactive, and audits it as a cancel', async () => {
      prisma.bankMaster.findFirst.mockResolvedValue(bankRow());

      await expect(service.softDelete(BANK_ID)).resolves.toEqual({
        bnkId: BANK_ID,
        deleted: true,
      });
      expect(prisma.bankMaster.updateMany).toHaveBeenCalledWith({
        where: { bnkId: BANK_ID, bnkIsDeleted: false },
        data: {
          bnkIsDeleted: true,
          bnkIsActive: false,
          bnkModifiedOn: expect.any(Date),
          bnkModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'State Bank of India',
        originalRecord: expect.objectContaining({ bnkIsDeleted: false }),
        modifiedRecord: expect.objectContaining({ bnkIsDeleted: true, bnkIsActive: false }),
      });
    });
  });
});
