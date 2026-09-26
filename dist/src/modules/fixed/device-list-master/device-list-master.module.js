"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceListMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const device_list_master_controller_1 = require("./device-list-master.controller");
const device_list_master_exception_filter_1 = require("./device-list-master-exception.filter");
const device_list_master_service_1 = require("./device-list-master.service");
let DeviceListMasterModule = class DeviceListMasterModule {
};
exports.DeviceListMasterModule = DeviceListMasterModule;
exports.DeviceListMasterModule = DeviceListMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [device_list_master_controller_1.DeviceListMasterController],
        providers: [device_list_master_service_1.DeviceListMasterService, device_list_master_exception_filter_1.DeviceListMasterExceptionFilter],
    })
], DeviceListMasterModule);
//# sourceMappingURL=device-list-master.module.js.map