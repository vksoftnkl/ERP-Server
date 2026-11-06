"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemQtyRatesExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const selling_price_bulk_exception_filter_1 = require("../../stocks/selling-price-bulk/selling-price-bulk-exception.filter");
let ItemQtyRatesExceptionFilter = class ItemQtyRatesExceptionFilter extends selling_price_bulk_exception_filter_1.SellingPriceBulkExceptionFilter {
};
exports.ItemQtyRatesExceptionFilter = ItemQtyRatesExceptionFilter;
exports.ItemQtyRatesExceptionFilter = ItemQtyRatesExceptionFilter = __decorate([
    (0, common_1.Catch)()
], ItemQtyRatesExceptionFilter);
//# sourceMappingURL=item-qty-rates-exception.filter.js.map