import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { MenuMasterService } from './menu-master.service';
import { MenuMasterErrorCode } from './types/menu-master-error-codes';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46ff01';

const menuRow = (menuId: number, menuParentId: number | null, overrides: object = {}) => ({
  menuId,
  menuParentId,
  menuName: `Menu ${menuId}`,
  menuAlias: null,
  menuVisibility: true,
  menuPosition: new Prisma.Decimal(menuId),
  menuIconLocationDesktop: null,
  menuIconLocationWeb: null,
  menuIconLocationMobile: null,
  menuSeparator: false,
  menuIsActive: true,
  menuVerbs: [] as string[],
  ...overrides,
});

const userMenuRow = (menu: ReturnType<typeof menuRow>, overrides: object = {}) => ({
  umMenuId: menu.menuId,
  umCanCreate: true,
  umCanEdit: true,
  umCanDelete: false,
  umCanPrint: true,
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
  menu,
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

describe('MenuMasterService', () => {
  let prisma: {
    menu: { findMany: jest.Mock; update: jest.Mock };
    userMenus: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let service: MenuMasterService;

  beforeEach(() => {
    prisma = {
      menu: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { menuId: number };
            data: { menuVisibility: boolean };
          }) => ({
            menuId: where.menuId,
            menuVisibility: data.menuVisibility,
          }),
        ),
      },
      userMenus: { findMany: jest.fn().mockResolvedValue([]) },
      // updateVisibility hands $transaction the array of pending updates.
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new MenuMasterService(prisma as unknown as PrismaService, context as never);
  });

  describe('get', () => {
    it('reads active menus of any visibility by default', async () => {
      const result = await service.get({});

      expect(prisma.menu.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { menuIsActive: true } }),
      );
      expect(result.meta).toEqual({ visibleOnly: false, count: 0 });
    });

    it('adds the visibility filter when visibleOnly is set', async () => {
      await service.get({ visibleOnly: true });

      expect(prisma.menu.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { menuIsActive: true, menuVisibility: true } }),
      );
    });

    it('nests children under their parent and counts only the roots', async () => {
      prisma.menu.findMany.mockResolvedValue([
        menuRow(1, null),
        menuRow(2, 1),
        menuRow(3, 2),
        menuRow(4, null),
      ]);

      const { items, meta } = await service.get({});

      expect(meta.count).toBe(2);
      expect(items.map((item) => item.menuId)).toEqual([1, 4]);
      expect(items[0].children?.[0].menuId).toBe(2);
      expect(items[0].children?.[0].children?.[0].menuId).toBe(3);
      expect(items[1]).not.toHaveProperty('children');
    });

    it('treats a parent id of 0 as a root, after the null-parent roots', async () => {
      prisma.menu.findMany.mockResolvedValue([menuRow(5, 0), menuRow(1, null)]);

      const { items } = await service.get({});

      expect(items.map((item) => item.menuId)).toEqual([1, 5]);
    });

    it('renders the decimal position as text and carries the verbs, with no permissions', async () => {
      prisma.menu.findMany.mockResolvedValue([
        menuRow(12, null, { menuPosition: new Prisma.Decimal('3.5'), menuVerbs: ['POST'] }),
        menuRow(13, null, { menuPosition: null }),
      ]);

      const { items } = await service.get({});

      expect(items[0]).toMatchObject({
        menuPosition: '3.5',
        menuVerbs: ['POST'],
        permissions: null,
      });
      expect(items[1].menuPosition).toBeNull();
    });

    it('stops at a menu that is its own parent instead of recursing forever', async () => {
      prisma.menu.findMany.mockResolvedValue([menuRow(0, 0)]);

      const { items } = await service.get({});

      expect(items).toHaveLength(1);
      expect(items[0].children).toHaveLength(1);
      expect(items[0].children?.[0]).not.toHaveProperty('children');
    });
  });

  describe('getUserMenu', () => {
    it('refuses with a 401 when the token names no user', async () => {
      context.getUserId.mockReturnValue(null);

      const refusal = await refusalOf(service.getUserMenu());

      expect(refusal).toMatchObject({
        status: 401,
        body: { errors: [{ field: 'userId', code: MenuMasterErrorCode.USER_UNRESOLVED }] },
      });
      expect(prisma.userMenus.findMany).not.toHaveBeenCalled();
    });

    it('reads only the visible, live grants of the current user on active menus', async () => {
      await service.getUserMenu();

      expect(prisma.userMenus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            umUserId: USER_ID,
            umVisibility: true,
            umIsDeleted: false,
            menu: { menuIsActive: true },
          },
        }),
      );
    });

    it('attaches each menu its own grant, down the tree', async () => {
      const root = menuRow(10, null);
      const child = menuRow(11, 10, { menuVerbs: ['POST', 'CANCEL'] });
      prisma.userMenus.findMany.mockResolvedValue([
        userMenuRow(root, { umSortOrder: 2 }),
        userMenuRow(child, { umCanPost: true, umCanCreate: false, umIsPinned: true }),
      ]);

      const { items, meta } = await service.getUserMenu();

      expect(meta).toEqual({ visibleOnly: true, count: 1 });
      expect(items[0].permissions).toMatchObject({ canCreate: true, canPost: false, sortOrder: 2 });
      expect(items[0].children?.[0]).toMatchObject({
        menuId: 11,
        menuVerbs: ['POST', 'CANCEL'],
        permissions: {
          canCreate: false,
          canEdit: true,
          canDelete: false,
          canPrint: true,
          canExport: false,
          canPost: true,
          canCancel: false,
          canAmend: false,
          canOverride: false,
          canRetender: false,
          isVisible: true,
          isFavourite: false,
          isPinned: true,
          sortOrder: 0,
        },
      });
    });

    it('drops a granted child whose parent the user was not granted', async () => {
      prisma.userMenus.findMany.mockResolvedValue([userMenuRow(menuRow(21, 20))]);

      await expect(service.getUserMenu()).resolves.toMatchObject({ items: [], meta: { count: 0 } });
    });
  });

  describe('updateVisibility', () => {
    it('refuses the batch, naming every unknown menu, before writing anything', async () => {
      prisma.menu.findMany.mockResolvedValue([{ menuId: 1, menuIsActive: true }]);

      const refusal = await refusalOf(
        service.updateVisibility([
          { menuId: 1, menuVisibility: false },
          { menuId: 7, menuVisibility: false },
          { menuId: 8, menuVisibility: true },
        ]),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'Menu(s) not found for menuId(s): 7, 8',
          errors: [{ field: 'menuId', code: MenuMasterErrorCode.NOT_FOUND }],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('writes the new visibility and pins each menu to its current active flag', async () => {
      prisma.menu.findMany.mockResolvedValue([
        { menuId: 1, menuIsActive: true },
        { menuId: 2, menuIsActive: false },
      ]);

      const result = await service.updateVisibility([
        { menuId: 1, menuVisibility: false },
        { menuId: 2, menuVisibility: true },
      ]);

      expect(prisma.menu.update).toHaveBeenNthCalledWith(1, {
        where: { menuId: 1 },
        data: { menuVisibility: false, menuIsActive: true },
        select: { menuId: true, menuVisibility: true },
      });
      expect(prisma.menu.update).toHaveBeenNthCalledWith(2, {
        where: { menuId: 2 },
        data: { menuVisibility: true, menuIsActive: false },
        select: { menuId: true, menuVisibility: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        { menuId: 1, menuVisibility: false },
        { menuId: 2, menuVisibility: true },
      ]);
    });
  });
});
