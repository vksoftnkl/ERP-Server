"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const company_master_controller_1 = require("./company-master.controller");
const company_master_exception_filter_1 = require("./company-master-exception.filter");
const company_master_service_1 = require("./company-master.service");
let CompanyMasterModule = class CompanyMasterModule {
};
exports.CompanyMasterModule = CompanyMasterModule;
exports.CompanyMasterModule = CompanyMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [company_master_controller_1.CompanyMasterController],
        providers: [company_master_service_1.CompanyMasterService, company_master_exception_filter_1.CompanyMasterExceptionFilter],
    })
], CompanyMasterModule);
//# sourceMappingURL=company-master.module.js.map