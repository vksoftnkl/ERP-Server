"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemQtyRatesModule = void 0;
const common_1 = require("@nestjs/common");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const cost_price_bulk_module_1 = require("../../stocks/cost-price-bulk/cost-price-bulk.module");
const selling_price_bulk_module_1 = require("../../stocks/selling-price-bulk/selling-price-bulk.module");
const items_qty_price_master_module_1 = require("../items-qty-price-master/items-qty-price-master.module");
const item_qty_rates_exception_filter_1 = require("./item-qty-rates-exception.filter");
const item_qty_rates_controller_1 = require("./item-qty-rates.controller");
const item_qty_rates_gateway_1 = require("./item-qty-rates.gateway");
const item_qty_rates_service_1 = require("./item-qty-rates.service");
let ItemQtyRatesModule = class ItemQtyRatesModule {
};
exports.ItemQtyRatesModule = ItemQtyRatesModule;
exports.ItemQtyRatesModule = ItemQtyRatesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            items_qty_price_master_module_1.ItemsQtyPriceMasterModule,
            selling_price_bulk_module_1.SellingPriceBulkModule,
            cost_price_bulk_module_1.CostPriceBulkModule,
            app_settings_module_1.AppSettingsModule,
        ],
        controllers: [item_qty_rates_controller_1.ItemQtyRatesController],
        providers: [item_qty_rates_service_1.ItemQtyRatesService, item_qty_rates_gateway_1.ItemQtyRatesGateway, item_qty_rates_exception_filter_1.ItemQtyRatesExceptionFilter],
    })
], ItemQtyRatesModule);
//# sourceMappingURL=item-qty-rates.module.js.map