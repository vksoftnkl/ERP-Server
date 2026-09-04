"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleOrderModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const charge_detail_module_1 = require("../../master/charge-detail/charge-detail.module");
const tender_detail_module_1 = require("../../accountsModule/tenderDetail/tender-detail.module");
const sale_order_controller_1 = require("./sale-order.controller");
const sale_order_exception_filter_1 = require("./sale-order-exception.filter");
const sale_order_service_1 = require("./sale-order.service");
let SaleOrderModule = class SaleOrderModule {
};
exports.SaleOrderModule = SaleOrderModule;
exports.SaleOrderModule = SaleOrderModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, charge_detail_module_1.ChargeDetailModule, tender_detail_module_1.TenderDetailModule],
        controllers: [sale_order_controller_1.SaleOrderController],
        providers: [sale_order_service_1.SaleOrderService, sale_order_exception_filter_1.SaleOrderExceptionFilter],
        exports: [sale_order_service_1.SaleOrderService],
    })
], SaleOrderModule);
//# sourceMappingURL=sale-order.module.js.map