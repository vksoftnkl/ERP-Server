"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callerIsSuperAdmin = callerIsSuperAdmin;
const user_administration_enum_1 = require("./types/user-administration.enum");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function callerIsSuperAdmin(client, userId) {
    if (!userId || !UUID.test(userId)) {
        return false;
    }
    const user = await client.userMaster.findFirst({
        where: { usrId: userId, usrIsActive: true, usrIsDeleted: false },
        select: { usrType: true },
    });
    return user?.usrType === user_administration_enum_1.UserType.SUPER_ADMIN;
}
//# sourceMappingURL=super-admin.js.map