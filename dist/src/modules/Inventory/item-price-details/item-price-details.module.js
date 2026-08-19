"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemPriceDetailsModule = void 0;
const common_1 = require("@nestjs/common");
const item_price_detail_exception_filter_1 = require("./item-price-detail-exception.filter");
const item_price_details_controller_1 = require("./item-price-details.controller");
const item_price_details_service_1 = require("./item-price-details.service");
const item_unit_conversion_module_1 = require("../item-unit-conversion/item-unit-conversion.module");
let ItemPriceDetailsModule = class ItemPriceDetailsModule {
};
exports.ItemPriceDetailsModule = ItemPriceDetailsModule;
exports.ItemPriceDetailsModule = ItemPriceDetailsModule = __decorate([
    (0, common_1.Module)({
        imports: [item_unit_conversion_module_1.ItemUnitConversionModule],
        controllers: [item_price_details_controller_1.ItemPriceDetailsController],
        providers: [item_price_details_service_1.ItemPriceDetailsService, item_price_detail_exception_filter_1.ItemPriceDetailExceptionFilter],
    })
], ItemPriceDetailsModule);
//# sourceMappingURL=item-price-details.module.js.map