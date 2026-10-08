"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppThemeModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const app_theme_controller_1 = require("./app-theme.controller");
const app_theme_exception_filter_1 = require("./app-theme-exception.filter");
const app_theme_service_1 = require("./app-theme.service");
let AppThemeModule = class AppThemeModule {
};
exports.AppThemeModule = AppThemeModule;
exports.AppThemeModule = AppThemeModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [app_theme_controller_1.AppThemeController],
        providers: [app_theme_service_1.AppThemeService, app_theme_exception_filter_1.AppThemeExceptionFilter],
        exports: [app_theme_service_1.AppThemeService],
    })
], AppThemeModule);
//# sourceMappingURL=app-theme.module.js.map