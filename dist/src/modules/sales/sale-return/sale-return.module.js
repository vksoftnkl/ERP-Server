"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleReturnModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const charge_detail_module_1 = require("../../master/charge-detail/charge-detail.module");
const tender_detail_module_1 = require("../../accountsModule/tenderDetail/tender-detail.module");
const posting_module_1 = require("../posting/posting.module");
const sale_return_controller_1 = require("./sale-return.controller");
const sale_return_exception_filter_1 = require("./sale-return-exception.filter");
const sale_return_service_1 = require("./sale-return.service");
let SaleReturnModule = class SaleReturnModule {
};
exports.SaleReturnModule = SaleReturnModule;
exports.SaleReturnModule = SaleReturnModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, charge_detail_module_1.ChargeDetailModule, tender_detail_module_1.TenderDetailModule, posting_module_1.SalesPostingModule],
        controllers: [sale_return_controller_1.SaleReturnController],
        providers: [sale_return_service_1.SaleReturnService, sale_return_exception_filter_1.SaleReturnExceptionFilter],
        exports: [sale_return_service_1.SaleReturnService],
    })
], SaleReturnModule);
//# sourceMappingURL=sale-return.module.js.map