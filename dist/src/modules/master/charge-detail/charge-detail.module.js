"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargeDetailModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const charge_detail_controller_1 = require("./charge-detail.controller");
const charge_detail_exception_filter_1 = require("./charge-detail-exception.filter");
const charge_detail_service_1 = require("./charge-detail.service");
let ChargeDetailModule = class ChargeDetailModule {
};
exports.ChargeDetailModule = ChargeDetailModule;
exports.ChargeDetailModule = ChargeDetailModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [charge_detail_controller_1.ChargeDetailController],
        providers: [charge_detail_service_1.ChargeDetailService, charge_detail_exception_filter_1.ChargeDetailExceptionFilter],
        exports: [charge_detail_service_1.ChargeDetailService],
    })
], ChargeDetailModule);
//# sourceMappingURL=charge-detail.module.js.map