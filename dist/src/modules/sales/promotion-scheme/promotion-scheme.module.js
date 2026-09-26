"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionSchemeModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const promotion_scheme_controller_1 = require("./promotion-scheme.controller");
const promotion_scheme_exception_filter_1 = require("./promotion-scheme-exception.filter");
const promotion_scheme_service_1 = require("./promotion-scheme.service");
let PromotionSchemeModule = class PromotionSchemeModule {
};
exports.PromotionSchemeModule = PromotionSchemeModule;
exports.PromotionSchemeModule = PromotionSchemeModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [promotion_scheme_controller_1.PromotionSchemeController],
        providers: [promotion_scheme_service_1.PromotionSchemeService, promotion_scheme_exception_filter_1.PromotionSchemeExceptionFilter],
        exports: [promotion_scheme_service_1.PromotionSchemeService],
    })
], PromotionSchemeModule);
//# sourceMappingURL=promotion-scheme.module.js.map