"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleOrderDeskModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const posting_module_1 = require("../posting/posting.module");
const sale_order_module_1 = require("../sale-order/sale-order.module");
const sale_order_desk_controller_1 = require("./sale-order-desk.controller");
const sale_order_desk_exception_filter_1 = require("./sale-order-desk-exception.filter");
const sale_order_desk_merge_service_1 = require("./sale-order-desk-merge.service");
const sale_order_desk_service_1 = require("./sale-order-desk.service");
let SaleOrderDeskModule = class SaleOrderDeskModule {
};
exports.SaleOrderDeskModule = SaleOrderDeskModule;
exports.SaleOrderDeskModule = SaleOrderDeskModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, posting_module_1.SalesPostingModule, sale_order_module_1.SaleOrderModule],
        controllers: [sale_order_desk_controller_1.SaleOrderDeskController],
        providers: [sale_order_desk_service_1.SaleOrderDeskService, sale_order_desk_merge_service_1.SaleOrderDeskMergeService, sale_order_desk_exception_filter_1.SaleOrderDeskExceptionFilter],
    })
], SaleOrderDeskModule);
//# sourceMappingURL=sale-order-desk.module.js.map