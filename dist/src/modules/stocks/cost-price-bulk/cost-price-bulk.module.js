"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostPriceBulkModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const item_price_log_module_1 = require("../../Inventory/item-price-log/item-price-log.module");
const cost_price_bulk_exception_filter_1 = require("./cost-price-bulk-exception.filter");
const cost_price_bulk_controller_1 = require("./cost-price-bulk.controller");
const cost_price_bulk_gateway_1 = require("./cost-price-bulk.gateway");
const cost_price_bulk_service_1 = require("./cost-price-bulk.service");
let CostPriceBulkModule = class CostPriceBulkModule {
};
exports.CostPriceBulkModule = CostPriceBulkModule;
exports.CostPriceBulkModule = CostPriceBulkModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, app_settings_module_1.AppSettingsModule, item_price_log_module_1.ItemPriceLogModule],
        controllers: [cost_price_bulk_controller_1.CostPriceBulkController],
        providers: [cost_price_bulk_service_1.CostPriceBulkService, cost_price_bulk_gateway_1.CostPriceBulkGateway, cost_price_bulk_exception_filter_1.CostPriceBulkExceptionFilter],
        exports: [cost_price_bulk_gateway_1.CostPriceBulkGateway],
    })
], CostPriceBulkModule);
//# sourceMappingURL=cost-price-bulk.module.js.map