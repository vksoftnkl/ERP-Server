"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsCustRatesMasterModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const item_cust_rate_exception_filter_1 = require("./item-cust-rate-exception.filter");
const items_cust_rates_master_controller_1 = require("./items-cust-rates-master.controller");
const items_cust_rates_master_service_1 = require("./items-cust-rates-master.service");
let ItemsCustRatesMasterModule = class ItemsCustRatesMasterModule {
};
exports.ItemsCustRatesMasterModule = ItemsCustRatesMasterModule;
exports.ItemsCustRatesMasterModule = ItemsCustRatesMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [items_cust_rates_master_controller_1.ItemsCustRatesMasterController],
        providers: [items_cust_rates_master_service_1.ItemsCustRatesMasterService, item_cust_rate_exception_filter_1.ItemCustRateExceptionFilter],
    })
], ItemsCustRatesMasterModule);
//# sourceMappingURL=items-cust-rates-master.module.js.map