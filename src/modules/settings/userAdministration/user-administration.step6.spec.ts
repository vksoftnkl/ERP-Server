import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserAdminErrorCode, UserType } from './types/user-administration.enum';
import {
  GENERATED_PASSWORD_LENGTH,
  UserAdministrationService,
  generatePassword,
  parseMaxDiscPerc,
} from './user-administration.service';

/**
 * Users & Rights review step 6 (admin/review-users-rights-2026-11-19.md points 3, 10, 15;
 * answers U6 / U8 / U10, user 20/11): reset password (typed or generated, must change at
 * next login), unlock, restore (inactive, no rights), max discount %, the 4-character rule.
 */
jest.mock('../../../common/utils/secret-hash.utils', () => ({
  hashSecret: jest.fn(async (plain: string) => `hashed:${plain}`),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hashSecret } = jest.requireMock<{ hashSecret: jest.Mock }>(
  '../../../common/utils/secret-hash.utils',
);

const CALLER_ID = '019c6f6c-be87-7a11-8905-36092c46f501';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f502';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

async function refusalOf(
  promise: Promise<unknown>,
): Promise<{ status: number; error: Record<string, unknown> }> {
  const caught = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (e: unknown) => e,
  );
  if (!(caught instanceof HttpException)) throw caught;
  const body = caught.getResponse() as { errors: Record<string, unknown>[] };
  return { status: caught.getStatus(), error: body.errors[0] };
}

const rightsRow = (...granted: string[]) => ({
  um_can_view: granted.includes('view'),
  um_can_create: granted.includes('create'),
  um_can_edit: granted.includes('edit'),
  um_can_delete: granted.includes('delete'),
  um_can_print: false,
  um_can_export: false,
  um_can_post: false,
  um_can_cancel: false,
  um_can_amend: false,
  um_can_override: false,
  um_can_retender: false,
});

describe('UserAdministrationService — review step 6', () => {
  let target: Record<string, unknown> | null;
  let callerType: string;
  let loginHolder: string | null;
  let prisma: {
    userMaster: {
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    userMenus: { updateMany: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
    menu: { findMany: jest.Mock };
    employeeMaster: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let audit: { logEntityChange: jest.Mock };
  let service: UserAdministrationService;

  const user = (overrides: Record<string, unknown> = {}) => ({
    usrId: USER_ID,
    usrLoginName: 'zt.cashier',
    usrDisplayName: 'ZT Cashier',
    usrType: UserType.CASHIER,
    usrIsDeleted: false,
    usrIsActive: true,
    usrIsLocked: false,
    usrLockedOn: null,
    usrLockedBy: null,
    usrFailedLoginCount: 0,
    usrMustChangePassword: false,
    usrPasswordChangedOn: STAMP,
    usrPasswordHash: 'hashed:old',
    usrPinHash: null,
    usrMaxDiscPerc: null,
    usrCreatedOn: STAMP,
    ...overrides,
  });

  beforeEach(() => {
    hashSecret.mockClear();
    target = user();
    callerType = UserType.ADMIN;
    loginHolder = null;
    prisma = {
      userMaster: {
        findFirst: jest.fn(
          async ({
            where,
            select,
          }: {
            where: Record<string, unknown>;
            select?: Record<string, unknown>;
          }) => {
            if ('usrLoginName' in where) {
              return loginHolder ? { usrLoginName: loginHolder } : null;
            }
            if (where.usrId === CALLER_ID) {
              // callerIsSuperAdmin (usrIsActive in where) or actorLoginName (usrLoginName selected).
              return select && 'usrLoginName' in select
                ? { usrLoginName: 'admin1' }
                : { usrType: callerType };
            }
            if (where.usrId === USER_ID) {
              if (!target) return null;
              if (where.usrIsDeleted === false && target.usrIsDeleted) return null;
              return target;
            }
            return null;
          },
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...user(),
          ...data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...user(),
          ...data,
          usrId: USER_ID,
        })),
      },
      userMenus: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      menu: { findMany: jest.fn().mockResolvedValue([]) },
      employeeMaster: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([rightsRow('view', 'create', 'edit', 'delete')]),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new UserAdministrationService(
      prisma as never,
      audit as never,
      { getUserId: () => CALLER_ID } as never,
    );
  });

  const auditCall = () =>
    audit.logEntityChange.mock.calls[0][0] as {
      notes: string;
      originalRecord: Record<string, unknown>;
      modifiedRecord: Record<string, unknown>;
    };

  describe('max discount %', () => {
    it.each([
      [undefined, undefined],
      [null, null],
      ['', null],
      ['  ', null],
      [0, '0'],
      ['12.5', '12.5'],
      [' 12.345 ', '12.35'],
      [100, '100'],
      ['99.999', '100'],
    ])('%p → %p', (value, expected) => {
      const parsed = parseMaxDiscPerc(value);
      expect(parsed === undefined || parsed === null ? parsed : parsed.toString()).toBe(expected);
    });

    it.each([-1, '-0.5', 100.01, '101', 'ten', '1e2x', true, {}, Number.NaN])(
      'refuses %p with 400 USER_MAX_DISC_INVALID on usrMaxDiscPerc',
      async (value) => {
        expect(() => parseMaxDiscPerc(value)).toThrow(HttpException);
        const { status, error } = await refusalOf(
          service.save({
            usrId: USER_ID,
            usrLoginName: 'zt.cashier',
            usrMaxDiscPerc: value as never,
          }),
        );
        expect(status).toBe(400);
        expect(error).toMatchObject({
          field: 'usrMaxDiscPerc',
          code: UserAdminErrorCode.MAX_DISC_INVALID,
        });
      },
    );

    it('a create stores the limit as a Decimal and answers it as "12.50"', async () => {
      const payload = await service.save({
        usrLoginName: 'zt.cashier',
        usrPassword: 'abcd',
        usrMaxDiscPerc: '12.5',
      });
      const data = prisma.userMaster.create.mock.calls[0][0].data as {
        usrMaxDiscPerc: Prisma.Decimal;
      };
      expect(data.usrMaxDiscPerc.toString()).toBe('12.5');
      expect(payload.usrMaxDiscPerc).toBe('12.50');
    });

    it('an update that omits the key keeps the stored limit; null clears it', async () => {
      await service.save({ usrId: USER_ID, usrLoginName: 'zt.cashier' });
      expect(prisma.userMaster.update.mock.calls[0][0].data).not.toHaveProperty('usrMaxDiscPerc');
      await service.save({ usrId: USER_ID, usrLoginName: 'zt.cashier', usrMaxDiscPerc: null });
      expect(prisma.userMaster.update.mock.calls[1][0].data).toMatchObject({
        usrMaxDiscPerc: null,
      });
    });
  });

  describe('the 4-character rule on a password the administrator sets', () => {
    it('create: under 4 (spaces at the ends not counted) is 400 USER_PASSWORD_TOO_SHORT before any write', async () => {
      const { status, error } = await refusalOf(
        service.save({ usrLoginName: 'zt.cashier', usrPassword: ' ab ' }),
      );
      expect(status).toBe(400);
      expect(error).toMatchObject({
        field: 'usrPassword',
        code: UserAdminErrorCode.PASSWORD_TOO_SHORT,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('update: the same', async () => {
      const { error } = await refusalOf(
        service.save({ usrId: USER_ID, usrLoginName: 'zt.cashier', usrPassword: 'abc' }),
      );
      expect(error.code).toBe(UserAdminErrorCode.PASSWORD_TOO_SHORT);
    });
  });

  describe('reset password', () => {
    it('a typed password: hashed (trimmed), must-change set, the audit names the admin and never the value', async () => {
      const result = await service.resetPassword({ usrId: USER_ID, newPassword: ' temp9 ' });
      expect(hashSecret).toHaveBeenCalledWith('temp9');
      expect(prisma.userMaster.update).toHaveBeenCalledWith({
        where: { usrId: USER_ID },
        data: expect.objectContaining({
          usrPasswordHash: 'hashed:temp9',
          usrMustChangePassword: true,
          usrPasswordChangedOn: expect.any(Date),
          usrModifiedBy: CALLER_ID,
        }),
      });
      expect(result).toEqual({
        usrId: USER_ID,
        usrLoginName: 'zt.cashier',
        usrMustChangePassword: true,
        usrPasswordChangedOn: expect.any(String),
        generatedPassword: null,
      });
      const row = auditCall();
      expect(row.notes).toContain('Password reset by admin1 (typed)');
      expect(JSON.stringify(row)).not.toContain('temp9');
      expect(row.modifiedRecord).toEqual({
        usrPasswordChangedOn: expect.any(String),
        usrMustChangePassword: true,
      });
    });

    it('generate: 8 characters answered once, the same that was hashed, absent from the audit', async () => {
      const result = await service.resetPassword({ usrId: USER_ID, generate: true });
      expect(result.generatedPassword).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{8}$/);
      expect(hashSecret).toHaveBeenCalledWith(result.generatedPassword);
      expect(auditCall().notes).toContain('(generated)');
      expect(JSON.stringify(auditCall())).not.toContain(result.generatedPassword!);
    });

    it('a typed password AND generate: 400 USER_RESET_PASSWORD_CHOICE', async () => {
      const { status, error } = await refusalOf(
        service.resetPassword({ usrId: USER_ID, newPassword: 'abcd', generate: true }),
      );
      expect(status).toBe(400);
      expect(error).toMatchObject({
        field: 'newPassword',
        code: UserAdminErrorCode.RESET_PASSWORD_CHOICE,
      });
    });

    it.each([undefined, null, '', 'abc', '  ab  '])(
      'no usable password (%p) without generate: 400 USER_PASSWORD_TOO_SHORT',
      async (newPassword) => {
        const { error } = await refusalOf(service.resetPassword({ usrId: USER_ID, newPassword }));
        expect(error).toMatchObject({
          field: 'newPassword',
          code: UserAdminErrorCode.PASSWORD_TOO_SHORT,
        });
        expect(prisma.userMaster.update).not.toHaveBeenCalled();
      },
    );

    it('needs the menu-58 Edit right (403 USER_RIGHT_EDIT)', async () => {
      prisma.$queryRaw.mockResolvedValue([rightsRow('view', 'create', 'delete')]);
      const { status, error } = await refusalOf(
        service.resetPassword({ usrId: USER_ID, generate: true }),
      );
      expect(status).toBe(403);
      expect(error.code).toBe('USER_RIGHT_EDIT');
    });

    it('a SUPER ADMIN user is reset only by a SUPER ADMIN (403 USER_ROLE_RESERVED)', async () => {
      target = user({ usrType: UserType.SUPER_ADMIN });
      const { status, error } = await refusalOf(
        service.resetPassword({ usrId: USER_ID, generate: true }),
      );
      expect(status).toBe(403);
      expect(error.code).toBe(UserAdminErrorCode.ROLE_RESERVED);
      callerType = UserType.SUPER_ADMIN;
      await expect(
        service.resetPassword({ usrId: USER_ID, generate: true }),
      ).resolves.toBeDefined();
    });

    it('no live user: 404 USER_NOT_FOUND', async () => {
      target = user({ usrIsDeleted: true });
      const { status, error } = await refusalOf(
        service.resetPassword({ usrId: USER_ID, generate: true }),
      );
      expect(status).toBe(404);
      expect(error.code).toBe(UserAdminErrorCode.NOT_FOUND);
    });

    it('generatePassword avoids look-alikes and has the set length', () => {
      for (let i = 0; i < 50; i += 1) {
        const p = generatePassword();
        expect(p).toHaveLength(GENERATED_PASSWORD_LENGTH);
        expect(p).not.toMatch(/[01OIl]/);
      }
    });
  });

  describe('unlock', () => {
    it('clears the lock and the failed count, one audit row', async () => {
      target = user({
        usrIsLocked: true,
        usrLockedOn: STAMP,
        usrLockedBy: CALLER_ID,
        usrFailedLoginCount: 3,
      });
      const result = await service.unlock(USER_ID);
      expect(result).toEqual({
        usrId: USER_ID,
        usrIsLocked: false,
        usrFailedLoginCount: 0,
        usrLockedOn: null,
        usrLockedBy: null,
        changed: true,
      });
      expect(prisma.userMaster.update).toHaveBeenCalledWith({
        where: { usrId: USER_ID },
        data: expect.objectContaining({
          usrIsLocked: false,
          usrLockedOn: null,
          usrLockedBy: null,
          usrFailedLoginCount: 0,
        }),
      });
      expect(auditCall().notes).toBe('Unlocked by admin1 (failed logins were 3)');
    });

    it('nothing to clear: changed false, no write, no audit row', async () => {
      const result = await service.unlock(USER_ID);
      expect(result.changed).toBe(false);
      expect(prisma.userMaster.update).not.toHaveBeenCalled();
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('only failed logins to clear: cleared and audited as such', async () => {
      target = user({ usrFailedLoginCount: 2 });
      await service.unlock(USER_ID);
      expect(auditCall().notes).toBe('Failed logins cleared by admin1 (failed logins were 2)');
    });

    it('needs the Edit right', async () => {
      prisma.$queryRaw.mockResolvedValue([rightsRow('view')]);
      const { status, error } = await refusalOf(service.unlock(USER_ID));
      expect(status).toBe(403);
      expect(error.code).toBe('USER_RIGHT_EDIT');
    });
  });

  describe('restore', () => {
    const DELETED_ON = new Date('2026-11-19T10:00:00.000Z');
    const DELETER = '019c6f6c-be87-7a11-8905-36092c46f5ff';
    const deletedRow = (umMenuId: number, o: Record<string, unknown> = {}) => ({
      umId: `um-${umMenuId}`,
      umUserId: USER_ID,
      umMenuId,
      umCanView: true,
      umCanCreate: umMenuId === 12,
      umCanEdit: false,
      umCanDelete: false,
      umCanPrint: false,
      umCanExport: false,
      umCanPost: umMenuId === 12,
      umCanCancel: false,
      umCanAmend: false,
      umCanOverride: false,
      umCanRetender: false,
      umIsDeleted: true,
      umModifiedOn: DELETED_ON,
      umModifiedBy: DELETER,
      ...o,
    });

    beforeEach(() => {
      target = user({
        usrIsDeleted: true,
        usrIsActive: false,
        usrModifiedOn: DELETED_ON,
        usrModifiedBy: DELETER,
      });
      prisma.userMenus.findMany.mockResolvedValue([deletedRow(12), deletedRow(30), deletedRow(99)]);
      prisma.menu.findMany.mockImplementation(
        async ({ where }: { where: { menuIsActive?: boolean } }) =>
          where.menuIsActive
            ? [{ menuId: 12 }, { menuId: 30 }]
            : [
                { menuId: 12, menuName: 'Sales Bill' },
                { menuId: 30, menuName: 'Price Master' },
              ],
      );
      prisma.userMenus.updateMany.mockResolvedValue({ count: 2 });
    });

    it("comes back INACTIVE with the rights the delete removed (not an inactive menu's); one audit row", async () => {
      const result = await service.restore(USER_ID);
      expect(result).toEqual({
        usrId: USER_ID,
        usrLoginName: 'zt.cashier',
        usrIsDeleted: false,
        usrIsActive: false,
        menuCount: 2,
      });
      expect(prisma.userMaster.updateMany).toHaveBeenCalledWith({
        where: { usrId: USER_ID, usrIsDeleted: true },
        data: expect.objectContaining({ usrIsDeleted: false, usrIsActive: false }),
      });
      // The rows that delete removed: the deleted user's own stamp, nothing older.
      expect(prisma.userMenus.findMany).toHaveBeenCalledWith({
        where: {
          umUserId: USER_ID,
          umIsDeleted: true,
          umModifiedOn: DELETED_ON,
          umModifiedBy: DELETER,
        },
        orderBy: { umMenuId: 'asc' },
      });
      expect(prisma.userMenus.updateMany).toHaveBeenCalledWith({
        where: { umId: { in: ['um-12', 'um-30'] }, umIsDeleted: true },
        data: { umIsDeleted: false, umModifiedOn: expect.any(Date), umModifiedBy: CALLER_ID },
      });
      expect(prisma.userMenus.upsert).not.toHaveBeenCalled();
      expect(auditCall().notes).toBe(
        'User restored by admin1: inactive, with the 2 menu rights the delete removed; ' +
          '1 of a menu no longer active left out',
      );
      expect(auditCall().originalRecord).toMatchObject({ usrIsDeleted: true, menuRights: {} });
      expect(auditCall().modifiedRecord).toMatchObject({
        usrIsDeleted: false,
        usrIsActive: false,
        menuRights: { 'Sales Bill': 'View, Create, Post', 'Price Master': 'View' },
      });
    });

    it('a user the delete removed no rights from comes back with none', async () => {
      prisma.userMenus.findMany.mockResolvedValue([]);
      const result = await service.restore(USER_ID);
      expect(result.menuCount).toBe(0);
      expect(prisma.userMenus.updateMany).not.toHaveBeenCalled();
      expect(auditCall().notes).toBe(
        'User restored by admin1: inactive, with the 0 menu rights the delete removed',
      );
    });

    it('no delete stamp on the row: nothing is guessed back', async () => {
      target = user({ usrIsDeleted: true, usrIsActive: false, usrModifiedOn: null });
      expect((await service.restore(USER_ID)).menuCount).toBe(0);
      expect(prisma.userMenus.findMany).not.toHaveBeenCalled();
    });

    it('checks the login name among live users only, any case, not itself', async () => {
      await service.restore(USER_ID);
      expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
        where: {
          usrLoginName: { equals: 'zt.cashier', mode: 'insensitive' },
          usrIsDeleted: false,
          NOT: { usrId: USER_ID },
        },
        select: { usrLoginName: true },
      });
    });

    it('a live user now holding the name: 409 USER_RESTORE_LOGIN_TAKEN with loginName', async () => {
      loginHolder = 'ZT.Cashier';
      const { status, error } = await refusalOf(service.restore(USER_ID));
      expect(status).toBe(409);
      expect(error).toMatchObject({
        field: 'usrLoginName',
        code: UserAdminErrorCode.RESTORE_LOGIN_TAKEN,
        loginName: 'ZT.Cashier',
      });
      expect(prisma.userMaster.updateMany).not.toHaveBeenCalled();
    });

    it('a live user: 409 USER_NOT_DELETED', async () => {
      target = user();
      const { status, error } = await refusalOf(service.restore(USER_ID));
      expect(status).toBe(409);
      expect(error.code).toBe(UserAdminErrorCode.NOT_DELETED);
    });

    it('no such user: 404 USER_NOT_FOUND', async () => {
      target = null;
      const { status, error } = await refusalOf(service.restore(USER_ID));
      expect(status).toBe(404);
      expect(error.code).toBe(UserAdminErrorCode.NOT_FOUND);
    });

    it('needs the Delete right (403 USER_RIGHT_DELETE)', async () => {
      prisma.$queryRaw.mockResolvedValue([rightsRow('view', 'edit')]);
      const { status, error } = await refusalOf(service.restore(USER_ID));
      expect(status).toBe(403);
      expect(error.code).toBe('USER_RIGHT_DELETE');
    });

    it('a deleted SUPER ADMIN is restored only by a SUPER ADMIN', async () => {
      target = user({ usrIsDeleted: true, usrIsActive: false, usrType: UserType.SUPER_ADMIN });
      const { error } = await refusalOf(service.restore(USER_ID));
      expect(error.code).toBe(UserAdminErrorCode.ROLE_RESERVED);
    });
  });
});
