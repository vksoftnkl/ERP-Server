"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxnHoldModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const txn_hold_controller_1 = require("./txn-hold.controller");
const txn_hold_exception_filter_1 = require("./txn-hold-exception.filter");
const txn_hold_service_1 = require("./txn-hold.service");
let TxnHoldModule = class TxnHoldModule {
};
exports.TxnHoldModule = TxnHoldModule;
exports.TxnHoldModule = TxnHoldModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [txn_hold_controller_1.TxnHoldController],
        providers: [txn_hold_service_1.TxnHoldService, txn_hold_exception_filter_1.TxnHoldExceptionFilter],
        exports: [txn_hold_service_1.TxnHoldService],
    })
], TxnHoldModule);
//# sourceMappingURL=txn-hold.module.js.map