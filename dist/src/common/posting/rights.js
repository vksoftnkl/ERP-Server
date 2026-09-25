"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RIGHT_COLUMN = exports.NO_RIGHTS = void 0;
exports.loadRights = loadRights;
exports.NO_RIGHTS = Object.freeze({
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
exports.RIGHT_COLUMN = {
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
async function loadRights(client, userId, menuId) {
    const rows = await client.$queryRaw `
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
//# sourceMappingURL=rights.js.map