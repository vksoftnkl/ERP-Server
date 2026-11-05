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
exports.TillContextService = exports.isUuid = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const rights_1 = require("../../common/posting/rights");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const app_setting_value_service_1 = require("../settings/appSettings/app-setting-value.service");
const till_settings_1 = require("./till.settings");
const till_enum_1 = require("./types/till-enum");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID.test(value);
exports.isUuid = isUuid;
let TillContextService = class TillContextService {
    prisma;
    requestContext;
    appSettings;
    constructor(prisma, requestContext, appSettings) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.appSettings = appSettings;
    }
    async caller(client) {
        const userId = this.requestContext.getUserId();
        const deviceId = this.requestContext.getDeviceId();
        return {
            userId: (0, exports.isUuid)(userId) ? userId : module_shared_utils_1.DEFAULT_ACTOR,
            actorName: await loginNameOf(client ?? this.prisma, userId),
            deviceId: (0, exports.isUuid)(deviceId) ? deviceId : null,
        };
    }
    async settings(scope) {
        const effective = await this.appSettings.resolveEffective({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId: (0, exports.isUuid)(scope.deviceId) ? scope.deviceId : null,
            userId: (0, exports.isUuid)(scope.userId) ? scope.userId : null,
        });
        return (0, till_settings_1.readTillSettings)(effective);
    }
    async requireRight(menuId, right, action) {
        return (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId,
            right,
            codePrefix: till_enum_1.TILL_RIGHT_CODE_PREFIX,
            action,
        });
    }
    async rights(menuId) {
        const userId = this.requestContext.getUserId();
        return (0, exports.isUuid)(userId) ? (0, rights_1.loadRights)(this.prisma, userId, menuId) : { ...rights_1.NO_RIGHTS };
    }
};
exports.TillContextService = TillContextService;
exports.TillContextService = TillContextService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService])
], TillContextService);
async function loginNameOf(client, userId) {
    if (!(0, exports.isUuid)(userId)) {
        return userId ?? module_shared_utils_1.DEFAULT_ACTOR;
    }
    const user = await client.userMaster.findUnique({
        where: { usrId: userId },
        select: { usrLoginName: true },
    });
    return user?.usrLoginName ?? userId;
}
//# sourceMappingURL=till-context.service.js.map