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
exports.MobileMeService = exports.MOBILE_ME_MENUS = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const rights_1 = require("../../common/posting/rights");
const mobile_login_1 = require("../common/mobile-login");
const mobile_scope_1 = require("../common/mobile-scope");
exports.MOBILE_ME_MENUS = [11, 12, 99];
let MobileMeService = class MobileMeService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async me() {
        const userId = (0, mobile_scope_1.requireMobileLogin)(this.requestContextService.getUserId());
        const login = await (0, mobile_login_1.requireMobileLoginRow)(this.prisma, userId);
        const rights = {};
        for (const menuId of exports.MOBILE_ME_MENUS) {
            const held = await (0, rights_1.loadRights)(this.prisma, userId, menuId);
            rights[String(menuId)] = {
                view: held.view,
                create: held.create,
                post: held.post,
                cancel: held.cancel,
                print: held.print,
            };
        }
        return {
            userId: login.userId,
            loginName: login.loginName,
            employeeId: login.employeeId,
            employeeName: login.employeeName,
            rights,
        };
    }
};
exports.MobileMeService = MobileMeService;
exports.MobileMeService = MobileMeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], MobileMeService);
//# sourceMappingURL=mobile-me.service.js.map