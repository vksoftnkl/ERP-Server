"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionAdminGuard = exports.ReleaseAccess = exports.APP_VERSION_ACCESS_KEY = void 0;
exports.actorOf = actorOf;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const app_version_constants_1 = require("../app-version.constants");
const app_version_error_codes_1 = require("../types/app-version-error-codes");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
exports.APP_VERSION_ACCESS_KEY = 'appVersionAccess';
const ReleaseAccess = () => (0, common_1.SetMetadata)(exports.APP_VERSION_ACCESS_KEY, 'release');
exports.ReleaseAccess = ReleaseAccess;
const ROLES = {
    admin: app_version_constants_1.APP_VERSION_ADMIN_TYPES,
    release: app_version_constants_1.APP_VERSION_RELEASE_TYPES,
};
let AppVersionAdminGuard = class AppVersionAdminGuard {
    prisma;
    reflector;
    constructor(prisma, reflector) {
        this.prisma = prisma;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const access = this.reflector.getAllAndOverride(exports.APP_VERSION_ACCESS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) ?? 'admin';
        const allowed = ROLES[access];
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.sub;
        if (typeof userId === 'string' && UUID.test(userId)) {
            const user = await this.prisma.userMaster.findFirst({
                where: { usrId: userId, usrIsActive: true, usrIsDeleted: false },
                select: { usrType: true },
            });
            const role = user?.usrType?.trim().toUpperCase() ?? '';
            if (allowed.includes(role)) {
                return true;
            }
        }
        throw new common_1.ForbiddenException((0, app_version_error_codes_1.appVersionErrorBody)(`Only a ${allowed.join(' / ')} user may use this route`, 'authorization', app_version_error_codes_1.AppVersionErrorCode.ADMIN_ONLY));
    }
};
exports.AppVersionAdminGuard = AppVersionAdminGuard;
exports.AppVersionAdminGuard = AppVersionAdminGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        core_1.Reflector])
], AppVersionAdminGuard);
function actorOf(request) {
    const userId = request.user?.sub;
    return typeof userId === 'string' && userId.length > 0 ? userId : 'unknown';
}
//# sourceMappingURL=app-version-admin.guard.js.map