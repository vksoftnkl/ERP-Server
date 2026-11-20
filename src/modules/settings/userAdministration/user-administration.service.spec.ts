import { HttpException } from '@nestjs/common';
import { UserMaster, UserMenus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { SaveUserAdministrationDto } from './dto/save-user-administration.dto';
import { UserAdminErrorCode, UserType } from './types/user-administration.enum';
import { UserAdministrationService, describeMenuRightsChange } from './user-administration.service';

// The real scrypt is slow and salted; a readable stand-in shows exactly what was hashed.
jest.mock('../../../common/utils/secret-hash.utils', () => ({
  hashSecret: jest.fn(async (plain: string) => `hashed:${plain}`),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hashSecret } = jest.requireMock<{ hashSecret: jest.Mock }>(
  '../../../common/utils/secret-hash.utils',
);

const CALLER_ID = '019c6f6c-be87-7a11-8905-36092c46f101';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f102';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f103';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f104';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46f105';
const EMPLOYEE_ID = '019c6f6c-be87-7a11-8905-36092c46f106';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const userRow = (overrides: Partial<UserMaster> = {}): UserMaster => ({
  usrId: USER_ID,
  usrCompanyId: COMPANY_ID,
  usrBranchId: null,
  usrEmployeeId: null,
  usrLoginName: 'cashier1',
  usrDisplayName: 'Cashier One',
  usrFullName: null,
  usrMobileNo: null,
  usrEmail: null,
  usrAvatarUrl: null,
  usrTimezone: 'Asia/Kolkata',
  usrLanguage: 'en',
  usrPasswordHash: 'hashed:old',
  usrPinHash: null,
  usrMustChangePassword: false,
  usrPasswordExpiresOn: null,
  usrPasswordChangedOn: null,
  usrType: UserType.CASHIER,
  usrEditDate: false,
  usrEditEntry: false,
  usrEditRate: false,
  usrMaxDiscPerc: null,
  usrDesktopLogin: true,
  usrWebLogin: true,
  usrMobileLogin: false,
  usrIsActive: true,
  usrIsLocked: false,
  usrFailedLoginCount: 0,
  usrLastFailedLoginOn: null,
  usrLockedOn: null,
  usrLockedBy: null,
  usrLastLoginOn: null,
  usrIsDeleted: false,
  usrNotes: null,
  usrSyncDate: null,
  usrCreatedOn: STAMP,
  usrCreatedBy: CALLER_ID,
  usrModifiedOn: null,
  usrModifiedBy: null,
  ...overrides,
});

const menuRow = (umMenuId: number, overrides: Partial<UserMenus> = {}): UserMenus => ({
  umId: `um-${umMenuId}`,
  umUserId: USER_ID,
  umMenuId,
  umCanView: true,
  umCanCreate: false,
  umCanEdit: false,
  umCanDelete: false,
  umCanPrint: false,
  umCanExport: false,
  umCanPost: false,
  umCanCancel: false,
  umCanAmend: false,
  umCanOverride: false,
  umCanRetender: false,
  umVisibility: true,
  umIsFavourite: false,
  umIsPinned: false,
  umSortOrder: 0,
  umIsDeleted: false,
  umSyncDate: null,
  umCreatedOn: STAMP,
  umCreatedBy: CALLER_ID,
  umModifiedOn: null,
  umModifiedBy: null,
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
  userMaster: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  userMenus: { updateMany: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
  menu: { findMany: jest.Mock };
  employeeMaster: { findFirst: jest.Mock };
  company: { findFirst: jest.Mock };
  branchMaster: { findFirst: jest.Mock };
  /** loadRights (common/posting/rights.ts): the caller's user_menus row for menu 58. */
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

type Right = 'view' | 'create' | 'edit' | 'delete';
/** A user_menus row as loadRights reads it: the rights named are true, every other flag false. */
const rightsRow = (...granted: Right[]) => ({
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

/**
 * What the four user_master reads of a save answer: the row being edited, the
 * caller (SUPER ADMIN check), a login-name clash, and an active user already
 * holding the employee.
 */
type UserLookups = {
  target?: UserMaster | null;
  callerType?: string | null;
  loginClash?: boolean;
  employeeHeldBy?: string | null;
};

describe('UserAdministrationService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: UserAdministrationService;

  const lookups = (answers: UserLookups) =>
    prisma.userMaster.findFirst.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if ('usrLoginName' in where) return answers.loginClash ? { usrId: 'someone' } : null;
        if ('usrEmployeeId' in where) {
          return answers.employeeHeldBy ? { usrLoginName: answers.employeeHeldBy } : null;
        }
        if (where.usrId === CALLER_ID && 'usrIsActive' in where) {
          return answers.callerType === undefined ? null : { usrType: answers.callerType };
        }
        if (where.usrId) return answers.target ?? null;
        return null;
      },
    );

  beforeEach(() => {
    hashSecret.mockClear();
    prisma = {
      userMaster: {
        findFirst: jest.fn(),
        create: jest.fn(async ({ data }: { data: Partial<UserMaster> }) => userRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<UserMaster> }) => userRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userMenus: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([menuRow(5)]),
        upsert: jest.fn(async ({ create }: { create: Partial<UserMenus> }) =>
          menuRow(create.umMenuId!, create),
        ),
      },
      menu: {
        findMany: jest.fn(async ({ where }: { where: { menuId: { in: number[] } } }) =>
          where.menuId.in.map((menuId) => ({ menuId })),
        ),
      },
      employeeMaster: { findFirst: jest.fn().mockResolvedValue(null) },
      company: { findFirst: jest.fn().mockResolvedValue({ compName: 'Zeta Traders' }) },
      branchMaster: { findFirst: jest.fn().mockResolvedValue({ brName: 'Main' }) },
      // The caller holds all four menu-58 rights unless a test says otherwise.
      $queryRaw: jest.fn().mockResolvedValue([rightsRow('view', 'create', 'edit', 'delete')]),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    lookups({});
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(CALLER_ID) };
    service = new UserAdministrationService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const create = (dto: Partial<SaveUserAdministrationDto> = {}) =>
    service.save({ usrLoginName: 'cashier1', usrPassword: 'secret1', ...dto });
  const update = (dto: Partial<SaveUserAdministrationDto> = {}) =>
    service.save({ usrId: USER_ID, usrLoginName: 'cashier1', ...dto });
  const createdData = () =>
    (prisma.userMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.userMaster.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const upserted = () =>
    prisma.userMenus.upsert.mock.calls.map(
      ([args]) => args as { create: Record<string, unknown>; update: Record<string, unknown> },
    );

  describe('create', () => {
    it.each([undefined, '', '   '])(
      'refuses a new user without a password (%p) before opening a transaction',
      async (usrPassword) => {
        const refusal = await refusalOf(create({ usrPassword }));

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [{ field: 'usrPassword', code: UserAdminErrorCode.PASSWORD_REQUIRED }],
          },
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('stores the password hash only, and never answers with it', async () => {
      const payload = await create({ usrLoginName: '  cashier1  ' });

      expect(hashSecret).toHaveBeenCalledWith('secret1');
      expect(createdData()).toMatchObject({
        usrLoginName: 'cashier1',
        usrDisplayName: '',
        usrPasswordHash: 'hashed:secret1',
        usrCreatedBy: CALLER_ID,
      });
      expect(Object.values(createdData())).not.toContain('secret1');
      expect(payload).not.toHaveProperty('usrPasswordHash');
      expect(payload).not.toHaveProperty('usrPinHash');
      expect(JSON.stringify(payload)).not.toContain('secret1');
    });

    it('hashes a till PIN the same way and answers only whether one is set', async () => {
      const payload = await create({ usrPin: '4321' });

      expect(hashSecret).toHaveBeenCalledWith('4321');
      expect(createdData().usrPinHash).toBe('hashed:4321');
      expect(payload.usrPinSet).toBe(true);
      expect(JSON.stringify(payload)).not.toContain('4321');
    });

    // Review list 11-19 S2: a call with no user in the request context has no rights, exactly
    // as a user with no menu-58 row (it used to save as DEFAULT_ACTOR).
    it('refuses a create when no user is logged in (no user, no rights)', async () => {
      context.getUserId.mockReturnValue(null);

      const refusal = await refusalOf(create());

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ field: 'userId', code: UserAdminErrorCode.RIGHT_CREATE }] },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.userMaster.create).not.toHaveBeenCalled();
      expect(DEFAULT_ACTOR).toBeTruthy();
    });

    it('refuses a login name another live user holds, compared case-insensitively', async () => {
      lookups({ loginClash: true });

      const refusal = await refusalOf(create({ usrLoginName: 'Cashier1' }));

      expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
        where: {
          usrLoginName: { equals: 'Cashier1', mode: 'insensitive' },
          usrIsDeleted: false,
        },
        select: { usrId: true },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'usrLoginName', code: UserAdminErrorCode.LOGIN_NAME_TAKEN }] },
      });
      expect(prisma.userMaster.create).not.toHaveBeenCalled();
    });

    describe('the SUPER ADMIN role (notes 125)', () => {
      it.each([
        ['an ADMIN', UserType.ADMIN],
        ['an unknown caller', undefined],
      ])('is refused when %s gives it', async (_label, callerType) => {
        lookups({ callerType });

        const refusal = await refusalOf(create({ usrType: UserType.SUPER_ADMIN }));

        expect(refusal).toMatchObject({
          status: 403,
          body: { errors: [{ field: 'usrType', code: UserAdminErrorCode.ROLE_RESERVED }] },
        });
        expect(prisma.userMaster.create).not.toHaveBeenCalled();
      });

      it('is given by a SUPER ADMIN', async () => {
        lookups({ callerType: UserType.SUPER_ADMIN });

        await expect(create({ usrType: UserType.SUPER_ADMIN })).resolves.toMatchObject({
          usrType: UserType.SUPER_ADMIN,
        });
      });

      it('never asks who the caller is for any other role', async () => {
        await create({ usrType: UserType.ADMIN });

        expect(prisma.userMaster.findFirst).not.toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ usrId: CALLER_ID }) }),
        );
      });
    });

    describe('menus — a save is a full replace', () => {
      it('grants only what is sent: an omitted transaction right is false, view is true', async () => {
        const payload = await create({
          menus: [
            { umMenuId: 12, umCanPost: true, umCanCreate: true },
            { umMenuId: 3, umCanView: false },
          ],
        });

        const [first, second] = upserted();
        expect(first.create).toMatchObject({
          umUserId: USER_ID,
          umMenuId: 12,
          umCanView: true,
          umCanCreate: true,
          umCanPost: true,
          umCanCancel: false,
          umCanAmend: false,
          umCanOverride: false,
          umCanRetender: false,
          umVisibility: true,
          umSortOrder: 0,
          umCreatedBy: CALLER_ID,
        });
        expect(second.create).toMatchObject({ umMenuId: 3, umCanView: false });
        // An update of an existing grant revokes the omitted rights the same way.
        expect(first.update).toMatchObject({ umCanCancel: false, umIsDeleted: false });
        expect(payload.menus.map((menu) => menu.umMenuId)).toEqual([3, 12]);
      });

      it('soft-deletes the old grants before writing the new ones', async () => {
        await create({ menus: [{ umMenuId: 12 }] });

        expect(prisma.userMenus.updateMany).toHaveBeenCalledWith({
          where: { umUserId: USER_ID, umIsDeleted: false },
          data: { umIsDeleted: true, umModifiedOn: expect.any(Date), umModifiedBy: CALLER_ID },
        });
        expect(prisma.userMenus.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
          prisma.userMenus.upsert.mock.invocationCallOrder[0],
        );
      });

      it('refuses menus that do not exist or are inactive, naming each once', async () => {
        prisma.menu.findMany.mockResolvedValue([{ menuId: 12 }]);

        const refusal = await refusalOf(
          create({ menus: [{ umMenuId: 12 }, { umMenuId: 900 }, { umMenuId: 900 }] }),
        );

        expect(prisma.menu.findMany).toHaveBeenCalledWith({
          where: { menuId: { in: [12, 900] }, menuIsActive: true },
          select: { menuId: true },
        });
        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [
              {
                field: 'menus',
                code: UserAdminErrorCode.MENU_INVALID,
                message: 'Menu IDs not found or inactive: 900',
              },
            ],
          },
        });
        expect(prisma.userMenus.upsert).not.toHaveBeenCalled();
      });
    });

    describe('the employee link (notes 95)', () => {
      const employee = (overrides: object = {}) => ({
        empName: 'Ravi',
        empCompanyId: COMPANY_ID,
        empIsActive: true,
        ...overrides,
      });

      it('refuses an employee that does not exist', async () => {
        const refusal = await refusalOf(create({ usrEmployeeId: EMPLOYEE_ID }));

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [{ field: 'usrEmployeeId', code: UserAdminErrorCode.EMPLOYEE_NOT_FOUND }],
          },
        });
      });

      it("refuses another company's employee", async () => {
        prisma.employeeMaster.findFirst.mockResolvedValue(
          employee({ empCompanyId: OTHER_COMPANY_ID }),
        );

        const refusal = await refusalOf(
          create({ usrEmployeeId: EMPLOYEE_ID, usrCompanyId: COMPANY_ID }),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ code: UserAdminErrorCode.EMPLOYEE_OTHER_COMPANY }] },
        });
      });

      it('lets any company link an employee who belongs to none', async () => {
        prisma.employeeMaster.findFirst.mockResolvedValue(employee({ empCompanyId: null }));

        await expect(
          create({ usrEmployeeId: EMPLOYEE_ID, usrCompanyId: OTHER_COMPANY_ID }),
        ).resolves.toMatchObject({ usrEmployeeId: EMPLOYEE_ID });
      });

      it('refuses an employee who has left', async () => {
        prisma.employeeMaster.findFirst.mockResolvedValue(employee({ empIsActive: false }));

        const refusal = await refusalOf(create({ usrEmployeeId: EMPLOYEE_ID }));

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ code: UserAdminErrorCode.EMPLOYEE_INACTIVE }] },
        });
      });

      it('refuses an employee another active user already is', async () => {
        prisma.employeeMaster.findFirst.mockResolvedValue(employee());
        lookups({ employeeHeldBy: 'cashier2' });

        const refusal = await refusalOf(create({ usrEmployeeId: EMPLOYEE_ID }));

        expect(refusal).toMatchObject({
          status: 409,
          body: {
            errors: [
              {
                code: UserAdminErrorCode.EMPLOYEE_LINKED,
                message: `Employee "Ravi" is already linked to active user 'cashier2'`,
              },
            ],
          },
        });
      });

      it('lets an inactive user hold a link without the active-only checks', async () => {
        prisma.employeeMaster.findFirst.mockResolvedValue(employee({ empIsActive: false }));
        lookups({ employeeHeldBy: 'cashier2' });

        await expect(
          create({ usrEmployeeId: EMPLOYEE_ID, usrIsActive: false }),
        ).resolves.toMatchObject({ usrIsActive: false });
      });
    });
  });

  describe('update', () => {
    it('refuses an id with no live user', async () => {
      const refusal = await refusalOf(update());

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'usrId', code: UserAdminErrorCode.NOT_FOUND }] },
      });
    });

    it('lets only a SUPER ADMIN change a SUPER ADMIN user', async () => {
      lookups({
        target: userRow({ usrType: UserType.SUPER_ADMIN, usrLoginName: 'vk' }),
        callerType: UserType.ADMIN,
      });

      const refusal = await refusalOf(update({ usrIsActive: false }));

      expect(refusal).toMatchObject({
        status: 403,
        body: {
          errors: [
            {
              field: 'usrId',
              code: UserAdminErrorCode.ROLE_RESERVED,
              message: 'vk is a SUPER ADMIN user: only a SUPER ADMIN can change it',
            },
          ],
        },
      });
      expect(prisma.userMaster.update).not.toHaveBeenCalled();
    });

    it('refuses promoting a user to SUPER ADMIN unless the caller is one', async () => {
      lookups({ target: userRow(), callerType: UserType.ADMIN });

      const refusal = await refusalOf(update({ usrType: UserType.SUPER_ADMIN }));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ field: 'usrType', code: UserAdminErrorCode.ROLE_RESERVED }] },
      });
    });

    it('checks the login name against every user but this one', async () => {
      lookups({ target: userRow() });

      await update({ usrLoginName: 'cashier9' });

      expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
        where: {
          usrLoginName: { equals: 'cashier9', mode: 'insensitive' },
          usrIsDeleted: false,
          NOT: { usrId: USER_ID },
        },
        select: { usrId: true },
      });
    });

    // Review step 6 (U8): a password the administrator types for someone is a reset — the
    // user must change it at the next login (it used to lift the flag).
    it('resets a password to its hash, stamps the change and sets must-change', async () => {
      lookups({ target: userRow({ usrMustChangePassword: false }) });

      const payload = await update({ usrPassword: 'n3w-secret' });

      expect(hashSecret).toHaveBeenCalledWith('n3w-secret');
      expect(updatedData()).toMatchObject({
        usrPasswordHash: 'hashed:n3w-secret',
        usrPasswordChangedOn: expect.any(Date),
        usrMustChangePassword: true,
        usrModifiedBy: CALLER_ID,
      });
      expect(JSON.stringify(payload)).not.toContain('n3w-secret');
    });

    it("an explicit usrMustChangePassword sent with the password still decides (the screen's tick)", async () => {
      lookups({ target: userRow() });

      await update({ usrPassword: 'n3w-secret', usrMustChangePassword: false });

      expect(updatedData()).toMatchObject({ usrMustChangePassword: false });
    });

    it('leaves the password and PIN alone when neither is sent', async () => {
      lookups({ target: userRow() });

      await update({ usrDisplayName: 'Till 1' });

      expect(hashSecret).not.toHaveBeenCalled();
      expect(updatedData()).not.toHaveProperty('usrPasswordHash');
      expect(updatedData()).not.toHaveProperty('usrPinHash');
      expect(updatedData().usrDisplayName).toBe('Till 1');
    });

    it.each([
      ['an empty string', ''],
      ['null', null],
    ])('clears the PIN when sent %s', async (_label, usrPin) => {
      lookups({ target: userRow({ usrPinHash: 'hashed:1234' }) });

      const payload = await update({ usrPin });

      expect(updatedData().usrPinHash).toBeNull();
      expect(payload.usrPinSet).toBe(false);
    });

    it('keeps the stored menus when menus is left out', async () => {
      lookups({ target: userRow() });

      const payload = await update();

      expect(prisma.userMenus.updateMany).not.toHaveBeenCalled();
      expect(prisma.userMenus.findMany).toHaveBeenCalledWith({
        where: { umUserId: USER_ID, umIsDeleted: false },
        orderBy: { umMenuId: 'asc' },
      });
      expect(payload.menus.map((menu) => menu.umMenuId)).toEqual([5]);
    });

    it('revokes every grant when menus is sent empty', async () => {
      lookups({ target: userRow() });

      const payload = await update({ menus: [] });

      expect(prisma.userMenus.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.userMenus.upsert).not.toHaveBeenCalled();
      expect(payload.menus).toEqual([]);
    });

    it('keeps a standing link to an employee who has since left', async () => {
      lookups({ target: userRow({ usrEmployeeId: EMPLOYEE_ID }) });
      prisma.employeeMaster.findFirst.mockResolvedValue({
        empName: 'Ravi',
        empCompanyId: COMPANY_ID,
        empIsActive: false,
      });

      await update({ usrDisplayName: 'Ravi (left)' });

      expect(prisma.userMaster.update).toHaveBeenCalledTimes(1);
      expect(updatedData()).not.toHaveProperty('usrEmployeeId');
    });

    it('re-checks that employee when the user is made active again', async () => {
      lookups({ target: userRow({ usrEmployeeId: EMPLOYEE_ID, usrIsActive: false }) });
      prisma.employeeMaster.findFirst.mockResolvedValue({
        empName: 'Ravi',
        empCompanyId: COMPANY_ID,
        empIsActive: false,
      });

      const refusal = await refusalOf(update({ usrIsActive: true }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: UserAdminErrorCode.EMPLOYEE_INACTIVE }] },
      });
    });

    it('does not count the user itself as the other holder of its employee', async () => {
      lookups({ target: userRow({ usrEmployeeId: EMPLOYEE_ID }) });
      prisma.employeeMaster.findFirst.mockResolvedValue({
        empName: 'Ravi',
        empCompanyId: COMPANY_ID,
        empIsActive: true,
      });

      await update({ usrEmployeeId: EMPLOYEE_ID });

      expect(prisma.userMaster.findFirst).toHaveBeenCalledWith({
        where: {
          usrEmployeeId: EMPLOYEE_ID,
          usrIsDeleted: false,
          usrIsActive: true,
          NOT: { usrId: USER_ID },
        },
        select: { usrLoginName: true },
      });
    });

    // Review list 11-19 step 3 (58.12): the rights BEFORE and AFTER, by menu name, so the
    // history diffs them per menu; never a hash; a note spells the change out.
    it('audits the rights before and after by menu name, and never a hash', async () => {
      lookups({ target: userRow({ usrPinHash: 'scrypt$old$pin' }) });
      prisma.menu.findMany.mockImplementation(
        async ({ where }: { where: { menuId: { in: number[] } } }) =>
          where.menuId.in.map((menuId) => ({
            menuId,
            menuName: ({ 5: 'Sales Bill', 7: 'Day Book' } as Record<number, string>)[menuId],
          })),
      );
      prisma.userMenus.findMany.mockResolvedValue([menuRow(5, { umCanEdit: true })]);

      await update({
        usrFullName: 'Cashier Number One',
        usrPassword: 'newpass1',
        usrPin: '4321',
        menus: [
          { umMenuId: 5, umCanView: true, umCanPost: true },
          { umMenuId: 7, umCanView: true },
        ],
      });

      const [entry] = audit.logEntityChange.mock.calls[0] as [Record<string, unknown>];
      expect(entry).toMatchObject({
        action: 'update',
        pk: USER_ID,
        displayName: 'Cashier One',
        userId: CALLER_ID,
        originalRecord: { menuRights: { 'Sales Bill': 'View, Edit' }, pinSet: true },
        modifiedRecord: {
          menuRights: { 'Sales Bill': 'View, Post', 'Day Book': 'View' },
          pinSet: true,
          usrFullName: 'Cashier Number One',
        },
        notes:
          'User updated; password reset by an administrator; PIN changed; ' +
          'Menu rights: Sales Bill: Edit off, Post on; Day Book: added (View)',
      });
      expect(entry.originalRecord).not.toHaveProperty('menus');
      expect(JSON.stringify(entry)).not.toMatch(/scrypt|newpass1|4321/);
    });

    it('keeps the stored rights on both sides when menus is left out (no rights diff)', async () => {
      lookups({ target: userRow() });

      await update({ usrFullName: 'Cashier Number One' });

      type Entry = {
        originalRecord: { menuRights: unknown };
        modifiedRecord: { menuRights: unknown };
        notes: string;
      };
      const [entry] = audit.logEntityChange.mock.calls[0] as [Entry];
      expect(entry.originalRecord.menuRights).toEqual({ 'Menu 5': 'View' });
      expect(entry.modifiedRecord.menuRights).toEqual(entry.originalRecord.menuRights);
      expect(entry.notes).toBe('User updated');
    });
  });

  describe('describeMenuRightsChange', () => {
    const names = new Map([
      [5, 'Sales Bill'],
      [7, 'Day Book'],
      [9, 'Old Report'],
    ]);
    it('names each menu: rights on / off, added, removed; nothing when equal', () => {
      expect(
        describeMenuRightsChange(
          [menuRow(5, { umCanEdit: true }), menuRow(9)],
          [menuRow(5, { umCanPost: true }), menuRow(7, { umCanCreate: true })],
          names,
        ),
      ).toBe('Sales Bill: Edit off, Post on; Day Book: added (View, Create); Old Report: removed');
      expect(describeMenuRightsChange([menuRow(5)], [menuRow(5)], names)).toBe('');
    });
  });

  // Review list 11-19 S2: the token alone used to be enough for every route here.
  describe('menu-58 rights (review list 11-19 S2)', () => {
    const OTHER_ID = '019c6f6c-be87-7a11-8905-36092c46f1aa';
    const grant = (...granted: Right[]) =>
      prisma.$queryRaw.mockResolvedValue([rightsRow(...granted)]);
    const noRow = () => prisma.$queryRaw.mockResolvedValue([]);

    it.each([
      ['create', () => create(), UserAdminErrorCode.RIGHT_CREATE, ['view', 'edit', 'delete']],
      ['update', () => update(), UserAdminErrorCode.RIGHT_EDIT, ['view', 'create', 'delete']],
      [
        'update of the caller themselves (password, rights)',
        () => service.save({ usrId: CALLER_ID, usrLoginName: 'me', usrPassword: 'newpass1' }),
        UserAdminErrorCode.RIGHT_EDIT,
        ['view', 'create', 'delete'],
      ],
      [
        'delete',
        () => service.softDelete(USER_ID),
        UserAdminErrorCode.RIGHT_DELETE,
        ['view', 'create', 'edit'],
      ],
      [
        'get of another user',
        () => service.getById(USER_ID),
        UserAdminErrorCode.RIGHT_VIEW,
        ['create', 'edit', 'delete'],
      ],
    ] as [string, () => Promise<unknown>, UserAdminErrorCode, Right[]][])(
      'refuses a %s without its right (403 %s), before anything is read or written',
      async (_what, call, code, others) => {
        lookups({ target: userRow() });
        grant(...others);

        const refusal = await refusalOf(call());

        expect(refusal).toMatchObject({
          status: 403,
          body: { errors: [{ field: 'userId', code }] },
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.userMaster.findFirst).not.toHaveBeenCalled();
        expect(prisma.userMaster.create).not.toHaveBeenCalled();
        expect(prisma.userMaster.update).not.toHaveBeenCalled();
        expect(prisma.userMaster.updateMany).not.toHaveBeenCalled();
        expect(hashSecret).not.toHaveBeenCalled();
      },
    );

    it('refuses everything to a caller with no menu-58 row at all', async () => {
      noRow();
      lookups({ target: userRow() });

      for (const call of [() => create(), () => update(), () => service.softDelete(USER_ID)]) {
        expect((await refusalOf(call())).status).toBe(403);
      }
    });

    it('reads the rights of the caller on menu 58', async () => {
      await create();

      const [, userIdArg, menuIdArg] = prisma.$queryRaw.mock.calls[0] as unknown[];
      expect(userIdArg).toBe(CALLER_ID);
      expect(menuIdArg).toBe(58);
    });

    it.each([
      ['create', () => create(), ['create']],
      ['update', () => update(), ['edit']],
      ['delete', () => service.softDelete(USER_ID), ['delete']],
    ] as [string, () => Promise<unknown>, Right[]][])(
      'lets a %s through with only its own right',
      async (_what, call, granted) => {
        lookups({ target: userRow() });
        grant(...granted);

        await expect(call()).resolves.toBeDefined();
      },
    );

    it("reads the caller's own row with no right at all (main window, My Profile)", async () => {
      context.getUserId.mockReturnValue(USER_ID);
      noRow();
      prisma.userMaster.findFirst.mockResolvedValue({ ...userRow(), userMenus: [menuRow(7)] });

      await expect(service.getById(USER_ID.toUpperCase())).resolves.toMatchObject({
        usrId: USER_ID,
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("reads another user's row with the View right", async () => {
      grant('view');
      prisma.userMaster.findFirst.mockResolvedValue({
        ...userRow({ usrId: OTHER_ID }),
        userMenus: [],
      });

      await expect(service.getById(OTHER_ID)).resolves.toMatchObject({ usrId: OTHER_ID });
    });

    it('keeps the SUPER ADMIN rule on top of the right', async () => {
      grant('view', 'create', 'edit', 'delete');
      lookups({
        target: userRow({ usrType: UserType.SUPER_ADMIN, usrLoginName: 'vk' }),
        callerType: UserType.ADMIN,
      });

      const refusal = await refusalOf(update({ usrPassword: 'reset1' }));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: UserAdminErrorCode.ROLE_RESERVED }] },
      });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live user', async () => {
      prisma.userMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.getById(USER_ID));

      expect(refusal.status).toBe(404);
    });

    it('answers the user with its live menus and the names it points at', async () => {
      prisma.userMaster.findFirst.mockResolvedValue({
        ...userRow({ usrBranchId: BRANCH_ID, usrType: 'MANAGER' }),
        userMenus: [menuRow(7)],
      });

      const payload = await service.getById(USER_ID);

      expect(payload).toMatchObject({
        usrCompanyName: 'Zeta Traders',
        usrBranchName: 'Main',
        usrEmployeeName: null,
        // A role name the enum no longer holds (MANAGER became STORE MANAGER) reads as none.
        usrType: null,
        usrCreatedOn: STAMP.toISOString(),
        menus: [expect.objectContaining({ umMenuId: 7 })],
      });
      expect(payload).not.toHaveProperty('usrPasswordHash');
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live user', async () => {
      const refusal = await refusalOf(service.softDelete(USER_ID));

      expect(refusal.status).toBe(404);
    });

    it('lets only a SUPER ADMIN delete a SUPER ADMIN user', async () => {
      lookups({
        target: userRow({ usrType: UserType.SUPER_ADMIN, usrLoginName: 'vk' }),
        callerType: UserType.ADMIN,
      });

      const refusal = await refusalOf(service.softDelete(USER_ID));

      expect(refusal).toMatchObject({
        status: 403,
        body: {
          errors: [
            {
              code: UserAdminErrorCode.ROLE_RESERVED,
              message: 'vk is a SUPER ADMIN user: only a SUPER ADMIN can delete it',
            },
          ],
        },
      });
      expect(prisma.userMaster.updateMany).not.toHaveBeenCalled();
    });

    it('deactivates the user, drops every menu grant and audits a cancel', async () => {
      lookups({ target: userRow() });

      await expect(service.softDelete(USER_ID)).resolves.toEqual({
        usrId: USER_ID,
        deleted: true,
      });
      expect(prisma.userMaster.updateMany).toHaveBeenCalledWith({
        where: { usrId: USER_ID, usrIsDeleted: false },
        data: {
          usrIsDeleted: true,
          usrIsActive: false,
          usrModifiedOn: expect.any(Date),
          usrModifiedBy: CALLER_ID,
        },
      });
      expect(prisma.userMenus.updateMany).toHaveBeenCalledWith({
        where: { umUserId: USER_ID, umIsDeleted: false },
        data: { umIsDeleted: true, umModifiedOn: expect.any(Date), umModifiedBy: CALLER_ID },
      });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          displayName: 'Cashier One',
          modifiedRecord: expect.objectContaining({ usrIsDeleted: true, usrIsActive: false }),
        }),
        prisma,
      );
    });
  });
});
