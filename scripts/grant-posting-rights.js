#!/usr/bin/env node
'use strict';

/**
 * Grant the five transaction rights on the posting menus a login needs.
 *
 *   node scripts/grant-posting-rights.js <login> [menuId ...]
 *   node scripts/grant-posting-rights.js ravi              # the sales chain
 *   node scripts/grant-posting-rights.js ravi 12           # Sales Entry alone
 *   node scripts/grant-posting-rights.js ravi --revoke 12
 *
 * WHY THIS EXISTS. `um_can_post` / `_cancel` / `_amend` / `_override` /
 * `_retender` are NOT NULL DEFAULT false and were unreachable from the API
 * until the five reached `SaveUserMenuDto`, so every one of the rows sat at the
 * default and nobody could post anything. The DTOs are fixed; somebody still
 * has to make the first grant, and until the user-administration screen ships
 * its checkbox column this is that somebody.
 *
 * IT IS ADDITIVE, AND THAT IS THE POINT. A `menus[]` save through the API is a
 * FULL REPLACE — send it a short list and it soft-deletes everything else the
 * user had. This touches ONE row per menu named on the command line and leaves
 * the rest of the grid exactly as it found it, which is what you want when the
 * login you are fixing has 219 menus.
 *
 * IT IS ALSO NO LONGER FRAGILE. Before the DTO fix a hand-grant survived only
 * until the next save from the user admin screen, which silently wrote the five
 * back to false because it did not know about them. It now sends all eleven
 * flags, so a grant made here survives an ordinary save.
 *
 * A menu only gets the rights its OWN capability allows: `menu_verbs` says what
 * a screen can do, and granting RETENDER on a screen that cannot re-tender is
 * the same lie the permissions grid used to tell. Refused, with the reason.
 */

const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

/** The sales chain, which is what the bill screen needs to be driven end to end. */
const DEFAULT_MENUS = [
  11, // Sales Order
  12, // Sales Entry      — the only screen that can re-tender
  13, // Sales Return
  182, // Deliver Note    — delivery challan AND DC return
];

const RIGHTS = [
  ['umCanPost', 'POST'],
  ['umCanCancel', 'CANCEL'],
  ['umCanAmend', 'AMEND'],
  ['umCanOverride', 'OVERRIDE'],
  ['umCanRetender', 'RETENDER'],
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const revoke = args.includes('--revoke');
  const rest = args.filter((a) => a !== '--revoke');
  const login = rest[0];
  const menus = rest.slice(1).map(Number).filter(Number.isInteger);
  return { login, menuIds: menus.length ? menus : DEFAULT_MENUS, revoke };
}

async function main() {
  const { login, menuIds, revoke } = parseArgs(process.argv);
  if (!login) {
    console.error('usage: node scripts/grant-posting-rights.js <login> [menuId ...] [--revoke]');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.userMaster.findFirst({
    where: { usrLoginName: login, usrIsDeleted: false },
    select: { usrId: true, usrLoginName: true, usrDisplayName: true },
  });
  if (!user) {
    console.error(`No active user with login "${login}".`);
    process.exitCode = 1;
    return;
  }

  // What each named screen can actually DO. A right the menu has no verb for is
  // refused rather than written: see the note at the top.
  const menus = await prisma.menu.findMany({
    where: { menuId: { in: menuIds }, menuIsActive: true },
    select: { menuId: true, menuName: true, menuVerbs: true },
  });
  const missing = menuIds.filter((id) => !menus.some((m) => m.menuId === id));
  if (missing.length) {
    console.error(`No active menu: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${revoke ? 'Revoking' : 'Granting'} for ${user.usrLoginName} (${user.usrId})\n`);
  const now = new Date();

  for (const menu of menus) {
    const verbs = new Set(menu.menuVerbs);
    const data = {};
    const applied = [];
    const skipped = [];
    for (const [field, verb] of RIGHTS) {
      if (verbs.has(verb)) {
        data[field] = !revoke;
        applied.push(verb);
      } else {
        skipped.push(verb);
      }
    }

    if (applied.length === 0) {
      console.log(`  ${String(menu.menuId).padStart(4)} ${menu.menuName.padEnd(26)} — nothing to grant (verbs: ${menu.menuVerbs.join(', ')})`);
      continue;
    }

    // upsert, not update: a login with no row for this menu gets one, and
    // um_can_view comes with it or the screen is granted rights it cannot reach.
    await prisma.userMenus.upsert({
      where: { uq_user_menus_user_menu: { umUserId: user.usrId, umMenuId: menu.menuId } },
      create: {
        umUserId: user.usrId,
        umMenuId: menu.menuId,
        umCanView: true,
        ...data,
        umCreatedOn: now,
        umCreatedBy: user.usrId,
      },
      update: {
        ...data,
        umIsDeleted: false,
        umModifiedOn: now,
        umModifiedBy: user.usrId,
      },
    });

    const note = skipped.length ? `   (not applicable: ${skipped.join(', ')})` : '';
    console.log(`  ${String(menu.menuId).padStart(4)} ${menu.menuName.padEnd(26)} ${applied.join(', ')}${note}`);
  }

  const after = await prisma.userMenus.findMany({
    where: { umUserId: user.usrId, umMenuId: { in: menuIds }, umIsDeleted: false },
    select: {
      umMenuId: true,
      umCanPost: true,
      umCanCancel: true,
      umCanAmend: true,
      umCanOverride: true,
      umCanRetender: true,
    },
    orderBy: { umMenuId: 'asc' },
  });
  console.log('\nnow:');
  for (const row of after) {
    const on = RIGHTS.filter(([f]) => row[f]).map(([, v]) => v);
    console.log(`  ${String(row.umMenuId).padStart(4)}  ${on.length ? on.join(', ') : '(none)'}`);
  }
  console.log('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
