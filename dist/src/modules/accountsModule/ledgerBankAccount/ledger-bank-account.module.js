"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerBankAccountModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const ledger_bank_account_controller_1 = require("./ledger-bank-account.controller");
const ledger_bank_account_exception_filter_1 = require("./ledger-bank-account-exception.filter");
const ledger_bank_account_service_1 = require("./ledger-bank-account.service");
let LedgerBankAccountModule = class LedgerBankAccountModule {
};
exports.LedgerBankAccountModule = LedgerBankAccountModule;
exports.LedgerBankAccountModule = LedgerBankAccountModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [ledger_bank_account_controller_1.LedgerBankAccountController],
        providers: [ledger_bank_account_service_1.LedgerBankAccountService, ledger_bank_account_exception_filter_1.LedgerBankAccountExceptionFilter],
    })
], LedgerBankAccountModule);
//# sourceMappingURL=ledger-bank-account.module.js.map