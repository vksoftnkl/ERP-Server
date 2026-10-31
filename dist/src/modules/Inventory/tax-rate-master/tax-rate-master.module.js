"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxRateMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const tax_rate_master_controller_1 = require("./tax-rate-master.controller");
const tax_rate_master_exception_filter_1 = require("./tax-rate-master-exception.filter");
const tax_rate_master_service_1 = require("./tax-rate-master.service");
let TaxRateMasterModule = class TaxRateMasterModule {
};
exports.TaxRateMasterModule = TaxRateMasterModule;
exports.TaxRateMasterModule = TaxRateMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [tax_rate_master_controller_1.TaxRateMasterController],
        providers: [tax_rate_master_service_1.TaxRateMasterService, tax_rate_master_exception_filter_1.TaxRateMasterExceptionFilter],
        exports: [tax_rate_master_service_1.TaxRateMasterService],
    })
], TaxRateMasterModule);
//# sourceMappingURL=tax-rate-master.module.js.map