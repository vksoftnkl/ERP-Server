"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const account_ledger_masters_module_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.module");
const customer_controller_1 = require("./customer.controller");
const customer_exception_filter_1 = require("./customer-exception.filter");
const customer_service_1 = require("./customer.service");
let CustomerModule = class CustomerModule {
};
exports.CustomerModule = CustomerModule;
exports.CustomerModule = CustomerModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, account_ledger_masters_module_1.AccountLedgerMastersModule],
        controllers: [customer_controller_1.CustomerController],
        providers: [customer_service_1.CustomerService, customer_exception_filter_1.CustomerExceptionFilter],
    })
], CustomerModule);
//# sourceMappingURL=customer.module.js.map