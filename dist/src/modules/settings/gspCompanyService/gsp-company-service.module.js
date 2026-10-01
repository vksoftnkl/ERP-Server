"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GspCompanyServiceModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const gsp_company_service_controller_1 = require("./gsp-company-service.controller");
const gsp_company_service_exception_filter_1 = require("./gsp-company-service-exception.filter");
const gsp_company_service_service_1 = require("./gsp-company-service.service");
let GspCompanyServiceModule = class GspCompanyServiceModule {
};
exports.GspCompanyServiceModule = GspCompanyServiceModule;
exports.GspCompanyServiceModule = GspCompanyServiceModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [gsp_company_service_controller_1.GspCompanyServiceController],
        providers: [gsp_company_service_service_1.GspCompanyServiceService, gsp_company_service_exception_filter_1.GspCompanyServiceExceptionFilter],
    })
], GspCompanyServiceModule);
//# sourceMappingURL=gsp-company-service.module.js.map