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
var DatasetAdminGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetAdminGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const request_context_service_1 = require("../../../../../common/request-context/request-context.service");
const DEFAULT_ADMIN_USER_TYPES = ['SUPER_ADMIN'];
let DatasetAdminGuard = DatasetAdminGuard_1 = class DatasetAdminGuard {
    requestContext;
    logger = new common_1.Logger(DatasetAdminGuard_1.name);
    allowed;
    constructor(requestContext, config) {
        this.requestContext = requestContext;
        const configured = config.get('REPORT_DATASET_ADMIN_USER_TYPES');
        const types = configured
            ? configured
                .split(',')
                .map((value) => value.trim().toUpperCase())
                .filter(Boolean)
            : DEFAULT_ADMIN_USER_TYPES;
        this.allowed = new Set(types);
    }
    canActivate() {
        const userType = this.requestContext.getUserType();
        if (userType === null || !this.allowed.has(userType.toUpperCase())) {
            this.logger.warn(`Report dataset admin refused for user type '${userType ?? 'none'}' ` +
                `(user ${this.requestContext.getUserId() ?? 'unknown'})`);
            throw new common_1.ForbiddenException('Authoring report datasets requires a vendor administrator account.');
        }
        return true;
    }
};
exports.DatasetAdminGuard = DatasetAdminGuard;
exports.DatasetAdminGuard = DatasetAdminGuard = DatasetAdminGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [request_context_service_1.RequestContextService,
        config_1.ConfigService])
], DatasetAdminGuard);
//# sourceMappingURL=dataset-admin.guard.js.map