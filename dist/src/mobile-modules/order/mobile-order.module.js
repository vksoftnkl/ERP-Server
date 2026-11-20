"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileOrderModule = void 0;
const common_1 = require("@nestjs/common");
const sale_order_module_1 = require("../../modules/sales/sale-order/sale-order.module");
const app_settings_module_1 = require("../../modules/settings/appSettings/app-settings.module");
const sale_order_exception_filter_1 = require("../../modules/sales/sale-order/sale-order-exception.filter");
const mobile_order_controller_1 = require("./mobile-order.controller");
const mobile_order_service_1 = require("./mobile-order.service");
let MobileOrderModule = class MobileOrderModule {
};
exports.MobileOrderModule = MobileOrderModule;
exports.MobileOrderModule = MobileOrderModule = __decorate([
    (0, common_1.Module)({
        imports: [sale_order_module_1.SaleOrderModule, app_settings_module_1.AppSettingsModule],
        controllers: [mobile_order_controller_1.MobileOrderController],
        providers: [mobile_order_service_1.MobileOrderService, sale_order_exception_filter_1.SaleOrderExceptionFilter],
    })
], MobileOrderModule);
//# sourceMappingURL=mobile-order.module.js.map