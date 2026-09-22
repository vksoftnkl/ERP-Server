"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryChallanModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const charge_detail_module_1 = require("../../master/charge-detail/charge-detail.module");
const tender_detail_module_1 = require("../../accountsModule/tenderDetail/tender-detail.module");
const bill_module_1 = require("../bill/bill.module");
const posting_module_1 = require("../posting/posting.module");
const delivery_challan_controller_1 = require("./delivery-challan.controller");
const delivery_challan_exception_filter_1 = require("./delivery-challan-exception.filter");
const delivery_challan_service_1 = require("./delivery-challan.service");
let DeliveryChallanModule = class DeliveryChallanModule {
};
exports.DeliveryChallanModule = DeliveryChallanModule;
exports.DeliveryChallanModule = DeliveryChallanModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, charge_detail_module_1.ChargeDetailModule, tender_detail_module_1.TenderDetailModule, posting_module_1.SalesPostingModule, bill_module_1.BillModule],
        controllers: [delivery_challan_controller_1.DeliveryChallanController],
        providers: [delivery_challan_service_1.DeliveryChallanService, delivery_challan_exception_filter_1.DeliveryChallanExceptionFilter],
        exports: [delivery_challan_service_1.DeliveryChallanService],
    })
], DeliveryChallanModule);
//# sourceMappingURL=delivery-challan.module.js.map