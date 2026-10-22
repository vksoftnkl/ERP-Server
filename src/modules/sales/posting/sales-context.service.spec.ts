import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { NO_RIGHTS } from '../../../common/posting/rights';
import { SalesContextService } from './sales-context.service';
import { SALES_SETTING_DEFAULTS, SALES_SETTING_KEYS } from './sales.settings';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46ac01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46ac02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46ac03';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46ac04';
const MENU_ID = 12;

/** One `user_menus` row, every flag false unless named. */
const rightsRow = (granted: Partial<Record<string, boolean>> = {}) => ({
  um_can_view: false,
  um_can_create: false,
  um_can_edit: false,
  um_can_delete: false,
  um_can_print: false,
  um_can_export: false,
  um_can_post: false,
  um_can_cancel: false,
  um_can_amend: false,
  um_can_override: false,
  um_can_retender: false,
  ...granted,
});

type ClientMock = {
  $queryRaw: jest.Mock;
  userMaster: { findUnique: jest.Mock };
};

describe('SalesContextService', () => {
  let prisma: ClientMock;
  let requestContext: { getUserId: jest.Mock };
  let appSettings: { resolveEffective: jest.Mock };
  let service: SalesContextService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([rightsRow({ um_can_view: true })]),
      userMaster: { findUnique: jest.fn().mockResolvedValue({ usrLoginName: '  cashier1  ' }) },
    };
    requestContext = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    appSettings = { resolveEffective: jest.fn().mockResolvedValue([]) };
    service = new SalesContextService(
      prisma as unknown as PrismaService,
      requestContext as never,
      appSettings as never,
    );
  });

  describe('actor / actorName', () => {
    it('answers the caller id, or the nil actor when nobody is logged in', () => {
      expect(service.actor()).toBe(USER_ID);

      requestContext.getUserId.mockReturnValue(null);
      expect(service.actor()).toBe(DEFAULT_ACTOR);
    });

    it('answers the trimmed login name for the text audit columns', async () => {
      await expect(service.actorName()).resolves.toBe('cashier1');
      expect(prisma.userMaster.findUnique).toHaveBeenCalledWith({
        where: { usrId: USER_ID },
        select: { usrLoginName: true },
      });
    });

    it('reads the name through the transaction client when given one', async () => {
      const tx = { userMaster: { findUnique: jest.fn().mockResolvedValue({ usrLoginName: 'x' }) } };

      await expect(service.actorName(tx as unknown as Prisma.TransactionClient)).resolves.toBe('x');
      expect(prisma.userMaster.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to the id when it names no user, or the user has a blank name', async () => {
      prisma.userMaster.findUnique.mockResolvedValueOnce(null);
      await expect(service.actorName()).resolves.toBe(USER_ID);

      prisma.userMaster.findUnique.mockResolvedValueOnce({ usrLoginName: '   ' });
      await expect(service.actorName()).resolves.toBe(USER_ID);
    });

    it('does not look up an id that is not a uuid', async () => {
      requestContext.getUserId.mockReturnValue('SYSTEM');
      await expect(service.actorName()).resolves.toBe('SYSTEM');

      requestContext.getUserId.mockReturnValue(null);
      await expect(service.actorName()).resolves.toBe(DEFAULT_ACTOR);

      expect(prisma.userMaster.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('resolves settings once through the resolver, with the scope and the caller', async () => {
      appSettings.resolveEffective.mockResolvedValue([
        { asdKey: SALES_SETTING_KEYS.BACKDATE_MODE, value: 'REFUSE' },
      ]);

      const ctx = await service.resolve(
        { companyId: COMPANY_ID, branchId: BRANCH_ID, deviceId: DEVICE_ID },
        MENU_ID,
      );

      expect(appSettings.resolveEffective).toHaveBeenCalledTimes(1);
      expect(appSettings.resolveEffective).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        deviceId: DEVICE_ID,
        userId: USER_ID,
      });
      expect(ctx).toMatchObject({
        userId: USER_ID,
        actor: USER_ID,
        actorName: 'cashier1',
        cogsMode: 'PERPETUAL',
        settings: { ...SALES_SETTING_DEFAULTS, backdateMode: 'REFUSE' },
        rights: { ...NO_RIGHTS, view: true },
      });
    });

    it('drops a device id that is not a uuid instead of sending it to a uuid cast', async () => {
      await service.resolve(
        { companyId: COMPANY_ID, branchId: BRANCH_ID, deviceId: 'TILL-HOSTNAME' },
        MENU_ID,
      );

      expect(appSettings.resolveEffective).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: null }),
      );
    });

    it.each([
      ['periodic', 'PERIODIC'],
      [' PERIODIC ', 'PERIODIC'],
      ['PERPETUAL', 'PERPETUAL'],
      ['', 'PERPETUAL'],
      ['SOMETHING', 'PERPETUAL'],
    ])('reads accounts.cogs_mode %p as %p', async (value, expected) => {
      appSettings.resolveEffective.mockResolvedValue([
        { asdKey: 'accounts.cogs_mode', value },
      ]);

      const ctx = await service.resolve({ companyId: COMPANY_ID, branchId: BRANCH_ID }, MENU_ID);

      expect(ctx.cogsMode).toBe(expected);
    });

    it('reads the rights of the caller on the menu, through the transaction client', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([rightsRow({ um_can_post: true })]),
        userMaster: { findUnique: jest.fn().mockResolvedValue({ usrLoginName: 'boss' }) },
      };

      const ctx = await service.resolve(
        { companyId: COMPANY_ID, branchId: BRANCH_ID },
        MENU_ID,
        tx as unknown as Prisma.TransactionClient,
      );

      expect(ctx.rights).toEqual({ ...NO_RIGHTS, post: true });
      expect(ctx.actorName).toBe('boss');
      expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([USER_ID, MENU_ID]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('holds no rights and reads none when nobody is logged in', async () => {
      requestContext.getUserId.mockReturnValue(null);

      const ctx = await service.resolve({ companyId: COMPANY_ID, branchId: BRANCH_ID }, MENU_ID);

      expect(ctx).toMatchObject({
        userId: DEFAULT_ACTOR,
        actor: DEFAULT_ACTOR,
        actorName: DEFAULT_ACTOR,
        rights: { ...NO_RIGHTS },
      });
      expect(appSettings.resolveEffective).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null }),
      );
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('treats a non-uuid caller as holding nothing, while still naming it', async () => {
      requestContext.getUserId.mockReturnValue('SYSTEM');

      const ctx = await service.resolve({ companyId: COMPANY_ID, branchId: BRANCH_ID }, MENU_ID);

      expect(ctx).toMatchObject({ userId: 'SYSTEM', actor: 'SYSTEM', rights: { ...NO_RIGHTS } });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('settings / setting', () => {
    it('resolves the sales settings without a user', async () => {
      appSettings.resolveEffective.mockResolvedValue([
        { asdKey: SALES_SETTING_KEYS.ROUND_OFF_STEP, value: '0.5' },
      ]);

      const settings = await service.settings(COMPANY_ID, BRANCH_ID, DEVICE_ID);

      expect(settings.roundOffStep).toBe(0.5);
      expect(appSettings.resolveEffective).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        deviceId: DEVICE_ID,
        userId: null,
      });
    });

    it('answers one raw value of any key, or null when the catalogue lacks it', async () => {
      appSettings.resolveEffective.mockResolvedValue([
        { asdKey: 'till.handover_receipt', value: 'REQUIRED' },
      ]);

      await expect(service.setting(COMPANY_ID, BRANCH_ID, 'till.handover_receipt')).resolves.toBe(
        'REQUIRED',
      );
      await expect(service.setting(COMPANY_ID, BRANCH_ID, 'no.such_key')).resolves.toBeNull();
      expect(appSettings.resolveEffective).toHaveBeenLastCalledWith({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        deviceId: null,
        userId: null,
      });
    });
  });

  describe('rights / hasRight', () => {
    it('answers all eleven flags, retender included', async () => {
      prisma.$queryRaw.mockResolvedValue([
        rightsRow({ um_can_view: true, um_can_retender: true }),
      ]);

      await expect(service.rights(MENU_ID)).resolves.toEqual({
        ...NO_RIGHTS,
        view: true,
        retender: true,
      });
    });

    it('answers no rights, without a read, when nobody is logged in', async () => {
      requestContext.getUserId.mockReturnValue(null);

      await expect(service.rights(MENU_ID)).resolves.toEqual({ ...NO_RIGHTS });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('hasRight is true only for a flag that is exactly true', async () => {
      const ctx = await service.resolve({ companyId: COMPANY_ID, branchId: BRANCH_ID }, MENU_ID);

      expect(service.hasRight(ctx, 'view')).toBe(true);
      expect(service.hasRight(ctx, 'post')).toBe(false);
    });
  });
});
