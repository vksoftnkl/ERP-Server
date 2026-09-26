"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsTaxMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const item_tax_exception_filter_1 = require("./item-tax-exception.filter");
const items_tax_master_controller_1 = require("./items-tax-master.controller");
const items_tax_master_service_1 = require("./items-tax-master.service");
let ItemsTaxMasterModule = class ItemsTaxMasterModule {
};
exports.ItemsTaxMasterModule = ItemsTaxMasterModule;
exports.ItemsTaxMasterModule = ItemsTaxMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [items_tax_master_controller_1.ItemsTaxMasterController],
        providers: [items_tax_master_service_1.ItemsTaxMasterService, item_tax_exception_filter_1.ItemTaxExceptionFilter],
    })
], ItemsTaxMasterModule);
//# sourceMappingURL=items-tax-master.module.js.map