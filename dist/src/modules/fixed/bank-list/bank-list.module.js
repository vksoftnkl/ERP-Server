"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankListModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const bank_list_controller_1 = require("./bank-list.controller");
const bank_list_exception_filter_1 = require("./bank-list-exception.filter");
const bank_list_service_1 = require("./bank-list.service");
let BankListModule = class BankListModule {
};
exports.BankListModule = BankListModule;
exports.BankListModule = BankListModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [bank_list_controller_1.BankListController],
        providers: [bank_list_service_1.BankListService, bank_list_exception_filter_1.BankListExceptionFilter],
    })
], BankListModule);
//# sourceMappingURL=bank-list.module.js.map