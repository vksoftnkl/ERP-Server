import { ConflictException, HttpException } from '@nestjs/common';
import { SaleAgent } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { SaveSaleAgentDto } from './dto/save-sale-agent.dto';
import { SaleAgentService } from './sale-agent.service';
import { SaleAgentErrorCode } from './types/sale-agent-error-codes';

const SA_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e202';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e203';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e204';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e205';
const ACC_GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e206';
const LEDGER_GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e207';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e208';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const agentRow = (overrides: Partial<SaleAgent> = {}): SaleAgent => ({
  saId: SA_ID,
  saCompanyId: COMPANY_ID,
  saBranchId: null,
  saGroupId: GROUP_ID,
  saCode: 'SA01',
  saName: 'Agent One',
  saAlias: null,
  saMobile1: null,
  saMobile2: null,
  saAddr1: null,
  saAddr2: null,
  saCity: null,
  saDistrict: null,
  saState: null,
  saPincode: null,
  saPanNo: null,
  saGstin: null,
  saRemarks: null,
  saIsActive: true,
  saIsDeleted: false,
  saSyncDate: null,
  saCreatedBy: USER_ID,
  saCreatedOn: STAMP,
  saModifiedBy: USER_ID,
  saModifiedOn: STAMP,
  ...overrides,
});

const saveDto = (overrides: Partial<SaveSaleAgentDto> = {}): SaveSaleAgentDto => ({
  saCompanyId: COMPANY_ID,
  saGroupId: GROUP_ID,
  saName: '  Agent One  ',
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
  saleAgent: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  accLedgerMaster: { findFirst: jest.Mock; updateMany: jest.Mock };
  accGroupMaster: { findFirst: jest.Mock };
  company: { findFirst: jest.Mock };
  branchMaster: { findFirst: jest.Mock };
  saleAgentGroup: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

type Where = { where: Record<string, unknown> };

describe('SaleAgentService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let ledgers: { createLedgerWithinTx: jest.Mock; updateLedgerWithinTx: jest.Mock };
  let service: SaleAgentService;
  /** What the existence read of the agent itself returns (the update/delete target). */
  let storedAgent: SaleAgent | null;
  /** What the duplicate-name and duplicate-code reads return. */
  let nameClash: { saId: string } | null;
  let codeClash: { saId: string } | null;

  beforeEach(() => {
    storedAgent = null;
    nameClash = null;
    codeClash = null;
    prisma = {
      saleAgent: {
        findFirst: jest.fn(async ({ where }: Where) => {
          if ('saName' in where) return nameClash;
          if ('saCode' in where) return codeClash;
          return storedAgent;
        }),
        create: jest.fn(async ({ data }: { data: Partial<SaleAgent> }) => agentRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<SaleAgent> }) => agentRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accLedgerMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accGroupMaster: { findFirst: jest.fn().mockResolvedValue({ accGroupId: ACC_GROUP_ID }) },
      company: { findFirst: jest.fn().mockResolvedValue({ compId: COMPANY_ID }) },
      branchMaster: { findFirst: jest.fn().mockResolvedValue({ brId: BRANCH_ID }) },
      saleAgentGroup: { findFirst: jest.fn().mockResolvedValue({ saGrpId: GROUP_ID }) },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    ledgers = {
      createLedgerWithinTx: jest.fn().mockResolvedValue({ ledId: LEDGER_ID }),
      updateLedgerWithinTx: jest.fn().mockResolvedValue({}),
    };
    service = new SaleAgentService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
      ledgers as never,
    );
  });

  const createdData = () =>
    (prisma.saleAgent.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.saleAgent.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const findWhere = (key: 'saName' | 'saCode') =>
    prisma.saleAgent.findFirst.mock.calls
      .map(([args]) => (args as Where).where)
      .find((where) => key in where);
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — create', () => {
    it('provisions a ledger under an account group and takes its id as the agent id', async () => {
      const payload = await service.save(
        saveDto({ saCode: ' SA01 ', saMobile1: '9840000003', saState: 'Kerala' }),
      );

      expect(ledgers.createLedgerWithinTx).toHaveBeenCalledWith(
        {
          ledGroupId: ACC_GROUP_ID,
          ledName: 'Agent One',
          ledCompanyId: COMPANY_ID,
          ledBranchId: null,
          ledPhone1: '9840000003',
          ledStateName: 'Kerala',
        },
        prisma,
      );
      expect(createdData()).toEqual({
        saId: LEDGER_ID,
        saCompanyId: COMPANY_ID,
        saBranchId: null,
        saGroupId: GROUP_ID,
        saCode: 'SA01',
        saName: 'Agent One',
        saCreatedOn: expect.any(Date),
        saCreatedBy: USER_ID,
        saModifiedOn: expect.any(Date),
        saModifiedBy: USER_ID,
        saMobile1: '9840000003',
        saState: 'Kerala',
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'sale agents',
        pk: LEDGER_ID,
        displayName: 'Agent One',
        originalRecord: null,
        modifiedRecord: payload,
      });
    });

    it('stores a blank code as no code and checks no code uniqueness', async () => {
      await service.save(saveDto({ saCode: '   ' }));

      expect(createdData().saCode).toBeNull();
      expect(findWhere('saCode')).toBeUndefined();
    });

    it('takes saCreatedBy from the body over the request user', async () => {
      await service.save(saveDto({ saCreatedBy: 'importer' }));

      expect(createdData()).toMatchObject({ saCreatedBy: 'importer', saModifiedBy: 'importer' });
    });

    it('refuses a blank name before opening a transaction', async () => {
      const refusal = await refusalOf(service.save(saveDto({ saName: '  ' })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'saName', code: SaleAgentErrorCode.NAME_REQUIRED }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['company', 'company', 'saCompanyId', SaleAgentErrorCode.COMPANY_NOT_FOUND],
      ['branch', 'branchMaster', 'saBranchId', SaleAgentErrorCode.BRANCH_NOT_FOUND],
      ['agent group', 'saleAgentGroup', 'saGroupId', SaleAgentErrorCode.GROUP_NOT_FOUND],
    ] as const)(
      'refuses an unknown %s before any ledger is made',
      async (_l, model, field, code) => {
        prisma[model].findFirst.mockResolvedValue(null);

        const refusal = await refusalOf(service.save(saveDto({ saBranchId: BRANCH_ID })));

        expect(refusal).toMatchObject({ status: 400, body: { errors: [{ field, code }] } });
        expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
      },
    );

    it('does not look the branch up when none is named', async () => {
      await service.save(saveDto());

      expect(prisma.branchMaster.findFirst).not.toHaveBeenCalled();
    });

    it('refuses a name another live agent of the company holds', async () => {
      nameClash = { saId: 'other' };

      const refusal = await refusalOf(service.save(saveDto()));

      expect(findWhere('saName')).toEqual({
        saIsDeleted: false,
        saCompanyId: COMPANY_ID,
        saName: { equals: 'Agent One', mode: 'insensitive' },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'saName', code: SaleAgentErrorCode.NAME_EXISTS }] },
      });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('refuses a code another live agent of the company holds', async () => {
      codeClash = { saId: 'other' };

      const refusal = await refusalOf(service.save(saveDto({ saCode: 'sa01' })));

      expect(findWhere('saCode')).toEqual({
        saIsDeleted: false,
        saCompanyId: COMPANY_ID,
        saCode: { equals: 'sa01', mode: 'insensitive' },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'saCode', code: SaleAgentErrorCode.CODE_EXISTS }] },
      });
    });

    it('refuses when there is no account group to file the ledger under', async () => {
      prisma.accGroupMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(saveDto()));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'request', code: SaleAgentErrorCode.NO_ACCOUNT_GROUP }] },
      });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('answers a unique-index race (P2002) with a 409 DUPLICATE', async () => {
      prisma.saleAgent.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save(saveDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'saName', code: SaleAgentErrorCode.DUPLICATE }] },
      });
    });

    it('answers a foreign-key failure (P2003) with a 400 REFERENCE_NOT_FOUND', async () => {
      prisma.saleAgent.create.mockRejectedValue(
        Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }),
      );

      const refusal = await refusalOf(service.save(saveDto()));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'request', code: SaleAgentErrorCode.REFERENCE_NOT_FOUND }] },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.saleAgent.create.mockRejectedValue(failure);

      await expect(service.save(saveDto())).rejects.toBe(failure);
    });
  });

  describe('save — update', () => {
    beforeEach(() => {
      storedAgent = agentRow({ saBranchId: BRANCH_ID });
      prisma.accLedgerMaster.findFirst.mockResolvedValue({
        ledId: SA_ID,
        ledName: 'Agent One',
        ledGroupId: LEDGER_GROUP_ID,
      });
    });

    it('refuses an id with no live agent', async () => {
      storedAgent = null;

      const refusal = await refusalOf(service.save(saveDto({ saId: SA_ID })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'saId', code: SaleAgentErrorCode.NOT_FOUND }] },
      });
      expect(prisma.saleAgent.update).not.toHaveBeenCalled();
    });

    it('checks name and code against every agent of the company but itself', async () => {
      await service.save(saveDto({ saId: SA_ID, saCode: 'SA02' }));

      expect(findWhere('saName')).toMatchObject({ saId: { not: SA_ID } });
      expect(findWhere('saCode')).toMatchObject({
        saCode: { equals: 'SA02', mode: 'insensitive' },
        saId: { not: SA_ID },
      });
    });

    it('writes the identity fields and the modifier', async () => {
      await service.save(
        saveDto({ saId: SA_ID, saCode: ' SA02 ', saBranchId: null, saModifiedBy: 'hq' }),
      );

      expect(prisma.saleAgent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { saId: SA_ID } }),
      );
      expect(updatedData()).toMatchObject({
        saCompanyId: COMPANY_ID,
        saBranchId: null,
        saGroupId: GROUP_ID,
        saCode: 'SA02',
        saName: 'Agent One',
        saModifiedOn: expect.any(Date),
        saModifiedBy: 'hq',
      });
    });

    it('clears the code when the update sends null', async () => {
      await service.save(saveDto({ saId: SA_ID, saCode: null, saBranchId: BRANCH_ID }));

      expect(updatedData().saCode).toBeNull();
      expect(findWhere('saCode')).toBeUndefined();
    });

    it('syncs the linked ledger, keeping the group the ledger is filed under', async () => {
      await service.save(
        saveDto({ saId: SA_ID, saBranchId: BRANCH_ID, saCode: null, saIsActive: false }),
      );

      expect(ledgers.updateLedgerWithinTx).toHaveBeenCalledWith(
        {
          ledId: SA_ID,
          ledGroupId: LEDGER_GROUP_ID,
          ledName: 'Agent One',
          ledCompanyId: COMPANY_ID,
          ledBranchId: BRANCH_ID,
          ledIsActive: false,
        },
        prisma,
      );
      expect(prisma.accGroupMaster.findFirst).not.toHaveBeenCalled();
    });

    it('leaves a legacy agent with no linked ledger alone', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(null);

      await service.save(saveDto({ saId: SA_ID, saBranchId: BRANCH_ID, saCode: null }));

      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ saCode: 'SA01' }),
        notes: 'Sale agent updated',
      });
    });

    it('words a ledger name clash as an agent name clash', async () => {
      ledgers.updateLedgerWithinTx.mockRejectedValue(new ConflictException('ledName taken'));

      const refusal = await refusalOf(
        service.save(saveDto({ saId: SA_ID, saBranchId: BRANCH_ID, saCode: null })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'saName', code: SaleAgentErrorCode.NAME_EXISTS }] },
      });
    });

    it('rethrows any other ledger failure untouched', async () => {
      const failure = new Error('ledger write failed');
      ledgers.updateLedgerWithinTx.mockRejectedValue(failure);

      await expect(
        service.save(saveDto({ saId: SA_ID, saBranchId: BRANCH_ID, saCode: null })),
      ).rejects.toBe(failure);
    });
  });

  describe('getById', () => {
    it('refuses an id with no live agent', async () => {
      const refusal = await refusalOf(service.getById(SA_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: SaleAgentErrorCode.NOT_FOUND }] },
      });
    });

    it('carries the company, branch and group names it was read with', async () => {
      storedAgent = {
        ...agentRow({ saBranchId: BRANCH_ID }),
        company: { compName: 'Zeta' },
        branch: { brName: 'Main Branch' },
        group: { saGrpName: 'Field' },
      } as unknown as SaleAgent;

      await expect(service.getById(SA_ID)).resolves.toMatchObject({
        saId: SA_ID,
        saCompanyName: 'Zeta',
        saBranchName: 'Main Branch',
        saGroupName: 'Field',
        saCreatedOn: STAMP.toISOString(),
      });
      expect(prisma.saleAgent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { saId: SA_ID, saIsDeleted: false },
          include: expect.objectContaining({ company: expect.anything() }) as object,
        }),
      );
    });

    it('answers null for a branch the agent does not have', async () => {
      storedAgent = {
        ...agentRow(),
        company: { compName: 'Zeta' },
        branch: null,
        group: { saGrpName: 'Field' },
      } as unknown as SaleAgent;

      await expect(service.getById(SA_ID)).resolves.toMatchObject({ saBranchName: null });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live agent', async () => {
      const refusal = await refusalOf(service.softDelete(SA_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.saleAgent.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      storedAgent = agentRow();
      prisma.saleAgent.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(SA_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.accLedgerMaster.updateMany).not.toHaveBeenCalled();
    });

    it('deletes the agent and its linked ledger together', async () => {
      storedAgent = agentRow();
      context.getUserId.mockReturnValue(null);

      await expect(service.softDelete(SA_ID)).resolves.toEqual({ saId: SA_ID, deleted: true });
      expect(prisma.saleAgent.updateMany).toHaveBeenCalledWith({
        where: { saId: SA_ID, saIsDeleted: false },
        data: {
          saIsDeleted: true,
          saIsActive: false,
          saModifiedOn: expect.any(Date),
          saModifiedBy: DEFAULT_ACTOR,
        },
      });
      expect(prisma.accLedgerMaster.updateMany).toHaveBeenCalledWith({
        where: { ledId: SA_ID, ledIsDeleted: false },
        data: {
          ledIsDeleted: true,
          ledIsActive: false,
          ledModifiedOn: expect.any(Date),
          ledModifiedBy: DEFAULT_ACTOR,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Agent One',
        modifiedRecord: expect.objectContaining({ saIsDeleted: true, saIsActive: false }),
        userId: DEFAULT_ACTOR,
      });
    });
  });
});
