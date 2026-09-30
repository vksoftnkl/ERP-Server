import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { AppThemeService } from '../src/modules/settings/appTheme/app-theme.service';
import { CompanyMasterService } from '../src/modules/settings/companyMaster/company-master.service';

/**
 * Company themes (theme/plan-app-theme.md §8 "Live") against the real
 * database, in one rolled-back transaction, on the REAL audit service:
 * /effective for a company with a theme and one without, the token
 * validation, the default's one-at-a-time rule, the delete guards, restore,
 * the menu rights, and the company master's live-theme check.
 *
 *     npm run test:e2e -- app-theme
 */

const prisma = new PrismaClient();
class Rollback extends Error {}

function transactional(tx: Prisma.TransactionClient): PrismaService {
  const proxy: object = new Proxy(tx, {
    get(target, prop) {
      if (prop === '$transaction') {
        return (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (client: unknown) => unknown)(proxy)
            : Promise.all(arg as Array<Promise<unknown>>);
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return proxy as PrismaService;
}

describe('App themes (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let themes: AppThemeService;
  let companies: CompanyMasterService;
  let userId: string;
  let menuId: number;
  let spSeq = 0;
  const stamp = Date.now().toString(36);

  beforeAll(async () => {
    await new Promise<void>((ready, fail) => {
      txDone = prisma
        .$transaction(
          async (client) => {
            tx = client;
            ready();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            throw new Rollback();
          },
          { maxWait: 30_000, timeout: 10 * 60_000 },
        )
        .then(
          () => undefined,
          (error: unknown) => {
            if (error instanceof Rollback) return;
            fail(error instanceof Error ? error : new Error(String(error)));
            throw error;
          },
        );
    });
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    userId = user.usr_id;
    const [menu] = await tx.$queryRaw<Array<{ menu_id: number }>>`
      SELECT menu_id FROM fixed.menu_master WHERE menu_parent = 60 AND menu_name = 'App Themes'`;
    menuId = menu.menu_id;
    const ctx = {
      getUserId: () => userId,
      getIpAddress: () => null,
    } as unknown as RequestContextService;
    const db = transactional(tx);
    const audit = new AuditLogService(db, ctx);
    themes = new AppThemeService(db, audit, ctx);
    companies = new CompanyMasterService(db, audit, ctx);
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  async function attempt<T>(fn: () => Promise<T>): Promise<T> {
    const sp = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
    try {
      const out = await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      return out;
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw error;
    }
  }
  const refusal = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return {
        status: (error as { status?: number }).status,
        body: JSON.stringify((error as { response?: unknown }).response ?? String(error)),
      };
    }
    throw new Error('expected a refusal, got a result');
  };
  const grant = async (rights: { create?: boolean; edit?: boolean; delete?: boolean }) => {
    await tx.$executeRaw`
      INSERT INTO public.user_menus (um_user_id, um_menu_id, um_can_create, um_can_edit, um_can_delete, um_created_by)
      VALUES (${userId}::uuid, ${menuId}, ${rights.create ?? false}, ${rights.edit ?? false},
              ${rights.delete ?? false}, ${userId}::uuid)
      ON CONFLICT (um_user_id, um_menu_id) DO UPDATE
        SET um_can_create = EXCLUDED.um_can_create, um_can_edit = EXCLUDED.um_can_edit,
            um_can_delete = EXCLUDED.um_can_delete, um_is_deleted = false`;
  };
  const theme = (name: string, extra: Record<string, unknown> = {}) => ({
    thmName: `ZT-${name}-${stamp}`,
    thmBase: 'LIGHT' as const,
    tokens: { primary: '#123456', 'table.selected': '#654321' },
    ...extra,
  });

  it('/effective: a company with a live theme gets it; one with none gets the default', async () => {
    const [withTheme] = await tx.$queryRaw<Array<{ comp_id: string; thm: number }>>`
      SELECT c.comp_id, c.comp_stylesheet_id AS thm FROM public.companys c
        JOIN public.app_theme_master t ON t.thm_id = c.comp_stylesheet_id
                                      AND t.thm_is_active AND NOT t.thm_is_deleted
       WHERE NOT c.comp_is_deleted LIMIT 1`;
    const [without] = await tx.$queryRaw<Array<{ comp_id: string }>>`
      SELECT comp_id FROM public.companys WHERE NOT comp_is_deleted AND comp_stylesheet_id IS NULL LIMIT 1`;
    const own = await themes.effective(withTheme.comp_id);
    expect(own).toMatchObject({ thmId: withTheme.thm, resolvedFrom: 'COMPANY' });
    expect(Object.keys(own.tokens)).toHaveLength(33);
    const fallback = await themes.effective(without.comp_id);
    expect(fallback).toMatchObject({
      thmName: 'MAROON',
      thmIsDefault: true,
      resolvedFrom: 'DEFAULT',
    });
    expect(fallback.tokens.primary).toBe('#7B1113');
  });

  it('writes need the App Themes menu rights (403 without a grant)', async () => {
    const denied = await refusal(attempt(() => themes.save(theme('norights'))));
    expect(denied.status).toBe(403);
    expect(denied.body).toContain('THM_RIGHT_CREATE');
  });

  it('/save validates every token, names a clash, and moves the default one at a time', async () => {
    await grant({ create: true, edit: true, delete: true });
    const bad = await refusal(
      attempt(() => themes.save(theme('bad', { tokens: { primary: 'red', x: '#FFFFFF' } }))),
    );
    expect(bad.status).toBe(400);
    expect(bad.body).toContain('tokens.primary');
    expect(bad.body).toContain('tokens.x');

    const created = await attempt(() => themes.save(theme('new')));
    expect(created).toMatchObject({ thmIsDefault: false, usedByCount: 0 });
    expect(created.thmId).toBeGreaterThan(3);
    const clash = await refusal(attempt(() => themes.save(theme('new'))));
    expect(clash.status).toBe(409);

    // Moving the default: the new one takes it, MAROON lets go, in one save.
    await attempt(() => themes.save({ ...theme('new'), thmId: created.thmId, thmIsDefault: true }));
    const defaults = await tx.appThemeMaster.findMany({
      where: { thmIsDefault: true, thmIsDeleted: false },
      select: { thmId: true },
    });
    expect(defaults).toEqual([{ thmId: created.thmId }]);
    // ...and it cannot simply be switched off again.
    const unset = await refusal(
      attempt(() => themes.save({ ...theme('new'), thmId: created.thmId, thmIsDefault: false })),
    );
    expect(unset.status).toBe(400);
  });

  it('/delete refuses the default, a theme in use, and a second delete; /restore undoes it', async () => {
    await grant({ create: true, edit: true, delete: true });
    const [defaultTheme] = await tx.$queryRaw<Array<{ thm_id: number }>>`
      SELECT thm_id FROM public.app_theme_master WHERE thm_is_default AND NOT thm_is_deleted`;
    expect((await refusal(attempt(() => themes.softDelete(defaultTheme.thm_id)))).status).toBe(409);

    const inUse = await refusal(attempt(() => themes.softDelete(3)));
    expect(inUse.status).toBe(409);
    expect(inUse.body).toMatch(/In use by \d+ compan/);

    const spare = await attempt(() => themes.save(theme('spare')));
    await expect(attempt(() => themes.softDelete(spare.thmId))).resolves.toEqual({
      thmId: spare.thmId,
      deleted: true,
    });
    expect((await refusal(attempt(() => themes.softDelete(spare.thmId)))).status).toBe(409);
    expect(await themes.getById(spare.thmId)).toMatchObject({ thmIsDeleted: true });
    await expect(attempt(() => themes.restore(spare.thmId))).resolves.toEqual({
      thmId: spare.thmId,
      deleted: false,
    });
  });

  it('a company whose theme is deleted is painted in the default; its master refuses a dead theme', async () => {
    await grant({ create: true, edit: true, delete: true });
    const dead = await attempt(() => themes.save(theme('dead')));
    const [company] = await tx.$queryRaw<
      Array<{ comp_id: string; comp_name: string; comp_state_code: string }>
    >`
      SELECT comp_id, comp_name, comp_state_code FROM public.companys
       WHERE NOT comp_is_deleted AND comp_stylesheet_id IS NULL LIMIT 1`;
    // Point it there directly, then retire the theme under it (as a pre-guard row would be).
    await tx.$executeRaw`UPDATE public.companys SET comp_stylesheet_id = ${dead.thmId} WHERE comp_id = ${company.comp_id}::uuid`;
    await tx.$executeRaw`UPDATE public.app_theme_master SET thm_is_deleted = true WHERE thm_id = ${dead.thmId}`;
    expect(await themes.effective(company.comp_id)).toMatchObject({ resolvedFrom: 'DEFAULT' });

    // The master refuses a CHANGE to a dead theme...
    await tx.$executeRaw`UPDATE public.companys SET comp_stylesheet_id = NULL WHERE comp_id = ${company.comp_id}::uuid`;
    const refused = await refusal(
      attempt(() =>
        companies.save({
          compId: company.comp_id,
          compName: company.comp_name,
          compStateCode: company.comp_state_code,
          compStylesheetId: dead.thmId,
        }),
      ),
    );
    expect(refused.status).toBe(400);
    expect(refused.body).toContain('compStylesheetId');
    // ...and accepts a live one.
    const saved = await attempt(() =>
      companies.save({
        compId: company.comp_id,
        compName: company.comp_name,
        compStateCode: company.comp_state_code,
        compStylesheetId: 2,
      }),
    );
    expect(saved.compStylesheetId).toBe(2);
  });
});
