import { ConflictException, HttpException } from '@nestjs/common';
import { SaleAgent } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { SaveSaleAgentDto } from './dto/save-sale-agent.dto';
import { createHouseValidationPipe } from '../../../common/validation/house-validation';
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

    it('copies every shared field it was sent onto the ledger under its ledger name', async () => {
      await service.save(
        saveDto({
          saBranchId: BRANCH_ID,
          saAlias: 'A1',
          saMobile1: '9840000003',
          saMobile2: '9840000004',
          saAddr1: '1 Main Rd',
          saAddr2: 'Anna Nagar',
          saCity: 'Chennai',
          saDistrict: 'Chennai',
          saState: 'Tamil Nadu',
          saPincode: '600040',
          saPanNo: 'ABCDE1234F',
          saGstin: '33ABCDE1234F1Z5',
          saRemarks: 'North beat',
          saIsActive: false,
        }),
      );

      expect(ledgers.createLedgerWithinTx).toHaveBeenCalledWith(
        {
          ledGroupId: ACC_GROUP_ID,
          ledName: 'Agent One',
          ledCompanyId: COMPANY_ID,
          ledBranchId: BRANCH_ID,
          ledAlias: 'A1',
          ledPhone1: '9840000003',
          ledPhone2: '9840000004',
          ledAddr1: '1 Main Rd',
          ledAddr2: 'Anna Nagar',
          ledCity: 'Chennai',
          ledDistrict: 'Chennai',
          ledStateName: 'Tamil Nadu',
          ledPin: '600040',
          ledPanNo: 'ABCDE1234F',
          ledGstinNo: '33ABCDE1234F1Z5',
          ledRemarks: 'North beat',
          ledIsActive: false,
        },
        prisma,
      );
      expect(createdData()).toMatchObject({ saBranchId: BRANCH_ID, saIsActive: false });
    });

    it('falls back to the default actor when nobody is named and no user is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.save(saveDto());

      expect(createdData()).toMatchObject({
        saCreatedBy: DEFAULT_ACTOR,
        saModifiedBy: DEFAULT_ACTOR,
      });
      expect(auditEntry().userId).toBe(DEFAULT_ACTOR);
    });

    it('refuses a code clash before any ledger is made', async () => {
      codeClash = { saId: 'other' };

      await refusalOf(service.save(saveDto({ saCode: 'SA01' })));

      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
      expect(prisma.saleAgent.create).not.toHaveBeenCalled();
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

    // dto-own-undefined trap: through the house ValidationPipe every declared field is
    // own (undefined when left out), so a left-out branch or code must be kept.
    it('keeps the stored branch and code when a piped update leaves them out', async () => {
      const dto = (await createHouseValidationPipe().transform(
        { saId: SA_ID, saCompanyId: COMPANY_ID, saGroupId: GROUP_ID, saName: 'Agent One' },
        { type: 'body', metatype: SaveSaleAgentDto },
      )) as SaveSaleAgentDto;
      expect(Object.prototype.hasOwnProperty.call(dto, 'saBranchId')).toBe(true);

      await service.save(dto);

      expect(updatedData()).toMatchObject({ saBranchId: BRANCH_ID, saCode: 'SA01' });
      expect(findWhere('saCode')).toMatchObject({ saCode: { equals: 'SA01', mode: 'insensitive' } });
      expect(ledgers.updateLedgerWithinTx.mock.calls[0][0]).toMatchObject({
        ledBranchId: BRANCH_ID,
      });
    });

    it('clears the branch and code when a piped update sends null', async () => {
      const dto = (await createHouseValidationPipe().transform(
        {
          saId: SA_ID,
          saCompanyId: COMPANY_ID,
          saGroupId: GROUP_ID,
          saName: 'Agent One',
          saBranchId: null,
          saCode: null,
        },
        { type: 'body', metatype: SaveSaleAgentDto },
      )) as SaveSaleAgentDto;

      await service.save(dto);

      expect(updatedData()).toMatchObject({ saBranchId: null, saCode: null });
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

    /** An update that names every identity field, so nothing falls back to the stored row. */
    const updateDto = (overrides: Partial<SaveSaleAgentDto> = {}) =>
      saveDto({ saId: SA_ID, saBranchId: BRANCH_ID, saCode: 'SA01', ...overrides });

    it('refuses a blank name and writes nothing', async () => {
      const refusal = await refusalOf(service.save(updateDto({ saName: '   ' })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'saName', code: SaleAgentErrorCode.NAME_REQUIRED }] },
      });
      expect(prisma.saleAgent.update).not.toHaveBeenCalled();
    });

    it.each([
      ['company', 'company', 'saCompanyId', SaleAgentErrorCode.COMPANY_NOT_FOUND],
      ['branch', 'branchMaster', 'saBranchId', SaleAgentErrorCode.BRANCH_NOT_FOUND],
      ['agent group', 'saleAgentGroup', 'saGroupId', SaleAgentErrorCode.GROUP_NOT_FOUND],
    ] as const)('refuses an unknown %s and writes nothing', async (_l, model, field, code) => {
      prisma[model].findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(updateDto()));

      expect(refusal).toMatchObject({ status: 400, body: { errors: [{ field, code }] } });
      expect(prisma.saleAgent.update).not.toHaveBeenCalled();
      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
    });

    it.each([
      ['name', 'saName', SaleAgentErrorCode.NAME_EXISTS],
      ['code', 'saCode', SaleAgentErrorCode.CODE_EXISTS],
    ] as const)('refuses a %s another agent of the company holds', async (clash, field, code) => {
      if (clash === 'name') nameClash = { saId: 'other' };
      else codeClash = { saId: 'other' };

      const refusal = await refusalOf(service.save(updateDto()));

      expect(refusal).toMatchObject({ status: 409, body: { errors: [{ field, code }] } });
      expect(prisma.saleAgent.update).not.toHaveBeenCalled();
    });

    it.each([
      ['P2002', 409, 'saName', SaleAgentErrorCode.DUPLICATE],
      ['P2003', 400, 'request', SaleAgentErrorCode.REFERENCE_NOT_FOUND],
    ])('answers a %s from the update with a coded %i', async (prismaCode, status, field, code) => {
      prisma.saleAgent.update.mockRejectedValue(
        Object.assign(new Error('constraint failed'), { code: prismaCode }),
      );

      const refusal = await refusalOf(service.save(updateDto()));

      expect(refusal).toMatchObject({ status, body: { errors: [{ field, code }] } });
    });

    it('carries the edited shared fields onto the agent row and its ledger', async () => {
      await service.save(updateDto({ saMobile1: '9840000009', saRemarks: null }));

      expect(updatedData()).toMatchObject({ saMobile1: '9840000009', saRemarks: null });
      expect(ledgers.updateLedgerWithinTx).toHaveBeenCalledWith(
        expect.objectContaining({ ledId: SA_ID, ledPhone1: '9840000009', ledRemarks: null }),
        prisma,
      );
    });

    it('audits the stored row against the saved one, under the modifier', async () => {
      storedAgent = agentRow({ saBranchId: BRANCH_ID, saName: 'Old Name' });
      context.getUserId.mockReturnValue(null);

      const payload = await service.save(updateDto());

      expect(updatedData().saModifiedBy).toBe(DEFAULT_ACTOR);
      expect(auditEntry()).toMatchObject({
        action: 'update',
        tableName: 'sale agents',
        pk: SA_ID,
        displayName: payload.saName,
        originalRecord: expect.objectContaining({ saName: 'Old Name' }),
        modifiedRecord: payload,
        userId: DEFAULT_ACTOR,
      });
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
