"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockAdjustmentModule = void 0;
const common_1 = require("@nestjs/common");
const app_settings_module_1 = require("../../settings/appSettings/app-settings.module");
const stock_voucher_module_1 = require("../stock-voucher/stock-voucher.module");
const stock_adjustment_controller_1 = require("./stock-adjustment.controller");
const stock_adjustment_service_1 = require("./stock-adjustment.service");
const stock_reasons_controller_1 = require("./stock-reasons.controller");
const stock_reasons_service_1 = require("./stock-reasons.service");
let StockAdjustmentModule = class StockAdjustmentModule {
};
exports.StockAdjustmentModule = StockAdjustmentModule;
exports.StockAdjustmentModule = StockAdjustmentModule = __decorate([
    (0, common_1.Module)({
        imports: [stock_voucher_module_1.StockVoucherModule, app_settings_module_1.AppSettingsModule],
        controllers: [stock_adjustment_controller_1.StockAdjustmentController, stock_reasons_controller_1.StockReasonsController],
        providers: [stock_adjustment_service_1.StockAdjustmentService, stock_reasons_service_1.StockReasonsService],
        exports: [stock_adjustment_service_1.StockAdjustmentService, stock_reasons_service_1.StockReasonsService],
    })
], StockAdjustmentModule);
//# sourceMappingURL=stock-adjustment.module.js.map