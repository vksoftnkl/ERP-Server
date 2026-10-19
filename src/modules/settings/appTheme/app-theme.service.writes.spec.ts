import { HttpException } from '@nestjs/common';
import { AppThemeMaster, AppThemeTemplate } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppThemeService } from './app-theme.service';
import { SaveAppThemeDto } from './dto/save-app-theme.dto';
import { AppThemeErrorCode } from './types/app-theme-error-codes';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f302';
const MENU_ID = 266;
const CREATED = new Date('2026-09-30T10:00:00.000Z');
const MODIFIED = new Date('2026-09-30T13:20:00.000Z');

const themeRow = (overrides: Partial<AppThemeMaster> = {}): AppThemeMaster => ({
  thmId: 3,
  thmName: 'BLUE',
  thmIsActive: true,
  thmIsDeleted: false,
  thmBase: 'LIGHT',
  thmTokens: { primary: '#1D4ED8' },
  thmIsDefault: false,
  thmRemarks: null,
  thmCreatedOn: CREATED,
  thmCreatedBy: USER_ID,
  thmModifiedOn: MODIFIED,
  thmModifiedBy: USER_ID,
  thmSyncDate: null,
  ...overrides,
});

const templateRow = (overrides: Partial<AppThemeTemplate> = {}): AppThemeTemplate => ({
  tplId: 1,
  tplName: 'Default QSS',
  tplQss: 'QDialog { color: {{text}}; background: {{primary}}; }\nQLabel { color: {{text}}; }',
  tplIsActive: true,
  tplIsDeleted: false,
  tplRemarks: null,
  tplSyncDate: null,
  tplCreatedOn: CREATED,
  tplCreatedBy: USER_ID,
  tplModifiedOn: MODIFIED,
  tplModifiedBy: USER_ID,
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
  appThemeMaster: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  appThemeTemplate: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  company: { findFirst: jest.Mock; count: jest.Mock };
  menu: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

describe('AppThemeService — reads, writes and rights', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: AppThemeService;
  /** The caller's user_menus row on the App Themes menu; null = no row. */
  let grant: Record<string, boolean> | null;
  /** A live theme whose name the save collides with. */
  let nameClash: { thmId: number } | null;

  const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join('?');
  const rightsQueries = () =>
    prisma.$queryRaw.mock.calls.filter((call) => sqlOf(call).includes('user_menus'));

  beforeEach(() => {
    grant = { um_can_create: true, um_can_edit: true, um_can_delete: true };
    nameClash = null;
    prisma = {
      appThemeMaster: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<AppThemeMaster> }) =>
          themeRow({ thmId: 9, thmModifiedOn: null, ...data }),
        ),
        update: jest.fn(
          async ({ where, data }: { where: { thmId: number }; data: Partial<AppThemeMaster> }) =>
            themeRow({ ...where, ...data }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      appThemeTemplate: {
        findFirst: jest.fn().mockResolvedValue(templateRow()),
        findUnique: jest.fn().mockResolvedValue(templateRow()),
        update: jest.fn(async ({ data }: { data: Partial<AppThemeTemplate> }) =>
          templateRow(data),
        ),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({ compStylesheetId: null }),
        count: jest.fn().mockResolvedValue(0),
      },
      menu: { findFirst: jest.fn().mockResolvedValue({ menuId: MENU_ID }) },
      $queryRaw: jest.fn(async (...call: unknown[]) => {
        const sql = sqlOf(call);
        if (sql.includes('user_menus')) return grant ? [grant] : [];
        if (sql.includes('app_theme_master')) return nameClash ? [nameClash] : [];
        return [];
      }),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new AppThemeService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const themeDto = (overrides: Partial<SaveAppThemeDto> = {}): SaveAppThemeDto => ({
    thmName: 'BLUE',
    thmBase: 'LIGHT',
    tokens: { primary: '#1d4ed8' },
    ...overrides,
  });
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('the App Themes menu right', () => {
    it.each([
      ['create a theme', () => service.save(themeDto()), 'THM_RIGHT_CREATE'],
      ['edit a theme', () => service.save(themeDto({ thmId: 3 })), 'THM_RIGHT_EDIT'],
      ['delete a theme', () => service.softDelete(3), 'THM_RIGHT_DELETE'],
      ['restore a theme', () => service.restore(3), 'THM_RIGHT_EDIT'],
      [
        'save the template',
        () =>
          service.saveTemplate({ tplId: 1, tplQss: 'A { }', tplModifiedOn: MODIFIED.toISOString() }),
        'THM_RIGHT_EDIT',
      ],
    ])('is needed to %s', async (_label, call, code) => {
      grant = null;

      const refusal = await refusalOf(call());

      expect(refusal).toMatchObject({ status: 403, body: { errors: [{ field: 'userId', code }] } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('is looked up on the menu found by name under Configuration, once', async () => {
      await service.save(themeDto());
      await service.save(themeDto());

      expect(prisma.menu.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.menu.findFirst).toHaveBeenCalledWith({
        where: { menuParentId: 60, menuName: 'App Themes' },
        select: { menuId: true },
      });
      const [, userId, menuId] = rightsQueries()[0];
      expect([userId, menuId]).toEqual([USER_ID, MENU_ID]);
    });

    it('matches no grant while the menu row is missing, and looks again next time', async () => {
      prisma.menu.findFirst.mockResolvedValue(null);
      grant = null;

      await refusalOf(service.save(themeDto()));
      await refusalOf(service.save(themeDto()));

      expect(prisma.menu.findFirst).toHaveBeenCalledTimes(2);
      expect(rightsQueries()[0][2]).toBe(0);
    });

    it('refuses a caller with no user without reading any grant', async () => {
      context.getUserId.mockReturnValue(null);

      const refusal = await refusalOf(service.softDelete(3));

      expect(refusal.status).toBe(403);
      expect(rightsQueries()).toHaveLength(0);
    });
  });

  describe('save', () => {
    it('refuses bad tokens before opening a transaction', async () => {
      const refusal = await refusalOf(service.save(themeDto({ tokens: { primary: 'blue' } })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'tokens.primary', code: AppThemeErrorCode.TOKEN_NOT_COLOUR }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates an active, non-default theme with its colours upper-cased', async () => {
      prisma.company.count.mockResolvedValue(0);

      const payload = await service.save(themeDto());

      expect(prisma.appThemeMaster.create).toHaveBeenCalledWith({
        data: {
          thmName: 'BLUE',
          thmBase: 'LIGHT',
          thmTokens: { primary: '#1D4ED8' },
          thmIsDefault: false,
          thmIsActive: true,
          thmCreatedBy: USER_ID,
        },
      });
      expect(prisma.appThemeMaster.updateMany).not.toHaveBeenCalled();
      expect(payload).toMatchObject({
        thmId: 9,
        tokens: { primary: '#1D4ED8' },
        usedByCount: 0,
        // A row never modified reports when it was created.
        thmModifiedOn: CREATED.toISOString(),
      });
      expect(auditEntry()).toMatchObject({ action: 'New', pk: '9', originalRecord: null });
    });

    it('moves the default: the old one lets go before the new one is written', async () => {
      await service.save(themeDto({ thmIsDefault: true }));

      expect(prisma.appThemeMaster.updateMany).toHaveBeenCalledWith({
        where: { thmIsDefault: true, thmIsDeleted: false },
        data: { thmIsDefault: false, thmModifiedOn: expect.any(Date), thmModifiedBy: USER_ID },
      });
      expect(prisma.appThemeMaster.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.appThemeMaster.create.mock.invocationCallOrder[0],
      );
    });

    it('does not move the default when the theme saved already is it', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow({ thmIsDefault: true }));

      await service.save(themeDto({ thmId: 3, thmIsDefault: true }));

      expect(prisma.appThemeMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses an id with no theme', async () => {
      const refusal = await refusalOf(service.save(themeDto({ thmId: 3 })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'thmId', code: AppThemeErrorCode.NOT_FOUND }] },
      });
    });

    it('refuses to edit a deleted theme', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow({ thmIsDeleted: true }));

      const refusal = await refusalOf(service.save(themeDto({ thmId: 3 })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: AppThemeErrorCode.DELETED }] },
      });
    });

    it('refuses to un-set the default', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow({ thmIsDefault: true }));

      const refusal = await refusalOf(service.save(themeDto({ thmId: 3, thmIsDefault: false })));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'thmIsDefault', code: AppThemeErrorCode.DEFAULT_STAYS_DEFAULT }],
        },
      });
    });

    it.each([
      ['deactivating the default', themeRow({ thmIsDefault: true }), { thmIsActive: false }],
      ['making an inactive theme the default', themeRow({ thmIsActive: false }), { thmIsDefault: true }],
    ])('refuses %s', async (_label, stored, overrides) => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(stored);

      const refusal = await refusalOf(service.save(themeDto({ thmId: 3, ...overrides })));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'thmIsActive', code: AppThemeErrorCode.DEFAULT_MUST_BE_ACTIVE }],
        },
      });
    });

    it('refuses a name another live theme holds', async () => {
      nameClash = { thmId: 4 };

      const refusal = await refusalOf(service.save(themeDto({ thmName: 'blue' })));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'thmName',
              code: AppThemeErrorCode.NAME_TAKEN,
              message: '"blue" is already theme 4.',
            },
          ],
        },
      });
      expect(prisma.appThemeMaster.create).not.toHaveBeenCalled();
    });

    it('checks the name against every theme but the one being edited', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow());

      await service.save(themeDto({ thmId: 3 }));

      const nameCheck = prisma.$queryRaw.mock.calls.find((call) =>
        sqlOf(call).includes('app_theme_master'),
      )!;
      expect(nameCheck.slice(1)).toEqual(['BLUE', 3, 3]);
    });

    it('writes the remarks only when they are sent, and audits before and after', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow({ thmRemarks: 'old' }));

      await service.save(themeDto({ thmId: 3 }));

      const { data } = prisma.appThemeMaster.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).not.toHaveProperty('thmRemarks');
      expect(data).toMatchObject({ thmModifiedOn: expect.any(Date), thmModifiedBy: USER_ID });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ thmTokens: { primary: '#1D4ED8' } }),
      });
    });

    describe('when the database refuses the row', () => {
      it.each([
        [
          'the one-default index',
          { code: 'P2002', meta: { target: 'ux_thm_default' } },
          { status: 409, field: 'thmIsDefault', code: AppThemeErrorCode.DEFAULT_MOVED },
        ],
        [
          'the name index',
          { code: 'P2002', meta: { target: ['thm_name'] } },
          { status: 409, field: 'thmName', code: AppThemeErrorCode.NAME_TAKEN },
        ],
        [
          'the base check',
          { message: 'code: "23514", violates check constraint "ck_thm_base"' },
          { status: 400, field: 'thmBase', code: AppThemeErrorCode.BASE_INVALID },
        ],
        [
          'the tokens check',
          { message: 'code: "23514", violates check constraint "ck_thm_tokens"' },
          { status: 400, field: 'tokens', code: AppThemeErrorCode.TOKEN_NOT_COLOUR },
        ],
      ])('answers %s with a coded refusal', async (_label, shape, expected) => {
        prisma.appThemeMaster.create.mockRejectedValue(Object.assign(new Error('db'), shape));

        const refusal = await refusalOf(service.save(themeDto()));

        expect(refusal).toMatchObject({
          status: expected.status,
          body: { errors: [{ field: expected.field, code: expected.code }] },
        });
      });

      it('rethrows anything else untouched', async () => {
        const failure = new Error('connection reset');
        prisma.appThemeMaster.create.mockRejectedValue(failure);

        await expect(service.save(themeDto())).rejects.toBe(failure);
      });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no theme', async () => {
      expect((await refusalOf(service.softDelete(3))).status).toBe(404);
    });

    it.each([
      ['already deleted', themeRow({ thmIsDeleted: true }), AppThemeErrorCode.ALREADY_DELETED],
      ['the default', themeRow({ thmIsDefault: true }), AppThemeErrorCode.DEFAULT_UNDELETABLE],
    ])('refuses a theme that is %s', async (_label, stored, code) => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(stored);

      const refusal = await refusalOf(service.softDelete(3));

      expect(refusal).toMatchObject({ status: 409, body: { errors: [{ code }] } });
      expect(prisma.appThemeMaster.update).not.toHaveBeenCalled();
    });

    it.each([
      [1, 'In use by 1 company. Point them at another theme first.'],
      [2, 'In use by 2 companies. Point them at another theme first.'],
    ])('refuses while %i live companies use it', async (count, message) => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow());
      prisma.company.count.mockResolvedValue(count);

      const refusal = await refusalOf(service.softDelete(3));

      expect(prisma.company.count).toHaveBeenCalledWith({
        where: { compStylesheetId: 3, compIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: AppThemeErrorCode.IN_USE, message }] },
      });
    });

    it('marks the theme deleted and audits a cancel', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow());

      await expect(service.softDelete(3)).resolves.toEqual({ thmId: 3, deleted: true });
      expect(prisma.appThemeMaster.update).toHaveBeenCalledWith({
        where: { thmId: 3 },
        data: { thmIsDeleted: true, thmModifiedOn: expect.any(Date), thmModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({ action: 'cancel', notes: 'App theme soft deleted' });
    });
  });

  describe('restore', () => {
    it('refuses a theme that is not deleted', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow());

      const refusal = await refusalOf(service.restore(3));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: AppThemeErrorCode.NOT_DELETED }] },
      });
    });

    it('refuses when a live theme has taken its name meanwhile', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow({ thmIsDeleted: true }));
      nameClash = { thmId: 5 };

      const refusal = await refusalOf(service.restore(3));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: AppThemeErrorCode.NAME_TAKEN }] },
      });
    });

    it('brings the theme back and audits it as an update', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(themeRow({ thmIsDeleted: true }));

      await expect(service.restore(3)).resolves.toEqual({ thmId: 3, deleted: false });
      expect(auditEntry()).toMatchObject({ action: 'update', notes: 'App theme restored' });
    });
  });

  describe('getById', () => {
    it('refuses an id with no theme', async () => {
      const refusal = await refusalOf(service.getById(3));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: AppThemeErrorCode.NOT_FOUND }] },
      });
    });

    it('answers a deleted theme too, keeping only the string colours', async () => {
      prisma.appThemeMaster.findUnique.mockResolvedValue(
        themeRow({ thmIsDeleted: true, thmTokens: { primary: '#1D4ED8', text: 7 } }),
      );
      prisma.company.count.mockResolvedValue(2);

      await expect(service.getById(3)).resolves.toMatchObject({
        thmIsDeleted: true,
        tokens: { primary: '#1D4ED8' },
        usedByCount: 2,
        thmModifiedOn: MODIFIED.toISOString(),
      });
    });
  });

  describe('effective', () => {
    it('refuses a company that does not exist', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.effective(COMPANY_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'companyId', code: AppThemeErrorCode.COMPANY_NOT_FOUND }] },
      });
    });

    it("paints a company in its own theme when that theme is live", async () => {
      prisma.company.findFirst.mockResolvedValue({ compStylesheetId: 3 });
      prisma.appThemeMaster.findFirst.mockResolvedValueOnce(themeRow());

      const result = await service.effective(COMPANY_ID);

      expect(prisma.appThemeMaster.findFirst).toHaveBeenCalledWith({
        where: { thmId: 3, thmIsActive: true, thmIsDeleted: false },
      });
      expect(result).toMatchObject({
        thmId: 3,
        resolvedFrom: 'COMPANY',
        template: { tplId: 1, tplModifiedOn: MODIFIED.toISOString() },
      });
    });

    it('falls back to the default when its own theme is off or gone', async () => {
      prisma.company.findFirst.mockResolvedValue({ compStylesheetId: 3 });
      prisma.appThemeMaster.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(themeRow({ thmId: 1, thmName: 'MAROON', thmIsDefault: true }));

      await expect(service.effective(COMPANY_ID)).resolves.toMatchObject({
        thmId: 1,
        resolvedFrom: 'DEFAULT',
      });
    });

    it('refuses when no live theme is the default', async () => {
      const refusal = await refusalOf(service.effective(COMPANY_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: AppThemeErrorCode.NO_DEFAULT }] },
      });
    });

    it('answers no template while none is active', async () => {
      prisma.appThemeMaster.findFirst.mockResolvedValue(themeRow({ thmIsDefault: true }));
      prisma.appThemeTemplate.findFirst.mockResolvedValue(null);

      await expect(service.effective(COMPANY_ID)).resolves.toMatchObject({ template: null });
    });
  });

  describe('bootstrap', () => {
    it('answers the default colours and the active template', async () => {
      prisma.appThemeMaster.findFirst.mockResolvedValue(
        themeRow({ thmIsDefault: true, thmModifiedOn: null }),
      );

      await expect(service.bootstrap()).resolves.toEqual({
        tokens: { primary: '#1D4ED8' },
        thmModifiedOn: CREATED.toISOString(),
        template: {
          tplId: 1,
          tplQss: templateRow().tplQss,
          tplModifiedOn: MODIFIED.toISOString(),
        },
      });
    });

    it('never refuses: an empty table answers empty', async () => {
      prisma.appThemeTemplate.findFirst.mockResolvedValue(null);

      await expect(service.bootstrap()).resolves.toEqual({
        tokens: {},
        thmModifiedOn: null,
        template: null,
      });
    });
  });

  describe('template', () => {
    it('reads the oldest live, active template', async () => {
      const payload = await service.template();

      expect(prisma.appThemeTemplate.findFirst).toHaveBeenCalledWith({
        where: { tplIsActive: true, tplIsDeleted: false },
        orderBy: { tplId: 'asc' },
      });
      expect(payload).toMatchObject({ tplId: 1, placeholders: ['text', 'primary'] });
    });

    it('refuses while no template is active', async () => {
      prisma.appThemeTemplate.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.template());

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: AppThemeErrorCode.TEMPLATE_MISSING }] },
      });
    });
  });

  describe('saveTemplate', () => {
    const save = (overrides: object = {}) =>
      service.saveTemplate({
        tplId: 1,
        tplQss: 'QDialog { color: {{text}}; }',
        tplModifiedOn: MODIFIED.toISOString(),
        ...overrides,
      });

    it('refuses a template with faults before opening a transaction', async () => {
      const refusal = await refusalOf(save({ tplQss: 'A { color: {{nope}};' }));

      expect(refusal).toMatchObject({ status: 400, body: { message: 'Invalid template' } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('locks the row before comparing it', async () => {
      await save();

      const lock = prisma.$queryRaw.mock.calls.find((call) => sqlOf(call).includes('FOR UPDATE'))!;
      expect(lock.slice(1)).toEqual([1]);
      expect(prisma.$queryRaw.mock.invocationCallOrder.at(-1)).toBeLessThan(
        prisma.appThemeTemplate.findUnique.mock.invocationCallOrder[0],
      );
    });

    it('refuses an id with no template', async () => {
      prisma.appThemeTemplate.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(save());

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: AppThemeErrorCode.TEMPLATE_NOT_FOUND }] },
      });
    });

    it.each([
      ['inactive', { tplIsActive: false }],
      ['deleted', { tplIsDeleted: true }],
    ])('refuses a template that is %s', async (_label, overrides) => {
      prisma.appThemeTemplate.findUnique.mockResolvedValue(templateRow(overrides));

      const refusal = await refusalOf(save());

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: AppThemeErrorCode.TEMPLATE_NOT_ACTIVE }] },
      });
    });

    it('refuses a copy loaded before someone else saved', async () => {
      const refusal = await refusalOf(save({ tplModifiedOn: '2026-09-30T00:00:00.000Z' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'tplModifiedOn', code: AppThemeErrorCode.TEMPLATE_CHANGED }] },
      });
      expect(prisma.appThemeTemplate.update).not.toHaveBeenCalled();
    });

    it('compares against the created stamp of a template never saved since', async () => {
      prisma.appThemeTemplate.findUnique.mockResolvedValue(templateRow({ tplModifiedOn: null }));

      await expect(save({ tplModifiedOn: CREATED.toISOString() })).resolves.toMatchObject({
        tplId: 1,
      });
    });

    it('writes the text, and the remarks only when sent, and audits both versions', async () => {
      await save({ tplRemarks: 'darker headers' });

      expect(prisma.appThemeTemplate.update).toHaveBeenCalledWith({
        where: { tplId: 1 },
        data: {
          tplQss: 'QDialog { color: {{text}}; }',
          tplRemarks: 'darker headers',
          tplModifiedOn: expect.any(Date),
          tplModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        tableName: 'app theme template',
        originalRecord: expect.objectContaining({ tplQss: templateRow().tplQss }),
        modifiedRecord: expect.objectContaining({ tplQss: 'QDialog { color: {{text}}; }' }),
      });
    });
  });
});
