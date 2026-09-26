"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpeningStockVoucherModule = void 0;
const common_1 = require("@nestjs/common");
const selling_price_bulk_module_1 = require("../selling-price-bulk/selling-price-bulk.module");
const stock_voucher_module_1 = require("../stock-voucher/stock-voucher.module");
const opening_stock_lookup_service_1 = require("./opening-stock-lookup.service");
const opening_stock_voucher_controller_1 = require("./opening-stock-voucher.controller");
let OpeningStockVoucherModule = class OpeningStockVoucherModule {
};
exports.OpeningStockVoucherModule = OpeningStockVoucherModule;
exports.OpeningStockVoucherModule = OpeningStockVoucherModule = __decorate([
    (0, common_1.Module)({
        imports: [stock_voucher_module_1.StockVoucherModule, selling_price_bulk_module_1.SellingPriceBulkModule],
        controllers: [opening_stock_voucher_controller_1.OpeningStockVoucherController],
        providers: [opening_stock_lookup_service_1.OpeningStockLookupService],
    })
], OpeningStockVoucherModule);
//# sourceMappingURL=opening-stock-voucher.module.js.map