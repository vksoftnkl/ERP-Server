"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleAgentModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const account_ledger_masters_module_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.module");
const sale_agent_controller_1 = require("./sale-agent.controller");
const sale_agent_exception_filter_1 = require("./sale-agent-exception.filter");
const sale_agent_service_1 = require("./sale-agent.service");
let SaleAgentModule = class SaleAgentModule {
};
exports.SaleAgentModule = SaleAgentModule;
exports.SaleAgentModule = SaleAgentModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, account_ledger_masters_module_1.AccountLedgerMastersModule],
        controllers: [sale_agent_controller_1.SaleAgentController],
        providers: [sale_agent_service_1.SaleAgentService, sale_agent_exception_filter_1.SaleAgentExceptionFilter],
    })
], SaleAgentModule);
//# sourceMappingURL=sale-agent.module.js.map