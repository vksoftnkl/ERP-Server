"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const charge_detail_module_1 = require("../../master/charge-detail/charge-detail.module");
const tender_detail_module_1 = require("../../accountsModule/tenderDetail/tender-detail.module");
const bill_controller_1 = require("./bill.controller");
const bill_exception_filter_1 = require("./bill-exception.filter");
const bill_service_1 = require("./bill.service");
const sale_order_module_1 = require("../sale-order/sale-order.module");
let BillModule = class BillModule {
};
exports.BillModule = BillModule;
exports.BillModule = BillModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, charge_detail_module_1.ChargeDetailModule, tender_detail_module_1.TenderDetailModule, sale_order_module_1.SaleOrderModule],
        controllers: [bill_controller_1.BillController],
        providers: [bill_service_1.BillService, bill_exception_filter_1.BillExceptionFilter],
        exports: [bill_service_1.BillService],
    })
], BillModule);
//# sourceMappingURL=bill.module.js.map