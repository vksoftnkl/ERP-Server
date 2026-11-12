"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransporterModule = void 0;
const common_1 = require("@nestjs/common");
const party_module_1 = require("../../../common/party/party.module");
const account_ledger_masters_module_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.module");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const transporter_controller_1 = require("./transporter.controller");
const transporter_exception_filter_1 = require("./transporter-exception.filter");
const transporter_service_1 = require("./transporter.service");
let TransporterModule = class TransporterModule {
};
exports.TransporterModule = TransporterModule;
exports.TransporterModule = TransporterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, account_ledger_masters_module_1.AccountLedgerMastersModule, party_module_1.PartyModule],
        controllers: [transporter_controller_1.TransporterController],
        providers: [transporter_service_1.TransporterService, transporter_exception_filter_1.TransporterExceptionFilter],
    })
], TransporterModule);
//# sourceMappingURL=transporter.module.js.map