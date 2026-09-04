"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintTemplateAssignmentModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const print_template_assignment_controller_1 = require("./print-template-assignment.controller");
const print_template_assignment_exception_filter_1 = require("./print-template-assignment-exception.filter");
const print_template_assignment_service_1 = require("./print-template-assignment.service");
let PrintTemplateAssignmentModule = class PrintTemplateAssignmentModule {
};
exports.PrintTemplateAssignmentModule = PrintTemplateAssignmentModule;
exports.PrintTemplateAssignmentModule = PrintTemplateAssignmentModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [print_template_assignment_controller_1.PrintTemplateAssignmentController],
        providers: [print_template_assignment_service_1.PrintTemplateAssignmentService, print_template_assignment_exception_filter_1.PrintTemplateAssignmentExceptionFilter],
        exports: [print_template_assignment_service_1.PrintTemplateAssignmentService],
    })
], PrintTemplateAssignmentModule);
//# sourceMappingURL=print-template-assignment.module.js.map