"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const configs_controller_1 = require("./configs.controller");
const configs_exception_filter_1 = require("./configs-exception.filter");
const configs_service_1 = require("./configs.service");
let ConfigsModule = class ConfigsModule {
};
exports.ConfigsModule = ConfigsModule;
exports.ConfigsModule = ConfigsModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [configs_controller_1.ConfigsController],
        providers: [configs_service_1.ConfigsService, configs_exception_filter_1.ConfigsExceptionFilter],
    })
], ConfigsModule);
//# sourceMappingURL=configs.module.js.map