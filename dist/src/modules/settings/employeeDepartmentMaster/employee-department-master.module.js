"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeDepartmentMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const employee_department_master_controller_1 = require("./employee-department-master.controller");
const employee_department_master_exception_filter_1 = require("./employee-department-master-exception.filter");
const employee_department_master_service_1 = require("./employee-department-master.service");
let EmployeeDepartmentMasterModule = class EmployeeDepartmentMasterModule {
};
exports.EmployeeDepartmentMasterModule = EmployeeDepartmentMasterModule;
exports.EmployeeDepartmentMasterModule = EmployeeDepartmentMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [employee_department_master_controller_1.EmployeeDepartmentMasterController],
        providers: [employee_department_master_service_1.EmployeeDepartmentMasterService, employee_department_master_exception_filter_1.EmployeeDepartmentMasterExceptionFilter],
    })
], EmployeeDepartmentMasterModule);
//# sourceMappingURL=employee-department-master.module.js.map