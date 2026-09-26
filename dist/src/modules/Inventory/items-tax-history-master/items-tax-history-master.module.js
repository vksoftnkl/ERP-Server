"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsTaxHistoryMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const item_tax_history_exception_filter_1 = require("./item-tax-history-exception.filter");
const items_tax_history_master_controller_1 = require("./items-tax-history-master.controller");
const items_tax_history_master_service_1 = require("./items-tax-history-master.service");
let ItemsTaxHistoryMasterModule = class ItemsTaxHistoryMasterModule {
};
exports.ItemsTaxHistoryMasterModule = ItemsTaxHistoryMasterModule;
exports.ItemsTaxHistoryMasterModule = ItemsTaxHistoryMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [items_tax_history_master_controller_1.ItemsTaxHistoryMasterController],
        providers: [items_tax_history_master_service_1.ItemsTaxHistoryMasterService, item_tax_history_exception_filter_1.ItemTaxHistoryExceptionFilter],
    })
], ItemsTaxHistoryMasterModule);
//# sourceMappingURL=items-tax-history-master.module.js.map