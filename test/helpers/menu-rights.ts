import { PrismaClient } from '@prisma/client';

/**
 * The `public.user_menus` fixture the receipt (menu 99) and payment (menu 100)
 * suites share. Since notes (62) D2 every route of both screens is judged on
 * the caller's row for its menu, and tester1 — the caller every suite stubs —
 * holds none. So a suite grants tester1 all eleven flags on the menus it
 * drives before its first request, and puts back exactly what was there after
 * its last: a row it inserted is deleted, a row it found gets its old flags
 * again. These are the fixture, not a bypass; the real `loadRights()` reads
 * them. The sales harness (`test/sales/sales-e2e.harness.ts`) does the same.
 *
 * Run with `--runInBand`: two suites granting and restoring one row at once
 * would put back each other's flags.
 */

/** tester1 (SUPER ADMIN) — every e2e suite's stubbed caller. */
export const TESTER1 = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

/** Issued Cheques — Stop / Void / Replace are judged on it (issued-cheques.service.ts). */
export const ISSUED_CHEQUES_MENU = 52;
export const RECEIPT_MENU = 99;
export const PAYMENT_MENU = 100;

const FLAGS = [
  'um_can_view',
  'um_can_create',
  'um_can_edit',
  'um_can_delete',
  'um_can_print',
  'um_can_export',
  'um_can_post',
  'um_can_cancel',
  'um_can_amend',
  'um_can_override',
  'um_can_retender',
] as const;
type Flag = (typeof FLAGS)[number];

export interface MenuRightsMemo {
  inserted: string[];
  restored: { umId: string; flags: Record<Flag, boolean | null> }[];
}

export async function grantMenuRights(
  prisma: PrismaClient,
  menuIds: readonly number[],
  userId = TESTER1,
): Promise<MenuRightsMemo> {
  const memo: MenuRightsMemo = { inserted: [], restored: [] };
  for (const menuId of menuIds) {
    const rows = await prisma.$queryRawUnsafe<({ um_id: string } & Record<Flag, boolean | null>)[]>(
      `SELECT um_id, ${FLAGS.join(', ')}
         FROM public.user_menus
        WHERE um_user_id = $1::uuid AND um_menu_id = $2::int AND um_is_deleted = false
        LIMIT 1`,
      userId,
      menuId,
    );
    if (rows[0]) {
      const flags = Object.fromEntries(FLAGS.map((flag) => [flag, rows[0][flag]])) as Record<
        Flag,
        boolean | null
      >;
      memo.restored.push({ umId: rows[0].um_id, flags });
      await prisma.$executeRawUnsafe(
        `UPDATE public.user_menus SET ${FLAGS.map((flag) => `${flag} = true`).join(', ')}
          WHERE um_id = $1::uuid`,
        rows[0].um_id,
      );
      continue;
    }
    const [created] = await prisma.$queryRawUnsafe<{ um_id: string }[]>(
      `INSERT INTO public.user_menus (um_user_id, um_menu_id, ${FLAGS.join(', ')}, um_created_by)
       VALUES ($1::uuid, $2::int, ${FLAGS.map(() => 'true').join(', ')}, $1::uuid)
       RETURNING um_id`,
      userId,
      menuId,
    );
    memo.inserted.push(created.um_id);
  }
  return memo;
}

export async function restoreMenuRights(
  prisma: PrismaClient,
  memo: MenuRightsMemo | null | undefined,
): Promise<void> {
  if (!memo) {
    return;
  }
  for (const umId of memo.inserted) {
    await prisma.$executeRawUnsafe(`DELETE FROM public.user_menus WHERE um_id = $1::uuid`, umId);
  }
  for (const row of memo.restored) {
    await prisma.$executeRawUnsafe(
      `UPDATE public.user_menus SET ${FLAGS.map((flag, i) => `${flag} = $${i + 2}`).join(', ')}
        WHERE um_id = $1::uuid`,
      row.umId,
      ...FLAGS.map((flag) => row.flags[flag]),
    );
  }
}
