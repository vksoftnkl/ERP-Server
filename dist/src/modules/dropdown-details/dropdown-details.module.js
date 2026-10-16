"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropdownDetailsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const dropdown_detail_exception_filter_1 = require("./dropdown-detail-exception.filter");
const dropdown_details_controller_1 = require("./dropdown-details.controller");
const dropdown_details_service_1 = require("./dropdown-details.service");
let DropdownDetailsModule = class DropdownDetailsModule {
};
exports.DropdownDetailsModule = DropdownDetailsModule;
exports.DropdownDetailsModule = DropdownDetailsModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [dropdown_details_controller_1.DropdownDetailsController],
        providers: [dropdown_details_service_1.DropdownDetailsService, dropdown_detail_exception_filter_1.DropdownDetailExceptionFilter],
    })
], DropdownDetailsModule);
//# sourceMappingURL=dropdown-details.module.js.map