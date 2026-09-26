import { Prisma } from '@prisma/client';

/**
 * The per-menu rights of `public.user_menus`, read in one round trip.
 *
 * Lifted from src/modules/sales/posting/sales.guards.ts for the Voucher
 * Register, which judges every one of its calls on the voucher TYPE's menu
 * (`acc_voucher_types.vchr_menu_id`, voucher_register.md §3). The six screen
 * verbs (view / create / edit / delete / print / export) sit beside the five
 * posting verbs (post / cancel / amend / override / retender) so one read
 * answers a `/get` and a `/post` alike.
 */
export type MenuRight =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'print'
  | 'export'
  | 'post'
  | 'cancel'
  | 'amend'
  | 'override'
  | 'retender';

export type MenuRights = Record<MenuRight, boolean>;

/** No row, no user, no rights. Spread it rather than re-listing the keys. */
export const NO_RIGHTS: Readonly<MenuRights> = Object.freeze({
  view: false,
  create: false,
  edit: false,
  delete: false,
  print: false,
  export: false,
  post: false,
  cancel: false,
  amend: false,
  override: false,
  retender: false,
});

/** The `user_menus` column behind each right, for a refusal that names it. */
export const RIGHT_COLUMN: Record<MenuRight, string> = {
  view: 'um_can_view',
  create: 'um_can_create',
  edit: 'um_can_edit',
  delete: 'um_can_delete',
  print: 'um_can_print',
  export: 'um_can_export',
  post: 'um_can_post',
  cancel: 'um_can_cancel',
  amend: 'um_can_amend',
  override: 'um_can_override',
  retender: 'um_can_retender',
};

type RightsClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

/**
 * Every flag for this user on this menu, in one read.
 *
 * No row means no rights. Defaulting a missing permission to TRUE is how a
 * permission system stops being one.
 */
export async function loadRights(
  client: RightsClient,
  userId: string,
  // `um_menu_id` is an INTEGER (fixed.menu_master.menu_id), not a uuid.
  menuId: number,
): Promise<MenuRights> {
  const rows = await client.$queryRaw<
    {
      um_can_view: boolean | null;
      um_can_create: boolean | null;
      um_can_edit: boolean | null;
      um_can_delete: boolean | null;
      um_can_print: boolean | null;
      um_can_export: boolean | null;
      um_can_post: boolean | null;
      um_can_cancel: boolean | null;
      um_can_amend: boolean | null;
      um_can_override: boolean | null;
      um_can_retender: boolean | null;
    }[]
  >`
    SELECT um_can_view, um_can_create, um_can_edit, um_can_delete, um_can_print, um_can_export,
           um_can_post, um_can_cancel, um_can_amend, um_can_override, um_can_retender
      FROM public.user_menus
     WHERE um_user_id    = ${userId}::uuid
       AND um_menu_id    = ${menuId}::int
       AND um_is_deleted = false
     LIMIT 1`;

  const row = rows[0];
  return {
    view: row?.um_can_view ?? false,
    create: row?.um_can_create ?? false,
    edit: row?.um_can_edit ?? false,
    delete: row?.um_can_delete ?? false,
    print: row?.um_can_print ?? false,
    export: row?.um_can_export ?? false,
    post: row?.um_can_post ?? false,
    cancel: row?.um_can_cancel ?? false,
    amend: row?.um_can_amend ?? false,
    override: row?.um_can_override ?? false,
    retender: row?.um_can_retender ?? false,
  };
}
