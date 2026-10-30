import { HttpException } from '@nestjs/common';
import { BranchMaster, Company, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { BranchMasterService, MAIN_BRANCH_NAME, MAIN_BRANCH_TYPE } from './branch-master.service';
import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import { BranchMasterErrorCode } from './types/branch-master-error-codes';

const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e202';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e203';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e204';
const BANK_ID = '019c6f6c-be87-7a11-8905-36092c46e205';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46e206';
const STAMP = new Date('2026-10-01T04:30:00.000Z');
/** State 33 (Tamil Nadu), PAN ABCDE1234F. */
const GSTIN = '33ABCDE1234F1Z5';
const PAN = 'ABCDE1234F';

const branchRow = (overrides: Partial<BranchMaster> = {}): BranchMaster => ({
  brId: BRANCH_ID,
  brCompId: COMPANY_ID,
  brCode: null,
  brName: 'Anna Nagar',
  brMailingName: null,
  brAlias: null,
  brShort: null,
  brType: null,
  brIsDefault: false,
  brIsActive: true,
  brAddr1: null,
  brAddr2: null,
  brAddr3: null,
  brCity: null,
  brDistrict: null,
  brState: null,
  brStateCode: '33',
  brPin: null,
  brCountry: 'India',
  brLandmark: null,
  brRegionAddr1: null,
  brRegionAddr2: null,
  brRegionAddr3: null,
  brRegionCity: null,
  brRegionDistrict: null,
  brRegionState: null,
  brRegionCountry: null,
  brRegionName: null,
  brContactPerson: null,
  brTel: null,
  brPhone: null,
  brMail: null,
  brBillPrefix: null,
  brInvoiceSeriesPrefix: null,
  brBillGreeting: null,
  brTerms: null,
  brRoundingMode: null,
  brRoundingValue: null,
  brDefaultGodownId: null,
  brPosType: null,
  brAllowNegativeStock: false,
  brSmsApplicable: false,
  brBankId: null,
  brFssaiNo: null,
  brFssaiLicenseType: null,
  brFssaiValidUpto: null,
  brGstinNo: null,
  brGstRegType: null,
  brPanNo: null,
  brIsDeleted: false,
  brSyncDate: null,
  brCreatedOn: STAMP,
  brCreatedBy: USER_ID,
  brModifiedOn: STAMP,
  brModifiedBy: USER_ID,
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

type Where = Record<string, unknown>;
type PrismaMock = {
  branchMaster: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
  company: { findFirst: jest.Mock };
  accLedgerMaster: { findFirst: jest.Mock };
  godownLocation: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

describe('BranchMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let godowns: { seedMainGodown: jest.Mock };
  let service: BranchMasterService;
  /** What the existence reads (get / update / delete / restore) find. */
  let stored: BranchMaster | null;
  /** Which uniqueness reads find another branch, and whether another default exists. */
  let clash: { name: boolean; code: boolean; otherDefault: boolean };
  /** Whether the company named is live. */
  let companyLive: boolean;

  beforeEach(() => {
    stored = null;
    clash = { name: false, code: false, otherDefault: false };
    companyLive = true;
    prisma = {
      branchMaster: {
        findFirst: jest.fn(async ({ where }: { where: Where }) => {
          if ('brName' in where) return clash.name ? { brId: 'other' } : null;
          if ('brCode' in where) return clash.code ? { brId: 'other' } : null;
          if ('brIsDefault' in where) return clash.otherDefault ? { brId: 'other' } : null;
          return stored;
        }),
        create: jest.fn(async ({ data }: { data: Partial<BranchMaster> }) => branchRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<BranchMaster> }) => ({
          ...(stored ?? branchRow()),
          ...data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      company: {
        findFirst: jest.fn(async ({ select }: { select: Record<string, boolean> }) => {
          if (select.compName) return { compName: 'Zeta Traders' };
          return companyLive ? { compId: COMPANY_ID } : null;
        }),
      },
      accLedgerMaster: { findFirst: jest.fn().mockResolvedValue({ ledName: 'HDFC Current' }) },
      godownLocation: { findFirst: jest.fn().mockResolvedValue({ gdlName: 'Main Godown' }) },
      // countLiveReferences: one row per reference that has any.
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    godowns = {
      seedMainGodown: jest.fn().mockResolvedValue({ gdl_id: GODOWN_ID, gdl_name: 'Main Godown' }),
    };
    service = new BranchMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      { getUserId: jest.fn().mockReturnValue(USER_ID) } as never,
      godowns as never,
    );
  });

  const create = (extra: Partial<SaveBranchMasterDto> = {}) =>
    service.save({ brCompId: COMPANY_ID, brName: 'Anna Nagar', brStateCode: '33', ...extra });
  const update = (extra: Partial<SaveBranchMasterDto> = {}) =>
    service.save({
      brId: BRANCH_ID,
      brCompId: COMPANY_ID,
      brName: 'Anna Nagar',
      brStateCode: '33',
      ...extra,
    });
  const createdData = () =>
    (prisma.branchMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.branchMaster.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;
  const errorsOf = (refusal: { body: unknown }) =>
    (refusal.body as { errors: Array<{ field: string; code: string; message: string }> }).errors;

  describe('create', () => {
    it('writes the trimmed name, the upper-cased state and the sent optional fields', async () => {
      const payload = await create({
        brName: '  Anna Nagar ',
        brStateCode: ' tn ',
        brCity: 'Chennai',
        brRoundingValue: 0.5,
      });

      expect(createdData()).toEqual({
        brCompId: COMPANY_ID,
        brName: 'Anna Nagar',
        brStateCode: 'TN',
        brCreatedOn: expect.any(Date),
        brCreatedBy: USER_ID,
        brCity: 'Chennai',
        brRoundingValue: 0.5,
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'branch master',
        pk: BRANCH_ID,
        originalRecord: null,
        modifiedRecord: payload,
        notes: 'Branch created',
      });
    });

    it('refuses a blank name', async () => {
      const refusal = await refusalOf(create({ brName: '  ' }));

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'brName', code: BranchMasterErrorCode.NAME_REQUIRED }),
      ]);
    });

    it('refuses a state code that is not two characters', async () => {
      const refusal = await refusalOf(create({ brStateCode: 'T' }));

      expect(errorsOf(refusal)).toEqual([
        {
          field: 'brStateCode',
          code: BranchMasterErrorCode.STATE_CODE_INVALID,
          message: 'brStateCode must be exactly 2 characters',
        },
      ]);
    });

    it('refuses a company that is missing or deleted', async () => {
      companyLive = false;

      const refusal = await refusalOf(create());

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID, compIsDeleted: false },
        select: { compId: true },
      });
      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'compId', code: BranchMasterErrorCode.COMPANY_NOT_FOUND }),
      ]);
      expect(prisma.branchMaster.create).not.toHaveBeenCalled();
    });

    it('refuses a name a live branch of the same company holds', async () => {
      clash.name = true;

      const refusal = await refusalOf(create({ brName: 'anna nagar' }));

      expect(prisma.branchMaster.findFirst).toHaveBeenCalledWith({
        where: {
          brCompId: COMPANY_ID,
          brIsDeleted: false,
          brName: { equals: 'anna nagar', mode: 'insensitive' },
        },
        select: { brId: true },
      });
      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'brName', code: BranchMasterErrorCode.NAME_DUPLICATE }),
      ]);
    });

    it('refuses a code any branch holds, across companies', async () => {
      clash.code = true;

      const refusal = await refusalOf(create({ brCode: 'AN01' }));

      expect(prisma.branchMaster.findFirst).toHaveBeenCalledWith({
        where: { brCode: { equals: 'AN01', mode: 'insensitive' } },
        select: { brId: true },
      });
      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'brCode', code: BranchMasterErrorCode.CODE_DUPLICATE }),
      ]);
    });

    it('skips the code check when no code is sent', async () => {
      await create();

      expect(prisma.branchMaster.findFirst).toHaveBeenCalledTimes(1);
    });

    it('answers a unique-index race (P2002) with a 409 on brCode', async () => {
      prisma.branchMaster.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(create());

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'brCode', code: BranchMasterErrorCode.DUPLICATE }),
      ]);
    });

    it('moves the company default to a new default branch', async () => {
      await create({ brIsDefault: true });

      expect(prisma.branchMaster.updateMany).toHaveBeenCalledWith({
        where: { brCompId: COMPANY_ID, brIsDeleted: false, brIsDefault: true },
        data: { brIsDefault: false, brModifiedOn: expect.any(Date), brModifiedBy: USER_ID },
      });
      expect(createdData().brIsDefault).toBe(true);
    });

    it('fills a blank PAN from the GSTIN', async () => {
      await create({ brGstinNo: GSTIN });

      expect(createdData()).toMatchObject({ brGstinNo: GSTIN, brPanNo: PAN });
    });

    it('refuses a GSTIN of another state and of another PAN, each under its own code', async () => {
      const refusal = await refusalOf(
        create({ brGstinNo: `27${GSTIN.slice(2)}`, brPanNo: 'ZZZZZ9999Z' }),
      );

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        {
          field: 'brGstinNo',
          code: BranchMasterErrorCode.GSTIN_STATE_MISMATCH,
          message: `GSTIN 27${GSTIN.slice(2)} is registered in state 27, but brStateCode is 33`,
        },
        expect.objectContaining({
          field: 'brPanNo',
          code: BranchMasterErrorCode.PAN_GSTIN_MISMATCH,
        }),
      ]);
    });

    it('refuses a GSTIN that is not GSTIN-shaped', async () => {
      const refusal = await refusalOf(create({ brGstinNo: '33ABC' }));

      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'brGstinNo', code: BranchMasterErrorCode.GSTIN_INVALID }),
      ]);
    });
  });

  describe('update', () => {
    it('refuses an id with no live branch', async () => {
      const refusal = await refusalOf(update());

      expect(refusal.status).toBe(404);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'brId', code: BranchMasterErrorCode.NOT_FOUND }),
      ]);
    });

    it('refuses to untick the default branch (notes 78 item 5)', async () => {
      stored = branchRow({ brIsDefault: true });

      const refusal = await refusalOf(update({ brIsDefault: false }));

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'brIsDefault',
          code: BranchMasterErrorCode.DEFAULT_UNSET_REFUSED,
        }),
      ]);
      expect(prisma.branchMaster.update).not.toHaveBeenCalled();
    });

    it('lets the default branch be saved with the flag left on or left out', async () => {
      stored = branchRow({ brIsDefault: true });

      await update({ brIsDefault: true });
      await update();

      expect(prisma.branchMaster.update).toHaveBeenCalledTimes(2);
    });

    it('takes the default from the company’s other branches, not from itself', async () => {
      stored = branchRow();

      await update({ brIsDefault: true });

      expect(prisma.branchMaster.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            brCompId: COMPANY_ID,
            brIsDeleted: false,
            brIsDefault: true,
            brId: { not: BRANCH_ID },
          },
        }),
      );
    });

    it('checks name and code against every branch but itself', async () => {
      stored = branchRow();

      await update({ brCode: 'AN01' });

      expect(prisma.branchMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ brName: expect.anything(), brId: { not: BRANCH_ID } }),
        }),
      );
      expect(prisma.branchMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { brCode: { equals: 'AN01', mode: 'insensitive' }, brId: { not: BRANCH_ID } },
        }),
      );
    });

    it('does not count references when the company stays the same', async () => {
      stored = branchRow();

      await update();

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('refuses to move the default branch to another company', async () => {
      stored = branchRow({ brIsDefault: true });

      const refusal = await refusalOf(update({ brCompId: OTHER_COMPANY_ID }));

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'brCompId',
          code: BranchMasterErrorCode.DEFAULT_IMMOVABLE,
        }),
      ]);
    });

    it('refuses to move a branch that holds documents, naming them', async () => {
      stored = branchRow();
      prisma.$queryRaw.mockResolvedValue([
        { ord: 10, n: 3n },
        { ord: 14, n: 1n },
      ]);

      const refusal = await refusalOf(update({ brCompId: OTHER_COMPANY_ID }));

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        {
          field: 'brCompId',
          code: BranchMasterErrorCode.IN_USE_IMMOVABLE,
          message: 'Anna Nagar cannot move to another company: it has 3 sale bills, 1 users',
        },
      ]);
      expect(prisma.branchMaster.update).not.toHaveBeenCalled();
    });

    it('moves an unused branch, checking the new company and its names', async () => {
      stored = branchRow();

      await update({ brCompId: OTHER_COMPANY_ID });

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { compId: OTHER_COMPANY_ID, compIsDeleted: false },
        select: { compId: true },
      });
      expect(prisma.branchMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ brCompId: OTHER_COMPANY_ID }),
        }),
      );
      expect(updatedData()).toMatchObject({ brCompId: OTHER_COMPANY_ID });
    });

    it('checks an update that omits the GSTIN against the stored one', async () => {
      stored = branchRow({ brGstinNo: GSTIN, brPanNo: PAN });

      const refusal = await refusalOf(update({ brStateCode: '29' }));

      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'brGstinNo',
          code: BranchMasterErrorCode.GSTIN_STATE_MISMATCH,
        }),
      ]);
    });

    it('writes the change and audits the before and after', async () => {
      stored = branchRow();

      const payload = await update({ brName: 'Anna Nagar West', brTel: '044-1234' });

      expect(updatedData()).toEqual({
        brCompId: COMPANY_ID,
        brName: 'Anna Nagar West',
        brStateCode: '33',
        brModifiedOn: expect.any(Date),
        brModifiedBy: USER_ID,
        brTel: '044-1234',
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ brName: 'Anna Nagar' }),
        modifiedRecord: payload,
        notes: 'Branch updated',
      });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live branch', async () => {
      const refusal = await refusalOf(service.getById(BRANCH_ID));

      expect(refusal.status).toBe(404);
    });

    it('adds the company, bank and default godown names', async () => {
      stored = branchRow({
        brBankId: BANK_ID,
        brDefaultGodownId: GODOWN_ID,
        brRoundingValue: new Prisma.Decimal('0.50'),
        brFssaiValidUpto: new Date('2027-01-31T00:00:00.000Z'),
      });

      await expect(service.getById(BRANCH_ID)).resolves.toMatchObject({
        brId: BRANCH_ID,
        brCompName: 'Zeta Traders',
        brBankName: 'HDFC Current',
        brDefaultGodownName: 'Main Godown',
        brRoundingValue: 0.5,
        brFssaiValidUpto: '2027-01-31T00:00:00.000Z',
      });
    });

    it('looks up no bank or godown the branch does not name', async () => {
      stored = branchRow();

      await expect(service.getById(BRANCH_ID)).resolves.toMatchObject({
        brBankName: null,
        brDefaultGodownName: null,
      });
      expect(prisma.accLedgerMaster.findFirst).not.toHaveBeenCalled();
      expect(prisma.godownLocation.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('softDelete (notes 72 B3)', () => {
    it('refuses an id with no live branch', async () => {
      const refusal = await refusalOf(service.softDelete(BRANCH_ID));

      expect(refusal.status).toBe(404);
    });

    it('refuses the default branch while the company has other live branches', async () => {
      stored = branchRow({ brIsDefault: true });
      prisma.branchMaster.count.mockResolvedValue(2);

      const refusal = await refusalOf(service.softDelete(BRANCH_ID));

      expect(prisma.branchMaster.count).toHaveBeenCalledWith({
        where: { brCompId: COMPANY_ID, brIsDeleted: false, brId: { not: BRANCH_ID } },
      });
      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'brId',
          code: BranchMasterErrorCode.DEFAULT_UNDELETABLE,
        }),
      ]);
    });

    it('lets the company’s only branch go once it is unused', async () => {
      stored = branchRow({ brIsDefault: true });

      await expect(service.softDelete(BRANCH_ID)).resolves.toEqual({
        brId: BRANCH_ID,
        deleted: true,
      });
    });

    it('refuses while documents, stock, users or devices use it, naming each', async () => {
      stored = branchRow();
      prisma.$queryRaw.mockResolvedValue([
        { ord: 0, n: 4n },
        { ord: 15, n: 2n },
      ]);

      const refusal = await refusalOf(service.softDelete(BRANCH_ID));

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        {
          field: 'brId',
          code: BranchMasterErrorCode.IN_USE,
          message:
            'Used by 4 stock balance rows, 2 devices. A deleted branch would leave them under a ' +
            'branch nobody can open.',
        },
      ]);
      expect(prisma.branchMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      stored = branchRow();
      prisma.branchMaster.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(BRANCH_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the branch deleted and inactive, and audits a cancel', async () => {
      stored = branchRow();

      await service.softDelete(BRANCH_ID);

      expect(prisma.branchMaster.updateMany).toHaveBeenCalledWith({
        where: { brId: BRANCH_ID, brIsDeleted: false },
        data: {
          brIsDeleted: true,
          brIsActive: false,
          brModifiedOn: expect.any(Date),
          brModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Anna Nagar',
        modifiedRecord: expect.objectContaining({ brIsDeleted: true, brIsActive: false }),
      });
    });
  });

  describe('restore (notes 72 B1)', () => {
    it('refuses an id that names no branch at all', async () => {
      const refusal = await refusalOf(service.restore(BRANCH_ID));

      expect(refusal.status).toBe(404);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ message: `No branch found with id ${BRANCH_ID}` }),
      ]);
    });

    it('refuses a branch that is not deleted', async () => {
      stored = branchRow();

      const refusal = await refusalOf(service.restore(BRANCH_ID));

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ code: BranchMasterErrorCode.NOT_DELETED }),
      ]);
    });

    it('waits for its company to be restored first', async () => {
      stored = branchRow({ brIsDeleted: true });
      companyLive = false;

      const refusal = await refusalOf(service.restore(BRANCH_ID));

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'brCompId',
          code: BranchMasterErrorCode.COMPANY_DELETED,
        }),
      ]);
    });

    it('refuses when a live branch of the company has taken its name', async () => {
      stored = branchRow({ brIsDeleted: true });
      clash.name = true;

      const refusal = await refusalOf(service.restore(BRANCH_ID));

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ code: BranchMasterErrorCode.NAME_DUPLICATE }),
      ]);
    });

    it('brings a default branch back as the default when none other has taken it', async () => {
      stored = branchRow({ brIsDeleted: true, brIsActive: false, brIsDefault: true });

      await expect(service.restore(BRANCH_ID)).resolves.toEqual({
        brId: BRANCH_ID,
        deleted: false,
      });
      expect(prisma.branchMaster.updateMany).toHaveBeenCalledWith({
        where: { brId: BRANCH_ID, brIsDeleted: true },
        data: {
          brIsDeleted: false,
          brIsActive: true,
          brIsDefault: true,
          brModifiedOn: expect.any(Date),
          brModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({ action: 'update', notes: 'Branch restored' });
    });

    it('brings a default branch back as an ordinary one when another took the default', async () => {
      stored = branchRow({ brIsDeleted: true, brIsDefault: true });
      clash.otherDefault = true;

      await service.restore(BRANCH_ID);

      expect(prisma.branchMaster.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ brIsDefault: false }) }),
      );
    });

    it('does not look for another default when the branch was not one', async () => {
      stored = branchRow({ brIsDeleted: true });

      await service.restore(BRANCH_ID);

      expect(prisma.branchMaster.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ brIsDefault: true }) }),
      );
    });
  });

  describe('seedMainBranch (notes 78)', () => {
    const company = {
      compId: COMPANY_ID,
      compStateCode: '33',
      compCountry: 'India',
      compAddr1: '12 Mount Road',
      compAddr2: null,
      compAddr3: null,
      compCity: 'Chennai',
      compDistrict: 'Chennai',
      compState: 'Tamil Nadu',
      compPin: 600002,
      compRegionAddr1: null,
      compRegionAddr2: null,
      compRegionAddr3: null,
      compRegionCity: null,
      compRegionDistrict: null,
      compRegionState: null,
      compRegionCountry: null,
      compTel: '044-1234',
      compPhone: null,
      compMail: 'office@zeta.example',
      compGstinNo: GSTIN,
      compGstRegType: 'REGULAR',
      compPanNo: PAN,
    } as Company;

    it('creates the default Main Branch from the company, with Main Godown as its godown', async () => {
      const now = new Date('2026-10-19T05:00:00.000Z');
      prisma.branchMaster.update.mockImplementation(
        async ({ data }: { data: Partial<BranchMaster> }) =>
          branchRow({ brName: MAIN_BRANCH_NAME, ...data }),
      );

      const seeded = await service.seedMainBranch(prisma as never, company, USER_ID, now);

      expect(createdData()).toMatchObject({
        brCompId: COMPANY_ID,
        brName: MAIN_BRANCH_NAME,
        brType: MAIN_BRANCH_TYPE,
        brIsDefault: true,
        brIsActive: true,
        brAddr1: '12 Mount Road',
        brCity: 'Chennai',
        brState: 'Tamil Nadu',
        brStateCode: '33',
        brPin: 600002,
        brCountry: 'India',
        brTel: '044-1234',
        brMail: 'office@zeta.example',
        brGstinNo: GSTIN,
        brGstRegType: 'REGULAR',
        brPanNo: PAN,
        brCreatedOn: now,
        brCreatedBy: USER_ID,
        brModifiedOn: now,
        brModifiedBy: USER_ID,
      });
      // brCode is unique across every company, so the seed leaves it unset.
      expect(createdData()).not.toHaveProperty('brCode');
      expect(godowns.seedMainGodown).toHaveBeenCalledWith(prisma, BRANCH_ID, USER_ID, now);
      expect(prisma.branchMaster.update).toHaveBeenCalledWith({
        where: { brId: BRANCH_ID },
        data: { brDefaultGodownId: GODOWN_ID },
      });
      expect(seeded).toEqual({
        brId: BRANCH_ID,
        brName: MAIN_BRANCH_NAME,
        gdlId: GODOWN_ID,
        gdlName: 'Main Godown',
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        userId: USER_ID,
        notes: 'Seeded on company create',
        modifiedRecord: expect.objectContaining({ brDefaultGodownId: GODOWN_ID }),
      });
    });
  });
});
