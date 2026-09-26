"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenderTypeMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const tender_type_master_controller_1 = require("./tender-type-master.controller");
const tender_type_master_exception_filter_1 = require("./tender-type-master-exception.filter");
const tender_type_master_service_1 = require("./tender-type-master.service");
let TenderTypeMasterModule = class TenderTypeMasterModule {
};
exports.TenderTypeMasterModule = TenderTypeMasterModule;
exports.TenderTypeMasterModule = TenderTypeMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [tender_type_master_controller_1.TenderTypeMasterController],
        providers: [tender_type_master_service_1.TenderTypeMasterService, tender_type_master_exception_filter_1.TenderTypeMasterExceptionFilter],
    })
], TenderTypeMasterModule);
//# sourceMappingURL=tender-type-master.module.js.map