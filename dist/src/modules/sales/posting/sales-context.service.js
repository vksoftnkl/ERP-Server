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
exports.SalesContextService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const sales_guards_1 = require("./sales.guards");
const sales_settings_1 = require("./sales.settings");
let SalesContextService = class SalesContextService {
    prisma;
    requestContext;
    appSettings;
    constructor(prisma, requestContext, appSettings) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.appSettings = appSettings;
    }
    actor() {
        return this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
    }
    async resolve(scope, menuId, client) {
        const userId = this.requestContext.getUserId();
        const effective = await this.appSettings.resolveEffective({
            companyId: scope.companyId,
            branchId: scope.branchId,
            deviceId: isUuid(scope.deviceId) ? scope.deviceId : null,
            userId: isUuid(userId) ? userId : null,
        });
        const settings = (0, sales_settings_1.readSalesSettings)(effective);
        const cogs = (effective.find((i) => i.asdKey === 'accounts.cogs_mode')?.value ?? '')
            .trim()
            .toUpperCase();
        const rights = isUuid(userId)
            ? await (0, sales_guards_1.loadRights)(client ?? this.prisma, userId, menuId)
            : { post: false, cancel: false, amend: false, override: false, retender: false };
        return {
            userId: userId ?? module_service_utils_1.DEFAULT_ACTOR,
            actor: userId ?? module_service_utils_1.DEFAULT_ACTOR,
            settings,
            cogsMode: cogs === 'PERIODIC' ? 'PERIODIC' : 'PERPETUAL',
            rights,
        };
    }
    async settings(companyId, branchId, deviceId) {
        const effective = await this.appSettings.resolveEffective({
            companyId,
            branchId,
            deviceId: isUuid(deviceId) ? deviceId : null,
            userId: null,
        });
        return (0, sales_settings_1.readSalesSettings)(effective);
    }
    async setting(companyId, branchId, key) {
        const effective = await this.appSettings.resolveEffective({
            companyId,
            branchId,
            deviceId: null,
            userId: null,
        });
        return effective.find((i) => i.asdKey === key)?.value ?? null;
    }
    async rights(menuId, client) {
        const userId = this.requestContext.getUserId();
        if (!isUuid(userId)) {
            return { post: false, cancel: false, amend: false, override: false, retender: false };
        }
        return (0, sales_guards_1.loadRights)(client ?? this.prisma, userId, menuId);
    }
    hasRight(ctx, right) {
        return ctx.rights[right] === true;
    }
};
exports.SalesContextService = SalesContextService;
exports.SalesContextService = SalesContextService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService])
], SalesContextService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=sales-context.service.js.map