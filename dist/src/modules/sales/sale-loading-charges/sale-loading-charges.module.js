"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleLoadingChargeModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const sale_loading_charges_controller_1 = require("./sale-loading-charges.controller");
const sale_loading_charges_exception_filter_1 = require("./sale-loading-charges-exception.filter");
const sale_loading_charges_service_1 = require("./sale-loading-charges.service");
let SaleLoadingChargeModule = class SaleLoadingChargeModule {
};
exports.SaleLoadingChargeModule = SaleLoadingChargeModule;
exports.SaleLoadingChargeModule = SaleLoadingChargeModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [sale_loading_charges_controller_1.SaleLoadingChargeController],
        providers: [sale_loading_charges_service_1.SaleLoadingChargeService, sale_loading_charges_exception_filter_1.SaleLoadingChargeExceptionFilter],
    })
], SaleLoadingChargeModule);
//# sourceMappingURL=sale-loading-charges.module.js.map