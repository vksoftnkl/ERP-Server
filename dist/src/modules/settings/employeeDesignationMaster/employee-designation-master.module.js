"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeDesignationMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const employee_designation_master_controller_1 = require("./employee-designation-master.controller");
const employee_designation_master_exception_filter_1 = require("./employee-designation-master-exception.filter");
const employee_designation_master_service_1 = require("./employee-designation-master.service");
let EmployeeDesignationMasterModule = class EmployeeDesignationMasterModule {
};
exports.EmployeeDesignationMasterModule = EmployeeDesignationMasterModule;
exports.EmployeeDesignationMasterModule = EmployeeDesignationMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [employee_designation_master_controller_1.EmployeeDesignationMasterController],
        providers: [employee_designation_master_service_1.EmployeeDesignationMasterService, employee_designation_master_exception_filter_1.EmployeeDesignationMasterExceptionFilter],
    })
], EmployeeDesignationMasterModule);
//# sourceMappingURL=employee-designation-master.module.js.map