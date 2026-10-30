import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AccLedgerRole } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { collectRoleLedgerErrors } from '../ledgerRole/ledger-role.helper';
import { LedgerMapService } from './ledger-map.service';
import { LedgerMapErrorCode } from './types/ledger-map-error-codes';

jest.mock('../ledgerRole/ledger-role.helper', () => ({
  collectRoleLedgerErrors: jest.fn(),
}));

const collectRoleLedgerErrorsMock = collectRoleLedgerErrors as jest.MockedFunction<
  typeof collectRoleLedgerErrors
>;

const ALM_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const OTHER_ALM_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e104';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e1ff';

const makeRole = (overrides: Partial<AccLedgerRole> = {}): AccLedgerRole => ({
  alrRole: 'DISCOUNT_ALLOWED',
  alrLabel: 'Discount allowed',
  alrGroup: 'RECEIPT',
  alrWantType: 'EXPENSE',
  alrWantDuty: null,
  alrWantNature: 'EXPENSE',
  alrBySupply: false,
  alrByRate: false,
  alrSortOrder: 10,
  alrIsActive: true,
  alrRemarks: null,
  alrSyncDate: null,
  ...overrides,
});

type MappingRow = {
  almId: string;
  almRole: string;
  almCompanyId: string | null;
  almBranchId: string | null;
  almSupplyNature: string | null;
  almLedgerId: string;
  almIsActive: boolean;
  almRemarks: string | null;
  ledger: { ledName: string; ledIsActive: boolean; ledIsDeleted: boolean } | null;
};

const makeMapping = (overrides: Partial<MappingRow> = {}): MappingRow => ({
  almId: ALM_ID,
  almRole: 'DISCOUNT_ALLOWED',
  almCompanyId: null,
  almBranchId: null,
  almSupplyNature: null,
  almLedgerId: LEDGER_ID,
  almIsActive: true,
  almRemarks: null,
  ledger: { ledName: 'Discount Allowed A/c', ledIsActive: true, ledIsDeleted: false },
  ...overrides,
});

type Args = { where: Record<string, unknown>; data?: Record<string, unknown>; select?: unknown };
type LedgerFlags = { ledName: string; ledIsActive: boolean; ledIsDeleted: boolean };
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  accLedgerRole: {
    findUnique: jest.Mock<Promise<AccLedgerRole | null>, [Args]>;
    findMany: jest.Mock<Promise<Array<Partial<AccLedgerRole>>>, [unknown]>;
  };
  accLedgerMap: {
    findFirst: jest.Mock<Promise<MappingRow | { almId: string } | null>, [Args]>;
    findMany: jest.Mock<Promise<MappingRow[]>, [Args]>;
    create: jest.Mock<Promise<MappingRow>, [Args]>;
    update: jest.Mock<Promise<MappingRow>, [Args]>;
  };
  accLedgerMaster: { findUnique: jest.Mock<Promise<LedgerFlags | null>, [Args]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

const SHARED_SCOPE = { almCompanyId: null, almBranchId: null, almSupplyNature: null };

/** The refusal body a thrown HttpException carries. */
const bodyOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error.getResponse();
    throw error;
  }
  throw new Error('expected the call to refuse');
};

describe('LedgerMapService', () => {
  let service: LedgerMapService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    collectRoleLedgerErrorsMock.mockReset();
    collectRoleLedgerErrorsMock.mockResolvedValue([]);
    prisma = {
      accLedgerRole: {
        findUnique: jest.fn<Promise<AccLedgerRole | null>, [Args]>(({ where }) =>
          Promise.resolve(makeRole({ alrRole: where.alrRole as string })),
        ),
        findMany: jest.fn<Promise<Array<Partial<AccLedgerRole>>>, [unknown]>(() =>
          Promise.resolve([]),
        ),
      },
      accLedgerMap: {
        // Default: no live mapping by id, and no duplicate for the role.
        findFirst: jest.fn<Promise<MappingRow | { almId: string } | null>, [Args]>(() =>
          Promise.resolve(null),
        ),
        findMany: jest.fn<Promise<MappingRow[]>, [Args]>(() => Promise.resolve([])),
        create: jest.fn<Promise<MappingRow>, [Args]>(({ data }) =>
          Promise.resolve(
            makeMapping({
              almRole: data!.almRole as string,
              almLedgerId: data!.almLedgerId as string,
              almRemarks: data!.almRemarks as string | null,
              almIsActive: (data!.almIsActive as boolean | undefined) ?? true,
            }),
          ),
        ),
        update: jest.fn<Promise<MappingRow>, [Args]>(({ data }) =>
          Promise.resolve(
            makeMapping({
              almLedgerId: (data!.almLedgerId as string | undefined) ?? LEDGER_ID,
              almRemarks: (data!.almRemarks as string | null | undefined) ?? null,
            }),
          ),
        ),
      },
      accLedgerMaster: {
        findUnique: jest.fn<Promise<LedgerFlags | null>, [Args]>(() =>
          Promise.resolve({
            ledName: 'Discount Allowed A/c',
            ledIsActive: true,
            ledIsDeleted: false,
          }),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new LedgerMapService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('listRoles', () => {
    it('lists the catalogue in sort order, unmapped roles included with nulls', async () => {
      prisma.accLedgerRole.findMany.mockResolvedValueOnce([
        makeRole({ alrRole: 'DISCOUNT_ALLOWED', alrSortOrder: 10 }),
        makeRole({ alrRole: 'PURCHASE_RETURN', alrLabel: 'Purchase return', alrSortOrder: 20 }),
      ]);
      prisma.accLedgerMap.findMany.mockResolvedValueOnce([makeMapping({ almRemarks: 'set 2026' })]);

      const roles = await service.listRoles();

      expect(prisma.accLedgerRole.findMany).toHaveBeenCalledWith({
        orderBy: [{ alrSortOrder: 'asc' }, { alrRole: 'asc' }],
      });
      expect(prisma.accLedgerMap.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ...SHARED_SCOPE, almIsDeleted: false } }),
      );
      expect(roles).toEqual([
        {
          role: 'DISCOUNT_ALLOWED',
          label: 'Discount allowed',
          group: 'RECEIPT',
          sortOrder: 10,
          expectedLedgerType: 'EXPENSE',
          expectedDutyHead: null,
          expectedGroupNature: 'EXPENSE',
          roleIsActive: true,
          usedBy: ['RECEIPT'],
          almId: ALM_ID,
          ledgerId: LEDGER_ID,
          ledgerName: 'Discount Allowed A/c',
          ledgerIsActive: true,
          ledgerIsDeleted: false,
          isActive: true,
          remarks: 'set 2026',
        },
        expect.objectContaining({
          role: 'PURCHASE_RETURN',
          usedBy: [],
          almId: null,
          ledgerId: null,
          ledgerName: null,
          ledgerIsActive: null,
          ledgerIsDeleted: null,
          isActive: null,
          remarks: null,
        }),
      ]);
    });

    // A mapping resolves without looking at the ledger flags; the screen must see them.
    it('shows a mapping that points at a deleted ledger as such', async () => {
      prisma.accLedgerRole.findMany.mockResolvedValueOnce([makeRole()]);
      prisma.accLedgerMap.findMany.mockResolvedValueOnce([
        makeMapping({ ledger: { ledName: 'Old A/c', ledIsActive: false, ledIsDeleted: true } }),
      ]);

      const [role] = await service.listRoles();

      expect(role).toMatchObject({ ledgerIsActive: false, ledgerIsDeleted: true });
    });
  });

  describe('save — create (no almId)', () => {
    it('maps the role in the shared scope and files a New audit row', async () => {
      const payload = await service.save({
        role: 'DISCOUNT_ALLOWED',
        ledgerId: LEDGER_ID,
        remarks: 'set 2026',
      });

      expect(prisma.accLedgerMap.findFirst).toHaveBeenCalledWith({
        where: { ...SHARED_SCOPE, almRole: 'DISCOUNT_ALLOWED', almIsDeleted: false },
        select: { almId: true },
      });
      expect(prisma.accLedgerMap.create.mock.calls[0][0].data).toEqual({
        ...SHARED_SCOPE,
        almRole: 'DISCOUNT_ALLOWED',
        almLedgerId: LEDGER_ID,
        almRemarks: 'set 2026',
        almCreatedOn: expect.any(Date) as Date,
        almCreatedBy: USER_ID,
      });
      expect(payload).toMatchObject({
        role: 'DISCOUNT_ALLOWED',
        almId: ALM_ID,
        ledgerId: LEDGER_ID,
        remarks: 'set 2026',
      });
      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'posting ledger map',
        screenName: 'Posting Ledger Map',
        screenType: 'master',
        pk: ALM_ID,
        displayName: 'DISCOUNT_ALLOWED',
        originalRecord: null,
        modifiedRecord: {
          almId: ALM_ID,
          almRole: 'DISCOUNT_ALLOWED',
          almLedgerId: LEDGER_ID,
          almLedgerName: 'Discount Allowed A/c',
          almIsActive: true,
          almIsDeleted: false,
          almRemarks: 'set 2026',
        },
        userId: USER_ID,
        notes: 'Posting ledger mapped',
      });
      expect(client).toBe(prisma);
    });

    it('writes isActive only when the body carries it', async () => {
      await service.save({ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID });
      expect(prisma.accLedgerMap.create.mock.calls[0][0].data).not.toHaveProperty('almIsActive');

      await service.save({ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID, isActive: false });
      expect(prisma.accLedgerMap.create.mock.calls[1][0].data!.almIsActive).toBe(false);
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save({ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID });

      expect(prisma.accLedgerMap.create.mock.calls[0][0].data!.almCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('refuses a role that already has a shared mapping, naming the row to re-point', async () => {
      prisma.accLedgerMap.findFirst.mockResolvedValueOnce({ almId: OTHER_ALM_ID });

      const promise = service.save({ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'That role is already mapped',
        errors: [
          {
            field: 'role',
            message:
              `DISCOUNT_ALLOWED already has a ledger (almId ${OTHER_ALM_ID}). ` +
              'Send that almId to re-point it rather than adding a second mapping.',
            code: LedgerMapErrorCode.ROLE_ALREADY_MAPPED,
          },
        ],
      });
      expect(prisma.accLedgerMap.create).not.toHaveBeenCalled();
    });

    // Two operators mapping the same role at once: ux_alm_role refuses the second.
    it('answers a unique violation as the role already mapped', async () => {
      prisma.accLedgerMap.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(
        bodyOf(service.save({ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID })),
      ).resolves.toEqual({
        success: false,
        message: 'That role is already mapped',
        errors: [
          {
            field: 'role',
            message:
              'DISCOUNT_ALLOWED already has a ledger. Re-point that mapping instead of adding a second one.',
            code: LedgerMapErrorCode.ROLE_ALREADY_MAPPED,
          },
        ],
      });
    });
  });

  describe('save — the role and the ledger', () => {
    it('refuses a role the catalogue does not know, listing the ones it does', async () => {
      prisma.accLedgerRole.findUnique.mockResolvedValueOnce(null);
      prisma.accLedgerRole.findMany.mockResolvedValueOnce([
        { alrRole: 'DISCOUNT_ALLOWED' },
        { alrRole: 'ROUND_OFF' },
      ]);

      const promise = service.save({ role: 'DISCOUNT_GIVEN', ledgerId: LEDGER_ID });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'role',
            message:
              '"DISCOUNT_GIVEN" is not a posting role. Known roles: DISCOUNT_ALLOWED, ROUND_OFF',
            code: LedgerMapErrorCode.UNKNOWN_ROLE,
          },
        ],
      });
      expect(prisma.accLedgerMaster.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      [
        'deleted',
        { ledName: 'Old A/c', ledIsActive: false, ledIsDeleted: true },
        '"Old A/c" is deleted — a mapping must name a live ledger',
        LedgerMapErrorCode.LEDGER_DELETED,
      ],
      [
        'inactive',
        { ledName: 'Dormant A/c', ledIsActive: false, ledIsDeleted: false },
        '"Dormant A/c" is inactive — a mapping must name a live ledger',
        LedgerMapErrorCode.LEDGER_INACTIVE,
      ],
    ])('refuses a %s ledger', async (_label, ledger, message, code) => {
      prisma.accLedgerMaster.findUnique.mockResolvedValueOnce(ledger);

      await expect(
        bodyOf(service.save({ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID })),
      ).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'ledgerId', message, code }],
      });
      expect(prisma.accLedgerMap.create).not.toHaveBeenCalled();
    });

    // The shared mapping is resolved by every company: it must name a GLOBAL ledger.
    it('checks the ledger against the role as a global ledger', async () => {
      await service.save({ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID });

      expect(collectRoleLedgerErrorsMock).toHaveBeenCalledWith(
        prisma,
        [{ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID, field: 'ledgerId' }],
        { companyId: null, where: 'acc_ledger_map' },
      );
    });

    it('refuses with every error the role check finds, after its own', async () => {
      prisma.accLedgerMaster.findUnique.mockResolvedValueOnce({
        ledName: 'HDFC Bank',
        ledIsActive: false,
        ledIsDeleted: false,
      });
      collectRoleLedgerErrorsMock.mockResolvedValueOnce([
        { field: 'ledgerId', message: 'wrong type', code: 'LEDGER_ROLE_WRONG_TYPE' },
      ]);

      await expect(
        bodyOf(service.save({ role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID })),
      ).resolves.toMatchObject({
        errors: [{ code: LedgerMapErrorCode.LEDGER_INACTIVE }, { code: 'LEDGER_ROLE_WRONG_TYPE' }],
      });
    });
  });

  describe('save — update (almId sent)', () => {
    beforeEach(() => {
      prisma.accLedgerMap.findFirst.mockImplementation(({ where }) =>
        Promise.resolve(where.almId === ALM_ID ? makeMapping() : null),
      );
    });

    it('re-points the live mapping and files an update audit row', async () => {
      const NEW_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e1aa';

      const payload = await service.save({
        almId: ALM_ID,
        role: 'DISCOUNT_ALLOWED',
        ledgerId: NEW_LEDGER_ID,
        remarks: 'moved',
      });

      const { where, data } = prisma.accLedgerMap.update.mock.calls[0][0];
      expect(where).toEqual({ almId: ALM_ID });
      expect(data).toEqual({
        almLedgerId: NEW_LEDGER_ID,
        almRemarks: 'moved',
        almModifiedOn: expect.any(Date) as Date,
        almModifiedBy: USER_ID,
      });
      expect(payload).toMatchObject({ almId: ALM_ID, ledgerId: NEW_LEDGER_ID });
      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        pk: ALM_ID,
        displayName: 'DISCOUNT_ALLOWED',
        notes: 'Posting ledger mapping re-pointed',
      });
      expect(entry.originalRecord).toMatchObject({ almLedgerId: LEDGER_ID });
      expect(entry.modifiedRecord).toMatchObject({ almLedgerId: NEW_LEDGER_ID });
      expect(prisma.accLedgerMap.create).not.toHaveBeenCalled();
    });

    it('refuses an almId with no live mapping', async () => {
      const promise = service.save({
        almId: OTHER_ALM_ID,
        role: 'DISCOUNT_ALLOWED',
        ledgerId: LEDGER_ID,
      });

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Posting ledger mapping not found',
        errors: [
          {
            field: 'almId',
            message: `No active acc_ledger_map row with id ${OTHER_ALM_ID}`,
            code: LedgerMapErrorCode.NOT_FOUND,
          },
        ],
      });
    });

    // Re-pointing a row at another role would unmap the old one past the in-use check.
    it('refuses to move a mapping to a different role', async () => {
      await expect(
        bodyOf(service.save({ almId: ALM_ID, role: 'ROUND_OFF', ledgerId: LEDGER_ID })),
      ).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'role',
            message:
              'This mapping belongs to DISCOUNT_ALLOWED, not ROUND_OFF. ' +
              'Map ROUND_OFF with its own request; a mapping never changes role.',
            code: LedgerMapErrorCode.ROLE_CHANGED,
          },
        ],
      });
      expect(prisma.accLedgerMap.update).not.toHaveBeenCalled();
    });

    it('refuses to edit a mapping scoped to a company', async () => {
      prisma.accLedgerMap.findFirst.mockResolvedValue(makeMapping({ almCompanyId: COMPANY_ID }));

      await expect(
        bodyOf(service.save({ almId: ALM_ID, role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID })),
      ).resolves.toMatchObject({
        errors: [{ field: 'almId', code: LedgerMapErrorCode.SCOPED_MAPPING }],
      });
      expect(prisma.accLedgerMap.update).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('unmaps a role no document posts yet and files a cancel audit row', async () => {
      prisma.accLedgerMap.findFirst.mockResolvedValue(makeMapping({ almRole: 'PURCHASE_RETURN' }));

      await expect(service.softDelete(ALM_ID)).resolves.toEqual({
        almId: ALM_ID,
        role: 'PURCHASE_RETURN',
        deleted: true,
      });

      expect(prisma.accLedgerMap.update).toHaveBeenCalledWith({
        where: { almId: ALM_ID },
        data: {
          almIsDeleted: true,
          almIsActive: false,
          almModifiedOn: expect.any(Date) as Date,
          almModifiedBy: USER_ID,
        },
      });
      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        pk: ALM_ID,
        displayName: 'PURCHASE_RETURN',
        notes: 'Posting ledger mapping removed',
      });
      expect(entry.originalRecord).toMatchObject({ almIsActive: true, almIsDeleted: false });
      expect(entry.modifiedRecord).toMatchObject({ almIsActive: false, almIsDeleted: true });
      expect(client).toBe(prisma);
    });

    // Unmapping a role a deployed engine resolves fails the next posting at the counter.
    it.each([
      ['one document', 'DISCOUNT_ALLOWED', 'DISCOUNT_ALLOWED is used by RECEIPT. '],
      ['two documents', 'BANK_CHARGES', 'BANK_CHARGES is used by RECEIPT and CHEQUE. '],
    ])('refuses a role that %s posts, naming them', async (_label, role, lead) => {
      prisma.accLedgerMap.findFirst.mockResolvedValue(makeMapping({ almRole: role }));

      const promise = service.softDelete(ALM_ID);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Posting role is in use',
        errors: [
          {
            field: 'almId',
            message: `${lead}Point it at a different ledger instead of removing it.`,
            code: LedgerMapErrorCode.ROLE_IN_USE,
          },
        ],
      });
      expect(prisma.accLedgerMap.update).not.toHaveBeenCalled();
    });

    it('refuses an almId with no live mapping', async () => {
      await expect(bodyOf(service.softDelete(ALM_ID))).resolves.toMatchObject({
        errors: [{ field: 'almId', code: LedgerMapErrorCode.NOT_FOUND }],
      });
    });

    it.each([
      ['a branch', { almBranchId: COMPANY_ID }],
      ['a supply nature', { almSupplyNature: 'INTER' }],
    ])('refuses to delete a mapping scoped to %s', async (_label, scope) => {
      prisma.accLedgerMap.findFirst.mockResolvedValue(
        makeMapping({ almRole: 'PURCHASE_RETURN', ...scope }),
      );

      await expect(bodyOf(service.softDelete(ALM_ID))).resolves.toMatchObject({
        errors: [{ code: LedgerMapErrorCode.SCOPED_MAPPING }],
      });
      expect(prisma.accLedgerMap.update).not.toHaveBeenCalled();
    });
  });
});
