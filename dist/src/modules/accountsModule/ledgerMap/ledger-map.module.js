"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerMapModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const ledger_map_controller_1 = require("./ledger-map.controller");
const ledger_map_exception_filter_1 = require("./ledger-map-exception.filter");
const ledger_map_service_1 = require("./ledger-map.service");
let LedgerMapModule = class LedgerMapModule {
};
exports.LedgerMapModule = LedgerMapModule;
exports.LedgerMapModule = LedgerMapModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [ledger_map_controller_1.LedgerMapController],
        providers: [ledger_map_service_1.LedgerMapService, ledger_map_exception_filter_1.LedgerMapExceptionFilter],
    })
], LedgerMapModule);
//# sourceMappingURL=ledger-map.module.js.map