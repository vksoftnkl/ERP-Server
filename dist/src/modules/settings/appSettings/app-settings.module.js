"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppSettingsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const app_setting_value_controller_1 = require("./app-setting-value.controller");
const app_setting_value_service_1 = require("./app-setting-value.service");
const app_settings_exception_filter_1 = require("./app-settings-exception.filter");
let AppSettingsModule = class AppSettingsModule {
};
exports.AppSettingsModule = AppSettingsModule;
exports.AppSettingsModule = AppSettingsModule = __decorate([
    (0, common_1.Module)({
        controllers: [app_setting_value_controller_1.AppSettingValueController],
        imports: [audit_log_module_1.AuditLogModule],
        providers: [app_setting_value_service_1.AppSettingValueService, app_settings_exception_filter_1.AppSettingsExceptionFilter],
        exports: [app_setting_value_service_1.AppSettingValueService],
    })
], AppSettingsModule);
//# sourceMappingURL=app-settings.module.js.map